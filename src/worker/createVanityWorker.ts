import type { WorkerInMessage, WorkerOutMessage } from '../types';

/*
	Creates a module Worker from a URL so Vite bundles dependencies (xrpl).
*/
export function createVanityWorker(): Worker {
	const worker = new Worker(new URL('./vanityWorker.ts', import.meta.url), { type: 'module' });
	return worker;
}

export type VanityWorker = Worker & {
	postMessage(message: WorkerInMessage): void;
	onmessage: ((this: Worker, ev: MessageEvent<WorkerOutMessage>) => any) | null;
}; 