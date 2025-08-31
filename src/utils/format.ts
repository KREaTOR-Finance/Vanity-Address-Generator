export function formatNumber(value: number): string {
	return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

export function formatDuration(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds <= 0) return '—';
	const s = Math.floor(seconds % 60);
	const m = Math.floor((seconds / 60) % 60);
	const h = Math.floor((seconds / 3600) % 24);
	const d = Math.floor(seconds / 86400);
	const parts: string[] = [];
	if (d) parts.push(`${d}d`);
	if (h) parts.push(`${h}h`);
	if (m) parts.push(`${m}m`);
	if (s || parts.length === 0) parts.push(`${s}s`);
	return parts.join(' ');
} 

export function formatPercent(value: number): string {
	if (!Number.isFinite(value)) return '—';
	return new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 2 }).format(Math.max(0, Math.min(1, value)));
}