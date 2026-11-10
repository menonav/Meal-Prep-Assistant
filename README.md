# Meal Prep Assistant

A minimal Next.js App Router app with React and managed Neon Auth. The homepage preserves the original landing page's content, styles, Google Fonts, and Unsplash image, with account links added below the closing message. AI, meal planning, and payments are not implemented.

## Local development

Use Node.js 24.x and pnpm 11.25.0 (the version pinned in `package.json`).

```sh
pnpm install
cp .env.example .env.local
pnpm dev
```

Open http://localhost:3000. For a production build and local production server:

```sh
pnpm build
pnpm start
```

## Structure

- `app/page.js`: homepage, rendered as a server component.
- `app/layout.js`: root layout, page metadata, favicon, and theme color.
- `app/globals.css`: original responsive landing-page styles.
- `dist/index.html`: retained original reference; Next.js does not serve or build from this directory.
- `pnpm-lock.yaml`: pinned dependency resolution for reproducible installs.
- `/signup` and `/login`: email/password account forms using the official Neon Auth client.
- `/dashboard`: server-protected account page with logout.
- `app/api/auth/[...path]/route.js`: same-origin SDK proxy; secrets stay on the server.
- `lib/auth/`: environment validation and Neon Auth SDK configuration.
- `proxy.js`: session validation/refresh for dashboard routes. The dashboard also independently revalidates sessions with Neon, bypassing the cookie cache.

## Vercel settings

Import this repository with the **Next.js** framework preset and the repository root as the **Root Directory**. Use Node.js **24.x**.

Leave Build Command, Install Command, and Output Directory at their framework defaults. Vercel should detect pnpm from the lockfile and build with `pnpm build`. If an existing project has static-site overrides, clear them, especially an Output Directory of `dist`. Next.js uses `.next` internally; no custom output configuration or `vercel.json` is needed.

## Neon Auth configuration

The local checkout has no Neon variables or Vercel project link. Vercel's remote environment settings were not accessible during implementation. Add or confirm these **server-side** variables in Vercel Settings > Environment Variables, for each environment you use:

| Variable | Value |
| --- | --- |
| `NEON_AUTH_BASE_URL` | The full Auth endpoint for the matching Neon branch, copied from Neon Auth or supplied by the Vercel integration. This is an HTTPS URL, not a PostgreSQL connection string. |
| `NEON_AUTH_COOKIE_SECRET` | A cryptographically random secret of at least 32 characters, kept stable across deploys within the same environment. |

### Diagnosing “Account access is being set up”

This message comes from the local configuration gate before the app contacts Neon. A Ready deployment can still be missing runtime configuration: the public homepage intentionally builds without auth variables.

The exact names are `NEON_AUTH_BASE_URL` and `NEON_AUTH_COOKIE_SECRET`. Both must apply to the environment serving the URL you opened. The URL is trimmed and trailing slashes removed consistently before validation and SDK initialization; the secret is preserved exactly. A database connection string is not an Auth URL.

After deploying the diagnostic fix, open `/signup`, then open **Vercel > Project > Logs** for that deployment and filter for `[auth-config]`. Only fixed codes and variable names are logged, once per function instance:

- `AUTH_URL_MISSING`: the runtime cannot see a nonempty `NEON_AUTH_BASE_URL`.
- `AUTH_URL_INVALID`: that value is not an HTTPS Auth endpoint, or contains credentials, query parameters, or a fragment. Check privately for copied quotes or a database URL.
- `COOKIE_SECRET_MISSING`: the runtime cannot see `NEON_AUTH_COOKIE_SECRET`.
- `COOKIE_SECRET_TOO_SHORT`: the secret has fewer than 32 characters excluding surrounding whitespace.
- `CONFIGURED`: both local checks passed; this is not a live Neon connectivity test.

Confirm the deployment is **Production**, points at the intended Git commit, and is the deployment assigned to your domain. A Preview URL does not receive Production-only secrets. In **Project Settings > Environment Variables**, check the exact names and scopes, then correct any flagged setting privately and redeploy the latest code to the same environment. Never paste values into chat or logs. Neon's integration normally injects `NEON_AUTH_BASE_URL`; deployment-specific integration variables may not appear in the project-level list. See [Neon's integration documentation](https://neon.com/blog/auth-that-just-works-in-vercel-previews).

Generate the cookie secret locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`, then save it directly in Vercel or your ignored `.env.local`. Never paste it into chat or commit it. For local testing, copy `.env.example` to `.env.local` and fill the two values privately, or pull Development variables with an authenticated Vercel CLI. Changes in Vercel apply to subsequent deployments; restart the local server after changing `.env.local`.

Authentication does not need `NEXT_PUBLIC_*` credentials or a direct `DATABASE_URL`. Neon Auth manages users, password hashing, and persistent sessions in the connected branch's `neon_auth` schema. Do not create competing auth tables or run custom auth migrations. Stripe billing uses `DATABASE_URL` only for its separate application billing table; see the Stripe setup below.

In Neon Auth, confirm email/password authentication is enabled. Confirm the production/custom domain and any preview domains are trusted (the Vercel integration may manage these automatically). Enable localhost access for local development. Use the appropriate branch endpoint for each Vercel environment. If email verification is required, configure Neon email delivery; signup displays a verification notice when no session is issued and sends a callback to `/dashboard`.

The SDK manages persistent HTTP-only, Secure, SameSite cookies and sign-out invalidation. Use HTTPS for deployed environments; use `localhost` for local development. The app stores no password or token in local storage. When configuration is missing, the homepage remains public, account forms are disabled, and auth API calls return 503 rather than a fake successful login.

Fonts and the hero image still load from external services.

Implementation follows the [official Neon Next.js SDK guide](https://github.com/neondatabase/neon-js/blob/main/packages/auth/NEXT-JS.md) and [Neon authentication flow](https://github.com/neondatabase/website/blob/main/content/docs/auth/authentication-flow.md).

## Verification

```sh
pnpm test
pnpm build
pnpm test:integration
```

The HTTP integration tests start temporary production servers on ports 3217/3218/3219, then stop them. They use a test-only upstream substitute and the real Neon SDK to check configuration failure, signup/login routing, persistent cookies, signed-in dashboard rendering, invalid credentials, duplicate accounts, logout cookie deletion, and revoked/forged cookie rejection. They do **not** prove that your live Neon project is configured correctly. The substitute is only imported by the test runner and is never used by application code.

After providing real environment variables, verify with a test account: sign up, complete email verification if required, refresh `/dashboard`, open it in a new tab, log out, and confirm direct access redirects to `/login`. Log in again and check that the same account returns. Confirm users/sessions in the connected branch's Neon Auth console.

The pinned Neon SDK is beta. Its bundled, unused Auth UI package currently declares a peer on the previous SDK beta; the custom forms use only the SDK client/server entry points. Better Auth transitive versions are pinned in `pnpm-workspace.yaml` to match the SDK.

## Stripe subscription setup

The account dashboard uses Stripe Checkout for recurring subscriptions and Stripe's hosted customer portal for billing changes and cancellations. The app keeps the Stripe customer and subscription status in a small application table; Neon Auth remains the source of account identity.

1. In Stripe Dashboard, create a product for the paid Meal Prep Assistant plan and add a recurring Price. Copy its `price_...` ID. The app does not set or assume a dollar amount.
2. Run `db/migrations/001_stripe_billing.sql` once in the Neon SQL Editor for the database branch used by this environment.
3. Enable Stripe's customer portal in Dashboard settings so customers can update or cancel their plan.
4. Set these server-side variables in Vercel for Preview and Production separately: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `DATABASE_URL`, and `APP_URL`. Start with Stripe test-mode keys and test Price ID. `APP_URL` must be the origin of the environment being used. Never use `NEXT_PUBLIC_` for secret keys.
5. For local testing, set `APP_URL=http://localhost:3000`, run the app, then run `stripe listen --forward-to localhost:3000/api/stripe/webhook`. Put the `whsec_...` shown by Stripe CLI in `STRIPE_WEBHOOK_SECRET` for local development.
6. In Stripe Dashboard, register `https://YOUR_DOMAIN/api/stripe/webhook` and subscribe to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`. Use the webhook signing secret for that endpoint as `STRIPE_WEBHOOK_SECRET` in the matching Vercel environment.

The webhook verifies Stripe's signature, syncs subscription status, ignores stale event updates, and acknowledges duplicate deliveries safely. Do not grant paid access based only on the Checkout success redirect; use the webhook-synced subscription status for any future paywall.

The previous GitHub Pages workflow was removed because it published the retained legacy `dist` page. This change does not remove a previously published GitHub Pages site; disable Pages separately in the repository settings if you want to retire that URL. The ignored `.openai/hosting.json` is legacy Sites hosting metadata and is not used by Vercel.
