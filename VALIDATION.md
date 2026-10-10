# SuperV 1.3.0 validation

## 1.3.0 checks

- Syntax of every panel and host script; every panel control and button is wired to an existing host action.
- New layout rendered in a browser at 360 px wide: every tile, drawer, settings and the status bar (screenshots checked). Hidden controls stay hidden.
- Simulated host: text box (three expressions, parented to the text), all four shape presets, title/upper case with keyframe-safe rewriting, comp resize keeping static and keyed layers centred and parented layers untouched, cursor expression output over time, and split text positions for left- and centre-aligned lines, words and characters.
- **Not yet run inside native After Effects.**

## 1.2.2

## 1.2.2 changes

- Crop Comp: new Fast mode (layer bounds, no rendering) as default; Exact mode renders in batches of 8 at half size with 20 ms file polling and a Cancel button; GIF rendering can now be cancelled too.
- Interrupted renders no longer block later Crop/GIF runs; leftover temporary render comps are removed.
- Fast crop checked in a simulated property model (moving, hidden, parented layers). Not yet verified in native After Effects.

## 1.2.1

## Completed for this build

- Script parsing, JSON and HTML bindings.
- Browser UI: all tabs, 15 presets, five categories, valid timing controls, SuperV branding, HEX/pins, export options and 330px layout.
- Simulated AE transport: four module loads, reconnect state, Unicode, errors and no repeated mutation on lost responses.
- Text engine in a simulated property model: 30 IN/OUT builds, expression values/endpoints and preservation of custom animators. Removed styles are absent.
- Marker regression checks: different layer start and playhead times; lowercase `in`/`out` creation; dragging stretches all units; simultaneous IN/OUT; reapply without duplicates; existing marker reuse and collision protection; duplicate-name rejection; layer trims; missing/out-of-range markers; short layers; rollback on an expression error.
- Simulated organizer: one root, flat COMPS/PRECOMPS and extension folders, stable source references, no comp/footage deletion, repeat runs and unsaved/category-named projects.
- Existing wiggle/counter regression checks: two sliders, separated Position, expression protection and custom comma formatting.
- FFmpeg regression checks: RGB background pixels, grayscale alpha, transparent GIF output, sequence input, special-character paths and preservation of an existing output on failure. Delayed/incomplete PNG handling, missing-frame rejection and transparency crop bounds also passed.

## Native AE verification

**Pending for SuperV 1.2.1.** This build has not been verified inside native After Effects. Earlier native capability-test attempts did not return a report. Native rendering, marker dragging in AE, outline appearance, installation and end-to-end clicks for this build are therefore not claimed as verified. Browser and simulated scripting checks cannot replace a native test.

Earlier versions had native checks on AE 26.3x87 for original host tools and CEP startup. Those results are not a native test of this release. AE 2025 has not been tested natively.

## Limits

Video-inspired presets are recreated motions. Check outline presets with your own fonts and existing styling. Crop/GIF limitations are described in README.md. The supplied duplicator's full option matrix has not been retested.

Development test scripts and personal recordings are excluded from the ZIP. Component licences remain in SuperV/bin and SuperV/vendor.
