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

Generate the cookie secret locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`, then save it directly in Vercel or your ignored `.env.local`. Never paste it into chat or commit it. For local testing, copy `.env.example` to `.env.local` and fill the two values privately, or pull Development variables with an authenticated Vercel CLI. Changes in Vercel apply to subsequent deployments; restart the local server after changing `.env.local`.

This app does not need `NEXT_PUBLIC_*` credentials or a direct `DATABASE_URL` for authentication. Neon Auth manages users, password hashing, and persistent sessions in the connected branch's `neon_auth` schema. Do not create competing auth tables or run custom auth migrations. Existing database variables supplied by Neon can stay in Vercel for future application data.

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

The HTTP integration tests start temporary production servers on ports 3217/3218, then stop them. They use a test-only upstream substitute and the real Neon SDK to check configuration failure, signup/login routing, persistent cookies, signed-in dashboard rendering, invalid credentials, duplicate accounts, logout cookie deletion, and revoked/forged cookie rejection. They do **not** prove that your live Neon project is configured correctly. The substitute is only imported by the test runner and is never used by application code.

After providing real environment variables, verify with a test account: sign up, complete email verification if required, refresh `/dashboard`, open it in a new tab, log out, and confirm direct access redirects to `/login`. Log in again and check that the same account returns. Confirm users/sessions in the connected branch's Neon Auth console.

The pinned Neon SDK is beta. Its bundled, unused Auth UI package currently declares a peer on the previous SDK beta; the custom forms use only the SDK client/server entry points. Better Auth transitive versions are pinned in `pnpm-workspace.yaml` to match the SDK.

The previous GitHub Pages workflow was removed because it published the retained legacy `dist` page. This change does not remove a previously published GitHub Pages site; disable Pages separately in the repository settings if you want to retire that URL. The ignored `.openai/hosting.json` is legacy Sites hosting metadata and is not used by Vercel.
