// XRPL Base58 alphabet (Ripple alphabet)
// https://xrpl.org/base58-encodings.html
export const XRPL_BASE58_ALPHABET = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz';

export function isValidXrplBase58Prefix(prefix: string): boolean {
	for (let i = 0; i < prefix.length; i++) {
		if (!XRPL_BASE58_ALPHABET.includes(prefix[i])) return false;
	}
	return true;
} 