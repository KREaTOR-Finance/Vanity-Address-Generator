import { Wallet } from 'xrpl'

function parseArgs(argv) {
  let mode = ''
  let prefix = ''
  let suffix = ''
  let len = 0
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--prefix') { mode = 'prefix'; prefix = String(argv[++i] ?? ''); }
    else if (a === '--suffix') { mode = 'suffix'; suffix = String(argv[++i] ?? ''); }
    else if (a === '--combo') { mode = 'combo'; prefix = String(argv[++i] ?? ''); suffix = String(argv[++i] ?? ''); }
    else if (a === '--len') { len = Number(argv[++i] ?? 0) || 0; }
  }
  return { mode, prefix, suffix, len }
}

function isMatch(address, { mode, prefix, suffix }) {
  if (!address || address[0] !== 'r') return false
  if (mode === 'prefix') {
    if (!prefix) return true
    return address.slice(1).startsWith(prefix)
  } else if (mode === 'suffix') {
    if (!suffix) return true
    return address.endsWith(suffix)
  } else if (mode === 'combo') {
    const afterR = address.slice(1)
    const pre = (prefix || '').slice(0, 3)
    const suf = (suffix || '').slice(0, 3)
    if (pre && !afterR.startsWith(pre)) return false
    if (suf && !address.endsWith(suf)) return false
    return true
  }
  return false
}

function formatInt(n) {
  try { return Number(n).toLocaleString('en-US') } catch { return String(n) }
}

async function main() {
  const { mode, prefix, suffix } = parseArgs(process.argv.slice(2))
  if (!mode) {
    console.error('Usage: node vanity.mjs --prefix <str> --len <n> | --suffix <str> --len <n> | --combo <pre> <suf>')
    process.exit(2)
  }

  let attempts = 0
  let lastAttempts = 0
  let lastTime = Date.now()
  const reportEvery = 1000

  for (;;) {
    // Generate ed25519 wallets (matches browser worker logic)
    const w = Wallet.generate('ed25519')
    attempts++

    if (attempts % reportEvery === 0) {
      const now = Date.now()
      const dt = Math.max(1, now - lastTime) / 1000
      const delta = Math.max(0, attempts - lastAttempts)
      const rate = Math.floor(delta / dt)
      process.stdout.write(`Total RATE: ${formatInt(rate)}/sec\n`)
      process.stdout.write(`ATTEMPTS: ${formatInt(attempts)}\n`)
      lastAttempts = attempts
      lastTime = now
    }

    if (isMatch(w.classicAddress, { mode, prefix, suffix })) {
      process.stdout.write(`FOUND=${w.classicAddress} | ${w.seed}\n`)
      process.exit(0)
    }
  }
}

main().catch((e) => {
  console.error('Miner error:', e && e.stack || e)
  process.exit(1)
})


