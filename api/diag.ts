import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const env = {
    dest: process.env.PAY_DEST_MAINNET || '',
    base: process.env.PUBLIC_BASE_URL || '',
    xrpl_rpc: process.env.XRPL_RPC || 'wss://xrplcluster.com',
    redis_url: process.env.REDIS_URL ? 'set' : 'not set'
  }
  return res.status(200).json(env)
}


