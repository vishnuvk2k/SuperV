/* SuperV: text background box, split text, change case, typewriter cursor, comp presets, spin and depth. ES3 only. */
function VKMore(h) {
    function hexToRgb(hex) {
        if (!/^#[0-9a-f]{6}$/i.test(String(hex))) h.fail('Enter a six-digit HEX colour, for example #0080FF.');
        return [parseInt(hex.substr(1, 2), 16) / 255, parseInt(hex.substr(3, 2), 16) / 255, parseInt(hex.substr(5, 2), 16) / 255];
    }
    function srcText(l) { return l.property('ADBE Text Properties').property('ADBE Text Document'); }
    function transform(l, name) { return l.property('ADBE Transform Group').property(name); }
    function textLayers(c) {
        var s = c.selectedLayers, r = [], i;
        if (!s.length) h.fail('Select one or more text layers.');
        for (i = 0; i < s.length; i++) {
            if (!s[i].property('ADBE Text Properties')) h.fail('Select text layers only. "' + s[i].name + '" is not a text layer.');
            if (s[i].locked) h.fail('Unlock the selected layers first.');
            r.push(s[i]);
        }
        return r;
    }
    function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

    /* ---------- Text background box ---------- */
    function textBox(o) {
        var c = h.comp(), ls = textLayers(c), rgb = hexToRgb(o.color);
        var pad = h.num(o.padding, 0, 5000), round = h.num(o.roundness, 0, 5000), op = h.num(o.opacity, 0, 100), i;
        for (i = 0; i < ls.length; i++) {
            var t = ls[i], box = c.layers.addShape();
            box.name = 'SuperV Box · ' + t.name;
            box.label = t.label;
            box.moveAfter(t);
            box.property('ADBE Root Vectors Group').addProperty('ADBE Vector Group');
            var group = box.property('ADBE Root Vectors Group').property(1);
            group.name = 'Box';
            group.property('ADBE Vectors Group').addProperty('ADBE Vector Shape - Rect');
            box.property('ADBE Root Vectors Group').property(1).property('ADBE Vectors Group').addProperty('ADBE Vector Graphic - Fill');
            var vecs = box.property('ADBE Root Vectors Group').property(1).property('ADBE Vectors Group');
            vecs.property(2).property('ADBE Vector Fill Color').setValue(rgb);
            box.property('ADBE Effect Parade').addProperty('ADBE Slider Control').name = 'Padding';
            box.property('ADBE Effect Parade').addProperty('ADBE Slider Control').name = 'Roundness';
            var fx = box.property('ADBE Effect Parade');
            fx.property(1).property(1).setValue(pad);
            fx.property(2).property(1).setValue(round);
            if (t.threeDLayer) box.threeDLayer = true;
            box.parent = t;
            // The box lives in the text layer's own space, so it follows its position, scale and rotation.
            transform(box, 'ADBE Anchor Point').setValue(t.threeDLayer ? [0, 0, 0] : [0, 0]);
            transform(box, 'ADBE Position').setValue(t.threeDLayer ? [0, 0, 0] : [0, 0]);
            transform(box, 'ADBE Scale').setValue(t.threeDLayer ? [100, 100, 100] : [100, 100]);
            transform(box, t.threeDLayer ? 'ADBE Rotate Z' : 'ADBE Rotate Z').setValue(0);
            transform(box, 'ADBE Opacity').setValue(op);
            box.inPoint = t.inPoint; box.outPoint = t.outPoint;
            var rect = box.property('ADBE Root Vectors Group').property(1).property('ADBE Vectors Group').property(1);
            var base = '// VK BOX\nvar r=thisLayer.parent.sourceRectAtTime(time,false);\n';
            h.setExpression(rect.property('ADBE Vector Rect Size'), base + 'var p=effect("Padding")(1);\n[r.width+p*2, r.height+p*2];');
            h.setExpression(rect.property('ADBE Vector Rect Position'), base + '[r.left+r.width/2, r.top+r.height/2];');
            h.setExpression(rect.property('ADBE Vector Rect Roundness'), '// VK BOX\neffect("Roundness")(1);');
        }
        return { message: 'Added a background box to ' + plural(ls.length, 'text layer') + '. It resizes with the text. Change Padding and Roundness in Effect Controls.' };
    }

    /* ---------- Split text ---------- */
    function stripAnimators(l) {
        var a = l.property('ADBE Text Properties').property('ADBE Text Animators');
        for (var j = a.numProperties; j >= 1; j--) a.property(j).remove();
    }
    function measure(m, str, justify, time) {
        var st = srcText(m), d = st.value;
        d.text = str;
        d.justification = justify;
        st.setValue(d);
        var r = m.sourceRectAtTime(time, false);
        return { l: r.left, w: r.width };
    }
    function splitText(o) {
        var c = h.comp(), ls = textLayers(c), by = o.by, total = 0, i;
        if (!/^(line|word|character)$/.test(by)) h.fail('Choose lines, words or characters.');
        var LEFT = ParagraphJustification.LEFT_JUSTIFY;
        for (i = 0; i < ls.length; i++) {
            var t = ls[i], st = srcText(t);
            if (st.numKeys) h.fail('"' + t.name + '" has Source Text keyframes. Remove them before splitting.');
            if (st.expression && st.expressionEnabled) h.fail('"' + t.name + '" has a Source Text expression (for example a Counter or Cursor). Remove it before splitting.');
            var doc = st.value;
            if (doc.boxText) h.fail('"' + t.name + '" is paragraph text. Right-click it and choose Convert to Point Text, then split.');
            var anchor = transform(t, 'ADBE Anchor Point');
            if (anchor.numKeys || (anchor.expression && anchor.expressionEnabled)) h.fail('The Anchor Point of "' + t.name + '" is animated. Remove its keyframes or expression first.');
            var lines = String(doc.text).split(/\r\n|\r|\n|\u0003/), units = [], li, k, mt;
            for (li = 0; li < lines.length; li++) {
                var line = lines[li];
                if (by === 'line') { if (/\S/.test(line)) units.push({ text: line, line: li, start: 0 }); continue; }
                if (by === 'word') { var re = /\S+/g; while ((mt = re.exec(line)) !== null) units.push({ text: mt[0], line: li, start: mt.index }); }
                else { for (k = 0; k < line.length; k++) if (/\S/.test(line.charAt(k))) units.push({ text: line.charAt(k), line: li, start: k }); }
            }
            if (!units.length) h.fail('"' + t.name + '" has no text to split.');
            if (units.length > 300) h.fail('That would create ' + units.length + ' layers. Split by lines or words, or shorten the text (300 maximum).');
            var lead = doc.fontSize * 1.2;
            try { if (!doc.autoLeading) lead = doc.leading; } catch (noLeading) {}
            var orig = doc.justification, a0 = anchor.value, time = c.time;
            var m = t.duplicate();
            m.name = 'SuperV measure';
            stripAnimators(m);
            var lineLeft = {}, lineStart = {}, plans = [], u;
            try {
                for (u = 0; u < units.length; u++) {
                    var un = units[u], dx = 0;
                    if (by !== 'line') {
                        if (lineLeft[un.line] === undefined) {
                            lineLeft[un.line] = measure(m, lines[un.line], orig, time).l;
                            lineStart[un.line] = measure(m, lines[un.line], LEFT, time).l;
                        }
                        // Right edge of the unit inside its line, versus the unit on its own; both left-justified.
                        var full = measure(m, lines[un.line].substr(0, un.start + un.text.length), LEFT, time);
                        var alone = measure(m, un.text, LEFT, time);
                        dx = (full.l + full.w - lineStart[un.line] + lineLeft[un.line]) - (alone.l + alone.w);
                    }
                    plans.push({ text: un.text, dx: dx, dy: un.line * lead });
                }
            } finally { m.remove(); }
            var made = [];
            for (u = 0; u < plans.length; u++) {
                var d2 = t.duplicate(), sd = srcText(d2), nd = sd.value;
                nd.text = plans[u].text;
                nd.justification = by === 'line' ? orig : LEFT;
                sd.setValue(nd);
                var na = [a0[0] - plans[u].dx, a0[1] - plans[u].dy];
                if (a0.length > 2) na.push(a0[2]);
                transform(d2, 'ADBE Anchor Point').setValue(na);
                d2.name = t.name + ' · ' + by + ' ' + (u + 1);
                made.push(d2);
            }
            if (o.hideOriginal) t.enabled = false;
            t.selected = false;
            for (u = 0; u < made.length; u++) made[u].selected = true;
            total += made.length;
        }
        return { message: 'Split into ' + plural(total, 'layer') + (o.hideOriginal ? '. The original layer is hidden, not deleted.' : '.') + ' Mixed fonts or colours inside one layer use the first character\'s style.' };
    }

    /* ---------- Change case ---------- */
    function caseOf(s, mode) {
        if (mode === 'upper') return s.toUpperCase();
        if (mode === 'lower') return s.toLowerCase();
        var out = '', start = true, i, ch;
        for (i = 0; i < s.length; i++) {
            ch = s.charAt(i);
            if (/\s/.test(ch)) { start = true; out += ch; }
            else { out += start ? ch.toUpperCase() : ch.toLowerCase(); start = false; }
        }
        return out;
    }
    function recase(d, mode) {
        d.text = caseOf(String(d.text), mode);
        if (mode !== 'upper') { try { d.allCaps = false; d.smallCaps = false; } catch (noCaps) {} }
        return d;
    }
    function changeCase(o) {
        var c = h.comp(), ls = textLayers(c), i, k;
        if (!/^(upper|lower|title)$/.test(o.mode)) h.fail('Choose a case.');
        for (i = 0; i < ls.length; i++) {
            var st = srcText(ls[i]);
            if (st.numKeys) { for (k = 1; k <= st.numKeys; k++) st.setValueAtKey(k, recase(st.keyValue(k), o.mode)); }
            else st.setValue(recase(st.value, o.mode));
        }
        return { message: 'Changed ' + plural(ls.length, 'text layer') + ' to ' + (o.mode === 'upper' ? 'UPPERCASE' : o.mode === 'lower' ? 'lowercase' : 'Title Case') + '.' };
    }

    /* ---------- Typewriter with cursor ---------- */
    function ensureInMarker(c, l, dur) {
        var markers = l.property('ADBE Marker'), k;
        for (k = 1; k <= markers.numKeys; k++) if (markers.keyValue(k).comment === 'in') return;
        var t = Math.min(l.outPoint - c.frameDuration, l.inPoint + dur);
        if (t <= l.inPoint) return;
        for (k = 1; k <= markers.numKeys; k++) if (Math.abs(markers.keyTime(k) - t) < 0.000001) return;
        markers.setValueAtTime(t, new MarkerValue('in'));
    }
    function textCursor(o) {
        var c = h.comp(), ls = textLayers(c), dur = h.num(o.duration, 0.1, 600), blink = h.num(o.blink, 0.1, 20);
        var ch = String(o.cursor || '|'), i;
        if (ch.length < 1 || ch.length > 2) h.fail('Choose a cursor character.');
        for (i = 0; i < ls.length; i++) {
            var ex = srcText(ls[i]).expression;
            if (ex && !/^\/\/ VK CURSOR/.test(ex) && !o.replace) h.fail('"' + ls[i].name + '" already has a Source Text expression (for example a Counter). Turn on Replace existing expressions to use the cursor.');
        }
        var e = '// VK CURSOR\nvar full=String(value);\nvar start=inPoint, end=Math.min(outPoint, inPoint+' + dur + ');\n' +
            'for(var m=1;m<=thisLayer.marker.numKeys;m++){if(thisLayer.marker.key(m).comment==="in"){end=thisLayer.marker.key(m).time;break;}}\n' +
            'end=Math.max(start+0.001, Math.min(outPoint, end));\n' +
            'var p=Math.max(0, Math.min(1, (time-start)/(end-start)));\n' +
            'var n=Math.floor(p*full.length+0.0001);\n' +
            'var on=time<end ? true : (' + (o.keep ? 'true' : 'false') + ' && Math.floor((time-end)*' + (blink * 2) + ')%2===0);\n' +
            'full.substr(0,n)+(on ? ' + h.encode(ch) + ' : "");';
        for (i = 0; i < ls.length; i++) {
            h.setExpression(srcText(ls[i]), e);
            ensureInMarker(c, ls[i], dur);
        }
        return { message: 'Typewriter with cursor applied to ' + plural(ls.length, 'text layer') + '. Drag the "in" layer marker to change the typing speed. Left-aligned text types most cleanly.' };
    }
    function removeCursor() {
        var c = h.comp(), ls = textLayers(c), n = 0, i;
        for (i = 0; i < ls.length; i++) {
            var st = srcText(ls[i]);
            if (/^\/\/ VK CURSOR/.test(st.expression)) { st.expression = ''; n++; }
        }
        return { message: 'Removed the cursor from ' + plural(n, 'text layer') + '.' };
    }

    /* ---------- Comp size presets and SmartResize ---------- */
    var sizes = {
        hd: [1920, 1080, '1080p'], uhd: [3840, 2160, '4K'], vertical: [1080, 1920, 'Reels · Shorts · Story'],
        square: [1080, 1080, 'Square'], portrait: [1080, 1350, 'Portrait 4·5']
    };
    var LAYOUT_NAMES = { fit: 'scaled to fit', fill: 'scaled to fill', spread: 'spread out', center: 'kept centred', none: 'left where they were' };
    function sizeOf(o) {
        if (o.preset === 'custom') return [Math.round(h.num(o.width, 4, 30000)), Math.round(h.num(o.height, 4, 30000)), 'Custom'];
        var p = sizes[o.preset];
        if (!p) h.fail('Choose a size.');
        return p;
    }
    // Rewrite every value of a property (all keyframes, or the single value). Returns false when an expression drives it.
    // tangentFn, when given, also rescales the spatial tangents of manual keyframes so motion paths keep their shape.
    function mapProperty(p, fn, tangentFn) {
        if (!p) return true;
        if (p.expression && p.expressionEnabled) return false;
        var k, rec, saved = [], spatial = false;
        if (!p.numKeys) { p.setValue(fn(p.value)); return true; }
        try { spatial = !!(tangentFn && p.isSpatial); } catch (e0) { spatial = false; }
        for (k = 1; k <= p.numKeys; k++) {
            rec = { v: p.keyValue(k) };
            if (spatial) { try { rec.ti = p.keyInSpatialTangent(k); rec.to = p.keyOutSpatialTangent(k); rec.auto = p.keySpatialAutoBezier(k); } catch (e1) { rec.ti = null; } }
            saved.push(rec);
        }
        for (k = 1; k <= p.numKeys; k++) p.setValueAtKey(k, fn(saved[k - 1].v));
        if (spatial) {
            for (k = 1; k <= p.numKeys; k++) {
                rec = saved[k - 1];
                if (rec.ti && !rec.auto) { try { p.setSpatialTangentsAtKey(k, tangentFn(rec.ti), tangentFn(rec.to)); } catch (e2) { } }
            }
        }
        return true;
    }
    function isPlain(p) { return !p.numKeys && !(p.expression && p.expressionEnabled); }
    // A solid or adjustment layer that exactly covered the old frame, untouched: it should keep covering the new frame.
    function fullFrameSolid(l, oldW, oldH) {
        if (!(l instanceof AVLayer) || l.threeDLayer || l.parent) return false;
        var src = l.source;
        if (!src || !(src.mainSource instanceof SolidSource)) return false;
        if (Math.abs(src.width - oldW) > 1 || Math.abs(src.height - oldH) > 1) return false;
        var pos = transform(l, 'ADBE Position'), sc = transform(l, 'ADBE Scale'), rot = transform(l, 'ADBE Rotate Z'), anc = transform(l, 'ADBE Anchor Point');
        if (pos.dimensionsSeparated || !isPlain(pos) || !isPlain(sc) || !isPlain(rot) || !isPlain(anc)) return false;
        if (Math.abs(rot.value) > 0.01 || Math.abs(sc.value[0] - 100) > 0.01 || Math.abs(sc.value[1] - 100) > 0.01) return false;
        return Math.abs(pos.value[0] - oldW / 2) < 1 && Math.abs(pos.value[1] - oldH / 2) < 1 && Math.abs(anc.value[0] - src.width / 2) < 1 && Math.abs(anc.value[1] - src.height / 2) < 1;
    }
    function fitSolid(l, W, H) {
        var src = l.source;
        transform(l, 'ADBE Scale').setValue([W / src.width * 100, H / src.height * 100, 100]);
        transform(l, 'ADBE Position').setValue([W / 2, H / 2]);
    }
    // g: { oldW, oldH, W, H, kx, ky, kz, s } where kx/ky stretch positions about the frame centre, kz depth and s the layer scale.
    function remapLayer(l, g) {
        var ok = true, pos = transform(l, 'ADBE Position'), poi = null;
        function mx(v) { return g.W / 2 + (v - g.oldW / 2) * g.kx; }
        function my(v) { return g.H / 2 + (v - g.oldH / 2) * g.ky; }
        function point(v) { var a = [mx(v[0]), my(v[1])]; if (v.length > 2) a.push(v[2] * g.kz); return a; }
        function tangent(v) { var a = [v[0] * g.kx, v[1] * g.ky]; if (v.length > 2) a.push(v[2] * g.kz); return a; }
        if (pos.dimensionsSeparated) {
            ok = mapProperty(pos.getSeparationFollower(0), mx) && ok;
            ok = mapProperty(pos.getSeparationFollower(1), my) && ok;
            if (g.kz !== 1 && pos.getSeparationFollower(2)) ok = mapProperty(pos.getSeparationFollower(2), function (v) { return v * g.kz; }) && ok;
        } else ok = mapProperty(pos, point, tangent) && ok;
        if (l instanceof CameraLayer || l instanceof LightLayer) {
            poi = transform(l, 'ADBE Anchor Point');
            if (poi) ok = mapProperty(poi, point) && ok;
        } else if (g.s !== 1) {
            ok = mapProperty(transform(l, 'ADBE Scale'), function (v) { var a = [], i; for (i = 0; i < v.length; i++) a.push(v[i] * g.s); return a; }) && ok;
        }
        if (l instanceof CameraLayer && g.s !== 1) {
            var names = ['ADBE Camera Zoom', 'ADBE Camera Focus Distance', 'ADBE Camera Aperture'], i, q;
            for (i = 0; i < names.length; i++) {
                try { q = l.property('ADBE Camera Options Group').property(names[i]); if (q) ok = mapProperty(q, function (v) { return v * g.s; }) && ok; } catch (e3) { }
            }
        }
        return ok;
    }
    function compPreset(o) {
        var p = sizeOf(o);
        if (o.mode === 'create') {
            var fps = h.num(o.fps, 1, 120), dur = h.num(o.duration, 0.1, 10800);
            var nc = app.project.items.addComp(p[2] + ' ' + p[0] + 'x' + p[1], p[0], p[1], 1, dur, fps);
            nc.openInViewer();
            return { message: 'Created a ' + p[0] + ' × ' + p[1] + ' comp (' + p[2] + ').' };
        }
        var c = h.comp(), W = p[0], H = p[1];
        var layout = o.layout || 'center';
        if (!LAYOUT_NAMES.hasOwnProperty(layout)) h.fail('Choose how the content should follow the new size.');
        if (!o.copy && c.width === W && c.height === H) return { message: 'This comp is already ' + W + ' × ' + H + '.' };
        var oldW = c.width, oldH = c.height, sx = W / oldW, sy = H / oldH;
        var g = { oldW: oldW, oldH: oldH, W: W, H: H, kx: 1, ky: 1, kz: 1, s: 1 };
        if (layout === 'fit' || layout === 'fill') { g.s = layout === 'fit' ? Math.min(sx, sy) : Math.max(sx, sy); g.kx = g.s; g.ky = g.s; g.kz = g.s; }
        else if (layout === 'spread') { g.kx = sx; g.ky = sy; }
        var target = c;
        if (o.copy) { target = c.duplicate(); target.name = c.name + ' ' + W + 'x' + H; }
        target.width = W; target.height = H;
        var skipped = 0, solids = 0, moved = 0, i, l, wasLocked;
        for (i = 1; i <= target.numLayers; i++) {
            l = target.layer(i);
            if (l.parent) continue; // follows its parent
            wasLocked = l.locked; l.locked = false;
            try {
                if (o.solids && fullFrameSolid(l, oldW, oldH)) { fitSolid(l, W, H); solids++; }
                else if (layout !== 'none') { if (remapLayer(l, g)) moved++; else skipped++; }
            } finally { l.locked = wasLocked; }
        }
        if (o.copy) target.openInViewer();
        return { message: (o.copy ? 'Made a ' : 'Resized to a ') + W + ' × ' + H + ' comp, content ' + LAYOUT_NAMES[layout] + '. ' + plural(moved, 'layer') + ' moved' + (solids ? ', ' + plural(solids, 'full-frame solid') + ' refitted' : '') + '.' + (skipped ? ' ' + plural(skipped, 'layer') + ' with a Position, Scale or camera expression ' + (skipped === 1 ? 'was' : 'were') + ' not changed.' : ''), moved: moved, solids: solids, skipped: skipped };
    }


    /* ---------- Rotate forever: spin in place or orbit ---------- */
    var SPIN = 'Spin Speed (deg/sec)', ORBIT_SPEED = 'Orbit Speed (deg/sec)', ORBIT_RADIUS = 'Orbit Radius (px)';
    function spinTargets(l, mode) {
        if (mode === 'spin') return [transform(l, 'ADBE Rotate Z')];
        var pos = transform(l, 'ADBE Position');
        return pos.dimensionsSeparated ? [pos.getSeparationFollower(0), pos.getSeparationFollower(1)] : [pos];
    }
    function setSlider(l, name, v, time) {
        var ctl = l.property('ADBE Effect Parade').property(name);
        if (!ctl) { ctl = l.property('ADBE Effect Parade').addProperty('ADBE Slider Control'); ctl.name = name; }
        var slider = l.property('ADBE Effect Parade').property(name).property(1);
        if (slider.numKeys) slider.setValueAtTime(time, v); else slider.setValue(v);
    }
    function spin(o) {
        var c = h.comp(), ls = c.selectedLayers, mode = o.mode, i, j;
        if (!/^(spin|orbit)$/.test(mode)) h.fail('Choose Spin or Orbit.');
        var speed = h.num(o.speed, 0, 36000) * (o.direction === 'ccw' ? -1 : 1), radius = h.num(o.radius, 0, 100000);
        if (!ls.length) h.fail('Select one or more layers to ' + (mode === 'spin' ? 'spin.' : 'orbit.'));
        var names = mode === 'spin' ? [SPIN] : [ORBIT_SPEED, ORBIT_RADIUS], tag = mode === 'spin' ? 'VK SPIN' : 'VK ORBIT';
        // Check every layer before changing any of them.
        for (i = 0; i < ls.length; i++) {
            var l = ls[i], fx = l.property('ADBE Effect Parade');
            if (l.locked) h.fail('Unlock the selected layers first.');
            if (!fx || !fx.canAddProperty('ADBE Slider Control')) h.fail('"' + l.name + '" cannot hold slider controls (cameras and lights are not supported).');
            for (j = 0; j < names.length; j++) { var ex = fx.property(names[j]); if (ex && ex.matchName !== 'ADBE Slider Control') h.fail('Rename the effect called "' + names[j] + '" on ' + l.name + '. A Slider Control with that name is needed.'); }
            var ts = spinTargets(l, mode);
            for (j = 0; j < ts.length; j++) {
                if (!ts[j].canSetExpression) h.fail('"' + l.name + '" does not support this expression.');
                if (ts[j].expression && ts[j].expression.indexOf('// ' + tag) !== 0 && !o.replace) h.fail('"' + l.name + '" already has a ' + (mode === 'spin' ? 'Rotation' : 'Position') + ' expression. Turn on Replace existing expressions to use ' + (mode === 'spin' ? 'Spin.' : 'Orbit.'));
            }
        }
        for (i = 0; i < ls.length; i++) {
            var layer = ls[i];
            if (mode === 'spin') {
                setSlider(layer, SPIN, speed, c.time);
                h.setExpression(transform(layer, 'ADBE Rotate Z'), '// VK SPIN\nvalue + time*effect(' + h.encode(SPIN) + ')(1);');
            } else {
                setSlider(layer, ORBIT_SPEED, speed, c.time);
                setSlider(layer, ORBIT_RADIUS, radius, c.time);
                var head = '// VK ORBIT\nvar a=degreesToRadians(time*effect(' + h.encode(ORBIT_SPEED) + ')(1));\nvar r=effect(' + h.encode(ORBIT_RADIUS) + ')(1);\n';
                var ps = spinTargets(layer, 'orbit');
                if (ps.length === 2) {
                    h.setExpression(ps[0], head + 'value + Math.cos(a)*r;');
                    h.setExpression(ps[1], head + 'value + Math.sin(a)*r;');
                } else {
                    h.setExpression(ps[0], head + 'var p=value;\np.length>2 ? [p[0]+Math.cos(a)*r, p[1]+Math.sin(a)*r, p[2]] : [p[0]+Math.cos(a)*r, p[1]+Math.sin(a)*r];');
                }
            }
        }
        return { message: (mode === 'spin' ? 'Spinning ' : 'Orbiting ') + plural(ls.length, 'layer') + ' at ' + Math.abs(speed) + '° per second, no keyframes. Change the speed' + (mode === 'orbit' ? ' and radius' : '') + ' in Effect Controls.' };
    }
    function stopSpin() {
        var c = h.comp(), ls = c.selectedLayers, n = 0, i, j, k;
        if (!ls.length) h.fail('Select the spinning or orbiting layers.');
        for (i = 0; i < ls.length; i++) {
            var l = ls[i], hit = false;
            if (l.locked) h.fail('Unlock the selected layers first.');
            var props = spinTargets(l, 'spin').concat(spinTargets(l, 'orbit'));
            for (j = 0; j < props.length; j++) if (/^\/\/ VK (SPIN|ORBIT)/.test(props[j].expression)) { props[j].expression = ''; hit = true; }
            var fx = l.property('ADBE Effect Parade'), names = [SPIN, ORBIT_SPEED, ORBIT_RADIUS];
            for (k = 0; fx && k < names.length; k++) { var e = fx.property(names[k]); if (e && e.matchName === 'ADBE Slider Control') e.remove(); }
            if (hit) n++;
        }
        return { message: 'Stopped spin or orbit on ' + plural(n, 'layer') + '. The layer keeps its own Rotation and Position values.' };
    }

    /* ---------- Depth: spread 2D layers along Z with optional size compensation and camera rig ---------- */
    function depth(o) {
        var c = h.comp(), ls = c.selectedLayers, lens = h.num(o.lens, 5, 1000), spacing = h.num(o.spacing, -100000, 100000), start = h.num(o.start, -100000, 100000);
        var i, used = [], skipped = 0;
        if (!ls.length) h.fail('Select the layers to spread in depth.');
        var sorted = []; for (i = 0; i < ls.length; i++) sorted.push(ls[i]);
        sorted.sort(function (a, b) { return a.index - b.index; });
        if (o.order === 'far') sorted.reverse();
        for (i = 0; i < sorted.length; i++) {
            var l = sorted[i];
            if (l instanceof CameraLayer || l instanceof LightLayer || l.parent || l.locked) { skipped++; continue; }
            var pos = transform(l, 'ADBE Position'), sc = transform(l, 'ADBE Scale');
            if (pos.numKeys || sc.numKeys || pos.dimensionsSeparated || (pos.expression && pos.expressionEnabled) || (sc.expression && sc.expressionEnabled)) { skipped++; continue; }
            used.push(l);
        }
        if (!used.length) h.fail('No layers could be moved. Depth needs unlocked, unparented layers without Position or Scale keyframes or expressions.');
        var cam = c.activeCamera, made = '';
        var zoom = lens * c.width / 36, D = zoom;
        if (cam) {
            zoom = cam.property('ADBE Camera Options Group').property('ADBE Camera Zoom').value;
            var cp = transform(cam, 'ADBE Position').value;
            D = (!cam.parent && cp[2] < 0) ? -cp[2] : zoom;
        } else if (o.camera) {
            cam = c.layers.addCamera('SuperV Camera ' + lens + 'mm', [c.width / 2, c.height / 2]);
            cam.property('ADBE Camera Options Group').property('ADBE Camera Zoom').setValue(zoom);
            transform(cam, 'ADBE Position').setValue([c.width / 2, c.height / 2, -zoom]);
            transform(cam, 'ADBE Anchor Point').setValue([c.width / 2, c.height / 2, 0]);
            var rig = c.layers.addNull(c.duration);
            rig.name = 'SuperV Camera Rig'; rig.threeDLayer = true;
            transform(rig, 'ADBE Position').setValue([c.width / 2, c.height / 2, 0]);
            cam.parent = rig;
            made = ' Added a ' + lens + 'mm camera with a rig null: move or rotate the rig to fly through the layers.';
        }
        var cx = c.width / 2, cy = c.height / 2;
        for (i = 0; i < used.length; i++) {
            var L = used[i], z = start + i * spacing, f = (D + z) / D;
            if (f <= 0.01) h.fail('Layers would end up behind the camera. Use a smaller spacing or start distance.');
            L.threeDLayer = true;
            var P = transform(L, 'ADBE Position'), S = transform(L, 'ADBE Scale'), p0 = P.value, s0 = S.value;
            if (o.keepSize) {
                P.setValue([cx + (p0[0] - cx) * f, cy + (p0[1] - cy) * f, z]);
                S.setValue([s0[0] * f, s0[1] * f, (s0.length > 2 ? s0[2] : 100) * f]);
            } else P.setValue([p0[0], p0[1], z]);
        }
        return { message: 'Spread ' + plural(used.length, 'layer') + ' in depth, ' + spacing + ' px apart' + (o.keepSize ? ', same size through the camera' : '') + '.' + made + (skipped ? ' Skipped ' + plural(skipped, 'layer') + ' (cameras, lights, parented, locked or animated).' : '') };
    }

    // Decomp: unpack selected precomp layers back into the parent comp (the reverse of Precompose).
    function decomp() {
        var c = h.comp(), sel = c.selectedLayers, picked = [], i, k;
        for (i = 0; i < sel.length; i++) if (sel[i].source instanceof CompItem) picked.push(sel[i]);
        if (!picked.length) h.fail('Select one or more precomp layers to unpack.');
        var done = 0, made = 0, notes = [], select = [];
        function isDefault(L, pre) {
            var t = L.property('ADBE Transform Group'), names = ['ADBE Anchor Point', 'ADBE Position', 'ADBE Scale', 'ADBE Rotate Z'], want = [[pre.width / 2, pre.height / 2], [c.width / 2, c.height / 2], [100, 100, 100], 0], j, p, v, w, d;
            if (L.parent) return false;
            for (j = 0; j < names.length; j++) {
                p = t.property(names[j]); if (p.numKeys || p.expressionEnabled) return false;
                v = p.value; w = want[j];
                if (typeof w === 'number') { if (Math.abs(v - w) > 0.001) return false; }
                else for (d = 0; d < w.length && d < v.length; d++) if (Math.abs(v[d] - w[d]) > 0.001) return false;
            }
            return true;
        }
        // AE refuses to copy parented layers or layers with linked expressions while an undo group is open.
        // For those, close the group for the copy and open it again straight after.
        function copyOut(layer, target) {
            try { layer.copyToComp(target); return; } catch (first) {
                if (!/undo group/i.test(String(first.message || first))) throw first;
            }
            app.endUndoGroup();
            try { layer.copyToComp(target); }
            finally { app.beginUndoGroup('SuperV \u00b7 decomp'); }
        }
        function copyProp(from, to) {
            var n;
            if (from.numKeys) { for (n = 1; n <= from.numKeys; n++) to.setValueAtTime(from.keyTime(n), from.keyValue(n)); }
            else to.setValue(from.value);
        }
        for (i = 0; i < picked.length; i++) {
            var L = picked[i], pre = L.source, name = L.name;
            if (L.locked) { notes.push('"' + name + '" is locked'); continue; }
            if (L.threeDLayer) { notes.push('"' + name + '" is 3D'); continue; }
            if (L.timeRemapEnabled) { notes.push('"' + name + '" uses Time Remap'); continue; }
            if (Math.abs(L.stretch - 100) > 0.001) { notes.push('"' + name + '" is time-stretched'); continue; }
            if (!pre.numLayers) { L.remove(); done++; continue; }
            var carrier = null;
            if (!isDefault(L, pre)) {
                carrier = c.layers.addNull(c.duration);
                carrier.name = name + ' (decomp)';
                var lt = L.property('ADBE Transform Group'), ct = carrier.property('ADBE Transform Group'), pn = ['ADBE Anchor Point', 'ADBE Position', 'ADBE Scale', 'ADBE Rotate Z'];
                for (k = 0; k < pn.length; k++) copyProp(lt.property(pn[k]), ct.property(pn[k]));
                carrier.inPoint = L.inPoint; carrier.outPoint = L.outPoint;
                if (L.parent) carrier.parent = L.parent;
                carrier.moveBefore(L);
            }
            var copies = [];
            for (k = 1; k <= pre.numLayers; k++) {
                copyOut(pre.layer(k), c);
                var n = c.layer(1);
                n.startTime = n.startTime + L.startTime;
                if (n.inPoint < L.inPoint) n.inPoint = L.inPoint;
                if (n.outPoint > L.outPoint) n.outPoint = L.outPoint;
                n.moveBefore(L);
                copies.push(n);
            }
            for (k = 1; k <= pre.numLayers; k++) {
                var par = pre.layer(k).parent;
                if (par) copies[k - 1].parent = copies[par.index - 1];
                else if (carrier) copies[k - 1].parent = carrier;
                else if (L.parent) copies[k - 1].parent = L.parent;
                else copies[k - 1].parent = null;
                select.push(copies[k - 1]);
            }
            var lost = [];
            if (L.property('ADBE Transform Group').property('ADBE Opacity').value < 100 || L.property('ADBE Transform Group').property('ADBE Opacity').numKeys) lost.push('opacity');
            if (L.blendingMode !== BlendingMode.NORMAL) lost.push('blend mode');
            if (L.property('ADBE Effect Parade') && L.property('ADBE Effect Parade').numProperties) lost.push('effects');
            if (L.hasTrackMatte) lost.push('track matte');
            if (lost.length) notes.push('"' + name + '" had ' + lost.join(', ') + ' that cannot be passed down');
            L.remove(); done++; made += copies.length;
        }
        for (i = 1; i <= c.numLayers; i++) c.layer(i).selected = false;
        for (i = 0; i < select.length; i++) select[i].selected = true;
        if (!done) h.fail('Nothing was unpacked: ' + notes.join('; ') + '.');
        return { message: 'Unpacked ' + done + ' precomp' + (done === 1 ? '' : 's') + ' into ' + made + ' layer' + (made === 1 ? '' : 's') + '.' + (notes.length ? ' Note: ' + notes.join('; ') + '.' : '') };
    }
    return { decomp: decomp, textBox: textBox, splitText: splitText, changeCase: changeCase, textCursor: textCursor, removeCursor: removeCursor,  compPreset: compPreset, spin: spin, stopSpin: stopSpin, depth: depth };
}
