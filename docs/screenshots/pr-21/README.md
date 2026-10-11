# PR #21 review screenshots

Captured October 11, 2026 from the local production build of the game
implementation at `9ba5c3c`, using Chromium 151 and Playwright. The screenshot
follow-up adds review evidence only; game code is unchanged.

| Image | Capture |
| --- | --- |
| [Stack Attack desktop](stack-attack-desktop.png) | Game frame at a 1280 × 1000 viewport, after six real placements. |
| [Stack Attack phone](stack-attack-phone.png) | Game frame at a 390 × 844 viewport, after six real placements. |
| [Tiny Golf desktop](tiny-golf-desktop.png) | Game frame at a 1280 × 1000 viewport, on hole two after completing hole one. |
| [Tiny Golf phone](tiny-golf-phone.png) | Game frame at a 390 × 844 viewport, ready to putt on hole one. |
| [Stack Attack thumbnail](stack-attack-thumbnail.png) | Its actual home-page catalog card at desktop width. |
| [Tiny Golf thumbnail](tiny-golf-thumbnail.png) | Its actual home-page catalog card at desktop width. |

The game screenshots include the sandboxed iframe and the portal's maximize
control. They use the reduced-motion preference, and were captured directly from
browser elements without compositing. Scores and course progression came from
real game inputs. The capture check
confirmed ten catalog cards, the home-page game count, no frame overflow at both
widths, and no uncaught page errors. Phone screenshots demonstrate layout at phone
width; the earlier touch-input checks are documented separately in the PR.
