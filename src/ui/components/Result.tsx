import type { VanityResult } from '../../types';

export interface ResultProps {
	result?: VanityResult | null;
	receiptUrl?: string | null;
}

export default function Result({ result, receiptUrl }: ResultProps) {
	function saveAsJson() {
		if (!result) return;
		const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
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
		<aside className="bg-neutral-900/70 rounded-2xl p-4 ring-1 ring-neutral-800 shadow h-max">
			<h3 className="font-semibold mb-3">Result</h3>
			{!result ? (
				<p className="text-neutral-400 text-sm">When a match is found, details will appear here.</p>
			) : (
				<div className="space-y-3">
					<div>
						<div className="text-neutral-400 text-xs">Classic address</div>
						<div className="font-mono break-all text-emerald-400 text-lg">{result.address}</div>
					</div>
					<div className="grid grid-cols-2 gap-2 text-xs">
						<div className="bg-neutral-800 rounded-lg p-2 border border-neutral-700">
							<div className="text-neutral-400">Algorithm</div>
							<div className="font-mono">{result.algorithm}</div>
						</div>
						<div className="bg-neutral-800 rounded-lg p-2 border border-neutral-700">
							<div className="text-neutral-400">Public Key</div>
							<div className="font-mono break-all">{result.publicKey}</div>
						</div>
					</div>
					{receiptUrl && (
						<div className="text-xs text-neutral-300">Receipt: <a href={receiptUrl} target="_blank" rel="noreferrer" className="underline">View transaction</a></div>
					)}
					<div className="flex gap-2 pt-1">
						<button onClick={saveAsJson} className="px-3 py-2 bg-neutral-100 text-black rounded-lg font-medium">Download JSON</button>
					</div>
					<div className="pt-2 text-xs text-neutral-400">
						Seed is revealed once in a secure modal after completion. Nothing is uploaded.
					</div>
				</div>
			)}
		</aside>
	);
} 