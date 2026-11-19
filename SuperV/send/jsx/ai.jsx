/* SuperV Send - Illustrator. Reads the selection (paths, fills, strokes, gradients, text) and writes it as data
   into the shared link folder; After Effects rebuilds it as native shape and text layers. No file is imported. */
function superv_send(enc) {
    var level = null, job = null;
    function purge(d) { try { var a = d.getFiles(), i; for (i = 0; i < a.length; i++) a[i].remove(); d.remove(); } catch (e) {} }
    function err(m) { return 'ERR:' + encodeURIComponent(m); }
    function r2(n) { return Math.round(n * 100) / 100; }

    /* ---- tiny JSON writer (ExtendScript has no JSON) ---- */
    function ser(v) {
        var t = typeof v, i, s, k;
        if (v === null || v === undefined) return 'null';
        if (t === 'number') return isFinite(v) ? String(v) : '0';
        if (t === 'boolean') return v ? 'true' : 'false';
        if (t === 'string') return '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r\n|\r|\n/g, '\\n').replace(/\t/g, '\\t').replace(/[\u0000-\u001f]/g, ' ') + '"';
        if (v instanceof Array) { s = []; for (i = 0; i < v.length; i++) s.push(ser(v[i])); return '[' + s.join(',') + ']'; }
        s = []; for (k in v) if (v.hasOwnProperty(k) && v[k] !== undefined) s.push(ser(k) + ':' + ser(v[k]));
        return '{' + s.join(',') + '}';
    }

    /* ---- colour ---- */
    function toRGB(c, depth) {
        depth = depth || 0;
        if (!c || depth > 3) return null;
        var t = c.typename, v;
        if (t === 'RGBColor') return [r2(c.red / 255), r2(c.green / 255), r2(c.blue / 255)];
        if (t === 'CMYKColor') {
            v = app.convertSampleColor(ImageColorSpace.CMYK, [c.cyan, c.magenta, c.yellow, c.black], ImageColorSpace.RGB, ColorConvertPurpose.defaultpurpose);
            return [r2(v[0] / 255), r2(v[1] / 255), r2(v[2] / 255)];
        }
        if (t === 'GrayColor') { var g = r2((100 - c.gray) / 100); return [g, g, g]; }
        if (t === 'SpotColor') {
            var base = toRGB(c.spot.color, depth + 1), tint = c.tint / 100;
            return base ? [r2(1 - (1 - base[0]) * tint), r2(1 - (1 - base[1]) * tint), r2(1 - (1 - base[2]) * tint)] : null;
        }
        return null;
    }
    function paint(c, fb) {
        if (!c || c.typename === 'NoColor') return null;
        if (c.typename === 'GradientColor') {
            var g = c.gradient, stops = [], i, st;
            for (i = 0; i < g.gradientStops.length; i++) {
                st = g.gradientStops[i];
                stops.push({ o: r2(st.rampPoint / 100), m: r2(st.midPoint / 100), c: toRGB(st.color) || [0, 0, 0], a: r2((st.opacity === undefined ? 100 : st.opacity) / 100) });
            }
            var org = [0, 0]; try { org = [c.origin[0], c.origin[1]]; } catch (e0) {}
            return { k: 'grad', type: String(g.type).toUpperCase().indexOf('RADIAL') >= 0 ? 'radial' : 'linear', stops: stops,
                     angle: r2(c.angle), length: r2(c.length), origin: org, hilite: r2(c.hiliteLength || 0), hiliteAngle: r2(c.hiliteAngle || 0) };
        }
        var rgb = toRGB(c);
        return rgb ? { k: 'rgb', v: rgb } : (fb || null);
    }

    /* ---- geometry (flipped to y-down, relative to the selection's top-left) ---- */
    var L = 0, T = 0;
    function P(pt) { return [r2(pt[0] - L), r2(T - pt[1])]; }
    function pathData(p) {
        var pts = [], i, pp;
        for (i = 0; i < p.pathPoints.length; i++) {
            pp = p.pathPoints[i];
            pts.push({ a: P(pp.anchor), l: P(pp.leftDirection), r: P(pp.rightDirection) });
        }
        return { closed: !!p.closed, pts: pts };
    }
    function gb(item) { var b = item.geometricBounds; return [r2(b[0] - L), r2(T - b[1]), r2(b[2] - L), r2(T - b[3])]; }   /* l, t, r, b (y down) */
    function union(a, b) { return a ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] : b; }

    var CAPS = { 'StrokeCap.BUTTENDCAP': 'butt', 'StrokeCap.ROUNDENDCAP': 'round', 'StrokeCap.PROJECTINGENDCAP': 'square' };
    var JOINS = { 'StrokeJoin.MITERENDJOIN': 'miter', 'StrokeJoin.ROUNDENDJOIN': 'round', 'StrokeJoin.BEVELENDJOIN': 'bevel' };
    function capName(c) { return CAPS[String(c)] || 'butt'; }
    function joinName(j) { return JOINS[String(j)] || 'miter'; }

    function paintGroup(item, paths, fillSrc) {
        var g = { name: '', paths: [], fill: null, stroke: null, evenodd: false, opacity: r2(item.opacity === undefined ? 100 : item.opacity) }, i;
        for (i = 0; i < paths.length; i++) if (paths[i].pathPoints.length) g.paths.push(pathData(paths[i]));
        if (fillSrc.filled) g.fill = paint(fillSrc.fillColor);
        try { g.evenodd = !!fillSrc.evenodd; } catch (e1) {}
        if (fillSrc.stroked && fillSrc.strokeWidth > 0) {
            var col = paint(fillSrc.strokeColor);
            if (col) {
                var dashes = [], d;
                try { for (d = 0; d < fillSrc.strokeDashes.length; d++) dashes.push(r2(fillSrc.strokeDashes[d])); } catch (e2) {}
                g.stroke = { color: col, w: r2(fillSrc.strokeWidth), cap: capName(fillSrc.strokeCap), join: joinName(fillSrc.strokeJoin), miter: r2(fillSrc.strokeMiterLimit || 4), dashes: dashes };
            }
        }
        return g;
    }

    /* ---- assets: a folder named after the Illustrator file, next to it: D:\Designs\cde.ai -> D:\Designs\cde\Logo.png ---- */
    var assets = null;
    function safeName(s, fallback) {
        var n = String(s || '').replace(/[\\\/:*?"<>|%~\u0000-\u001f]/g, '_').replace(/^[\s.]+|[\s.]+$/g, '').substring(0, 80).replace(/[\s.]+$/, '');
        if (!n) n = fallback;
        if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(n)) n += '_';
        return n;
    }
    function assetFolder() {
        if (assets) return assets;
        var home = null;
        try { home = doc.path; } catch (eP) { home = null; }          /* an unsaved document has no path */
        if (!home || !String(home.fsName || '') || !home.exists) { var eu = new Error('Save your Illustrator file first, then send.'); eu.user = true; throw eu; }
        assets = new Folder(home.absoluteURI + '/' + File.encode(safeName(doc.name.replace(/\.[^.]+$/, ''), 'SuperV assets')));
        if (!assets.exists && !assets.create()) { var ec = new Error('Could not create the folder: ' + assets.fsName); ec.user = true; throw ec; }
        return assets;
    }
    function assetFile(name) {                                         /* never overwrites: Logo.png, Logo_2.png, ... */
        var dir = assetFolder(), stem = safeName(name, 'Artwork'), n = 1, f;
        do { f = new File(dir.absoluteURI + '/' + File.encode(stem + (n > 1 ? '_' + n : '') + '.png')); n++; } while (f.exists);
        return f;
    }

    /* ---- output stream, bottom layer first. Shapes next to each other share one shape layer. ---- */
    var skipped = [], stream = [], run = null, curName = '', doc = null;
    function shapeGroup(g, box) {
        if (!run) { run = { t: 'shape', name: curName, box: null, groups: [] }; stream.push(run); }
        run.groups.unshift(g);                                         /* shape layer contents are listed top first */
        run.box = run.box ? union(run.box, box) : box;
    }
    function textLayer(tx) {
        run = null;
        stream.push({ t: 'text', name: tx.data.name || tx.data.text.replace(/\n/g, ' ').substring(0, 60), text: tx.data });
    }
    function imageName(item) {
        var n = '';
        try { n = item.name; } catch (e0) {}
        if (!n && item.typename === 'PlacedItem') { try { n = decodeURI(item.file.name).replace(/\.[^.]+$/, ''); } catch (e1) {} }
        if (!n) n = { RasterItem: 'Image', PlacedItem: 'Image', GroupItem: 'Clip group', SymbolItem: 'Symbol', MeshItem: 'Mesh' }[item.typename] || 'Artwork';
        return String(n).replace(/[\r\n]/g, ' ').substring(0, 60);
    }
    /* Anything After Effects cannot rebuild as live layers (images, clip groups, symbols, meshes, plugin art)
       is rendered on its own to a transparent PNG at 2x, saved in the asset folder and sent as an image. */
    function exportImage(item) {
        var vb = item.visibleBounds, w = vb[2] - vb[0], h = vb[1] - vb[3], tmp = null;
        if (w < 0.5 || h < 0.5) return;
        var name = imageName(item), f = assetFile(name), scale = Math.min(200, Math.floor(8000 / Math.max(w, h) * 100));
        try {
            tmp = app.documents.add(DocumentColorSpace.RGB, Math.max(w, 1), Math.max(h, 1));
            var dup = item.duplicate(tmp.layers[0], ElementPlacement.PLACEATBEGINNING);
            try { dup.hidden = false; } catch (eH) {}
            tmp.artboards[0].artboardRect = dup.visibleBounds;
            var po = new ExportOptionsPNG24();
            po.antiAliasing = true; po.transparency = true; po.artBoardClipping = true;
            po.horizontalScale = scale; po.verticalScale = scale;
            tmp.exportFile(f, ExportType.PNG24, po);
        } finally {
            if (tmp) { try { tmp.close(SaveOptions.DONOTSAVECHANGES); } catch (eC) {} }
        }
        if (!f.exists) { skipped.push(name + ' (could not export)'); return; }
        run = null;
        stream.push({ t: 'image', name: name, file: f.name, path: f.fsName, x: r2(vb[0] - L), y: r2(T - vb[1]), w: r2(w), h: r2(h), opacity: 100 });
    }

    function walk(item) {
        var t = item.typename, i, g;
        try { if (item.hidden) return; } catch (e) {}
        if (t === 'PathItem') {
            if (item.guides || item.clipping) return;
            g = paintGroup(item, [item], item); g.name = item.name || 'Path'; shapeGroup(g, gb(item)); return;
        }
        if (t === 'CompoundPathItem') {
            var ps = [], k;
            for (k = 0; k < item.pathItems.length; k++) ps.push(item.pathItems[k]);
            if (!ps.length) return;
            g = paintGroup(item, ps, ps[0]); g.name = item.name || 'Compound path'; shapeGroup(g, gb(item)); return;
        }
        if (t === 'GroupItem') {
            if (item.clipped) { exportImage(item); return; }            /* the mask is kept by sending the group as one image */
            for (i = item.pageItems.length - 1; i >= 0; i--) walk(item.pageItems[i]);   /* bottom first */
            return;
        }
        if (t === 'TextFrame') { var tx = textData(item); if (tx) textLayer(tx); return; }
        exportImage(item);
    }

    function textData(tf) {
        var ca, pa, size, just, ar = null, kind = 'point';
        var str = String(tf.contents).replace(/\r\n|\r|\u2028|\u2029/g, '\n');
        if (!str) return null;
        ca = tf.textRange.characterAttributes; pa = tf.textRange.paragraphAttributes;
        try { ca = tf.characters[0].characterAttributes; } catch (e0) {}
        var font = '', fam = '', sty = '';
        try { font = ca.textFont.name; fam = ca.textFont.family; sty = ca.textFont.style; } catch (e1) {}
        var just = 'left';
        try { var jn = String(pa.justification).toUpperCase(); just = jn.indexOf('FULLJUSTIFY') >= 0 ? 'justify' : jn.indexOf('CENTER') >= 0 ? 'center' : jn.indexOf('RIGHT') >= 0 ? 'right' : 'left'; } catch (e2) {}
        var a = null, box;
        if (String(tf.kind).toUpperCase().indexOf('AREA') >= 0) {
            kind = 'area';
            var tb = gb(tf);
            ar = [tb[0], tb[1], tb[2] - tb[0], tb[3] - tb[1]];
            box = tb;
        } else {
            a = tf.anchor;
            box = gb(tf);
        }
        var color = paint(ca.fillColor);
        var stroke = null;
        try { if (ca.strokeColor && ca.strokeColor.typename !== 'NoColor' && ca.strokeWeight > 0) stroke = { color: paint(ca.strokeColor), w: r2(ca.strokeWeight) }; } catch (e3) {}
        var lead = null; try { if (!ca.autoLeading) lead = r2(ca.leading); } catch (e4) {}
        return { box: box, data: {
            name: tf.name || '', text: str, font: font, family: fam, style: sty, size: r2(ca.size),
            fill: color, stroke: stroke, tracking: r2(ca.tracking || 0), leading: lead, just: just, kind: kind,
            anchor: a ? P(a) : [ar[0], ar[1]], area: ar, opacity: r2(tf.opacity === undefined ? 100 : tf.opacity),
            hscale: r2(ca.horizontalScale || 100), vscale: r2(ca.verticalScale || 100), box: box } };
    }

    function zKey(item) {
        var z = 0, lz = 0; try { z = item.zOrderPosition; } catch (e) {} try { lz = item.layer.zOrderPosition; } catch (e2) {}
        return lz * 1000000 + z;
    }

    try {
        var o = eval('(' + decodeURIComponent(enc) + ')'); job = o;
        if (app.documents.length === 0) return err('Open a document first.');
        doc = app.activeDocument; var sel = doc.selection;
        if (!sel || !sel.length) return err('Select some artwork first.');
        level = app.userInteractionLevel; app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

        var i, vb, b = null, items = [];
        for (i = 0; i < sel.length; i++) {
            var cur = sel[i], dup = false, k0;
            try { while (cur.parent && cur.parent.typename === 'CompoundPathItem') cur = cur.parent; } catch (eP) {}   /* a selected sub-path means the whole compound shape */
            for (k0 = 0; k0 < items.length; k0++) if (items[k0] == cur) { dup = true; break; }
            if (!dup) items.push(cur);
        }
        items.sort(function (x, y) { return zKey(x) - zKey(y); });              /* bottom first */
        for (i = 0; i < items.length; i++) {
            vb = items[i].visibleBounds;                                  /* includes strokes, so nothing is clipped */
            if (!b) b = [vb[0], vb[1], vb[2], vb[3]];
            else { b[0] = Math.min(b[0], vb[0]); b[1] = Math.max(b[1], vb[1]); b[2] = Math.max(b[2], vb[2]); b[3] = Math.min(b[3], vb[3]); }
        }
        var ar = doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect;   /* positions are measured from the artboard, so layers land exactly where they sit in Illustrator */
        L = ar[0]; T = ar[1];
        var W = r2(ar[2] - ar[0]), H = r2(ar[1] - ar[3]);

        var layers = [], first = '';
        for (i = 0; i < items.length; i++) {
            var it = items[i];
            var nm = '';
            try { nm = it.typename === 'TextFrame' ? it.contents : it.name; } catch (e5) {}
            if (!nm) nm = (it.typename === 'GroupItem' ? 'Group' : it.typename === 'CompoundPathItem' ? 'Compound path' : it.typename === 'PathItem' ? 'Path' : 'Object');
            nm = String(nm).replace(/[\r\n]/g, ' ').substring(0, 60);
            if (!first) first = nm;
            curName = nm;
            if (o.perObject) run = null;                               /* "each object" mode: a layer per selected object */
            walk(it);
        }
        layers = stream;
        if (!layers.length) return err('Nothing in the selection can be sent' + (skipped.length ? ' (' + skipped.join(', ') + ').' : '.'));

        var dir = new Folder(o.base + '/transfers/' + o.id);
        if (!dir.exists && !dir.create()) return err('Could not create the link folder: ' + dir.fsName);
        var title = items.length === 1 ? first : doc.name.replace(/\.[^.]+$/, '') + ' (' + items.length + ')';
        var df = new File(dir.fsName + '/data.json');
        df.encoding = 'UTF-8'; df.open('w');
        df.write(ser({ version: 1, app: 'ILST', doc: doc.name.replace(/\.[^.]+$/, ''), assets: assets ? assets.fsName : null, width: W, height: H, layers: layers, skipped: skipped }));
        df.close();
        var mf = new File(dir.fsName + '/manifest.tmp');
        mf.encoding = 'UTF-8'; mf.open('w');
        mf.write(ser({ id: o.id, app: 'ILST', kind: 'vector', file: 'data.json', title: title, count: layers.length, width: W, height: H, time: (new Date()).getTime() }));
        mf.close();
        mf.rename('manifest.json');                           /* written last so the receiver never sees half a transfer */
        var note = skipped.length ? ' (skipped: ' + skipped.join(', ') + ')' : '';
        return 'OK:' + encodeURIComponent('Sent ' + layers.length + ' layer' + (layers.length === 1 ? '' : 's') + ' to After Effects.' + (assets ? ' Assets saved in ' + assets.fsName + '.' : '') + note);
    } catch (e) {
        try { if (job) { var bad = new Folder(job.base + '/transfers/' + job.id); if (bad.exists && !new File(bad.fsName + '/manifest.json').exists) purge(bad); } } catch (ignore0) {}
        return err(String(e.message || e) + (e.line && !e.user ? ' (line ' + e.line + ')' : ''));
    } finally {
        try { if (level !== null) app.userInteractionLevel = level; } catch (ignore2) {}
    }
}
