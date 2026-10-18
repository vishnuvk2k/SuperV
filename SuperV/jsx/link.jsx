/* SuperV Link - After Effects side. Imports artwork sent from Illustrator or Photoshop. */
function VKLink(h) {
    var fail = h.fail;

    function folder(name) {
        var root = app.project.rootFolder, i;
        for (i = 1; i <= root.numItems; i++) {
            var it = root.item(i);
            if (it instanceof FolderItem && it.name === name) return it;
        }
        return app.project.items.addFolder(name);
    }

    function firstComp(res) {
        var i;
        if (res instanceof CompItem) return res;
        if (res && res.length) for (i = 0; i < res.length; i++) if (res[i] instanceof CompItem) return res[i];
        return null;
    }

    function cleanName(layer) {
        var n = layer.name, c = n.replace(/\/art\.(ai|psd)$/i, '');
        if (c && c !== n) { try { layer.name = c; } catch (e) {} }
    }

    function linkImport(o) {
        var f = new File(String(o.file || ''));
        if (!f.exists) fail('The sent file is missing: ' + f.fsName);
        var active = app.project.activeItem;
        var into = (o.mode !== 'new' && active instanceof CompItem) ? active : null;

        var io = new ImportOptions(f);
        try { io.importAs = ImportAsType.COMP_CROPPED_LAYERS; } catch (e) { io.importAs = ImportAsType.COMP; }
        var comp = firstComp(app.project.importFile(io));
        if (!comp) fail('After Effects read the file but did not create a composition.');

        var title = String(o.title || '').replace(/[\r\n]/g, ' ');
        var count = comp.numLayers, i, j;

        /* Tidy: gather the new items into one project folder. */
        var box = folder('SuperV Link');
        var parents = [];
        for (i = 1; i <= comp.numLayers; i++) {
            var src = comp.layer(i).source;
            if (src && src.parentFolder && src.parentFolder !== app.project.rootFolder && src.parentFolder !== box) {
                var seen = false;
                for (j = 0; j < parents.length; j++) if (parents[j] === src.parentFolder) seen = true;
                if (!seen) parents.push(src.parentFolder);
            }
        }
        for (j = 0; j < parents.length; j++) parents[j].parentFolder = box;

        if (!into) {
            if (title) comp.name = title;
            for (i = 1; i <= comp.numLayers; i++) cleanName(comp.layer(i));
            comp.parentFolder = box;
            comp.openInViewer();
            return { message: 'Imported ' + count + ' layer' + (count === 1 ? '' : 's') + ' into a new comp.' };
        }

        /* Copy the layers into the open comp, centred, in their original order. */
        for (i = 1; i <= into.numLayers; i++) into.layer(i).selected = false;
        for (i = comp.numLayers; i >= 1; i--) comp.layer(i).copyToComp(into);
        var dx = (into.width - comp.width) / 2, dy = (into.height - comp.height) / 2;
        for (i = 1; i <= count; i++) {
            var layer = into.layer(i);
            layer.selected = true;
            cleanName(layer);
            if (!layer.parent) {
                var pos = layer.property('ADBE Transform Group').property('ADBE Position');
                if (pos.numKeys === 0) {
                    var v = pos.value;
                    pos.setValue(v.length > 2 ? [v[0] + dx, v[1] + dy, v[2]] : [v[0] + dx, v[1] + dy]);
                }
            }
        }
        comp.remove();
        return { message: 'Added ' + count + ' layer' + (count === 1 ? '' : 's') + ' to ' + into.name + '.' };
    }

    /* ---------- native vector / text build (data sent by the Illustrator and Photoshop panels) ---------- */
    function col3(c) { return [c[0], c[1], c[2]]; }
    function mid(g) { var st = g.stops, i, best = st[0], d = 9; for (i = 0; i < st.length; i++) if (Math.abs(st[i].o - 0.5) < d) { d = Math.abs(st[i].o - 0.5); best = st[i]; } return best.c; }

    function shapeOf(path, cx, cy) {
        var s = new Shape(), v = [], it = [], ot = [], i, p;
        for (i = 0; i < path.pts.length; i++) {
            p = path.pts[i];
            v.push([p.a[0] - cx, p.a[1] - cy]);
            it.push([p.l[0] - p.a[0], p.l[1] - p.a[1]]);
            ot.push([p.r[0] - p.a[0], p.r[1] - p.a[1]]);
        }
        s.vertices = v; s.inTangents = it; s.outTangents = ot; s.closed = !!path.closed;
        return s;
    }

    function applyPaint(contents, g, st) {
        var fill, stroke, i;
        if (g.stroke) {
            stroke = contents.addProperty('ADBE Vector Graphic - Stroke');
            var c = g.stroke.color;
            stroke.property('ADBE Vector Stroke Color').setValue((c.k === 'grad' ? col3(mid(c)) : col3(c.v)).concat([1]));
            if (c.k === 'grad') st.gradients++;
            stroke.property('ADBE Vector Stroke Width').setValue(g.stroke.w);
            stroke.property('ADBE Vector Stroke Line Cap').setValue(g.stroke.cap === 'round' ? 2 : g.stroke.cap === 'square' ? 3 : 1);
            stroke.property('ADBE Vector Stroke Line Join').setValue(g.stroke.join === 'round' ? 2 : g.stroke.join === 'bevel' ? 3 : 1);
            if (g.stroke.join === 'miter') stroke.property('ADBE Vector Stroke Miter Limit').setValue(g.stroke.miter);
            if (g.stroke.dashes && g.stroke.dashes.length) {
                var dsh = stroke.property('ADBE Vector Stroke Dashes'), n = Math.min(g.stroke.dashes.length, 6);
                var names = ['ADBE Vector Stroke Dash 1', 'ADBE Vector Stroke Gap 1', 'ADBE Vector Stroke Dash 2', 'ADBE Vector Stroke Gap 2', 'ADBE Vector Stroke Dash 3', 'ADBE Vector Stroke Gap 3'];
                for (i = 0; i < n; i++) { var pr = dsh.addProperty(names[i]); pr.setValue(g.stroke.dashes[i]); }
                if (g.stroke.dashes.length === 1) { var gp = dsh.addProperty(names[1]); gp.setValue(g.stroke.dashes[0]); }
            }
        }
        if (g.fill) {
            fill = contents.addProperty('ADBE Vector Graphic - Fill');
            if (g.fill.k === 'grad') { fill.property('ADBE Vector Fill Color').setValue(col3(mid(g.fill)).concat([1])); st.gradients++; }
            else fill.property('ADBE Vector Fill Color').setValue(col3(g.fill.v).concat([1]));
            fill.property('ADBE Vector Fill Rule').setValue(g.evenodd ? 2 : 1);
        }
    }

    function buildShape(comp, L, dx, dy, st) {
        var cx = (L.box[0] + L.box[2]) / 2, cy = (L.box[1] + L.box[3]) / 2, i, j;
        var layer = comp.layers.addShape();
        layer.name = L.name;
        var root = layer.property('ADBE Root Vectors Group');
        for (i = 0; i < L.groups.length; i++) {                      /* AE appends: add the top-most group first */
            var g = L.groups[i];
            var grp = root.addProperty('ADBE Vector Group');
            grp.name = g.name || ('Shape ' + (i + 1));
            var contents = grp.property('ADBE Vectors Group');
            for (j = 0; j < g.paths.length; j++) {                    /* paths first: AE draws a fill/stroke only for the paths listed above it */
                var pg = contents.addProperty('ADBE Vector Shape - Group');
                pg.property('ADBE Vector Shape').setValue(shapeOf(g.paths[j], cx, cy));
            }
            applyPaint(contents, g, st);
            if (g.opacity < 100) grp.property('ADBE Vector Transform Group').property('ADBE Vector Group Opacity').setValue(g.opacity);
        }
        var tr = layer.property('ADBE Transform Group');
        tr.property('ADBE Anchor Point').setValue([0, 0]);
        tr.property('ADBE Position').setValue([cx + dx, cy + dy]);
        return layer;
    }

    function buildText(comp, T, dx, dy, st) {
        var layer, area = T.kind === 'area' && T.area;
        var str = T.text.replace(/\n/g, '\r');
        if (area) layer = comp.layers.addBoxText([Math.max(1, T.area[2]), Math.max(1, T.area[3])]);
        else layer = comp.layers.addText(str);
        var src = layer.property('ADBE Text Properties').property('ADBE Text Document'), td = src.value;
        td.resetCharStyle(); td.resetParagraphStyle();
        td.text = str;
        if (T.font) { try { td.font = T.font; } catch (e1) { st.fontMissing.push(T.font); } }
        td.fontSize = T.size;
        if (T.fill && T.fill.k === 'rgb') { td.applyFill = true; td.fillColor = col3(T.fill.v); }
        else if (T.fill && T.fill.k === 'grad') { td.applyFill = true; td.fillColor = col3(mid(T.fill)); st.gradients++; }
        else td.applyFill = false;
        if (T.stroke && T.stroke.color && T.stroke.color.k === 'rgb') { td.applyStroke = true; td.strokeColor = col3(T.stroke.color.v); td.strokeWidth = T.stroke.w; td.strokeOverFill = true; }
        td.tracking = T.tracking;
        try { td.justification = T.just === 'center' ? ParagraphJustification.CENTER_JUSTIFY : T.just === 'right' ? ParagraphJustification.RIGHT_JUSTIFY : T.just === 'justify' ? ParagraphJustification.FULL_JUSTIFY_LASTLINE_LEFT : ParagraphJustification.LEFT_JUSTIFY; } catch (e2) {}
        if (T.leading !== null && T.leading !== undefined) { try { td.autoLeading = false; td.leading = T.leading; } catch (e3) {} }
        src.setValue(td);
        var tr = layer.property('ADBE Transform Group');
        tr.property('ADBE Anchor Point').setValue([0, 0]);
        tr.property('ADBE Position').setValue(area ? [T.area[0] + T.area[2] / 2 + dx, T.area[1] + T.area[3] / 2 + dy] : [T.anchor[0] + dx, T.anchor[1] + dy]);   /* box text is anchored at its centre */
        if (T.opacity < 100) tr.property('ADBE Opacity').setValue(T.opacity);
        return layer;
    }

    function linkVector(o) {
        var d = o.data;
        if (!d || !d.layers || !d.layers.length) fail('The sent data was empty.');
        var active = app.project.activeItem;
        var comp = (active instanceof CompItem) ? active : null, i;
        var made = false;
        if (!comp) fail('Open the composition you want the layers in, then send again.');
        var dx = comp.width / 2 - d.width / 2, dy = comp.height / 2 - d.height / 2;
        var st = { gradients: 0, fontMissing: [] };
        for (i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false;
        var out = [];
        for (i = 0; i < d.layers.length; i++) {
            var L = d.layers[i];
            out.push(L.t === 'text' ? buildText(comp, L.text, dx, dy, st) : buildShape(comp, L, dx, dy, st));
            if (L.t === 'text') out[out.length - 1].name = L.name;
        }
        for (i = 0; i < out.length; i++) out[i].selected = true;
        if (made) comp.openInViewer();
        var msg = 'Added ' + out.length + ' layer' + (out.length === 1 ? '' : 's') + ' to ' + comp.name + '.';
        if (st.gradients) msg += ' ' + st.gradients + ' gradient' + (st.gradients === 1 ? '' : 's') + ' approximated with a solid colour.';
        if (st.fontMissing.length) msg += ' Font not found: ' + st.fontMissing.join(', ') + '.';
        if (d.skipped && d.skipped.length) msg += ' Skipped: ' + d.skipped.join(', ') + '.';
        return { message: msg };
    }

    return { linkImport: linkImport, linkVector: linkVector };
}
