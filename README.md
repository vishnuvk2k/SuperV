# SuperV 1.2.1

After Effects CEP panel for Windows, targeting AE 2025 and 2026. Dark gray interface with azure blue **#0080FF**. Includes JavaScript/JSX, JSON defaults, the supplied True Comp Duplicator and FFmpeg.

## Install or update

1. Save your work and close After Effects.
2. Extract the **entire ZIP** to a normal folder.
3. Double-click **INSTALL.cmd**. No administrator account is required.
4. Open AE: **Window > Extensions > SuperV**, or **Extensions (Legacy) > SuperV**.
5. Enable **Edit > Preferences > Scripting & Expressions > Allow Scripts to Write Files and Access Network** for crop and GIF rendering.
6. In SuperV, open **Settings > Test Encoder**. The included FFmpeg is selected automatically.

The installer backs up previous installations to `%APPDATA%\SuperV-Backups` and installs at `%APPDATA%\Adobe\CEP\extensions\SuperV`. Existing CEP identity/settings keys remain compatible. Do not install the JSON separately or use AE's native Plug-ins folder. This personal unsigned extension uses `PlayerDebugMode` in the current Windows user's CSXS 11 and 12 registry keys. The installer retains previous values for optional restoration.

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
- **Crop Comp:** Removes transparent rendered borders, with padding. Full Animation measures every frame; Current Frame/Work Area may crop artwork visible at other times. An opaque full-comp background prevents cropping. Supports 2D comps; precompose 3D artwork first. Duration and key times stay unchanged. Coordinate-dependent expressions and certain parent expressions require baking/precomposing. Full animation can take time and disk space.
- **True Comp Duplicator:** Opens your supplied v3.9.14 script. Select project comps and use its original controls. Its code and credits are retained.
- **Copy/Paste Keys:** Select keyframe diamonds on one source layer. Copies values, timing, easing and supported spatial data. Matching target properties/effects must exist. Matching-time keys are replaced. Optional expressions are copied verbatim. Clipboard lasts until the AE host reloads.
- **Loop:** IN/OUT/both and cycle, ping-pong, offset or continue. Select numeric properties with at least two keys. Zero intervals uses all keys.
- **Wiggle:** Only speed and amount. Applies to Position, including separated dimensions. Reapplying reuses the editable sliders. Non-panel expressions are protected unless replacement is enabled.
- **Counter:** From/to, duration, decimals, prefix/suffix and custom comma spacing. Digits count from the right: 3/3 gives `1,500,000`; 3/2 gives `15,00,000`. Select text or deselect everything to create a layer. Reapply to update formatting. The value remains editable in Effect Controls.
- **Colours:** HEX entry, RGB readout, four recent swatches, shift-click pins and selected/last-watched property capture. Auto-capture does not intercept every colour picker; select the target property or text/shape layer. Applying colour to a keyed property writes at the playhead.
- **GIF:** Comp/work-area/video source, width, FPS, palette, dithering and loops. RGB flattens onto a background. Alpha exports a grayscale mask. RGB + Alpha uses thresholded binary transparency; GIF cannot retain soft alpha. PNG frames are checked before encoding. Failed encoding preserves existing output. Cancel Encoding stops FFmpeg; rendering must finish its active frame first. Maximum 18,000 frames.

## About and uninstall

Done by VisHnu VK and GPT-6 Astra

The minimal About section is at the bottom of Settings. Third-party components: True Comp Duplicator and FFmpeg. Other reference plugins and personal recordings are not bundled.

To uninstall, close AE and double-click **UNINSTALL.cmd**. It moves the installed folder to `%APPDATA%\SuperV-Backups`; projects and media are not deleted. To restore saved registry values too, run `scripts/Uninstall.ps1 -RestoreDebugSettings` in PowerShell before a normal uninstall.

For connection problems, use **Settings > Reconnect to After Effects**. For an old panel name, close AE and reinstall the complete extracted ZIP. See **VALIDATION.md** for completed checks and remaining native verification. Packaging does not automatically install the panel.

## Building from this repository

`SuperV/bin/ffmpeg.exe` is not stored in git because it is over GitHub's 100 MB file limit. Before installing from a clone, run `scripts/Setup-Encoder.ps1` in PowerShell. It downloads FFmpeg into `SuperV/bin`. You can also pass `-EncoderPath C:\path\to\ffmpeg.exe` to copy one you already have.
