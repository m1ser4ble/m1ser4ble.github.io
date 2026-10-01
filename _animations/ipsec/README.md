# IPsec / IKEv2 Motion Canvas demo

Jekyll article: `/system/ipsec-ikev2-motion-canvas/`  
Standalone player: `/assets/animations/ipsec/index.html`

## Scope

Korean educational animation: IKEv2 PSK mutual authentication, initial IKE_SA_INIT + IKE_AUTH, first CHILD SA, directional ESP SAs, and AES-GCM ESP tunnel-mode data protection. Nine chapters, 8 seconds each, 72 seconds at 30 fps. No cryptographic implementation or packet generator.

## Build and edit

Requires Node.js 22 and npm.

```sh
cd _animations/ipsec
npm ci
npm start       # Motion Canvas editor on http://127.0.0.1:9000
npm run build  # writes ../../assets/animations/ipsec
npx tsc --noEmit
npm test
```

Commit the source AND generated assets. GitHub Pages serves the generated files; it does not run the Node build. `_animations/` is intentionally Jekyll-private. No modification of the existing Pages workflow is required.

- `src/handshake.tsx`: actual Motion Canvas generator scene.
- `src/project.meta`: 1280×720 and 30 fps.
- `public/index.html`: standalone accessible controls and player container.
- `public/controls.js`: chapter, seek, play/pause, rate adapter.
- `tests/browser.mjs`: real browser canvas and interaction assertions.

The official web component and runtime are pinned to Motion Canvas 3.17.2. The controls adapter uses its exposed JS `player` instance and calls the core's Player APIs. Re-test the adapter when upgrading. Do NOT set `width`, `height`, or `quality` attributes in the initial custom-element HTML: in 3.17.2 those attribute callbacks call `configure()` before a Player exists. Set resolution through project metadata instead. A build-time Vite CJS deprecation warning comes from the official Vite plugin; it is not a browser runtime error.

## Browser verification

From repository root, in one terminal:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

In another:

```sh
cd _animations/ipsec
npx playwright install chromium
npm run test:browser
```

Optional environment variables:

- `CHROMIUM_PATH`: use an existing compatible Chromium executable.
- `DEMO_URL`: test a deployed standalone player instead of localhost.
- `SCREENSHOT_DIR`: directory for screenshots; defaults to ignored `test-output/`.

Assertions cover actual non-empty canvas rendering, initial paused state, playback advancing, pause, chapter seeking, playback rate, ESP arrow direction, slider, previous/next, restart, no mobile horizontal overflow, and no browser console/runtime errors.

## References

RFC 7296 §§1.2, 2.13–2.17; RFC 4303 §§2–3; RFC 4106 §§3–6. The article includes the detailed citations and simplification boundaries.

The Motion Canvas runtime is MIT licensed; see the deployed `THIRD_PARTY_NOTICES.txt`.
