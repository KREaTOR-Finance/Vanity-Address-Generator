import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const dest = process.env.PAY_DEST_MAINNET || ''
  const base = process.env.PUBLIC_BASE_URL || ''
  return res.status(200).json({ dest, base })
}


