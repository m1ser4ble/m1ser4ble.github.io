# DDS — native SVG field guide

Source, build and DDS-specific checks live here. `assets/animations/dds/` contains the four deterministic deployment copies. There is no runtime dependency, package install, CDN, remote font, D3, Canvas, or generic animation framework. The HTML/CSS transport follows the existing IPsec SVG player pattern; all eleven DDS compositions and explanatory text are new.

## Build and verification

```sh
node _animations/dds/build.mjs
node _animations/dds/tests/scenes.cjs
PLAYWRIGHT_MODULE=/tmp/dds-browser-tools/node_modules/playwright \
  node _animations/dds/tests/browser.cjs
```

The browser runner uses externally available Playwright (the verified run used 1.58.2) and installed Google Chrome on macOS. `PLAYWRIGHT_MODULE` and `CHROME_EXECUTABLE` can point to other already installed tools. They are test tooling, not site dependencies. The runner starts its own loopback HTTP server on an ephemeral port, closes browser/server, records actual results, and rejects browser page errors. Test artifacts are ignored in `test-output/`.

The DDS checks cover eleven distinct SVG structures and complete topic-specific fallback/caption text, actual moving objects, guide destinations, initial/middle/final semantic states, real play/pause/rates/end behavior, seek finite-input handling, paused restart, keyboard and native form keys, topic changes and invalid-topic fallback, static reduced motion and a live preference change, same-origin intrinsic iframe height messages, all eleven scenes at 320 px, and fixed-label clearance sampled every 0.5 seconds across all fourteen seconds. The fault-state test additionally checks UNKNOWN/HEALTHY/STALE/RECOVERING and recovery counts 1/3, 2/3, 3/3.

Latest full DDS run: **14/14 Chrome browser tests passed**, plus the Node scene/caption/fallback checks. This is a DDS-specific result, independent of the older IPsec test count. `test-output/results.json` holds per-test results; `screenshot-manifest.json` lists 33 SVG screenshots at 0, 7 and 14 seconds. Final scenes and representative intermediate views were visually inspected. These screenshots are checks, not network or device evidence.

## Embed and transport contract

```html
<iframe src="/assets/animations/dds/index.html?topic=qos"
  title="DDS QoS 설명용 애니메이션" loading="lazy"
  style="width:100%;height:760px;border:1px solid #3a4252;border-radius:12px"></iframe>
```

Use Jekyll `relative_url` on the asset path in articles. Valid query topics are:

| Topic | Distinct composition / moving meaning |
| --- | --- |
| `guide` | Ten clickable articles around a learning spine; a reading marker moves through conceptual layers. |
| `basics` | In-process Writer fanout to controller/viewer Readers; keyed instances and independent app responsibilities. |
| `discovery-addressing` | Logical Domain, endpoint information, matching conditions, unmatched Reader, and a separate user-data route. |
| `qos` | Sample, Deadline and Liveliness lanes; loss/retransmission, interval miss, and a still-live Writer. |
| `history-persistence` | Bounded memory, late Reader, optional DB restore route, and separate business commit. |
| `security` | Participant authentication, Topic permissions, SIGN/ENCRYPT distinction, then app control authority. |
| `device-adapters` | TCP/UART/SocketCAN branches, byte pieces, frame assembly, validation/conversion, typed DDS sample. |
| `realtime-linux` | Timer releases, runnable wait, another CPU task, execution, and later DDS publication. |
| `fault-diagnosis` | Active health states, retained-but-unusable value, timeout, and three-sample recovery counter. |
| `observability` | Statistics backend and app log/metric/manual-span routes converging on evidence comparison. |
| `gva-losa` | LOSA scope, distinct UK GVA/NATO NGVA branches, common data contract, DDS and adapter layer. |

Missing/unknown topics fall back to `guide`. A topic selection pauses and resets the timeline, updates the query string, replaces the real SVG composition, and retains reduced-motion behavior. Guide SVG anchors target the top browsing context and resolve relative to the deployed asset directory, preserving a site base URL.

Every topic lasts 14 seconds, starts paused at zero, and holds its final state. The endpoint is reached by 11 seconds, followed by a readable hold. Restart pauses at zero. Play at the endpoint starts again. Finite seek values clamp to `[0, 14]`; non-finite inputs are ignored. Seeking preserves playback except at the endpoint. Speed options are 0.5/1/1.5/2.

```js
window.ddsSvg.topic            // read-only current topic
window.ddsSvg.time             // read-only seconds
window.ddsSvg.playing          // read-only boolean
window.ddsSvg.duration         // 14
window.ddsSvg.seek(7)
window.ddsSvg.toggle()
window.ddsSvg.restart()
window.ddsSvg.setTopic('qos')
```

Space, arrows, Home and End operate the focused player; input/select/button/summary and the SVG scroll region retain native keys. Reduced motion displays the static final scene and disables/no-ops all transport controls/APIs. Topic selection remains available. Preference changes are honored without reload.

The SVG is 680 × 480 with native text. At ≤560 px the drawing retains 680 px width inside a focusable horizontal scroll region. The document, caption, controls and expanded fallback wrap to the available width. No page-wide horizontal overflow is introduced.

Height reports are coalesced and only sent for finite positive intrinsic body height changes:

```js
parent.postMessage({
  type: 'dds-animation-height',
  height: Math.ceil(document.body.getBoundingClientRect().height)
}, location.origin);
```

The parent must validate both the origin and the exact iframe source window before resizing. ResizeObserver, viewport resize, load and font readiness trigger measurement. The player does not alter parent assets.

## Teaching boundaries

All diagrams and time intervals are schematic educational models. They are not RTPS captures, cryptographic implementations, actual scheduler traces, fresh project test results, device measurements, or standards compliance evidence. Topic captions and expanded text repeat these limits; articles provide topic-specific plain-text fallbacks even if JavaScript is unavailable.

The scene contract keeps Domain separate from subnet/authentication, Topic separate from port, Reliability separate from deadline/exactly-once, Liveliness separate from sensor validity, Writer history separate from Reader state/business commit, and DDS security separate from present operating control authority. The persistence example is optional and explicitly scopes Fast DDS 2.11.2 TRANSIENT plugin support. TCP returns payload-byte pieces; UART TTY and SocketCAN are distinct. Linux releases come from an app timer. OTel spans require app instrumentation in this example. LOSA/GVA/NGVA are architectural/standard scopes, not a certification of the local project.

No still-image export, video encoding, real network simulation, hardware calibration, or publish action was needed. Only `_animations/dds/` and its deployment copies are owned by this task.
