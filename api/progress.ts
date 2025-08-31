import type { VercelRequest, VercelResponse } from '@vercel/node'
import Redis from 'ioredis'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { jobId } = req.query as { jobId?: string }
  if (!jobId) return res.status(400).json({ error: 'bad request' })
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) return res.json({ status: 'queued', rate: '0', attempts: '0', jobId })
  const redis = new Redis(redisUrl)
  const meta = await redis.hgetall(`job:${jobId}`)
  const prog = await redis.hgetall(`job:${jobId}:progress`)
  await redis.quit()
  return res.json({ status: meta.status || 'unknown', rate: prog.rate || '0', attempts: prog.attempts || '0' })
}

