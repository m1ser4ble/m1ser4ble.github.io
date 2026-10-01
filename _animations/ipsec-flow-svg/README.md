# IPsec flow — local HTML/SVG player

The three distinct query topics replace only the educational Motion Canvas embeds in the new article. Existing Canvas projects are untouched. This directory owns the source, tests, build helper and documentation; the deployable copies live in `assets/animations/ipsec-flow-svg/`.

## Build and verify

From `/home/sampling/m1ser4ble.github.io`:

```sh
node _animations/ipsec-flow-svg/build.mjs
node _animations/ipsec-flow-svg/tests/browser.cjs
```

The build copies four plain files, with no package install, bundler, CDN, remote font, canvas, or network runtime dependency. The test uses the already installed Playwright at `_animations/ipsec-explainer/node_modules/playwright` and Chromium at `/home/sampling/.cache/ms-playwright/chromium-1228/chrome-linux/chrome`. It starts a loopback HTTP server on an ephemeral port, exercises real browser events and shuts down the server/browser. ARM headless Chromium is launched with GPU disabled for test reliability; nothing in the player requires this flag.

Latest complete run: **15/15 browser tests passed**, including distinct real SVG titles/structures, staged motion, controls, API, keyboard, same-origin iframe height messaging, reduced-motion static final scenes, and embedded widths 320/342/390 px. Output and screenshots go to `test-output/`, ignored by this directory's `.gitignore`.

### Important output files

- `test-output/results.json`: per-test actual browser results.
- `test-output/screenshot-manifest.json`: six sampled diagram screenshots for each of the three topics.
- `test-output/{keys,mitm,handshake}-desktop-final.png`: 720 px final player screenshots.
- `test-output/{keys,mitm,handshake}-embedded-342-final.png`: narrow same-origin iframe screenshots, after height settling.
- `test-output/mitm-proof-in-flight.png`: proof visibly approaching verification before rejection.
- `test-output/handshake-protected-auth.png`: protected control exchange before ESP.
- `test-output/{keys,mitm,handshake}-reduced-motion.png`: static final topic resolutions.

Browser-rendered snapshots were visually inspected. A key badge initially painted behind its Child SA panel and a moving proof initially crossed a verifier label; each was reproduced with a failing browser geometry/paint test before correction. The 320 px overflow regression also failed before the responsive control grid was introduced.

## Integration contract

Use the same-origin URLs:

```text
/assets/animations/ipsec-flow-svg/index.html?topic=keys
/assets/animations/ipsec-flow-svg/index.html?topic=mitm
/assets/animations/ipsec-flow-svg/index.html?topic=handshake
```

Unknown/missing topics fall back to `keys`. Each topic is 14 seconds and initially **paused at zero**. The endpoint is held until the user replays it. Last spatial motion settles around 12.1 seconds for keys, 9.6 for MITM and 12 for handshake, leaving a readable final hold.

Controls have fixed IDs `#play`, `#restart`, `#seek`, `#speed`. Restart resets to zero **paused**. Playback from the end starts again at zero. Seek accepts finite numeric seconds, clamps to `[0, duration]`, keeps the current play state except that seeking to the endpoint stops playback, and ignores non-finite inputs. Speed options are 0.5/1/1.5/2.

```js
window.ipsecSvg.topic       // keys | mitm | handshake
window.ipsecSvg.time        // read-only getter, seconds
window.ipsecSvg.playing     // read-only getter, boolean
window.ipsecSvg.duration    // read-only getter, seconds (14)
window.ipsecSvg.seek(6.5)
window.ipsecSvg.toggle()
window.ipsecSvg.restart()
```

With focus in the player, Space toggles playback; arrows seek ±1 second; Home restarts paused; End seeks to the final scene. Native button/range/select/summary keys are not hijacked. The focusable mobile SVG region also retains native horizontal keyboard scrolling. `prefers-reduced-motion: reduce` displays the topic's static final resolution, disables transport controls and makes transport API calls no-ops. A live preference change is honored.

The player reports actual intrinsic body height, not viewport height or a preset:

```js
parent.postMessage(
  {type: 'ipsec-explainer-height', height: Math.ceil(document.body.getBoundingClientRect().height)},
  location.origin
);
```

ResizeObserver, load, viewport resize and font readiness trigger a coalesced report only when finite positive height changes. The parent must validate origin and source iframe before adjusting that iframe. All tested narrow layouts, including expanded plaintext explanations, stay below the parent's 2000 px limit. No parent assets are changed here.

At ≤560 px, the diagram retains a 680 px native drawing width and scrolls **inside** its border instead of shrinking SVG labels into unreadability. A Korean scroll hint is visible. Headings, captions, fallback paragraphs and controls fit/wrap within the iframe; document width does not overflow. The controls form a compact row plus full-width seek row.

## Content boundaries

All three scenes are schematic teaching diagrams, **not real cryptographic operations, byte-exact packets, captures, or complete protocol implementations**. Korean captions and expanded plaintext give the omitted distinctions; a no-JavaScript paragraph covers all three paths.

- **keys:** provisioned PSK remains parked in a separate credential strip and feeds AUTH only. Public X/Y and nonces travel across the exchange; private a/b stay local. Z moves into local IKE derivation. The IKE key groups identify encryption, AUTH identity-binding and non-AEAD integrity keys (AEAD: zero length for SK_ai/SK_ar). SK_d objects continue down into distinct ESP K_AB/K_BA. AUTH plus Child SA success gates user data. Final labels explicitly show A TX K_AB / RX K_BA and B TX K_BA / RX K_AB.
- **mitm:** the single assumed exchange physically splits into A↔M and M↔B legs. Distinct Z_AM/Z_MB continue into separate IKE key panels that M knows. A copied AUTH object travels into B's exchange-bound verifier, then moves back away on rejection. No approved ESP SA or user data is emitted. M is assumed not to know the strong provisioned PSK; valid IKE message encryption is not peer AUTH.
- **handshake:** time-ordered public IKE_SA_INIT request/response → local Z/IKE keys → protected IKE_AUTH request/response, peer verification and first Child SA → SK_d-derived SA_AB/SA_BA → ESP user/reply IP packets. IKE_AUTH carries identity, AUTH and SA/TS control information, **never user TCP**. Opposite directions have separate keys, SPI and sequence state; each direction has matching sender/receiver symmetric material.

Primary reference boundaries follow the read-only article `_posts/2026-10-01-ipsec-from-keys-to-packets.markdown` and its RFC sources: [RFC 7296](https://www.rfc-editor.org/rfc/rfc7296.txt) §§1.2, 2.14, 2.15, 2.17; [RFC 4301](https://www.rfc-editor.org/rfc/rfc4301.txt) §4.1; [RFC 4303](https://www.rfc-editor.org/rfc/rfc4303.txt); [RFC 5282](https://www.rfc-editor.org/rfc/rfc5282.txt) for IKE AEAD.

## Motion design / test-first process

The installed motion-design skill's Corporate personality is applied: smooth non-linear spatial easing, no overshoot, intentional endpoint/credential staging, and segmented waypoints for long travel. Primary objects carry meaning (public values, Z/key badges, AUTH proof, protected control records, ESP records). Secondary card settling and the temporal stage/progress indicators support the story. No decorative particles or ambient unrelated motion are used.

New behavior was developed through observed RED→GREEN slices: initial paused API; play/pause/restart; finite seek; playback rates; keyboard transport; reduced motion; intrinsic iframe height; keys; MITM; handshake; narrow control regression; keyboard SVG scrolling. Geometry/paint regressions were likewise added before their fixes. Additional final regression tests capture unique real compositions and confirm natural end-of-playback, not only API fields.

Only the two owned directories were written. Blog integration, parent CSS/JS, config, original Canvas projects, git operations and publication remain the parent agent's responsibility.
