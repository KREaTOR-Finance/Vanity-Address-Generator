import { useEffect, useMemo, useRef, useState } from 'react';
import Controls from './components/Controls';
import Stats from './components/Stats';
import Result from './components/Result';
import Tips from './components/Tips';
import { createVanityWorker } from '../worker/createVanityWorker';
import type { KeyAlgorithm, VanityResult, WorkerOutMessage, VanityMode, Network } from '../types';
import { estimateEtaSeconds } from '../utils/eta';
import { buildVanityMemoHex } from '../utils/memo';
import { openXamanSign } from '../utils/xaman';
import { buildXrpPaymentPayload, buildIouPaymentPayload, ensureTrustline, PAYMENT_MODE, PRICE_DROPS } from '../utils/payments';
import { QRCodeCanvas } from 'qrcode.react';
import { deriveKeyPBKDF2, decryptCipher } from '../utils/decrypt';

function explorerTxUrl(hash: string, network: Network): string {
	if (network === 'testnet') return `https://testnet.xrpl.org/transactions/${hash}`;
	return `https://livenet.xrpl.org/transactions/${hash}`;
}

export default function App() {
	const [isRunning, setIsRunning] = useState(false);
	const [attempts, setAttempts] = useState(0);
	const [rate, setRate] = useState(0);
	const [result, setResult] = useState<VanityResult | null>(null);
	const [prefix, setPrefix] = useState('');
	const [suffix, setSuffix] = useState('');
	const [mode, setMode] = useState<VanityMode>('prefix');
	const [network, setNetwork] = useState<Network>('mainnet');
	const [receiptHash, setReceiptHash] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [revealOpen, setRevealOpen] = useState(false);
	const workersRef = useRef<Worker[]>([]);
	const lastTickRef = useRef<number>(performance.now());
	const lastAttemptsRef = useRef<number>(0);
	const pollTimerRef = useRef<number | null>(null);
	const remoteJobRef = useRef<{ jobId: string; progressUrl: string; deliveryUrl: string } | null>(null);
	const workerLastAttemptsRef = useRef<number>(0);

	useEffect(() => {
		const id = window.setInterval(() => {
			const now = performance.now();
			const dt = (now - lastTickRef.current) / 1000;
			if (dt <= 0) return;
			const dAttempts = attempts - lastAttemptsRef.current;
			lastAttemptsRef.current = attempts;
			lastTickRef.current = now;
			setRate(dAttempts / dt);
		}, 1000);
		return () => window.clearInterval(id);
	}, [attempts]);

	const constraintLength = useMemo(() => {
		if (mode === 'prefix') return prefix.length;
		if (mode === 'suffix') return suffix.length;
		return Math.min(3, prefix.length) + Math.min(3, suffix.length);
	}, [mode, prefix, suffix]);

	const estimatedSeconds = useMemo(() => estimateEtaSeconds(constraintLength, rate), [constraintLength, rate]);

	function stopWorkers() {
		for (const w of workersRef.current) {
			try { w.postMessage({ type: 'stop' }); } catch {}
			try { w.terminate(); } catch {}
		}
		workersRef.current = [];
		setIsRunning(false);
		workerLastAttemptsRef.current = 0;
	}

	function stopPolling() {
		if (pollTimerRef.current) {
			window.clearInterval(pollTimerRef.current);
			pollTimerRef.current = null;
		}
		remoteJobRef.current = null;
	}

	function handleFound(m: WorkerOutMessage) {
		if (m.type === 'found') {
			const cur = Number(m.attempts) || 0;
			const prev = workerLastAttemptsRef.current || 0;
			const delta = Math.max(0, cur - prev);
			workerLastAttemptsRef.current = cur;
			if (delta > 0) setAttempts((a) => a + delta);
			setResult(m.result);
			stopWorkers();
			setRevealOpen(true);
		}
	}

	async function start(params: { prefix: string; suffix?: string; mode: VanityMode; algorithm: KeyAlgorithm; threads: number; network: Network; demoMode: boolean; }) {
		const { prefix: p, suffix: s, mode: m, algorithm, threads: t, network: net, demoMode } = params;
		const pClean = (p || '').trim().replace(/^r/i, '');
		const sClean = (s || '').trim();
		stopWorkers();
		stopPolling();
		setAttempts(0);
		setResult(null);
		setRate(0);
		setPrefix(pClean);
		setSuffix(sClean);
		setMode(m);
		setNetwork(net);
		setError(null);
		setReceiptHash(null);

		const constraintLen = m === 'prefix' ? pClean.length : m === 'suffix' ? sClean.length : Math.min(3, pClean.length) + Math.min(3, sClean.length);

		if (!demoMode) {
			const destination = net === 'testnet' ? (import.meta.env.VITE_PAY_DEST_TESTNET as string) : (import.meta.env.VITE_PAY_DEST_MAINNET as string);
			if (!destination) {
				setError('Missing payment destination env var');
				return;
			}
			const memo = buildVanityMemoHex({
				mode: m,
				prefix: pClean || undefined,
				suffix: sClean || undefined,
				constraintLen,
				algo: algorithm,
				network: net,
				app: 'xrpl-raddress-vanity',
				version: '0.1.0',
			});
			console.log('Built memo:', JSON.stringify(memo, null, 2));
			let pay;
			if (PAYMENT_MODE === 'XRP') {
				const tx = buildXrpPaymentPayload({ destination, amountDrops: PRICE_DROPS, memos: memo });
				pay = await openXamanSign(tx, { submit: true });
			} else {
				const issuer = (import.meta as any).env?.VITE_FIATCOIN_ISSUER as string;
				const currency = (import.meta as any).env?.VITE_FIATCOIN_CODE as string;
				if (!issuer || !currency) {
					setError('Missing IOU config');
					return;
				}

				const trust = ensureTrustline({ currency, issuer });
				await openXamanSign(trust, { submit: true });
				const iouTx = buildIouPaymentPayload({ destination, currency, issuer, value: '1', memos: memo });
				pay = await openXamanSign(iouTx, { submit: true });
			}
			if (!pay.success || !pay.hash) {
				setError(pay.error || 'Payment was not completed');
				return;
			}
			setReceiptHash(pay.hash);

			// Verify and enqueue with public API (retry while ledger validates)
			try {
				const base = (import.meta.env.VITE_PUBLIC_API_BASE as string) || '';
				const started = Date.now();
				let verifyOk = false;
				let lastErr: any = null;
				
				while (Date.now() - started < 20000) { // retry for up to 20 seconds
					const res = await fetch(`${base}/api/payment/verify`, {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ txid: pay.hash }),
					});
					
					if (res.ok) {
						const data: { jobId: string; progressUrl: string; deliveryUrl: string } = await res.json();
						remoteJobRef.current = data;
						setIsRunning(true);
						verifyOk = true;
						break;
					}
					
					const err = await res.json().catch(() => ({} as any));
					lastErr = err?.error || 'Verification failed';
					
					// Only retry for validation-related errors
					if (err?.error === 'tx not validated' || err?.error === 'tx not found') {
						await new Promise(r => setTimeout(r, 1500)); // Wait 1.5s between retries
						continue;
					}
					
					// For other errors (like bad destination), fail immediately
					break;
				}
				
				if (!verifyOk) {
					setError(lastErr || 'Verification failed');
					return;
				}

				// Poll progress
				pollTimerRef.current = window.setInterval(async () => {
					if (!remoteJobRef.current) return;
					try {
						const pr = await fetch(remoteJobRef.current.progressUrl);
						if (!pr.ok) return;
						const pj: { status: string; rate?: string; attempts?: string } = await pr.json();
						if (pj.rate) {
							const r = parseInt(pj.rate.replace(/,/g, ''), 10);
							if (!Number.isNaN(r)) setRate(r);
						}
						if (pj.attempts) {
							const a = parseInt(pj.attempts.replace(/,/g, ''), 10);
							if (!Number.isNaN(a)) setAttempts(a);
						}
						if (pj.status === 'complete') {
							// Fetch one-time delivery
							const dv = await fetch(remoteJobRef.current.deliveryUrl);
							if (!dv.ok) throw new Error('Delivery failed');
							const dj: { cipher: { iv: string; tag: string; ct: string }; txid: string } = await dv.json();
							const u = new URL(remoteJobRef.current.deliveryUrl);
							const token = u.searchParams.get('token') || '';
							const jobId = remoteJobRef.current.jobId;
							const key = await deriveKeyPBKDF2(token, jobId);
							const payload: { address: string; seed: string; algorithm: 'ed25519' | 'secp256k1'; receiptTx?: string } = await decryptCipher(dj.cipher, key);
							setResult({ address: payload.address, seed: payload.seed, publicKey: '', algorithm: payload.algorithm });
							if (payload.receiptTx) setReceiptHash(payload.receiptTx);
							stopPolling();
							setIsRunning(false);
							setRevealOpen(true);
						}
					} catch (e) {
						// transient errors ignored while polling
					}
				}, 2000);
			} catch (e: any) {
				setError(e?.message || 'Failed to verify payment');
			}
			return;
		}

		// Local demo mode: run workers in browser as before
		const newWorkers: Worker[] = [];
		for (let i = 0; i < t; i++) {
			const worker = createVanityWorker();
			worker.onmessage = (ev: MessageEvent<WorkerOutMessage>) => {
				const msg = ev.data as WorkerOutMessage;
				if (msg.type === 'progress') {
					const cur = Number(msg.attempts) || 0;
					const prev = workerLastAttemptsRef.current || 0;
					const delta = Math.max(0, cur - prev);
					workerLastAttemptsRef.current = cur;
					if (delta > 0) setAttempts((a) => a + delta);
				} else if (msg.type === 'found') {
					handleFound(msg);
				} else if (msg.type === 'error') {
					setError(msg.error || 'Worker error');
					stopWorkers();
				}
			};
			worker.postMessage({ type: 'start', prefix: pClean, suffix: sClean, mode: m, algorithm, reportEvery: 1000, debug: false });
			newWorkers.push(worker);
		}
		workersRef.current = newWorkers;
		setIsRunning(true);
	}

	useEffect(() => () => { stopWorkers(); stopPolling(); }, []);

	const receiptUrl = receiptHash ? explorerTxUrl(receiptHash, network) : null;

	function downloadRevealJson() {
		if (!result) return;
		const payload = {
			address: result.address,
			seed: result.seed,
			publicKey: result.publicKey,
			algorithm: result.algorithm,
			receiptHash: receiptHash || undefined,
			network,
		};
		const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `xrpl-vanity-${result.address}.json`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	}

	return (
		<div className="min-h-screen bg-neutral-950 text-neutral-100">
			<div className="max-w-6xl mx-auto p-4 md:p-8">
				<div className="flex items-center gap-3">
					<div className="text-2xl font-bold">XRPL Vanity r-address</div>
					<span className="text-xs text-neutral-500">Client-side • Web Worker • Xaman-ready</span>
				</div>
				<div className="mt-2 text-sm text-neutral-400">All generation happens locally in your browser. No network calls.</div>

				{error && (
					<div className="mt-4 bg-red-900/30 border border-red-800 rounded-lg p-3 text-sm">
						<div className="flex items-center justify-between">
							<div className="text-red-300">{error}</div>
							<button className="text-red-200" onClick={() => setError(null)}>Dismiss</button>
						</div>
						<div className="text-neutral-400 mt-1">If this is a CDN issue, try again or check your network/CSP.</div>
					</div>
				)}

				<div className="grid md:grid-cols-3 gap-4 mt-6">
					<div className="md:col-span-2 space-y-4">
						<Controls
							isRunning={isRunning}
							onStart={start}
							onStop={() => { stopWorkers(); stopPolling(); }}
						/>

						<Stats
							attempts={attempts}
							rate={rate}
							constraintLength={constraintLength}
							estimatedSeconds={estimatedSeconds}
						/>

						<Tips />
					</div>

					<Result result={result} receiptUrl={receiptUrl} />
				</div>

				<footer className="mt-8 text-xs text-neutral-500 leading-relaxed">
					<p>
						Address strings use XRPL Base58 with checksum. The leading <code>r</code> is fixed by version bytes; your prefix starts after it.
					</p>
					<p className="mt-1">No network requests are made by this component. All generation happens locally.</p>
				</footer>
			</div>

			{revealOpen && result && (
				<div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
					<div className="bg-neutral-900 rounded-xl border border-neutral-700 max-w-lg w-full p-4">
						<h4 className="font-semibold mb-2">One-time Reveal</h4>
						<div className="text-sm text-neutral-400 mb-3">Save this securely now. It will not be shown again.</div>
						<div>
							<div className="text-neutral-400 text-xs">Classic address</div>
							<div className="font-mono break-all text-emerald-400 text-lg">{result.address}</div>
						</div>
						<div className="mt-2">
							<div className="text-neutral-400 text-xs">Seed</div>
							<div className="font-mono break-all bg-neutral-800 rounded-lg p-2 border border-neutral-700">{result.seed}</div>
						</div>
						{result.privateKey && (
							<div className="mt-3">
								<div className="text-neutral-400 text-xs">Private Key (QR)</div>
								<div className="bg-neutral-800 rounded-lg p-3 border border-neutral-700 inline-block">
									<QRCodeCanvas value={result.privateKey} size={160} includeMargin={false} level="M" />
								</div>
							</div>
						)}
						<div className="flex gap-2 mt-3">
							<button onClick={downloadRevealJson} className="px-3 py-2 bg-neutral-100 text-black rounded-lg font-medium">Download JSON</button>
							<button onClick={() => { navigator.clipboard.writeText(result.seed); }} className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg">Copy seed</button>
						</div>
						<div className="flex justify-end mt-4">
							<button className="px-3 py-2 bg-emerald-500 text-black rounded-lg font-medium" onClick={() => setRevealOpen(false)}>Close</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
} 