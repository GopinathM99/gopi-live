# Pocket Mayhem preview evidence

Captured locally in Chromium 151 with Playwright and software WebGL on October 11, 2026. These are screenshots of the implemented game and catalog, not concept art. Phone captures use touch emulation; no physical iPhone/Android or Safari validation was performed.

- `pocket-menu.png`: desktop start screen, 1440 × 960.
- `pocket-upgrade.png`: desktop upgrade choice after granting XP in the browser test.
- `pocket-desktop.png`: combat/boss UI fixture, with the timer, weapon ranks, and enemies set by the browser test to inspect a busy scene quickly.
- `pocket-results.png`: victory screen reached by defeating a final-boss fixture through the damage API. This screenshot does not establish a natural full-run victory.
- `pocket-phone-menu.png`, `pocket-phone.png`, `pocket-phone-upgrade.png`: 390 × 844 menu, combat fixture, and upgrade screen.
- `pocket-320.png`, `pocket-844.png`: narrow phone and landscape gameplay layout checks.
- `pocket-catalog.png`, `pocket-catalog-phone.png`: catalog with all three prototypes and the new game shortlisted.
- `catalog-before.png`, `catalog-before-phone.png`: the prior two-game catalog, rendered from the branch's pre-change HTML and CSS.

The browser test instruments the engine constructor in the test context only. No debug globals, cheat controls, or test hooks ship in the game. Actual keyboard controls and Chromium's native multitouch events exercise movement and simultaneous stick/dash input. Menu navigation, difficulty selection, daily mode, mute, pause/resume, card selection/rerolls, Overdrive, death/restart, victory/overtime, and saved run totals are checked through the UI.

A separate opaque-origin iframe uses the portal's `sandbox="allow-scripts allow-pointer-lock"` restrictions to check unavailable storage, movement, dash, results, and restart. Pocket Mayhem has no production `/play/pocket-mayhem` route because this PR remains preview-only.

The pure simulation suite in `apps/portal/public/playground/tests/pocket-mayhem.test.cjs` independently completes full-length runs with all three robots, using a deterministic movement/upgrade bot without modifying health or weapon ranks. Automated success does not establish human difficulty or enjoyment; this preview is intended for that feedback.

Additional checks cover actual landscape touch movement/cancellation, corrupt storage, reduced-motion startup, automatic pause on blur, and the reload/exit screen for unavailable or lost WebGL contexts.

There is no before-game screenshot because Pocket Mayhem did not exist. Before/after catalog screenshots are included. All new runtime files are local; browser validation checks for failed requests and uncaught script errors.
