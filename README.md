# hook2tg API (Cloudflare Worker)

This worker implements the webhook → Telegram bridge described in the repo README.

Bindings to configure (in `wrangler.toml`):
- `PREMIUM_KV` (KV namespace) — keys of the form `premium:<botId>`
- `RATE_LIMITER` (Durable Object) — per-`botId` limiter

Only the `json` payload format is implemented in this first iteration.

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 8+
- Cloudflare account (for deployment)

### Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Create a KV namespace for local development:
   ```bash
   wrangler kv:namespace create PREMIUM_KV
   ```

3. Update `wrangler.toml` with your KV namespace ID, or create `wrangler.local.toml`:
   ```toml
   [[kv_namespaces]]
   binding = "PREMIUM_KV"
   id = "your-kv-namespace-id-here"
   ```

4. Start the development server:
   ```bash
   pnpm dev
   ```

### Testing

Run tests with:
```bash
pnpm test
```

Tests use `miniflare` to emulate KV & Durable Objects locally.

## Deployment

### Manual Deployment

```bash
wrangler deploy
```

### GitHub Actions (CI/CD)

This project includes automated deployment via GitHub Actions. Deployments happen automatically on push to `main`.

#### Required GitHub Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

1. **`CLOUDFLARE_API_TOKEN`**
   - Go to: https://dash.cloudflare.com/profile/api-tokens
   - Create token with "Edit Cloudflare Workers" template
   - Required permissions:
     - Account → Workers Scripts → Edit
     - Account → Workers KV Storage → Edit
     - Account → Account Settings → Read

2. **`CLOUDFLARE_ACCOUNT_ID`**
   - Found in your Cloudflare dashboard
   - Go to: Workers & Pages → Overview
   - Copy the Account ID from the right sidebar

3. **`CLOUDFLARE_KV_NAMESPACE_ID`**
   - Your production KV namespace ID
   - Create with: `wrangler kv:namespace create PREMIUM_KV`
   - Copy the ID from the output

#### Workflow

The GitHub Actions workflow (`.github/workflows/deploy.yml`):
- Runs tests on all PRs and pushes
- Deploys to Cloudflare Workers on push to `main` (after tests pass)

## Architecture

- **Rate Limiting**: Implemented via Durable Objects (`RateLimiter`)
  - Free tier: 1 req/sec, 30 req/month
  - Premium tier: 10 req/sec, 100k req/month
- **Premium Status**: Stored in KV namespace with expiration dates
- **Framework**: Built with [Hono](https://hono.dev/) for fast routing

## API Usage

```bash
POST /:chatId/:format?botToken=YOUR_BOT_TOKEN
Content-Type: application/json

{
  "your": "json",
  "payload": "here"
}
```

Currently only `format=json` is supported.

