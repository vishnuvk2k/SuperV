/* SuperV Send - Photoshop. Reads the selected layers straight from the document and writes them as plain data
   (text, vector shapes, pixel layers) for the After Effects panel to build as native layers. No file is opened in AE. */
function superv_send(enc) {
    var job = null, units = null, tunits = null, dlg = null;
    function purge(d) { try { var a = d.getFiles(), i; for (i = 0; i < a.length; i++) a[i].remove(); d.remove(); } catch (e) {} }
    function err(m) { return 'ERR:' + encodeURIComponent(m); }
    function r2(n) { return Math.round(n * 100) / 100; }
    function px(u) { try { return u.as('px'); } catch (e) { return Number(u); } }
    function ser(v) {
        var t = typeof v, i, a, k;
        if (v === null || v === undefined) return 'null';
        if (t === 'number') return isFinite(v) ? String(v) : 'null';
        if (t === 'boolean') return v ? 'true' : 'false';
        if (t === 'string') return '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t') + '"';
        if (v instanceof Array) { a = []; for (i = 0; i < v.length; i++) a.push(ser(v[i])); return '[' + a.join(',') + ']'; }
        a = []; for (k in v) if (v.hasOwnProperty(k)) a.push(ser(k) + ':' + ser(v[k]));
        return '{' + a.join(',') + '}';
    }
    function sid(s) { return stringIDToTypeID(s); }
    function cid(s) { return charIDToTypeID(s); }

    var BLEND = {};
    (function () {
        var m = ['MULTIPLY', 'SCREEN', 'OVERLAY', 'SOFTLIGHT', 'HARDLIGHT', 'COLORDODGE', 'COLORBURN', 'DARKEN', 'LIGHTEN', 'DIFFERENCE', 'EXCLUSION', 'HUE', 'SATURATION', 'COLORBLEND', 'LUMINOSITY', 'LINEARDODGE', 'LINEARBURN', 'VIVIDLIGHT', 'LINEARLIGHT', 'PINLIGHT', 'HARDMIX', 'DISSOLVE'];
        var i; for (i = 0; i < m.length; i++) { try { BLEND[String(BlendMode[m[i]])] = m[i]; } catch (e) {} }
    })();
    var JUST = {};
    (function () { try { JUST[String(Justification.CENTER)] = 'center'; JUST[String(Justification.RIGHT)] = 'right'; JUST[String(Justification.LEFT)] = 'left'; JUST[String(Justification.FULLYJUSTIFIED)] = 'justify'; } catch (e) {} })();

    function layerDesc(ly) {
        var r = new ActionReference();
        r.putIdentifier(cid('Lyr '), ly.id);
        return executeActionGet(r);
    }
    function rgbOf(d) { return [r2(d.getDouble(cid('Rd  ')) / 255), r2(d.getDouble(cid('Grn ')) / 255), r2(d.getDouble(cid('Bl  ')) / 255)]; }

    /* layer ids of the current selection (groups expand to their contents later) */
    function selectedIds() {
        var ref = new ActionReference(), ids = [], i, d, l;
        ref.putEnumerated(cid('Dcmn'), cid('Ordn'), cid('Trgt'));
        d = executeActionGet(ref);
        if (d.hasKey(sid('targetLayersIDs'))) {
            l = d.getList(sid('targetLayersIDs'));
            for (i = 0; i < l.count; i++) {
                try { ids.push(l.getReference(i).getIdentifier(cid('Lyr '))); }
                catch (e1) { try { ids.push(l.getObjectValue(i).getInteger(sid('layerID'))); } catch (e2) {} }
            }
        }
        return ids;
    }

    function leaves(set, out, parentSelected, sel) {          /* bottom first */
        var i, ly, on;
        for (i = set.layers.length - 1; i >= 0; i--) {
            ly = set.layers[i];
            on = parentSelected || sel[ly.id] === true;
            if (ly.typename === 'LayerSet') leaves(ly, out, on, sel);
            else if (on) out.push(ly);
        }
    }
    function allLayers(set, out) { var i; for (i = 0; i < set.layers.length; i++) { out.push(set.layers[i]); if (set.layers[i].typename === 'LayerSet') allLayers(set.layers[i], out); } }
    function reallyVisible(ly) { var p = ly; while (p && p.typename !== 'Document') { if (!p.visible) return false; p = p.parent; } return true; }

    /* render one layer on its own to a trimmed PNG */
    function exportLayer(doc, ly, file, W, H) {
        var all = [], i, vis = [], p, b, l, t, r, bt, dup;
        allLayers(doc, all);
        for (i = 0; i < all.length; i++) vis.push(all[i].visible);
        try {
            for (i = 0; i < all.length; i++) all[i].visible = false;
            p = ly; while (p && p.typename !== 'Document') { p.visible = true; p = p.parent; }
            b = ly.bounds; l = Math.max(0, Math.floor(px(b[0]))); t = Math.max(0, Math.floor(px(b[1]))); r = Math.min(W, Math.ceil(px(b[2]))); bt = Math.min(H, Math.ceil(px(b[3])));
            if (r - l < 1 || bt - t < 1) return null;
            dup = doc.duplicate('superv_tmp', false);
            dup.crop([l, t, r, bt]);
            var po = new PNGSaveOptions(); po.interlaced = false;
            dup.saveAs(file, po, true, Extension.LOWERCASE);
            dup.close(SaveOptions.DONOTSAVECHANGES);
            return { x: l, y: t, w: r - l, h: bt - t };
        } finally {
            try { for (i = 0; i < all.length; i++) all[i].visible = vis[i]; } catch (e) {}
        }
    }

    function textLayer(ly) {
        var ti = ly.textItem, str = String(ti.contents).replace(/\r\n|\r| | /g, '\n'), area = false, pos, fill = { k: 'rgb', v: [0, 0, 0] };
        if (!str) return null;
        try { area = String(ti.kind) === String(TextType.PARAGRAPHTEXT); } catch (e0) {}
        try { var c = ti.color.rgb; fill = { k: 'rgb', v: [r2(c.red / 255), r2(c.green / 255), r2(c.blue / 255)] }; } catch (e1) {}
        pos = ti.position;
        var x = px(pos[0]), y = px(pos[1]);
        var lead = null; try { if (!ti.useAutoLeading) lead = r2(px(ti.leading)); } catch (e2) {}
        var just = 'left'; try { just = JUST[String(ti.justification)] || 'left'; } catch (e3) {}
        var ar = null, w = 0, h = 0;
        if (area) { w = px(ti.width); h = px(ti.height); ar = [r2(x), r2(y), r2(w), r2(h)]; }
        var hs = 100, vs = 100; try { hs = ti.horizontalScale; vs = ti.verticalScale; } catch (e4) {}
        var tr = 0; try { tr = ti.tracking; } catch (e5) {}
        var font = ''; try { font = ti.font; } catch (e6) {}
        return { name: ly.name, text: str, font: font, family: '', style: '', size: r2(px(ti.size)), fill: fill, stroke: null, tracking: tr, leading: lead,
            just: just, kind: area ? 'area' : 'point', anchor: [r2(x), r2(y)], area: ar, opacity: r2(ly.opacity), hscale: hs, vscale: vs,
            box: [r2(x), r2(y), r2(x + w), r2(y + h)] };
    }

    /* vector shape layer -> same path format the Illustrator side sends; null when it cannot be read (then it is sent as pixels) */
    function shapeLayer(doc, ly) {
        var d = layerDesc(ly), adj, cls, fill = null, stroke = null, i, j, k, item = null, sp, pp, paths = [], box = null, evenodd = false;
        if (!d.hasKey(sid('adjustment'))) return null;
        adj = d.getList(sid('adjustment'));
        if (!adj.count) return null;
        cls = typeIDToStringID(adj.getClass(0));
        if (cls !== 'solidColorLayer') { if (cls !== 'null' && cls !== '') return null; }
        try { fill = { k: 'rgb', v: rgbOf(adj.getObjectValue(0).getObjectValue(sid('color'))) }; } catch (e0) { return null; }
        try {
            if (d.hasKey(sid('AGMStrokeStyleInfo'))) {
                var s = d.getObjectValue(sid('AGMStrokeStyleInfo'));
                var fe = true; try { fe = s.getBoolean(sid('fillEnabled')); } catch (e1) {}
                if (!fe) fill = null;
                if (s.getBoolean(sid('strokeEnabled'))) {
                    var sc = s.getObjectValue(sid('strokeStyleContent'));
                    var cap = 'butt', join = 'miter';
                    try { var cp = typeIDToStringID(s.getEnumerationValue(sid('strokeStyleLineCapType'))); cap = cp.indexOf('Round') >= 0 ? 'round' : cp.indexOf('Square') >= 0 ? 'square' : 'butt'; } catch (e2) {}
                    try { var jp = typeIDToStringID(s.getEnumerationValue(sid('strokeStyleLineJoinType'))); join = jp.indexOf('Round') >= 0 ? 'round' : jp.indexOf('Bevel') >= 0 ? 'bevel' : 'miter'; } catch (e3) {}
                    var dashes = []; try { var dl = s.getList(sid('strokeStyleLineDashSet')); var wv = s.getDouble(sid('strokeStyleLineWidth')); for (i = 0; i < dl.count; i++) dashes.push(r2(dl.getDouble(i) * wv)); } catch (e4) {}
                    stroke = { color: { k: 'rgb', v: rgbOf(sc.getObjectValue(sid('color'))) }, w: r2(s.getDouble(sid('strokeStyleLineWidth'))), cap: cap, join: join, miter: r2((function () { try { return s.getDouble(sid('strokeStyleMiterLimit')); } catch (e5) { return 10; } })()), dashes: dashes };
                }
            }
        } catch (e6) {}
        doc.activeLayer = ly;
        for (i = 0; i < doc.pathItems.length; i++) { if (String(doc.pathItems[i].kind) === String(PathKind.VECTORMASK)) { item = doc.pathItems[i]; break; } }
        if (!item) return null;
        for (j = 0; j < item.subPathItems.length; j++) {
            sp = item.subPathItems[j];
            var pts = [];
            for (k = 0; k < sp.pathPoints.length; k++) {
                pp = sp.pathPoints[k];
                var a = [r2(pp.anchor[0]), r2(pp.anchor[1])], l = [r2(pp.leftDirection[0]), r2(pp.leftDirection[1])], r = [r2(pp.rightDirection[0]), r2(pp.rightDirection[1])];
                pts.push({ a: a, l: l, r: r });
                if (!box) box = [a[0], a[1], a[0], a[1]];
                else { box[0] = Math.min(box[0], a[0]); box[1] = Math.min(box[1], a[1]); box[2] = Math.max(box[2], a[0]); box[3] = Math.max(box[3], a[1]); }
            }
            if (!pts.length) continue;
            try { if (String(sp.operation) === String(ShapeOperation.SHAPESUBTRACT) || String(sp.operation) === String(ShapeOperation.SHAPEXOR)) evenodd = true; } catch (e7) {}
            paths.push({ closed: !!sp.closed, pts: pts });
        }
        if (!paths.length) return null;
        return { t: 'shape', name: ly.name, box: box, groups: [{ name: ly.name, paths: paths, fill: fill, stroke: stroke, evenodd: evenodd, opacity: r2(ly.opacity) }] };
    }

    try {
        var o = eval('(' + decodeURIComponent(enc) + ')'); job = o;
        if (app.documents.length === 0) return err('Open a document first.');
        var doc = app.activeDocument, i;
        dlg = app.displayDialogs; app.displayDialogs = DialogModes.NO;
        units = app.preferences.rulerUnits; app.preferences.rulerUnits = Units.PIXELS;
        tunits = app.preferences.typeUnits; app.preferences.typeUnits = TypeUnits.PIXELS;

        var sel = {}, ids = selectedIds(), picked = [];
        if (!ids.length) { try { ids = [doc.activeLayer.id]; } catch (eA) {} }
        if (!ids.length) return err('Select one or more layers first.');
        for (i = 0; i < ids.length; i++) sel[ids[i]] = true;
        if (o.whole) { var every = []; allLayers(doc, every); sel = {}; for (i = 0; i < every.length; i++) sel[every[i].id] = true; }
        leaves(doc, picked, false, sel);

        var W = Math.round(px(doc.width)), H = Math.round(px(doc.height));
        var dir = new Folder(o.base + '/transfers/' + o.id);
        if (!dir.exists && !dir.create()) return err('Could not create the link folder: ' + dir.fsName);

        var layers = [], skipped = [], n = 0, first = '';
        for (i = 0; i < picked.length; i++) {
            var ly = picked[i], kind = String(ly.kind), rec = null, blend = null;
            if (!reallyVisible(ly)) continue;
            if (!first) first = ly.name;
            try { blend = BLEND[String(ly.blendMode)] || null; } catch (eB) {}
            if (ly.typename === 'ArtLayer' && kind === String(LayerKind.TEXT)) {
                var T = textLayer(ly);
                if (T) rec = { t: 'text', name: ly.name, text: T };
            } else if (kind === String(LayerKind.SOLIDFILL)) {
                try { rec = shapeLayer(doc, ly); } catch (eS) { rec = null; }
            } else if (kind !== String(LayerKind.NORMAL) && kind !== String(LayerKind.SMARTOBJECT) && kind !== String(LayerKind.LAYER3D) && kind !== String(LayerKind.VIDEO) && kind !== String(LayerKind.GRADIENTFILL) && kind !== String(LayerKind.PATTERNFILL)) {
                skipped.push(ly.name + ' (adjustment layer)'); continue;
            }
            if (!rec) {
                var f = new File(dir.fsName + '/layer_' + (n + 1) + '.png');
                var rc = exportLayer(doc, ly, f, W, H);
                if (!rc) continue;
                rec = { t: 'image', name: ly.name, file: f.name, x: rc.x, y: rc.y, w: rc.w, h: rc.h, opacity: r2(ly.opacity) };
            }
            if (blend) rec.blend = blend;
            layers.push(rec); n++;
        }
        if (!layers.length) { purge(dir); return err('Nothing in the selection can be sent' + (skipped.length ? ' (' + skipped.join(', ') + ').' : '.')); }

        var title = picked.length === 1 ? first : doc.name.replace(/\.[^.]+$/, '') + ' (' + layers.length + ')';
        var df = new File(dir.fsName + '/data.json');
        df.encoding = 'UTF-8'; df.open('w'); df.write(ser({ version: 1, app: 'PHXS', width: W, height: H, layers: layers, skipped: skipped })); df.close();
        var mf = new File(dir.fsName + '/manifest.tmp');
        mf.encoding = 'UTF-8'; mf.open('w');
        mf.write(ser({ id: o.id, app: 'PHXS', kind: 'vector', file: 'data.json', title: title, count: layers.length, width: W, height: H, time: (new Date()).getTime() }));
        mf.close();
        mf.rename('manifest.json');
        return 'OK:' + encodeURIComponent('Sent ' + layers.length + ' layer' + (layers.length === 1 ? '' : 's') + ' to After Effects.' + (skipped.length ? ' (skipped: ' + skipped.join(', ') + ')' : ''));
    } catch (e) {
        try { if (job) { var bad = new Folder(job.base + '/transfers/' + job.id); if (bad.exists && !new File(bad.fsName + '/manifest.json').exists) purge(bad); } } catch (ignore0) {}
        return err(String(e.message || e) + (e.line ? ' (line ' + e.line + ')' : ''));
    } finally {
        try { if (units !== null) app.preferences.rulerUnits = units; if (tunits !== null) app.preferences.typeUnits = tunits; if (dlg !== null) app.displayDialogs = dlg; } catch (ignore2) {}
    }
}
