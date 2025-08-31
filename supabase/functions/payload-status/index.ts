// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.178.0/http/server.ts";

function withCors(res: Response, statusOverride?: number): Response {
	const h = new Headers(res.headers);
	h.set('Access-Control-Allow-Origin', '*');
	h.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
	h.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
	return new Response(res.body, { status: statusOverride ?? res.status, headers: h });
}

function okJson(obj: unknown, status = 200): Response {
	return withCors(new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } }));
}

function getEnv(...names: string[]): string | undefined {
	for (const name of names) {
		const v = Deno.env.get(name);
		if (v && v.length > 0) return v;
	}
	return undefined;
}

async function getPayloadStatus(uuid: string): Promise<any> {
	const apiKey = getEnv('XUMM_API_KEY', 'XAMAN_API_KEY', 'XUMM_APIKEY', 'SUPABASE_XUMM_API_KEY');
	const apiSecret = getEnv('XUMM_API_SECRET', 'XAMAN_API_SECRET', 'XUMM_APISECRET', 'SUPABASE_XUMM_API_SECRET');
	if (!apiKey || !apiSecret) {
		throw new Error('Missing XUMM credentials in Supabase secrets');
	}
	const resp = await fetch(`https://xumm.app/api/v1/platform/payload/${encodeURIComponent(uuid)}`, {
		headers: {
			'X-API-Key': apiKey,
			'X-API-Secret': apiSecret,
		},
	});
	if (!resp.ok) {
		const t = await resp.text();
		throw new Error(`Xumm payload status error: ${resp.status} ${t}`);
	}
	return await resp.json();
}

serve(async (req) => {
	if (req.method === 'OPTIONS') return withCors(new Response('ok', { status: 200 }));
	if (req.method !== 'GET') return withCors(new Response('Method Not Allowed', { status: 405 }));
	try {
		const url = new URL(req.url);
		const uuid = url.searchParams.get('uuid') || '';
		if (!uuid) return okJson({ error: 'Bad Request' }, 400);
		const status = await getPayloadStatus(uuid);
		const signed = !!status?.meta?.signed;
		const txid = status?.response?.txid || undefined;
		const dispatched_result = status?.response?.dispatched_result || undefined;
		const dispatched_to = status?.response?.dispatched_to || undefined;
		const dispatched_nodetype = status?.response?.dispatched_nodetype || undefined;
		const resolved_at = status?.meta?.resolved || undefined;
		return okJson({ signed, txid, dispatched_result, dispatched_to, dispatched_nodetype, resolved_at });
	} catch (e) {
		const msg = (e as any)?.message || String(e);
		return okJson({ error: msg }, 500);
	}
}); 