export interface VanityMemoPayload {
	mode: 'prefix' | 'suffix' | 'combo3x3';
	prefix?: string;
	suffix?: string;
	constraintLen: number;
	algo: 'ed25519' | 'secp256k1';
	network: 'mainnet' | 'testnet';
	app: string;
	version: string;
}

function toHex(str: string): string {
	const encoder = new TextEncoder();
	const bytes = encoder.encode(str);
	let out = '';
	for (let i = 0; i < bytes.length; i++) {
		out += bytes[i].toString(16).padStart(2, '0');
	}
	return out;
}

export function buildVanityMemoHex(data: VanityMemoPayload): { Memos: Array<{ Memo: { MemoType?: string; MemoFormat?: string; MemoData: string; } }> } {
	// Simplified memo with just the essential info
	const json = JSON.stringify({
		intent: 'vanity',
		mode: data.mode,
		len: data.constraintLen,
		prefix: data.prefix,
		suffix: data.suffix
	});
	return {
		Memos: [
			{
				Memo: {
					MemoType: toHex('text/plain'),
					MemoFormat: toHex('application/json'),
					MemoData: toHex(json),
				},
			},
		],
	};
}

export function utf8ToHex(str: string): string { return toHex(str); } 