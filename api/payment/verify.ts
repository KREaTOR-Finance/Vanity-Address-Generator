import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Client } from 'xrpl'
import Redis from 'ioredis'

const ALLOWED = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz'
const ok58 = (s?: string) => [...(s || '')].every((c) => ALLOWED.includes(c))

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
  try {
    const { txid } = (req.body || {}) as { txid?: string }
    if (!txid) return res.status(400).json({ error: 'Bad Request' })

    const XRPL_RPC = process.env.XRPL_RPC || 'wss://xrplcluster.com'
    const DEST = process.env.PAY_DEST_MAINNET || ''
    if (!DEST) return res.status(500).json({ error: 'server not configured' })

    const xrpl = new Client(XRPL_RPC)
    await xrpl.connect()
    let result: any
    for (let attempt = 0; attempt < 15; attempt++) {
      try {
        const r = await xrpl.request({ command: 'tx', transaction: txid })
        result = r.result
        if (result?.validated) break
      } catch {}
      await new Promise((r) => setTimeout(r, 2000))
    }
    await xrpl.disconnect()

    if (!result) return res.status(404).json({ error: 'tx not found' })
    if (!result.validated) return res.status(400).json({ error: 'tx not validated' })
    if (result.TransactionType !== 'Payment')
      return res.status(400).json({ error: 'not a payment' })
    if (result.Destination !== DEST)
      return res.status(400).json({ error: 'bad destination', expected: DEST, got: result.Destination })

    const memoHex = result.Memos?.[0]?.Memo?.MemoData
    if (!memoHex) return res.status(400).json({ error: 'missing memo' })
    let memo
    try {
      memo = JSON.parse(Buffer.from(memoHex, 'hex').toString('utf8'))
    } catch {
      return res.status(400).json({ error: 'bad memo json' })
    }

    const { intent, mode, prefix, suffix, len } = memo || {}
    if (intent !== 'vanity') return res.status(400).json({ error: 'bad intent' })

    const normalizedMode = mode === 'combo3x3' ? 'combo' : mode
    if (normalizedMode === 'prefix') {
      if (!(len >= 1 && len <= 6) || !ok58(prefix)) return res.status(400).json({ error: 'bad prefix' })
    } else if (normalizedMode === 'suffix') {
      if (!(len >= 1 && len <= 6) || !ok58(suffix)) return res.status(400).json({ error: 'bad suffix' })
    } else if (normalizedMode === 'combo') {
      if (!(prefix?.length === 3 && suffix?.length === 3) || !ok58(prefix + suffix))
        return res.status(400).json({ error: 'bad combo' })
    } else return res.status(400).json({ error: 'bad mode' })

    // For serverless minimal example, just echo a stub job
    const jobId = txid
    const deliverySecret = Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2)
    const redisUrl = process.env.REDIS_URL
    if (redisUrl) {
      const redis = new Redis(redisUrl)
      await redis.hset(`job:${jobId}`, {
        status: 'paid',
        txid: result.hash,
        mode: normalizedMode,
        prefix: prefix || '',
        suffix: suffix || '',
        len,
        algo: 'ed25519',
        deliverySecret,
        createdAt: Date.now().toString()
      })
      await redis.lpush('queue:vanity', jobId)
      await redis.quit()
    }
    const base = process.env.PUBLIC_BASE_URL || ''
    return res.json({ jobId, progressUrl: `${base}/api/progress/${jobId}`, deliveryUrl: `${base}/api/deliver/${jobId}?token=${deliverySecret}` })
  } catch (e: any) {
    return res.status(500).json({ error: 'verify failed' })
  }
}


