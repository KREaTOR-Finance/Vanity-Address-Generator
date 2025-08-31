import Redis from 'ioredis'
import { spawn } from 'child_process'
import crypto from 'crypto'

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
const redis = new Redis(redisUrl)

function pbkdf2Key(secret, salt) {
  return crypto.pbkdf2Sync(secret, salt, 200_000, 32, 'sha256')
}
function aesEncryptJson(obj, key) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const pt = Buffer.from(JSON.stringify(obj))
  const ct = Buffer.concat([cipher.update(pt), cipher.final()])
  const tag = cipher.getAuthTag()
  return { iv: iv.toString('base64'), tag: tag.toString('base64'), ct: ct.toString('base64') }
}

async function loop() {
  for (;;) {
    const res = await redis.brpop('queue:vanity', 0)
    const jobId = res?.[1]
    if (!jobId) continue

    const meta = await redis.hgetall(`job:${jobId}`)
    if (!meta?.status) continue

    const { mode, prefix, suffix, len } = meta
    console.log('Job start', jobId, mode, prefix, suffix, len)

    const args = []
    if (mode === 'prefix') args.push('--prefix', prefix, '--len', String(len))
    else if (mode === 'suffix') args.push('--suffix', suffix, '--len', String(len))
    else if (mode === 'combo') args.push('--combo', prefix, suffix)

    const miner = spawn('/miner/vanity_farm.sh', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let found = null

    miner.stdout.on('data', async (buf) => {
      const line = buf.toString()
      const r = line.match(/Total RATE:\s*([\d,]+)\/sec/i)
      if (r) await redis.hset(`job:${jobId}:progress`, { rate: r[1] })
      const a = line.match(/ATTEMPTS:\s*([\d,]+)/i)
      if (a) await redis.hset(`job:${jobId}:progress`, { attempts: a[1] })
      if (/FOUND=/.test(line) || /MATCH FOUND/i.test(line)) found = line
    })
    miner.stderr.on('data', (d) => process.stderr.write(d))
    await new Promise((res) => miner.on('close', res))

    if (!found) {
      await redis.hset(`job:${jobId}`, { status: 'failed' })
      console.error('No match found', jobId)
      continue
    }

    const address = found.match(/r[1-9A-HJ-NP-Za-km-z]+/)?.[0] || ''
    const seed = (found.split('|')[1] || '').trim()

    const key = pbkdf2Key(meta.deliverySecret, jobId)
    const payload = { address, seed, algorithm: 'ed25519', receiptTx: meta.txid }
    const cipher = aesEncryptJson(payload, key)

    await redis.setex(`job:${jobId}:out`, 1800, JSON.stringify(cipher))
    await redis.hset(`job:${jobId}`, { status: 'complete' })
    await redis.del(`job:${jobId}:progress`)
    console.log('Job done', jobId)
  }
}

loop().catch(console.error) 