import Redis from 'ioredis'
import { spawn, spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
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

    // Discover GPUs (if any). Prefer env GPU_DEVICES, else probe nvidia-smi.
    function listGpuDevices() {
      const envList = (process.env.GPU_DEVICES || '').split(',').map(s => s.trim()).filter(Boolean)
      if (envList.length) return envList
      try {
        const out = spawnSync('nvidia-smi', ['-L'], { encoding: 'utf8' })
        if (out.status === 0 && typeof out.stdout === 'string') {
          return out.stdout.split('\n').map(l => (l.match(/^GPU\s+(\d+):/) || [])[1]).filter(Boolean)
        }
      } catch {}
      return []
    }
    const minerScriptPath = '/miner/vanity_farm.sh'
    const hasGpuMiner = fs.existsSync(minerScriptPath)
    const gpuDevices = hasGpuMiner ? listGpuDevices() : []
    const defaultCpuWorkers = Math.max(1, Math.floor((os.cpus()?.length || 2) / 2))
    const cpuWorkers = Math.max(1, Number(process.env.CPU_WORKERS) || defaultCpuWorkers)

    const miners = []
    const per = new Map() // pid -> { rate: number, attempts: number }
    let foundLine = null
    let finished = false

    function human(n) {
      const x = Number(n || 0)
      return x.toLocaleString('en-US')
    }

    async function publishAggregate() {
      let totalRate = 0
      let totalAttempts = 0
      for (const v of per.values()) {
        totalRate += v.rate || 0
        totalAttempts += v.attempts || 0
      }
      await redis.hset(`job:${jobId}:progress`, { rate: human(totalRate), attempts: human(totalAttempts) })
    }

    function wireMiner(miner) {
      miners.push(miner)
      per.set(miner.pid, { rate: 0, attempts: 0 })
      miner.stdout.on('data', async (buf) => {
        if (finished) return
        const line = buf.toString()
        const r = line.match(/Total RATE:\s*([\d,]+)\/sec/i)
        if (r) {
          const rate = parseInt(r[1].replace(/,/g, ''), 10)
          if (!Number.isNaN(rate)) {
            const st = per.get(miner.pid) || { rate: 0, attempts: 0 }
            st.rate = rate
            per.set(miner.pid, st)
            await publishAggregate()
          }
        }
        const a = line.match(/ATTEMPTS:\s*([\d,]+)/i)
        if (a) {
          const attempts = parseInt(a[1].replace(/,/g, ''), 10)
          if (!Number.isNaN(attempts)) {
            const st = per.get(miner.pid) || { rate: 0, attempts: 0 }
            st.attempts = attempts
            per.set(miner.pid, st)
            await publishAggregate()
          }
        }
        if (!foundLine && (/FOUND=/.test(line) || /MATCH FOUND/i.test(line))) {
          foundLine = line
          finished = true
          for (const m of miners) { try { m.kill('SIGTERM') } catch {} }
        }
      })
      miner.stderr.on('data', (d) => process.stderr.write(d))
    }

    // GPUs
    if (gpuDevices.length > 0) {
      for (const dev of gpuDevices) {
        const env = { ...process.env, CUDA_VISIBLE_DEVICES: dev }
        const miner = spawn(minerScriptPath, args, { stdio: ['ignore', 'pipe', 'pipe'], env })
        wireMiner(miner)
      }
    }
    // CPU workers (always at least one)
    for (let i = 0; i < cpuWorkers; i++) {
      const miner = spawn(process.execPath, ['miner/vanity.mjs', ...args], { stdio: ['ignore', 'pipe', 'pipe'] })
      wireMiner(miner)
    }

    // Wait for all miners to exit
    await Promise.all(miners.map(m => new Promise(res => m.on('close', res))))

    if (!foundLine) {
      await redis.hset(`job:${jobId}`, { status: 'failed' })
      console.error('No match found', jobId)
      continue
    }

    const address = foundLine.match(/r[1-9A-HJ-NP-Za-km-z]+/)?.[0] || ''
    const seed = (foundLine.split('|')[1] || '').trim()

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