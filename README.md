# Adrian Moroz’s homepage

The React homepage for [adrianmoroz.lt](https://adrianmoroz.lt/). Vite builds a static site in `dist/`. The built HTML already contains the intro and the project cards, so both links work before React loads and when JavaScript is disabled. No server-side React runtime is needed on GitHub Pages.

## Update the projects

- **Add or reorder projects:** edit the `projects` array in `src/projects.js`. Give each project a unique `id`, title, category, description, link label, URL, and cover image. Put images in `public/assets/projects/`, with accurate alt text and intrinsic width and height.
- **Change autoplay:** edit `rotationIntervalMs` in the same file. The default is `7000` (7 seconds); use a whole number of at least `1000` milliseconds.
- **Change the page:** `src/App.jsx` owns the intro, `src/ProjectCarousel.jsx` owns the cards and controls, `src/useCarousel.js` owns the carousel behavior, and `src/site.css` owns the styling.

Hovering over or holding a finger on a card temporarily suspends autoplay. Keyboard focus or manual navigation pauses it until the visitor selects **Start autoplay**. It starts paused and skips transitions when the visitor prefers reduced motion.

## Preview and test

Use Node.js 22.12 or newer (the workflow uses Node.js 24).

```sh
npm ci
npm run dev       # Development server
npm run build     # Build and prerender dist/
npm run preview   # Serve the production build locally
```

The Playwright suite builds and serves the production site before testing it:

```sh
npx playwright install chromium
npm test
```

## Publish on GitHub Pages

In the repository’s **Settings → Pages**, use **GitHub Actions** as the source and keep `adrianmoroz.lt` as the custom domain. The workflow in `.github/workflows/pages.yml` builds pull requests and deploys `dist/` from `main`. No change to DNS or either project subdomain is needed. The existing root `CNAME` is preserved; the custom domain for an Actions deployment is managed in Pages settings.

## Image sources

- Lietuvos atlasas: the [atlas’s own seal illustration](https://github.com/AdrianMoroz/Lietuvos-Atlasas-Pilot/blob/45dd44f711e00cbd1acf5ae1368f55bcab2d60d5/src/assets/illustrations/seal-hero.png).
- The Last Disciple: a screenshot of the first playable courtyard from [the browser game](https://spooky.adrianmoroz.lt/), cropped to remove the interface.
