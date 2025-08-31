import { useEffect, useState } from 'react';
import { formatNumber, formatDuration, formatPercent } from '../../utils/format';
import { etaSecondsForQuantile, probabilityOfSuccess, probabilityWithinSeconds } from '../../utils/eta';

export interface StatsProps {
	attempts: number;
	rate: number;
	constraintLength: number;
	estimatedSeconds: number;
}

export default function Stats({ attempts, rate, constraintLength }: StatsProps) {
	// Stabilize transient zeros by keeping the last positive rate
	const [stableRate, setStableRate] = useState(0);
	useEffect(() => {
		if (rate > 0) setStableRate(rate);
	}, [rate]);
	const effectiveRate = rate > 0 ? rate : stableRate;

	const p50 = etaSecondsForQuantile(constraintLength, effectiveRate, 0.5);
	const p90 = etaSecondsForQuantile(constraintLength, effectiveRate, 0.9);
	const p99 = etaSecondsForQuantile(constraintLength, effectiveRate, 0.99);
	const successNow = probabilityOfSuccess(attempts, constraintLength);
	const success1m = probabilityWithinSeconds(constraintLength, effectiveRate, 60);
	const success10m = probabilityWithinSeconds(constraintLength, effectiveRate, 600);
	return (
		<div className="bg-neutral-900/60 rounded-2xl p-4 ring-1 ring-neutral-800 shadow">
			<h3 className="font-semibold mb-3">Stats</h3>
			<div className="grid grid-cols-2 md:grid-cols-6 gap-3">
				<div className="bg-neutral-800/50 rounded-xl p-3 border border-neutral-800">
					<div className="text-neutral-400">Attempts</div>
					<div className="text-lg font-semibold">{formatNumber(attempts)}</div>
				</div>
				<div className="bg-neutral-800/50 rounded-xl p-3 border border-neutral-800">
					<div className="text-neutral-400">Rate</div>
					<div className="text-lg font-semibold">{formatNumber(Math.floor(effectiveRate))}/s</div>
				</div>
				<div className="bg-neutral-800/50 rounded-xl p-3 border border-neutral-800">
					<div className="text-neutral-400">Constraint length</div>
					<div className="text-lg font-semibold">{constraintLength || '—'}</div>
				</div>
				<div className="bg-neutral-800/50 rounded-xl p-3 border border-neutral-800">
					<div className="text-neutral-400">ETA p50</div>
					<div className="text-lg font-semibold">{formatDuration(p50)}</div>
				</div>
				<div className="bg-neutral-800/50 rounded-xl p-3 border border-neutral-800">
					<div className="text-neutral-400">ETA p90</div>
					<div className="text-lg font-semibold">{formatDuration(p90)}</div>
				</div>
				<div className="bg-neutral-800/50 rounded-xl p-3 border border-neutral-800">
					<div className="text-neutral-400">ETA p99</div>
					<div className="text-lg font-semibold">{formatDuration(p99)}</div>
				</div>
			</div>

			<div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
				<div className="bg-neutral-800/30 rounded-xl p-3 border border-neutral-800">
					<div className="text-neutral-400">Success so far</div>
					<div className="text-lg font-semibold">{formatPercent(successNow)}</div>
				</div>
				<div className="bg-neutral-800/30 rounded-xl p-3 border border-neutral-800">
					<div className="text-neutral-400">In 1 minute</div>
					<div className="text-lg font-semibold">{formatPercent(success1m)}</div>
				</div>
				<div className="bg-neutral-800/30 rounded-xl p-3 border border-neutral-800">
					<div className="text-neutral-400">In 10 minutes</div>
					<div className="text-lg font-semibold">{formatPercent(success10m)}</div>
				</div>
			</div>
		</div>
	);
} 