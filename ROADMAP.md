# SuperV roadmap

## 1.3 — planned (not built yet)

### New layout (from VisHnu's sketch)
- Name at top, two large tabs: **Effects** and **Text**.
- Effects: tool tiles in rows of four (Null, Crop, Copy keys, Paste keys, Loop, Wiggle, Counter, GIF, Organize, Duplicate, Colour). Clicking a tile opens its options under the grid.
- Text: preset tiles with category row on top; In/Out, Duration, Stagger and the Animate button below.
- Settings and About open from the gear. About credits: VisHnu VK, GPT-6 Astra and Claude.
- Proper main button: 40 px, centred, icon + layer-count pill; hover, pressed, nothing-selected, working (fills up) and done (green) states.
- Recent colours removed. Colour is a tile with HEX entry, pinned colours, Sample and Apply. Nothing is remembered unless pinned.

### Features chosen
- **Split text** — break a text layer into one layer per line, word or character, keeping positions.
- **Change case** — switch selected text layers to UPPERCASE, lowercase or Title Case.
- **Typewriter cursor** — blinking cursor that follows the Typewriter preset.
- **Update check** — panel tells you when a newer version is on GitHub. (Note: the repo is private, so this needs either a public releases location or a token.)

## Done in 1.2.2
- Crop Comp Fast mode (layer bounds, no rendering) as default; Exact mode in batches at half size, cancellable.
- Fast crop includes shape and text layers.
- Interrupted renders no longer block Crop/GIF; GIF rendering can be cancelled.
- Automatic colour capture removed.
