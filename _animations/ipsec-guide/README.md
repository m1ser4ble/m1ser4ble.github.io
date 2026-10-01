# IPsec tutorial diagrams and article verification

Article: `_posts/2026-10-01-ipsec-from-keys-to-packets.markdown`

This directory preserves Mermaid authoring sources and real-browser article integration tests. Runtime SVG images live under `assets/images/ipsec-guide/`; the article does not require a Mermaid CDN/runtime. `preview.html` is an ignored, temporary Markdown visual preview and is **not** a Jekyll build.

## Mermaid rendering

Tested with `@mermaid-js/mermaid-cli@11.4.2`. Use a compatible installed Chromium. An optional Puppeteer JSON config contains `executablePath` and Chromium launch arguments appropriate to your machine; do not commit machine-specific paths.

From the repository root, for each `roles`, `authentication-gate`, `directional-sas`, and `oidc-enrollment` diagram:

```bash
npm exec --yes --package @mermaid-js/mermaid-cli@11.4.2 -- mmdc \
  -i _animations/ipsec-guide/diagrams/roles.mmd \
  -o assets/images/ipsec-guide/roles.svg \
  -t dark -b transparent -w 1200
```

If Puppeteer's default browser is unavailable, pass `-p <local-puppeteer-config.json>`. Inspect rendered SVGs as actual article `<img>` elements, not only inline SVG; both screenshots and image loading are checked below.

## Browser tests

Install the existing baseline's pinned test dependencies and browser if needed:

```bash
npm ci --prefix _animations/ipsec
npm exec --prefix _animations/ipsec -- playwright install chromium
node _animations/ipsec-guide/tests/embed.mjs
```

`embed.mjs` tests real DOM message handling: origin, iframe source, topic-specific message types, finite bounded heights, and independent resizing for the new explainers and the existing handshake animation.

The integration test accepts `ARTICLE_URL` and `SCREENSHOT_DIR` environment variables. `CHROMIUM_PATH` may select an existing Chromium executable when the Playwright cache/package versions differ.

```bash
ARTICLE_URL=https://m1ser4ble.github.io/system/ipsec-from-keys-to-packets/ \
  node _animations/ipsec-guide/tests/article.mjs
```

It verifies:

- HTTP success and expected article content;
- four static Mermaid SVG figures and four working animated embeds;
- two expandable optional mathematical sections;
- actual nonempty canvas pixels, initial pause, play/pause/restart in each iframe;
- no failed article asset requests or runtime errors;
- desktop and 390px-wide mobile layout and visible controls;
- screenshots of article, figures, and embedded players for visual review.

`test-output/` and `preview.html` are intentionally ignored. Private Discord source exports and citation evidence do not belong in this public repository.

## Animation sources

- `_animations/ipsec`: existing whole-handshake project.
- `_animations/ipsec-explainer`: new `keys`, `mitm`, and `modes` explanation topics.

Build their standalone same-origin assets using each project's README and npm scripts. Follow the repository's existing GitHub Pages deployment; do not add a competing publish workflow.
