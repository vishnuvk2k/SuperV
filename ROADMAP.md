# SuperV roadmap

## 1.3 — built (1.3.0)

Everything below is in 1.3.0 except the update check.

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
- **Text background box** — a rectangle behind a text layer with equal padding on all sides. It follows the text automatically as you type, resize or animate (driven by the text's bounds), with controls for padding, corner roundness, colour and opacity.
- **Shape presets** — one-click circle, rounded rectangle, line or arrow, already centred in the comp.
- **Comp size presets** — 1080p, 4K, Reels/Shorts (1080×1920), Square and Story; one click to create a comp or resize the current one.
- **Update check** — panel tells you when a newer version is on GitHub. (Note: the repo is private, so this needs either a public releases location or a token.)

## Done in 1.2.2
- Crop Comp Fast mode (layer bounds, no rendering) as default; Exact mode in batches at half size, cancellable.
- Fast crop includes shape and text layers.
- Interrupted renders no longer block Crop/GIF; GIF rendering can be cancelled.
- Automatic colour capture removed.
