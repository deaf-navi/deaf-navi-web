# Web brand mark replacement — 2026-10-28

The user requested replacement of the Deaf Navi Web icon, site logo and favicon with the supplied coral/orange D + hand + three-ray symbol. They clarified that "sitemap" meant the site logo. This request supersedes the earlier logo hold recorded for the stories project in PRODUCT.md.

## Artwork and scope

- `content/brand/deafnavi-icon.png` is the approved transparent, square export from the supplied raster artwork. Background and hand-shaped negative space are transparent; the opaque artwork retains the source colors. No generated redesign is used.
- `scripts/generate-icons.ps1` exports favicon PNGs/ICO, the legacy SVG URL, 192/512 PNGs, an opaque white Apple touch icon and a white maskable icon. The maskable mark is scaled to 70% to keep all three rays within its safe circle.
- Shared static/World and PHP headers, favicon references, manifest and service-worker precache use `20261028logo`. The obsolete blue tile behind the shared mark is removed. Existing wordmark, tagline, page layout and site colors remain.
- The separate iOS application promotion image and OtoMado product icons are outside this website branding change.
- `docs` is regenerated with the domestic and World builders; no generated HTML is hand-edited.

## Validation before release

- Domestic/World builds and verification passed (439 domestic articles / 600 World articles).
- 28 template, structure, GitHub Pages and iOS API compatibility checks passed, plus 10 service-worker checks. Run tests sequentially: the iOS compatibility setup rewrites API JSON, which can race with the Pages byte comparison.
- Browser checks passed at 1280px, 375px, 320px, dark mode, World and guesthouse pages: loaded 192px artwork, transparent corners and header background, current favicon URLs, keyboard focus and no horizontal overflow. No JavaScript page errors.
- Maskable colored-pixel maximum radius: 189.11px, inside the 204.8px safe circle. No colored pixels outside it.
- The UI guideline review found no issues introduced by the logo change. The mechanical detector reported existing navigation underline styles; these are outside the changed mark styling.
- PHP syntax and the complete repository suite run in CI before merge. Public static/PHP checks and image hashes must pass after deployment; local checks alone do not establish deployment.

## Release and recovery

Use the existing GitHub Actions/XServer release workflow, which stages a complete release and switches `/srv/deafnavi/current` atomically while retaining the previous directory. The last successful release observed before this change was `/srv/deafnavi/releases/e52c244d9c19d99090488958799240df94088506-40640288546-1` (deploy run 40640288546). Record the actual previous/current paths from the new deployment logs. Recovery can restore the retained release; a Git revert also restores the source assets and references for subsequent builds. No database or authentication changes are included.
