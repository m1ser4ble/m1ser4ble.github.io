# IPsec article: rendered diagrams and local SVG motion

Canonical article: `/system/ipsec-from-keys-to-packets/`.

The updated article uses **20 static SVG figures** and **four local SVG animation embeds**. Its 17 learning sections, RFC-based explanations, exact formulas and real commands are retained. Conceptual ASCII diagrams are replaced by figures plus Korean text alternatives. No Mermaid CDN, Canvas renderer, Creator login or third-party animation runtime is needed by the page.

## Authoring assets

- `_animations/ipsec-guide/diagrams/*.mmd`: Mermaid sources; generated images in `assets/images/ipsec-guide/`.
- `tls-esp-protection-boundaries.svg`, `nebula-ipsec-overlay-structure.svg`, `native-esp-nat-t-carriage.svg`: hand-authored native SVG packet layouts, themselves the source.
- `esp-packet-comparison.drawio`: editable draw.io source; corresponding SVG was extracted from the real editor renderer. The embedded Noto CJK font subset is covered by `FONT-LICENSE.txt` in that asset directory.
- `assets/animations/ipsec-packet-svg/{index.html,style.css,player.js}`: canonical source/runtime of the nine-second ESP transport/tunnel sequence, adapted from the tested local SVG comparison.
- `_animations/ipsec-flow-svg/`: reproducible source, build and browser tests for `keys`, `mitm`, `handshake`; runtime under `assets/animations/ipsec-flow-svg/`.

The old `_animations/ipsec` and `_animations/ipsec-explainer` projects remain available to their other article. They are no longer embedded in this canonical article; this change does not delete their assets or alter that separate post.

## Re-render Mermaid

Tested tool: `@mermaid-js/mermaid-cli@11.4.2`. Use a compatible installed Chromium; pass a local Puppeteer config when its default executable is unavailable. Machine-specific executable paths do not belong in committed config.

```sh
npm exec --yes --package @mermaid-js/mermaid-cli@11.4.2 -- mmdc \
  -i _animations/ipsec-guide/diagrams/ike-sa-init-exchange.mmd \
  -o assets/images/ipsec-guide/ike-sa-init-exchange.svg \
  -b '#0b1220' -w 1000
```

New flowcharts configure native SVG labels in their sources (`htmlLabels: false`). Check image rendering, not just inline SVG, after regeneration. Keep topology and packet widths labeled schematic; diagrams are not packet captures or exact byte-scale drawings.

## Tests

Install the existing pinned Playwright dependencies under `_animations/ipsec` or supply the equivalent compatible package. `CHROMIUM_PATH` selects an available browser for the article/message tests.

From the repository root:

```sh
node _animations/ipsec-guide/tests/clock.mjs
node _animations/ipsec-guide/tests/packet-site.mjs
CHROMIUM_PATH=/path/to/chromium node _animations/ipsec-guide/tests/embed.mjs
node _animations/ipsec-flow-svg/tests/browser.cjs
ARTICLE_URL=https://m1ser4ble.github.io/system/ipsec-from-keys-to-packets/ \
  CHROMIUM_PATH=/path/to/chromium \
  node _animations/ipsec-guide/tests/article.mjs
```

`clock.mjs` starts its own ephemeral HTTP server and verifies all four scenes against backward/future animation-callback timestamps. Playback consistently uses the document-local `performance.now()` clock; this prevents negative time in late-loaded iframes.

`packet-site.mjs` starts its own ephemeral local HTTP server. It checks real published packet-player paths, initial pause, speed, reset, both encryption boundaries, actual sizing messages, narrow layout and reduced motion. `embed.mjs` retains origin/source/type/finite bounded-height regression checks, including old message compatibility.

`article.mjs` checks the actual article and every SVG image; all four new iframe URLs; nonempty SVG scenes; initial pause; play/pause/reset; speed selector; keyboard seeking; desktop/390px layout; full iframe height; reduced-motion final states; no failed article assets or page errors. It reports the actual figure count rather than assuming the old four-figure layout. Screenshots are saved to `test-output/` or `SCREENSHOT_DIR` and require visual review; passing behavior tests is not aesthetic approval.

`preview.html` is an ignored temporary Markdown preview, **not a Jekyll build**. If Ruby/Bundler is unavailable, use these browser/static checks locally and verify the real GitHub Pages Jekyll deployment afterward. Deployment continues through the repository's established `master` Pages source; no competing workflow is added.

## Reading and accessibility

Animations start paused, expose play/pause, reset, speed and native keyboard-accessible seek, and use final static views for reduced motion. Field/object continuity explains the transformation instead of unrelated fading boxes. Detailed vector strips may scroll inside their frame on narrow screens; wrapping Korean captions and the packet-player's static HTML structures remain readable without page overflow. Figure links open the full-size SVG.

Private Discord source exports, credential values, local SDK wire logs and screenshots from authenticated sessions are not publication assets.
