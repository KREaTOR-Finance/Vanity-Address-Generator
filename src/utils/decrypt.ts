export async function deriveKeyPBKDF2(secret: string, salt: string): Promise<CryptoKey> {
	const enc = new TextEncoder()
	const baseKey = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveKey'])
	return crypto.subtle.deriveKey(
		{ name: 'PBKDF2', salt: enc.encode(salt), iterations: 200_000, hash: 'SHA-256' },
		baseKey,
		{ name: 'AES-GCM', length: 256 },
		false,
		['decrypt']
	)
}

export async function decryptCipher(cipher: { iv: string; tag: string; ct: string }, key: CryptoKey) {
	const b64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0))
	const iv = b64(cipher.iv)
	const tag = b64(cipher.tag)
	const ct = b64(cipher.ct)
	const buf = new Uint8Array(ct.length + tag.length)
	buf.set(ct)
	buf.set(tag, ct.length)
	const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, buf)
	return JSON.parse(new TextDecoder().decode(new Uint8Array(pt)))
} 