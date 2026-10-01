# IPsec explanatory Motion Canvas player

Actual TypeScript generator scenes rendered through the pinned Motion Canvas 3.17.2 player. Independent of the existing `_animations/ipsec` project.

## Published entries

`/assets/animations/ipsec-explainer/index.html?topic=keys|mitm|modes`

- `keys`: six 6-second chapters, PSK provisioned before connection vs DH-derived session keys during connection. Public-value exchange, local derivation, protected AUTH, trust change, separate ESP keys.
- `mitm`: five chapters, two DH legs and secrets; keys exist but trust stays false; attacker lacks credentials; AUTH fails; abort before ESP.
- `modes`: four chapters, original packet, transport, tunnel, orthogonal P2P topology.

Unknown/missing topic defaults to keys. Topic selection is scoped in both the actual scene and HTML controls/captions. Canvas labels are brief English; Korean HTML captions and a complete expandable static transcript provide the details. No actual crypto or network exchange occurs.

## Build / test

Node 22 / npm 10. The lockfile is based on the existing pinned tooling, installed with a separate `npm ci`; baseline files were not modified.

```sh
npm ci
npm run build        # ONLY ../../assets/animations/ipsec-explainer is emptied
npm run typecheck
# From repository root, a dedicated server (do not interfere with port 8765):
python3 -m http.server 8767 --bind 127.0.0.1
# From this project:
CHROMIUM_PATH=/absolute/path/to/chromium npm test
```

Optional `DEMO_URL` overrides the target. Playwright can also use its standard installed Chromium when CHROMIUM_PATH is absent. Browser build and runtime are entirely same-site; no CDN, webfont, or remote script dependencies.

## Controls / embedding

Initially paused, including prefers-reduced-motion. Play/pause, restart, previous/next, chapters, native range seek, speed selection. Keyboard Space and arrows on body/player; native button/range keyboard behavior retained. Hidden documents pause and deactivate rendering.

Use a same-origin iframe with `loading="lazy"` and a meaningful title. The player posts `{type: 'ipsec-explainer-height', height: number}` to `location.origin`. Parent must verify exact origin AND `event.source === iframe.contentWindow` before changing height. Closed captions are under the canvas, not overlaid onto animation. Native scrolling remains available for expanded static explanations.

## Verified behavior

`tests/browser.mjs`: real canvas pixels, selected URL topic, no autoplay, playback advancement, pause holds frame, chapter seek, slider, previous/next, restart, speed, keyboard, conceptual scene labels, topic-specific chapter counts, same-origin lazy iframe height messages (including expanded fallback), no console/runtime errors.

`tests/visual.mjs`: all 15 storyboard chapters captured at stable points; visible-label bounds and pairwise overlap checked for every chapter; actual playback changes canvas pixels for EACH topic; 390px mobile no horizontal overflow and reduced-motion initial pause for EACH topic. Results and screenshots go to ignored `test-output/`. Tests are real Chromium, not mocked Player APIs.

A visual regression test caught the original-packet stage label behind the transport encrypted box. It is now hidden on transition. Nested JSX fragment arrays must be flattened before insertion with this pinned runtime; a regression asserts actual mounted endpoints/PSK labels, not merely non-empty pixels.

## Scope / references / limitations

Motion Canvas docs: https://motion-canvas.io/docs/flow (hyphenated domain). Protocol details: RFC 7296 §§2.14–2.17; RFC 4303 §3.1. Exact equations and omitted ESP fields are in static fallback prose. Strong independently provisioned PSK assumed; credentials are never animated across the public network. Signing-key authentication is only an alternative analogy, not mixed with PSK authentication.

MIT Motion Canvas and dependency notices are shipped as `THIRD_PARTY_NOTICES.txt`. Build emits the official plugin's Vite CJS deprecation warning. `npm ci` reports five inherited pinned dependency audit findings (3 moderate, 2 high); `npm audit --omit=dev` reports two transitive findings, xmldom high and speech-rule-engine moderate, through the unused MathJax dependency tree. No dependency upgrades were performed to avoid changing the requested pinned baseline. This player takes no user-provided XML/MathJax input.

No git commits or pushes. Generated static assets must be published alongside source; Jekyll does not run npm builds.
