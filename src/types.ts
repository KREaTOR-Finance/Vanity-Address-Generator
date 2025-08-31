export type KeyAlgorithm = 'ed25519' | 'secp256k1';

export type VanityMode = 'prefix' | 'suffix' | 'combo3x3';
export type Network = 'mainnet' | 'testnet';

export interface VanityResult {
	address: string;
	seed: string;
	publicKey: string;
	privateKey?: string;
	algorithm: KeyAlgorithm;
}

export interface ReceiptInfo {
	transactionHash: string;
	network: Network;
}

export interface WorkerStartMessage {
	type: 'start';
	prefix: string;
	suffix?: string;
	mode: VanityMode;
	algorithm: KeyAlgorithm;
	reportEvery: number;
	debug?: boolean;
}

export interface WorkerStopMessage {
	type: 'stop';
}

export type WorkerInMessage = WorkerStartMessage | WorkerStopMessage;

export interface WorkerProgressMessage {
	type: 'progress';
	attempts: number;
	delta?: number;
}

export interface WorkerFoundMessage {
	type: 'found';
	result: VanityResult;
	attempts: number;
}

export interface WorkerErrorMessage {
	type: 'error';
	error: string;
}

export type WorkerOutMessage = WorkerProgressMessage | WorkerFoundMessage | WorkerErrorMessage; 