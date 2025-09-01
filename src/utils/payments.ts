export type PaymentMode = 'XRP' | 'IOU';

export const XRPL_NETWORK: string = ((import.meta as any).env?.VITE_XRPL_NETWORK ?? 'mainnet') as string;
export const PRICE_DROPS: string = String((import.meta as any).env?.VITE_PRICE_DROPS ?? '10000');
export const PAYMENT_MODE: PaymentMode = ((import.meta as any).env?.VITE_PAYMENT_MODE ?? 'XRP') as PaymentMode;
export const FIATCOIN_ISSUER: string | undefined = (import.meta as any).env?.VITE_FIATCOIN_ISSUER as string | undefined;
export const FIATCOIN_CODE: string | undefined = (import.meta as any).env?.VITE_FIATCOIN_CODE as string | undefined;
export const FIATCOIN_TRUST_LIMIT: string = String((import.meta as any).env?.VITE_FIATCOIN_TRUST_LIMIT ?? '1000000');

export function buildXrpPaymentPayload(params: { destination: string; amountDrops?: string; memos?: any }) {
  const amount = params.amountDrops ?? PRICE_DROPS;
  const payload = {
    TransactionType: 'Payment',
    Destination: params.destination,
    Amount: amount,
    Memos: params.memos?.Memos || [],
  };
  console.log('Payment payload:', JSON.stringify(payload, null, 2));
  return payload;
}

export function ensureTrustline(params: { currency: string; issuer: string; limit?: string }) {
  const limit = params.limit ?? FIATCOIN_TRUST_LIMIT;
  return {
    TransactionType: 'TrustSet',
    LimitAmount: {
      currency: params.currency,
      issuer: params.issuer,
      value: String(limit),
    },
  };
}

export function buildIouPaymentPayload(params: { destination: string; currency: string; issuer: string; value: string; memos?: any }) {
  return {
    TransactionType: 'Payment',
    Destination: params.destination,
    Amount: {
      currency: params.currency,
      issuer: params.issuer,
      value: params.value,
    },
    ...(params.memos || {}), // Memos field should be at root level
  };
}


