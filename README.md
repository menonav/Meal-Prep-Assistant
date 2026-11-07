# Meal Prep Assistant

A minimal Next.js App Router app with React. The homepage preserves the original landing page's content, styles, Google Fonts, and Unsplash image. Authentication, databases, AI, and payments are not implemented.

## Local development

Use Node.js 24.x and pnpm 11.25.0 (the version pinned in `package.json`).

```sh
pnpm install
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

## Vercel settings

Import this repository with the **Next.js** framework preset and the repository root as the **Root Directory**. Use Node.js **24.x**.

Leave Build Command, Install Command, and Output Directory at their framework defaults. Vercel should detect pnpm from the lockfile and build with `pnpm build`. If an existing project has static-site overrides, clear them, especially an Output Directory of `dist`. Next.js uses `.next` internally; no custom output configuration or `vercel.json` is needed.

No environment variables are required for this step. Fonts and the hero image still load from external services.

The previous GitHub Pages workflow was removed because it published the retained legacy `dist` page. This change does not remove a previously published GitHub Pages site; disable Pages separately in the repository settings if you want to retire that URL. The ignored `.openai/hosting.json` is legacy Sites hosting metadata and is not used by Vercel.
