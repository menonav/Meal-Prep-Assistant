# Meal Prep Assistant

The existing static website is in `dist/index.html`. No build step or package installation is required. The page uses externally hosted Google Fonts and an Unsplash image.

## Local preview

Open `dist/index.html` in a browser, or serve the `dist` directory with a static web server.

## GitHub Pages

In the repository's **Settings > Pages**, set **Source** to **GitHub Actions**. The included workflow publishes the contents of `dist` on pushes to `main` and can also be run manually from the Actions tab.

The default project URL is https://menonav.github.io/Meal-Prep-Assistant/ once GitHub Pages is enabled and deployment succeeds.
