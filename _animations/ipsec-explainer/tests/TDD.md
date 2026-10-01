# Observed RED → GREEN evidence

All runtime implementation started after an actual failing browser assertion.

1. Missing project: selected keys URL returned HTTP 404 (expected 200). Implemented initial actual Motion Canvas project and paused controls. GREEN: 23,274 rendered pixels, paused frame 0.
2. Keys controls/storyboard: zero chapter buttons (expected six). Implemented six phases and controls. GREEN: chapter/seek/play/pause/keyboard/speed/restart tests passed, duration 1,079 frames (~36s).
3. Mounted diagram regression: screenshot revealed missing endpoints despite enough pixels. Actual scene traversal did not contain A · Initiator or provisioned PSK. Flattened nested fragment arrays, then GREEN with 37,250 rendered pixels and actual labels.
4. MITM scope: ?topic=mitm still selected keys (expected mitm). Implemented scoped MITM project scene/captions. GREEN: distinct secret labels, false trust, AUTH failure/abort/no ESP; 899 frames (~30s).
5. Modes scope: ?topic=modes still selected keys (expected modes). Implemented packet transformations and independent topology chapter. GREEN: original host addresses and new gateway outer addresses; 719 frames (~24s).
6. Embed: no height messages within 15 seconds. Added same-origin ResizeObserver height notification. GREEN: lazy iframe received height payload, expanded transcript also verified.
7. Visual regression: geometry test failed on overlapping Outer addresses: hostA → hostB and ENCRYPTED: TCP + DATA. Hid obsolete stage label at transport transition. GREEN: all chapter bounds/overlap tests and screenshots passed.

8. Topology cleanup: screenshot showed prior tunnel packet edges protruding around the comparison panel; actual scene visibility test failed (four visible Original IP / NEW outer IP nodes). Hid prior packet shapes and changed endpoint labels to peerA / peerB. GREEN covered all chapters including topology.
9. Duration display: assertion failed at 0초 / 35초 instead of 0초 / 36초 due to a one-frame rounding difference. Rounded only the displayed total to the nearest second; actual duration and seek bounds remain unchanged.

Toolchain discovery failure was not counted as RED: default Playwright executable missing. Used the existing chromium-1228 binary via CHROMIUM_PATH instead of downloading another browser. Tests allow ±1 frame duration rounding from the pinned runtime.
