export function getSupabaseFunctionsBaseUrl(): string {
	const url = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
	if (!url) throw new Error('VITE_SUPABASE_URL is not set');
	try {
		const u = new URL(url);
		// Use official functions path under the project domain
		u.pathname = '/functions/v1/';
		return u.origin + u.pathname.replace(/\/+$/, '');
	} catch {
		throw new Error('Invalid VITE_SUPABASE_URL');
	}
}

export async function callEdgeFunction<T = any>(path: string, init?: RequestInit): Promise<T> {
	const base = getSupabaseFunctionsBaseUrl();
	const anon = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;
	if (!anon) throw new Error('VITE_SUPABASE_ANON_KEY is not set');
	const res = await fetch(`${base}/${path}`.replace(/\/+/g, '/').replace(/\/+$/, ''), {
		...init,
		headers: {
			'Authorization': `Bearer ${anon}`,
			'Content-Type': 'application/json',
			...(init?.headers || {}),
		},
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Edge function ${path} failed: ${res.status} ${text}`);
	}
	return res.json();
} 