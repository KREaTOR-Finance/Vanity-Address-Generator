# CHECKLIST: Xaman/xApp + XRPL + Supabase + Docker GPU

### Xaman (XUMM) / xApp
- [ ] Pin SDK/API versions; prefer in-wallet `xAppSdk.openSignRequest`.
- [ ] Keep fallback payload create/status with timeout and clear errors.
- [ ] IOU helpers present: `buildIouPaymentPayload`, `ensureTrustline`.
- [ ] Set price via `VITE_PRICE_DROPS=10000`.
- [ ] Verify `XAPP_SLUG` and deeplink.

### Payment Flow (XRP + IOU)
- [ ] `PAYMENT_MODE=XRP` now; IOU when issuer/code set.
- [ ] XRP: `Payment` in drops with memos.
- [ ] IOU: `TrustSet` then `Payment {currency,issuer,value}`.

### Supabase
- [ ] Create `users`, `payments`; enable RLS; service-role policies for webhook writes.
- [ ] Deploy edge: `create-payload`, `payload-status`, `xaman-webhook`.
- [ ] Store Xaman keys as Supabase secrets.

### Docker & GPU
- [ ] Compose: `web`, `api`, `redis`, `worker-gpu` (`gpus: all`).
- [ ] Provide `web.Dockerfile`, `worker/Dockerfile.gpu`.
- [ ] Healthchecks and `.env` wiring.

### Secrets & .env
- [ ] `.env` templates provided; real secrets in untracked `.env`.

### Tests
- [ ] E2E happy paths and error paths (expired/declined/balance/trustline).
