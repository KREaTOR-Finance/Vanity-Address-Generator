import type { VercelRequest, VercelResponse } from '@vercel/node'
import Redis from 'ioredis'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { jobId, token } = req.query as { jobId?: string; token?: string }
  if (!jobId) return res.status(400).json({ error: 'bad request' })
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) return res.status(404).json({ error: 'not ready' })
  const redis = new Redis(redisUrl)
  const meta = await redis.hgetall(`job:${jobId}`)
  if (!meta?.deliverySecret || token !== meta.deliverySecret) {
    await redis.quit()
    return res.status(403).json({ error: 'forbidden' })
  }
  const ciphertext = await redis.get(`job:${jobId}:out`)
  if (!ciphertext) {
    await redis.quit()
    return res.status(404).json({ error: 'not ready' })
  }
  await redis.del(`job:${jobId}:out`)
  await redis.hdel(`job:${jobId}`, 'deliverySecret')
  await redis.quit()
  return res.json({ cipher: JSON.parse(ciphertext), txid: meta.txid })
}

