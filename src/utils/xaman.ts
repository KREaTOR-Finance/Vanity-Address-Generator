import { callEdgeFunction } from './supabase';

export interface PaymentParams {
	destination: string;
	amountDrops: string;
	memos?: any;
}

export interface PaymentResult {
	success: boolean;
	hash?: string;
	error?: string;
}

// Minimal type for window.xumm or xApp SDK
declare global {
	interface Window {
		Xumm?: any;
		xAppSdk?: any;
	}
}

export async function openXamanSign(txjson: any, options?: { submit?: boolean }): Promise<PaymentResult> {
	const payload = { ...(txjson || {}) };
	const submit = options?.submit !== false;
	if (typeof window !== 'undefined' && (window.xAppSdk && typeof window.xAppSdk.openSignRequest === 'function')) {
		try {
			const res = await window.xAppSdk.openSignRequest({ json: payload, options: { submit } });
			if (res && res.signed && res.txid) {
				return { success: true, hash: res.txid };
			}
			return { success: false, error: 'Rejected' };
		} catch (e: any) {
			return { success: false, error: e?.message || String(e) };
		}
	}

	// Fallback via Supabase Edge Function: create payload + deeplink + poll for result
	try {
		const created = await callEdgeFunction<{ uuid: string; next: { always: string } }>('create-payload', {
			method: 'POST',
			body: JSON.stringify({ json: payload }),
		});
		if (!created?.next?.always || !created?.uuid) return { success: false, error: 'Failed to create payload' };
		try { window.open(created.next.always, '_blank'); } catch {}
		const start = Date.now();
		while (Date.now() - start < 180000) {
			const status = await fetchPayloadStatus(created.uuid);
			if (status && status.signed) {
				if (status.txid) return { success: true, hash: status.txid };
				return { success: false, error: 'Signed without txid' };
			}
			await new Promise(r => setTimeout(r, 2000));
		}
		return { success: false, error: 'Signing timed out' };
	} catch (e: any) {
		return { success: false, error: e?.message || String(e) };
	}
}

export async function openXamanPayment(params: PaymentParams): Promise<PaymentResult> {
	const payload = {
		TransactionType: 'Payment',
		Destination: params.destination,
		Amount: params.amountDrops,
		...(params.memos ? params.memos : {}),
	};
	return openXamanSign(payload, { submit: true });
}

export async function fetchPayloadStatus(uuid: string): Promise<{ signed: boolean; txid?: string } | null> {
	try {
		const res = await callEdgeFunction<{ signed: boolean; txid?: string }>(`payload-status?uuid=${encodeURIComponent(uuid)}`);
		return res || null;
	} catch {
		return null;
	}
} 