/// <reference lib="webworker" />
// Module worker bundled by Vite; avoids CDN usage.
import { Wallet } from 'xrpl'

let running = false

function generate(algo?: string) {
	if (algo === 'secp256k1') {
		return (Wallet as any).generate('ecdsa-secp256k1');
	}
	if (algo === 'ed25519') {
		return (Wallet as any).generate('ed25519');
	}
	return (Wallet as any).generate();
}

function matches(address: string, prefix: string, suffix: string, mode: 'prefix' | 'suffix' | 'combo3x3') {
	if (!address || address[0] !== 'r') return false;
	if (mode === 'prefix') {
		if (!prefix) return true;
		return address.slice(1).startsWith(prefix);
	}
	if (mode === 'suffix') {
		if (!suffix) return true;
		return address.endsWith(suffix);
	}
	if (mode === 'combo3x3') {
		const afterR = address.slice(1);
		const pre = (prefix || '').slice(0, 3);
		const suf = (suffix || '').slice(0, 3);
		if (pre && !afterR.startsWith(pre)) return false;
		if (suf && !address.endsWith(suf)) return false;
		return true;
	}
	return false;
}

self.onmessage = (ev: MessageEvent) => {
	const msg: any = ev.data;
	if (msg.type === 'start') {
		const prefix: string = msg.prefix || '';
		const suffix: string = msg.suffix || '';
		const mode: 'prefix' | 'suffix' | 'combo3x3' = msg.mode || 'prefix';
		const algorithm: string = msg.algorithm || 'ed25519';
		const reportEvery = Math.max(100, msg.reportEvery || 500);
		const debug = !!msg.debug;
		running = true;
		let attempts = 0;
		try {
			while (running) {
				const w = generate(algorithm);
				attempts += 1;
				if (debug && mode === 'prefix' && prefix) {
					const afterR = w.classicAddress.slice(1);
					if (afterR[0] === prefix[0]) {
						if (attempts % 200 === 0) {
							try { console.log('first-char', attempts, w.classicAddress); } catch {}
						}
					}
				}
				if (attempts % reportEvery === 0) {
					(self as any).postMessage({ type: 'progress', attempts });
				}
				if (matches(w.classicAddress, prefix, suffix, mode)) {
					if (debug && attempts <= reportEvery * 2) {
						try { console.log('match', w.classicAddress, { attempts, prefix, suffix, mode }); } catch {}
					}
					const foundResult = {
						address: w.classicAddress,
						seed: w.seed,
						publicKey: w.publicKey,
						privateKey: w.privateKey,
						algorithm,
					};
					(self as any).postMessage({ type: 'found', result: foundResult, attempts });
				}
				else if (debug && attempts <= reportEvery) {
					if (attempts % 100 === 0) {
						try { console.log('gen', attempts, w.classicAddress); } catch {}
					}
				}
			}
		} catch (e: any) {
			(self as any).postMessage({ type: 'error', error: String((e && e.message) || e) });
		}
	} else if (msg.type === 'stop') {
		running = false;
		try { (self as any).close(); } catch {}
	}
} 