// @ts-nocheck
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

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function upsertPayment(payload: any) {
  const { payload_uuidv4, response, meta } = payload || {};
  const status: string = meta?.signed ? 'signed' : (meta?.expired ? 'expired' : 'failed');
  const tx_hash: string | undefined = response?.txid || undefined;
  const body = [{ payload_uuidv4, status, tx_hash, updated_at: new Date().toISOString() }];
  const resp = await fetch(`${SB_URL}/rest/v1/payments?on_conflict=payload_uuidv4`, {
    method: 'POST',
    headers: {
      'apikey': SB_SERVICE,
      'Authorization': `Bearer ${SB_SERVICE}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`DB upsert failed: ${resp.status} ${t}`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return withCors(new Response('ok', { status: 200 }));
  if (req.method !== 'POST') return withCors(new Response('Method Not Allowed', { status: 405 }));
  try {
    const event = await req.json().catch(() => null);
    if (!event?.payload_uuidv4) return okJson({ error: 'Bad Request' }, 400);
    await upsertPayment(event);
    return okJson({ ok: true });
  } catch (e) {
    return okJson({ error: (e as any)?.message || String(e) }, 500);
  }
});


