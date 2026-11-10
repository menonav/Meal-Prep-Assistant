# Meal Prep Assistant

A Next.js App Router app with managed Neon Auth, an account-synced weekly planner, a Stripe premium checkout, and an AI fridge-photo recipe feature. The free planner stores each signed-in user's weekly plan and shopping-list state in Neon Postgres. Premium members can upload a fridge photo to identify ingredients and get three practical recipes they can add to the weekly plan. The image is sent to OpenAI for analysis and is not stored by this app.

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
- `/dashboard`: server-protected account page with logout and a link to the planner.
- `/planner`: server-protected weekly meal planner with sample recipes, AI recipe suggestions, serving adjustments, and a combined shopping list. Plan state is stored in Neon by authenticated user; browser-only legacy plans can be imported after confirmation.
- `app/api/auth/[...path]/route.js`: same-origin SDK proxy; secrets stay on the server.
- `app/api/planner/route.js`: authenticated read/write API for account-owned planner data.
- `app/api/ai/fridge/route.js`: authenticated, premium-gated photo analysis via OpenAI Responses API.
- `app/api/stripe/`: Checkout Session creation, verified webhook, and confirmed payment return.
- `lib/app-data.js`: Neon Postgres storage for meal plans, premium entitlements, and a five-scan daily AI limit.
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
| `DATABASE_URL` | The Postgres connection string for the matching Neon branch; the app creates its planner and entitlement tables on first use. |

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

This app does not need `NEXT_PUBLIC_*` credentials or a direct `DATABASE_URL` for authentication. Neon Auth manages users, password hashing, and persistent sessions in the connected branch's `neon_auth` schema. Do not create competing auth tables or run custom auth migrations. Existing database variables supplied by Neon can stay in Vercel for future application data.

In Neon Auth, confirm email/password authentication is enabled. Confirm the production/custom domain and any preview domains are trusted (the Vercel integration may manage these automatically). Enable localhost access for local development. Use the appropriate branch endpoint for each Vercel environment. If email verification is required, configure Neon email delivery; signup displays a verification notice when no session is issued and sends a callback to `/dashboard`.

The SDK manages persistent HTTP-only, Secure, SameSite cookies and sign-out invalidation. Use HTTPS for deployed environments; use `localhost` for local development. The app stores no password or token in local storage. When configuration is missing, the homepage remains public, account forms are disabled, and auth API calls return 503 rather than a fake successful login.

Fonts and the hero image still load from external services.

## AI recipes and Stripe checkout

Add these server-side environment variables in Vercel. Do not paste secret values into GitHub or chat:

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Key for the AI fridge-photo analysis. The default model is `gpt-4.1-mini`; set `OPENAI_MODEL` only if you choose another vision-capable Responses API model. |
| `STRIPE_SECRET_KEY` | Stripe API key. Use a test-mode key while testing. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the Stripe webhook endpoint below. |
| `STRIPE_PRICE_CENTS` | One-time premium price in cents; defaults to `100` ($1.00). |

Create a Stripe webhook endpoint at `https://meal-prep-assistant-avinash-menon.vercel.app/api/stripe/webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`, then save its signing secret as `STRIPE_WEBHOOK_SECRET`. Checkout creates a one-time premium payment. The signed webhook (and the verified success return) records paid access in Neon; returning to the site alone never grants it. Set the same branch-specific `DATABASE_URL` used by the app so that entitlement can be saved.

Use Stripe **test mode** and its documented test card numbers to check the flow first. When switching to live mode, replace both the Stripe API key and webhook signing secret with live-mode values. Vercel Preview requires its own available keys and a webhook pointing to the Preview deployment if you want to test payments there.

## Demo account and submission evidence

The app grants premium access to `demo@demo.com` so the assignment demo login can use the AI feature without checkout. The Neon Auth user still needs to exist. In the Production branch's Neon Better Auth settings, turn off the email-verification requirement, create the assignment-specified demo account through `/signup`, then confirm you can log in through `/login`. Keep this account; the grader logs in and does not create it.

For the required Neon screenshot, create a fresh account through `/signup` immediately before submission, then open the Production branch's Neon SQL editor and run:

```sql
SELECT id, email, "emailVerified", "createdAt"
FROM neon_auth."user"
ORDER BY "createdAt" DESC;
```

Capture the result with several real account rows visible, without showing password hashes or secrets. Put that screenshot, the production URL, and the GitHub repository link in the one-page Canvas submission.

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

The previous GitHub Pages workflow was removed because it published the retained legacy `dist` page. This change does not remove a previously published GitHub Pages site; disable Pages separately in the repository settings if you want to retire that URL. The ignored `.openai/hosting.json` is legacy Sites hosting metadata and is not used by Vercel.
