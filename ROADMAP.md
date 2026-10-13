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

## References shared by VisHnu (kept outside the repo)

- **Depth v1.0.2** by Yat Fung Leung (MIT licence). Spreads selected 2D layers into 3D depth for a parallax look: picks a camera lens (15–200 mm), spaces layers along Z, scales each one so it still looks the same size through the camera, and can add a Camera Controller null. A second button moves layers relative to an existing camera. Idea for SuperV: a **Depth** tile built our own way (no alert pop-ups, one undo step, works with the SuperV status bar). If any of its code is reused, its MIT notice must be kept.
- **TextPlugin.jsxbin**. Compiled ExtendScript (about 3 MB), so its code cannot be read. Not decompiled; we will use its features as reference once VisHnu lists or screenshots the ones he likes.

- **Easify 2 Pro 2.5.0** by Leyero (commercial, aescripts; signed extension for After Effects and Premiere). Only its panel layout and labels were read for feature ideas; its code is not used. What it offers: a custom curve editor (draw your own bezier ease) and a Math mode with In and Out presets (Sine, Quad, Cubic, Quart, Quint, Expo, Circ, Back, Elastic, Bounce); apply to keys **between** selected keyframes, **all** keys, or the motion **path**; an interval for baking extra keyframes; Bounce settings (count, first and last bounce %, custom peaks) and Elastic settings (strength, frequency, length, phase, decay) with a live chart; copy, paste and remove easing; favourite presets; zoom on the graph; plus licence, update check and support pages. Idea for SuperV: an **Ease** tile of our own (see plan below).

## Since 1.3.0 (in code, not packaged yet)
- Preset preview tiles fixed (letters no longer stack one per line).
- Shapes and Colour tools removed from the panel.
- Compact tiles: 62 px high, five per row in wide panels.
- **Spin** tile: rotate forever (spin in place) or orbit around the layer's position, clockwise or counter-clockwise, speed and radius as sliders, no keyframes. Stop removes it again.

## Built in 1.3.2
- **SmartResize** (Comp size tile), **WebM export** (GIF / WebM tile) and the blank-panel fixes. See the README.
- Next: send selected Illustrator and Photoshop artwork to After Effects from a small panel inside each app.

## Planned next (not built) — version 1.5

### Ease tile (inspired by Easify 2 Pro and Easify 4; our own design and code)
1. **Curve graph:** a small graph with two draggable handles; applies to the selected keyframes as normal After Effects easing (editable afterwards in the Graph Editor).
2. **Presets:** Linear, Sine, Quad, Cubic, Quart, Quint, Expo, Circ and Back, for In, Out and In-Out, with a strength slider.
3. **Apply to:** between selected keys, all keys on the selected properties, or the motion path (spatial).
4. **Bounce and Elastic:** after the last keyframe, as editable expression controls (count, height, frequency, decay) or baked keyframes at a chosen interval.
5. **Copy, paste and reset easing.**
6. **Favourites:** save your own curves by name.
7. **Eased time remapping:** enable time remap on footage with a smooth slow-down or speed-up.
8. **One-click transitions:** slide, zoom or fade between layers using the chosen curve.
9. **Align:** line up selected layers to each other or to the comp.
Limit: AE easing between two keys has two handles, so Bounce and Elastic use controls or extra keys. Premiere Pro is not included.

### Depth tile (inspired by Depth v1.0.2)
Spread 2D layers along Z with size compensation, lens choice and an optional camera rig; move layers relative to an existing camera.

### From TextPlugin
Dropped at VisHnu's request.

## Done in 1.2.2
- Crop Comp Fast mode (layer bounds, no rendering) as default; Exact mode in batches at half size, cancellable.
- Fast crop includes shape and text layers.
- Interrupted renders no longer block Crop/GIF; GIF rendering can be cancelled.
- Automatic colour capture removed.
