import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { jobId } = req.query as { jobId?: string }
  return res.json({ status: 'queued', rate: '0', attempts: '0', jobId })
}

