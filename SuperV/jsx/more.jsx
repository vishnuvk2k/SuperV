/* SuperV 1.3: text background box, split text, change case, typewriter cursor, shape and comp presets. ES3 only. */
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

    /* ---------- Shape presets ---------- */
    function vectors(L) { return L.property('ADBE Root Vectors Group').property(1).property('ADBE Vectors Group'); }
    function openPath(points) {
        var s = new Shape(), ins = [], outs = [], k;
        for (k = 0; k < points.length; k++) { ins.push([0, 0]); outs.push([0, 0]); }
        s.vertices = points; s.inTangents = ins; s.outTangents = outs; s.closed = false;
        return s;
    }
    function shapePreset(o) {
        var c = h.comp(), kind = o.kind, rgb = hexToRgb(o.color);
        var names = { circle: 'Circle', roundrect: 'Rounded Rectangle', line: 'Line', arrow: 'Arrow' };
        if (!names[kind]) h.fail('Choose a shape.');
        var L = c.layers.addShape();
        L.name = 'SuperV ' + names[kind];
        L.property('ADBE Root Vectors Group').addProperty('ADBE Vector Group');
        L.property('ADBE Root Vectors Group').property(1).name = names[kind];
        if (kind === 'circle') {
            var d = h.num(o.size, 1, 30000);
            vectors(L).addProperty('ADBE Vector Shape - Ellipse');
            vectors(L).addProperty('ADBE Vector Graphic - Fill');
            vectors(L).property(1).property('ADBE Vector Ellipse Size').setValue([d, d]);
            vectors(L).property(2).property('ADBE Vector Fill Color').setValue(rgb);
        } else if (kind === 'roundrect') {
            var w = h.num(o.width, 1, 30000), ht = h.num(o.height, 1, 30000), r = h.num(o.roundness, 0, 15000);
            vectors(L).addProperty('ADBE Vector Shape - Rect');
            vectors(L).addProperty('ADBE Vector Graphic - Fill');
            vectors(L).property(1).property('ADBE Vector Rect Size').setValue([w, ht]);
            vectors(L).property(1).property('ADBE Vector Rect Roundness').setValue(r);
            vectors(L).property(2).property('ADBE Vector Fill Color').setValue(rgb);
        } else {
            var len = h.num(o.size, 1, 30000), sw = h.num(o.stroke, 0.5, 1000);
            vectors(L).addProperty('ADBE Vector Shape - Group');
            vectors(L).property(1).property('ADBE Vector Shape').setValue(openPath([[-len / 2, 0], [len / 2, 0]]));
            if (kind === 'arrow') {
                var hd = Math.max(sw * 2.4, len * 0.12);
                vectors(L).addProperty('ADBE Vector Shape - Group');
                vectors(L).property(2).property('ADBE Vector Shape').setValue(openPath([[len / 2 - hd, -hd * 0.8], [len / 2, 0], [len / 2 - hd, hd * 0.8]]));
            }
            vectors(L).addProperty('ADBE Vector Graphic - Stroke');
            var stroke = vectors(L).property(vectors(L).numProperties);
            stroke.property('ADBE Vector Stroke Color').setValue(rgb);
            stroke.property('ADBE Vector Stroke Width').setValue(sw);
            try { stroke.property('ADBE Vector Stroke Line Cap').setValue(2); stroke.property('ADBE Vector Stroke Line Join').setValue(2); } catch (noCap) {}
        }
        transform(L, 'ADBE Position').setValue([c.width / 2, c.height / 2]);
        return { message: 'Added a ' + names[kind].toLowerCase() + ' in the centre of the comp.' };
    }

    /* ---------- Comp size presets ---------- */
    var sizes = {
        hd: [1920, 1080, '1080p'], uhd: [3840, 2160, '4K'], vertical: [1080, 1920, 'Reels · Shorts · Story'],
        square: [1080, 1080, 'Square'], portrait: [1080, 1350, 'Portrait 4·5']
    };
    function shiftValue(v, dx, dy) { var a = [v[0] + dx, v[1] + dy]; if (v.length > 2) a.push(v[2]); return a; }
    function shiftProperty(p, dx, dy, scalar) {
        if (p.expression && p.expressionEnabled) return false;
        var k;
        if (p.numKeys) { for (k = 1; k <= p.numKeys; k++) p.setValueAtKey(k, scalar ? p.keyValue(k) + scalar : shiftValue(p.keyValue(k), dx, dy)); }
        else p.setValue(scalar ? p.value + scalar : shiftValue(p.value, dx, dy));
        return true;
    }
    function compPreset(o) {
        var p = sizes[o.preset];
        if (!p) h.fail('Choose a size.');
        if (o.mode === 'create') {
            var fps = h.num(o.fps, 1, 120), dur = h.num(o.duration, 0.1, 10800);
            var nc = app.project.items.addComp(p[2] + ' ' + p[0] + 'x' + p[1], p[0], p[1], 1, dur, fps);
            nc.openInViewer();
            return { message: 'Created a ' + p[0] + ' × ' + p[1] + ' comp (' + p[2] + ').' };
        }
        var c = h.comp();
        if (c.width === p[0] && c.height === p[1]) return { message: 'This comp is already ' + p[0] + ' × ' + p[1] + '.' };
        var dx = (p[0] - c.width) / 2, dy = (p[1] - c.height) / 2, skipped = 0, i;
        c.width = p[0]; c.height = p[1];
        if (o.center) {
            for (i = 1; i <= c.numLayers; i++) {
                var l = c.layer(i);
                if (l.parent) continue;
                var locked = l.locked;
                l.locked = false;
                try {
                    var pos = transform(l, 'ADBE Position'), ok = true;
                    if (pos.dimensionsSeparated) {
                        ok = shiftProperty(pos.getSeparationFollower(0), 0, 0, dx) && ok;
                        ok = shiftProperty(pos.getSeparationFollower(1), 0, 0, dy) && ok;
                    } else ok = shiftProperty(pos, dx, dy) && ok;
                    if (l instanceof CameraLayer || l instanceof LightLayer) {
                        var poi = transform(l, 'ADBE Anchor Point');
                        if (poi) ok = shiftProperty(poi, dx, dy) && ok;
                    }
                    if (!ok) skipped++;
                } finally { l.locked = locked; }
            }
        }
        return { message: 'Resized to ' + p[0] + ' × ' + p[1] + (o.center ? ', content kept centred' : '') + '.' + (skipped ? ' ' + plural(skipped, 'layer') + ' with a Position expression were not moved.' : '') };
    }

    return { textBox: textBox, splitText: splitText, changeCase: changeCase, textCursor: textCursor, removeCursor: removeCursor, shapePreset: shapePreset, compPreset: compPreset };
}
