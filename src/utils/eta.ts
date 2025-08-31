const BASE = 58;

export function expectedAttemptsForConstraintLength(len: number): number {
	if (len <= 0) return 1;
	return Math.pow(BASE, len);
}

export function estimateEtaSeconds(constraintLength: number, attemptsPerSecond: number): number {
	if (attemptsPerSecond <= 0) return Infinity;
	const expected = expectedAttemptsForConstraintLength(constraintLength);
	const medianAttempts = 0.6931471805599453 * expected;
	return medianAttempts / attemptsPerSecond;
}

// Probability of at least one success after N attempts for constraint length L
export function probabilityOfSuccess(attempts: number, constraintLength: number): number {
	if (attempts <= 0) return 0;
	const expected = expectedAttemptsForConstraintLength(constraintLength);
	const p = 1 / expected;
	if (p >= 1) return 1;
	const failProb = Math.pow(1 - p, Math.max(0, Math.floor(attempts)));
	return 1 - failProb;
}

// ETA for a given quantile q in (0,1)
export function etaSecondsForQuantile(constraintLength: number, attemptsPerSecond: number, q: number): number {
	if (!(q > 0 && q < 1)) return Infinity;
	if (attemptsPerSecond <= 0) return Infinity;
	const expected = expectedAttemptsForConstraintLength(constraintLength);
	const p = 1 / expected;
	// For geometric with small p, t_q ≈ ln(1/(1-q)) / (p * rate)
	const lnFactor = Math.log(1 / (1 - q));
	return lnFactor / (p * attemptsPerSecond);
}

// Probability to succeed within T seconds at a constant attemptsPerSecond
export function probabilityWithinSeconds(constraintLength: number, attemptsPerSecond: number, seconds: number): number {
	if (seconds <= 0 || attemptsPerSecond <= 0) return 0;
	const attempts = attemptsPerSecond * seconds;
	return probabilityOfSuccess(attempts, constraintLength);
}