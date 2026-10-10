# SuperV 1.3.1

After Effects CEP panel for Windows, targeting AE 2025 and 2026. Dark gray interface with azure blue **#0080FF**. Includes JavaScript/JSX, JSON defaults, the supplied True Comp Duplicator and FFmpeg.

## Install or update

1. Save your work and close After Effects.
2. Extract the **entire ZIP** to a normal folder.
3. Double-click **INSTALL.cmd**. No administrator account is required.
4. Open AE: **Window > Extensions > SuperV**, or **Extensions (Legacy) > SuperV**.
5. Enable **Edit > Preferences > Scripting & Expressions > Allow Scripts to Write Files and Access Network** for crop and GIF rendering.
6. In SuperV, open **Settings > Test Encoder**. The included FFmpeg is selected automatically.

The installer backs up previous installations to `%APPDATA%\SuperV-Backups` and installs at `%APPDATA%\Adobe\CEP\extensions\SuperV`. Existing CEP identity/settings keys remain compatible. Do not install the JSON separately or use AE's native Plug-ins folder. This personal unsigned extension uses `PlayerDebugMode` in the current Windows user's CSXS 11 and 12 registry keys. The installer retains previous values for optional restoration.

## New in 1.3

**New layout.** Two big tabs, **Effects** and **Text**. Each shows tool tiles; click a tile and its options open underneath with one main button. Settings and About are behind the gear. Results show in the status bar at the bottom; the main button shows working, done (green) or error (red).

**Effects tiles:** Null · Crop · Keyframes (copy/paste) · **Ease** · Loop · Wiggle · **Spin** · **Depth** · Counter · **Comp size** · GIF · Organize · Duplicate.

**Text tiles:** Animate (the 15 presets) · **Text box** · **Split text** · **Case** · **Cursor**.

- **Text box:** a rectangle behind each selected text layer with equal padding on every side. It is parented to the text and sized by an expression, so it follows typing, resizing and movement. Padding and Roundness are sliders in Effect Controls; colour and opacity are set when you add it.
- **Split text:** one layer per line, word or character, each in its original place. Point text only, no Source Text keyframes or expressions, up to 300 pieces. The original is hidden, not deleted. Mixed styles inside one layer take the first character's style.
- **Case:** UPPERCASE, lowercase or Title Case, including Source Text keyframes.
- **Cursor:** types the text in from the layer start to its "in" marker with a blinking cursor (|, _, ▌ or █). Optional blinking after typing. Remove cursor takes it off again.
- **Shapes:** circle, rounded rectangle, line or arrow, centred in the comp, in your colour.
- **Comp size:** 1080p, 4K, Reels · Shorts · Story (1080×1920), Square, Portrait 4:5. Create a new comp, or resize the current one with content kept centred.
- **Ease:** a draggable two-handle curve with Value and Speed graph views, presets from Sine to Back for in, out and in-out, a strength slider and editable curve values. Applies as native After Effects easing (speed and influence per dimension, one speed along spatial paths), between selected keyframes or on all keys.
- **Spin:** rotate forever in place, or orbit around the layer's own position, clockwise or counter-clockwise. Speed and radius become sliders in Effect Controls; no keyframes. Stop removes it again.
- **Depth:** spread selected 2D layers along Z for parallax, with lens choice, spacing and optional size compensation so nothing appears to move until the camera does. Uses an existing camera, or adds one with a rig null.
- **Colour and Shapes were removed** from the panel.
- **About** shows the connected After Effects version, whether FFmpeg was found, tool counts, Copy diagnostics, Install folder and a GitHub link.

## Text animation — 15 presets

| Category | Presets |
| --- | --- |
| BASIC | Slide Up, Word Reveal, Tracking, Gentle Scale |
| FADE & REVEAL | Fade Up Characters, Slow Fade On, Typewriter |
| SLIDE & SCALE | Ease Lines Up, Ease Lines From Left, Character Scale In, Line Sweep From Left |
| BLUR | Blur By Word, Opposing Line Slide |
| OUTLINE | Outline to Fill — Characters, Outline to Fill — Lines |

Removed in this update: Line Wipe, Fade Up Lines, Fade Up Words, Word Dissolve, Phrase Fade and Multiline Word Reveal. The earlier excluded styles remain excluded.

Select a category/card, set timing and IN/OUT, select text layers and click **Apply Animation**. IN starts at the layer in-point and finishes at its lowercase `in` marker. OUT starts at its lowercase `out` marker and finishes at the layer out-point. The playhead is ignored. Apply each direction separately to use both; reapplying replaces only that direction. Other animators and your font remain intact. Initial Duration sets the first marker spacing, including all staggered units. Drag the marker to stretch the entire animation proportionally. Existing `in`/`out` markers are reused at their current times; unrelated markers are never overwritten. Duplicate names produce an explanatory error. Keep `in` before `out` for a visible hold between animations. Out-of-range markers are clamped to the layer bounds; deleting a timing marker falls back to Initial Duration. Trimming the layer changes the corresponding start/end automatically. **Remove Animation** removes only panel-created animators. Internal VK markers remain compatible with earlier projects.

Previews use **SuperV** in Helvetica-style typography with Arial fallback. Line/word previews repeat the name to show sequencing. **Create AE Preview** makes an actual composition for playback. These are recreated motions, not copies of proprietary preset files. Outline presets use text fill/stroke animators.

## File organizer

One root uses the saved project's name, without its extension. Unsaved projects use UNTITLED. Only needed folders are created.

```text
PROJECT NAME
├── COMPS
│   ├── Main compositions
│   └── PRECOMPS
│       └── All compositions used inside another composition
├── PNG
├── JPG
├── PSD
├── MP4
├── MOV
├── MP3
├── WAV
├── SOLIDS
└── Other file extensions, as needed
```

All PNG footage goes directly into PNG; JPG/JPEG share JPG. Sequences use their source extension. Existing custom folders, including imported layered-file folders, are flattened. Only empty old project folders are deleted. Compositions, footage items and disk files remain intact. Running again reuses the structure. AE Undo restores the previous layout. A composition used by another comp is classified as a precomp, even if it is also used for output.

## Other tools retained

- **Null:** Comp centre or unparented 2D selection centre, with optional parenting.
- **Crop Comp:** Removes transparent borders, with padding. **Fast** (default) measures each visible layer's box over the range in about a second, without rendering. Effects that draw outside a layer (glow, shadow) and precomp/alpha-footage content are measured by their box, so the panel warns you to add padding or use Exact. **Exact** renders frames at half size in batches and reads real pixels; it can be cancelled. An opaque full-comp background prevents cropping. Supports 2D comps; precompose 3D artwork first. Duration and key times stay unchanged. Coordinate-dependent expressions and certain parent expressions require baking/precomposing.
- **True Comp Duplicator:** Opens your supplied v3.9.14 script. Select project comps and use its original controls. Its code and credits are retained.
- **Copy/Paste Keys:** Select keyframe diamonds on one source layer. Copies values, timing, easing and supported spatial data. Matching target properties/effects must exist. Matching-time keys are replaced. Optional expressions are copied verbatim. Clipboard lasts until the AE host reloads.
- **Loop:** IN/OUT/both and cycle, ping-pong, offset or continue. Select numeric properties with at least two keys. Zero intervals uses all keys.
- **Wiggle:** Only speed and amount. Applies to Position, including separated dimensions. Reapplying reuses the editable sliders. Non-panel expressions are protected unless replacement is enabled.
- **Counter:** From/to, duration, decimals, prefix/suffix and custom comma spacing. Digits count from the right: 3/3 gives `1,500,000`; 3/2 gives `15,00,000`. Select text or deselect everything to create a layer. Reapply to update formatting. The value remains editable in Effect Controls.
- **Colours:** HEX entry, RGB readout, four recent swatches and shift-click pins. Recent colours change only when you apply or sample a colour; nothing is captured automatically. Select a colour property, or a text/shape layer, then apply. Applying colour to a keyed property writes at the playhead.
- **GIF:** Comp/work-area/video source, width, FPS, palette, dithering and loops. RGB flattens onto a background. Alpha exports a grayscale mask. RGB + Alpha uses thresholded binary transparency; GIF cannot retain soft alpha. PNG frames are checked before encoding. Failed encoding preserves existing output. Cancel Encoding stops FFmpeg; rendering must finish its active frame first. Maximum 18,000 frames.

## About and uninstall

Done by VisHnu VK, GPT-6 Astra and Claude

The minimal About section is at the bottom of Settings. Third-party components: True Comp Duplicator and FFmpeg. Other reference plugins and personal recordings are not bundled.

To uninstall, close AE and double-click **UNINSTALL.cmd**. It moves the installed folder to `%APPDATA%\SuperV-Backups`; projects and media are not deleted. To restore saved registry values too, run `scripts/Uninstall.ps1 -RestoreDebugSettings` in PowerShell before a normal uninstall.

For connection problems, use **Settings > Reconnect to After Effects**. For an old panel name, close AE and reinstall the complete extracted ZIP. See **VALIDATION.md** for completed checks and remaining native verification. Packaging does not automatically install the panel.

## Building from this repository

`SuperV/bin/ffmpeg.exe` is not stored in git because it is over GitHub's 100 MB file limit. Before installing from a clone, run `scripts/Setup-Encoder.ps1` in PowerShell. It downloads FFmpeg into `SuperV/bin`. You can also pass `-EncoderPath C:\path\to\ffmpeg.exe` to copy one you already have.
