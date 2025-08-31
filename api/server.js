import Fastify from 'fastify'
import cors from '@fastify/cors'
import { Client } from 'xrpl'
import Redis from 'ioredis'
import { z } from 'zod'
import crypto from 'crypto'

const app = Fastify({ logger: true })
await app.register(cors, { origin: true })

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
const redis = new Redis(redisUrl)
const XRPL_RPC = process.env.XRPL_RPC || 'wss://xrplcluster.com'
const DEST = process.env.PAY_DEST_MAINNET || ''
const BASE = process.env.PUBLIC_BASE_URL || ''

const VerifyBody = z.object({ txid: z.string() })

const ALLOWED = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz'
const ok58 = (s) => [...(s || '')].every((c) => ALLOWED.includes(c))

app.post('/api/payment/verify', async (req, rep) => {
  try {
    const { txid } = VerifyBody.parse(req.body)
    if (!DEST) return rep.code(500).send({ error: 'server not configured' })

    const xrpl = new Client(XRPL_RPC)
    await xrpl.connect()
    let result
    // Retry up to ~30s for ledger inclusion (signed → validated)
    for (let attempt = 0; attempt < 15; attempt++) {
      try {
        const r = await xrpl.request({ command: 'tx', transaction: txid })
        result = r.result
        if (result?.validated) break
      } catch (e) {
        // txn not found yet → wait and retry
      }
      await new Promise(r => setTimeout(r, 2000))
    }
    await xrpl.disconnect()

    if (!result) return rep.code(404).send({ error: 'tx not found' })
    if (!result.validated) return rep.code(400).send({ error: 'tx not validated' })
    if (result.TransactionType !== 'Payment' || result.Destination !== DEST)
      return rep.code(400).send({ error: 'bad destination' })

    const memoHex = result.Memos?.[0]?.Memo?.MemoData
    if (!memoHex) return rep.code(400).send({ error: 'missing memo' })
    let memo
    try {
      memo = JSON.parse(Buffer.from(memoHex, 'hex').toString('utf8'))
    } catch {
      return rep.code(400).send({ error: 'bad memo json' })
    }

    const { intent, mode, prefix, suffix, len } = memo || {}
    if (intent !== 'vanity') return rep.code(400).send({ error: 'bad intent' })

    const normalizedMode = mode === 'combo3x3' ? 'combo' : mode
    if (normalizedMode === 'prefix') {
      if (!(len >= 1 && len <= 6) || !ok58(prefix)) return rep.code(400).send({ error: 'bad prefix' })
    } else if (normalizedMode === 'suffix') {
      if (!(len >= 1 && len <= 6) || !ok58(suffix)) return rep.code(400).send({ error: 'bad suffix' })
    } else if (normalizedMode === 'combo') {
      if (!(prefix?.length === 3 && suffix?.length === 3) || !ok58(prefix + suffix))
        return rep.code(400).send({ error: 'bad combo' })
    } else return rep.code(400).send({ error: 'bad mode' })

    const jobId = crypto.randomUUID()
    const deliverySecret = crypto.randomBytes(16).toString('hex')

    await redis.hset(`job:${jobId}`, {
      status: 'paid',
      txid: result.hash,
      mode: normalizedMode,
      prefix: prefix || '',
      suffix: suffix || '',
      len,
      algo: 'ed25519',
      deliverySecret,
      createdAt: Date.now()
    })
    await redis.lpush('queue:vanity', jobId)

    return {
      jobId,
      progressUrl: `${BASE}/api/progress/${jobId}`,
      deliveryUrl: `${BASE}/api/deliver/${jobId}?token=${deliverySecret}`
    }
  } catch (e) {
    app.log.error({ err: e }, 'verify failed')
    return rep.code(500).send({ error: 'verify failed' })
  }
})

app.get('/api/progress/:jobId', async (req, rep) => {
  const { jobId } = req.params
  const meta = await redis.hgetall(`job:${jobId}`)
  const prog = await redis.hgetall(`job:${jobId}:progress`)
  return {
    status: meta.status || 'unknown',
    rate: prog.rate || '0',
    attempts: prog.attempts || '0'
  }
})

app.get('/api/deliver/:jobId', async (req, rep) => {
  const { jobId } = req.params
  const { token } = req.query
  const h = await redis.hgetall(`job:${jobId}`)
  if (!h?.deliverySecret || token !== h.deliverySecret) return rep.code(403).send({ error: 'forbidden' })
  if (h.status !== 'complete') return rep.code(404).send({ error: 'not ready' })

  const ciphertext = await redis.get(`job:${jobId}:out`)
  if (!ciphertext) return rep.code(410).send({ error: 'gone' })

  await redis.del(`job:${jobId}:out`)
  await redis.hdel(`job:${jobId}`, 'deliverySecret')
  return rep.send({ cipher: JSON.parse(ciphertext), txid: h.txid })
})

app.listen({ port: 8080, host: '0.0.0.0' }) 