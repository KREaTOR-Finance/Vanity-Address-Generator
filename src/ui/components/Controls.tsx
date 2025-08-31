import { useState, useEffect } from 'react';
import type { KeyAlgorithm, VanityMode, Network } from '../../types';
import { isValidXrplBase58Prefix } from '../../utils/base58';

export interface ControlsProps {
	isRunning: boolean;
	onStart: (params: { prefix: string; suffix?: string; mode: VanityMode; algorithm: KeyAlgorithm; threads: number; network: Network; demoMode: boolean; }) => void;
	onStop: () => void;
}

export default function Controls({ isRunning, onStart, onStop }: ControlsProps) {
	const [mode, setMode] = useState<VanityMode>('prefix');
	const [prefix, setPrefix] = useState('');
	const [suffix, setSuffix] = useState('');
	const algorithm: KeyAlgorithm = 'ed25519';
	const [network, setNetwork] = useState<Network>('mainnet');
	const [demoMode, setDemoMode] = useState<boolean>(false);
	const [error, setError] = useState<string>('');

	function sanitize(value: string): string {
		const allowed = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz';
		let out = '';
		for (let i = 0; i < value.length; i++) {
			const c = value[i];
			if (allowed.includes(c)) out += c;
		}
		return out;
	}

	useEffect(() => {
		let err = '';
		const check = (s: string) => isValidXrplBase58Prefix(s);
		if (mode === 'prefix') {
			if (!check(prefix)) err = 'Invalid character: XRPL Base58 only';
			if (prefix.length > 6) err = 'Prefix length must be ≤ 6';
		}
		if (mode === 'suffix') {
			if (!check(suffix)) err = 'Invalid character: XRPL Base58 only';
			if (suffix.length > 6) err = 'Suffix length must be ≤ 6';
		}
		if (mode === 'combo3x3') {
			if (!check(prefix) || !check(suffix)) err = 'Invalid character: XRPL Base58 only';
			if (prefix.length > 3 || suffix.length > 3) err = 'Combo is limited to 3+3';
		}
		setError(err);
	}, [mode, prefix, suffix]);

	useEffect(() => {
		const maxLen = mode === 'combo3x3' ? 3 : 6;
		setPrefix((p) => p.slice(0, maxLen));
		setSuffix((s) => s.slice(0, maxLen));
	}, [mode]);

	const constraintLen = mode === 'prefix' ? prefix.length : mode === 'suffix' ? suffix.length : Math.min(3, prefix.length) + Math.min(3, suffix.length);
	const priceHint = constraintLen <= 4 ? '$' : constraintLen === 5 ? '$$' : '$$$';

	return (
		<div className="bg-neutral-900/60 rounded-2xl p-4 ring-1 ring-neutral-800 shadow">
			<h2 className="text-xl font-semibold">XRPL Vanity r-address</h2>
			<p className="text-neutral-400 text-sm mt-1">Choose mode and enter your constraint. Longer patterns cost and take more time.</p>

			<div className="grid md:grid-cols-2 gap-3 mt-4">
				<label className="block">
					<div className="text-sm text-neutral-300 mb-1">Mode</div>
					<select
						className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2"
						value={mode}
						onChange={(e) => setMode(e.target.value as VanityMode)}
					>
						<option value="prefix">Prefix (≤6)</option>
						<option value="suffix">Suffix (≤6)</option>
						<option value="combo3x3">Combo 3+3</option>
					</select>
				</label>
			</div>

			<div className="grid md:grid-cols-2 gap-3 mt-3">
				{mode !== 'suffix' && (
					<label className="block">
						<div className="text-sm text-neutral-300 mb-1">Prefix {mode === "combo3x3" ? '(≤3)' : '(≤6)'} (after r)</div>
						<input
							className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2 font-mono"
							value={prefix}
							onChange={(e) => {
								const raw = sanitize(e.target.value);
								const maxLen = mode === 'combo3x3' ? 3 : 6;
								setPrefix(raw.slice(0, maxLen));
							}}
							placeholder="e.g. xrp, moon, 1A"
							spellCheck={false}
						/>
						{error && <div className="text-red-500 text-xs mt-1">{error}</div>}
					</label>
				)}
				{mode !== 'prefix' && (
					<label className="block">
						<div className="text-sm text-neutral-300 mb-1">Suffix {mode === "combo3x3" ? '(≤3)' : '(≤6)'}</div>
						<input
							className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2 font-mono"
							value={suffix}
							onChange={(e) => {
								const raw = sanitize(e.target.value);
								const maxLen = mode === 'combo3x3' ? 3 : 6;
								setSuffix(raw.slice(0, maxLen));
							}}
							placeholder="e.g. xrp, moon, 1A"
							spellCheck={false}
						/>
						{error && <div className="text-red-500 text-xs mt-1">{error}</div>}
					</label>
				)}
			</div>

			<div className="grid md:grid-cols-3 gap-3 mt-3">
				<label className="block">
					<div className="text-sm text-neutral-300 mb-1">Network</div>
					<select
						className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2"
						value={network}
						onChange={(e) => setNetwork(e.target.value as Network)}
					>
						<option value="mainnet">Mainnet</option>
						<option value="testnet">Testnet</option>
					</select>
				</label>
				<label className="flex items-center gap-2 mt-6 md:mt-0">
					<input type="checkbox" checked={demoMode} onChange={(e) => setDemoMode(e.target.checked)} />
					<span className="text-sm text-neutral-300">Demo mode (bypass payment)</span>
				</label>
				<div className="text-sm text-neutral-400 mt-6 md:mt-0">Pricing: <span className="font-medium text-neutral-200">{priceHint}</span> {constraintLen >= 5 && <span>(5th/6th chars cost more)</span>}</div>
			</div>

			<div className="flex gap-2 mt-4">
				{!isRunning ? (
					<button
						onClick={() => onStart({ prefix, suffix, mode, algorithm, threads: 1, network, demoMode })}
						className="px-4 py-2 bg-emerald-500 text-black rounded-lg font-medium"
						disabled={!!error}
					>
						Pay & Start
					</button>
				) : (
					<button
						onClick={onStop}
						className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg"
					>
						Stop
					</button>
				)}
			</div>
		</div>
	);
} 