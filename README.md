# Adrian Moroz’s homepage

A static GitHub Pages site for [adrianmoroz.lt](https://adrianmoroz.lt/). The page uses plain HTML, CSS, and JavaScript; it has no build step or runtime dependencies.

## Update the projects

- **Add a project:** copy an `<article data-carousel-slide>` in `index.html` and update its `<h3>`, description, link, and image. Put the image in `assets/projects/` and give it accurate alt text and intrinsic `width` and `height`. The carousel uses the title to build the project picker. The order in the HTML is the rotation order.
- **Change the timing:** edit `data-interval="7000"` on the carousel in `index.html`. The value is in milliseconds (`7000` is 7 seconds). Use `1000` or more.
- **Change the look or behavior:** edit `assets/site.css` for layout and styles, or `assets/carousel.js` for navigation and autoplay.

Visitors can browse with the arrows or pick a project by name. Hovering over or holding a finger on the featured project temporarily suspends autoplay. Keyboard focus or manual navigation pauses it until the visitor selects **Start autoplay**. It starts paused and transitions are disabled when the visitor prefers reduced motion. Without JavaScript, every project and link is still visible.

## Preview and test

From the repository root, run `python3 -m http.server 8000 --bind 127.0.0.1` and open `http://127.0.0.1:8000/`.

The optional Playwright tests use Node.js and Python 3:

```sh
npm ci
npx playwright install chromium
npm test
```

## Image sources

- Lietuvos atlasas: the [atlas’s own seal illustration](https://github.com/AdrianMoroz/Lietuvos-Atlasas-Pilot/blob/45dd44f711e00cbd1acf5ae1368f55bcab2d60d5/src/assets/illustrations/seal-hero.png).
- The Last Disciple: a screenshot of the first playable courtyard from [the browser game](https://spooky.adrianmoroz.lt/), cropped to remove the interface.

The homepage serves both images as local WebP files.
