# Solana Sentinel

Premium Solana wallet intelligence for traders, funds, security analysts, and power users. Solana Sentinel combines GoldRush API data with a lightweight risk engine, live whale alerts, suspicious token detection, and a demo x402 pay-per-insight endpoint.

## Features

- Wallet risk scoring from suspicious tokens, concentration, transfer behavior, volatility exposure, and transaction frequency
- Premium wallet report at `/wallet/[address]`
- Live whale activity feed at `/alerts`
- Suspicious token and whale behavior indicators
- Portfolio overview with Recharts visualizations
- GoldRush wrapper with retry, timeout, stale-cache, and rate-limit fallback
- x402-style premium insight demo at `/api/premium-insight/[wallet]`
- App Router, TypeScript, Tailwind, shadcn-style UI primitives, and server components where appropriate

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

Create `.env.local`:

```bash
GOLDRUSH_API_KEY=your_goldrush_key
SENTINEL_WATCHLIST=wallet_one,wallet_two,wallet_three
```

Wallet intelligence is fetched from GoldRush when `GOLDRUSH_API_KEY` is present. `SENTINEL_WATCHLIST` is optional but enables the live alert feed to derive activity from real watched wallets. If GoldRush is rate limited or temporarily unavailable, the app serves recent cached GoldRush responses when available and otherwise falls back to realistic demo data instead of crashing.

## Demo Flow

1. Start on `/` and paste any Solana wallet address.
2. Open the generated wallet report.
3. Review risk score, portfolio exposure, suspicious tokens, recent activity, whale indicators, and recommendations.
4. Click `Unlock` in the Premium x402 Insight panel to simulate a 402 payment-required response and then reveal the paid insight.
5. Visit `/alerts` for the animated whale feed.

## Architecture

- `app/` contains App Router pages and route handlers.
- `components/` contains reusable UI, home, and dashboard components.
- `lib/goldrush.ts` wraps GoldRush calls, response normalization, retries, timeouts, stale-cache fallback, and rate-limit handling.
- `lib/risk-engine.ts` calculates wallet risk and recommendations.
- `lib/mock-data.ts` provides realistic demo data.
- `types/` contains shared TypeScript contracts.
- `hooks/` contains small client hooks for interactive flows.

## GoldRush Integration

`lib/goldrush.ts` exposes:

- `getWalletBalances()`
- `getWalletTransactions()`
- `getWalletTokenExposure()`
- `getWalletRiskSignals()`

The wrapper reads `GOLDRUSH_API_KEY` server-side and returns normalized wallet intelligence from `balances_v2` and paged `transactions_v3`. Balance responses provide token metadata and USD pricing; transaction log metadata is used to classify swaps, mints, burns, bridges, and transfers. Failed or rate-limited requests use short-lived cached responses when possible and otherwise return realistic mock data for demo continuity.

## API Routes

- `GET /api/wallet/[address]` returns a full wallet report.
- `GET /api/alerts` returns whale alerts.
- `GET /api/stream` streams Server-Sent Event alert payloads.
- `GET /api/premium-insight/[wallet]` returns a 402-style payment requirement.
- `GET /api/premium-insight/[wallet]?paid=true` returns premium wallet intelligence.

## Scripts

```bash
npm run dev
npm run lint
npm run build
```
