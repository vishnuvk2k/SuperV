/* SuperV Send - Illustrator. Saves the selection as a layered .ai in the shared link folder. */
function superv_send(enc) {
    var level = null, tmp = null, doc = null;
    var job = null;
    function purge(d) { try { var a = d.getFiles(), i; for (i = 0; i < a.length; i++) a[i].remove(); d.remove(); } catch (e) {} }
    function err(m) { return 'ERR:' + encodeURIComponent(m); }
    function q(s) { return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]/g, ' ') + '"'; }
    try {
        var o = eval('(' + decodeURIComponent(enc) + ')'); job = o;
        if (app.documents.length === 0) return err('Open a document first.');
        doc = app.activeDocument;
        var sel = doc.selection;
        if (!sel || !sel.length) return err('Select some artwork first.');
        level = app.userInteractionLevel; app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

        var i, b = null, vb;
        for (i = 0; i < sel.length; i++) {
            vb = sel[i].visibleBounds;                         /* [left, top, right, bottom], y up */
            if (!b) b = [vb[0], vb[1], vb[2], vb[3]];
            else { b[0] = Math.min(b[0], vb[0]); b[1] = Math.max(b[1], vb[1]); b[2] = Math.max(b[2], vb[2]); b[3] = Math.min(b[3], vb[3]); }
        }
        var w = Math.max(1, Math.ceil(b[2] - b[0])), h = Math.max(1, Math.ceil(b[1] - b[3]));
        if (w > 16000 || h > 16000) return err('That selection is too large to send (' + w + ' x ' + h + ' px).');

        var dir = new Folder(o.base + '/transfers/' + o.id);
        if (!dir.exists && !dir.create()) return err('Could not create the link folder: ' + dir.fsName);
        var art = new File(dir.fsName + '/art.ai');

        tmp = app.documents.add(doc.documentColorSpace, w, h);
        var base = tmp.layers[0], made = [], first = '';
        for (i = 0; i < sel.length; i++) {
            var target = o.perObject ? tmp.layers.add() : base;
            var item = sel[i], copy = item.duplicate(target, ElementPlacement.PLACEATEND), nm = '';
            try { nm = item.typename === 'TextFrame' ? item.contents : item.name; } catch (e1) {}
            if (!nm) nm = item.typename || 'Object';
            nm = String(nm).replace(/[\r\n]/g, ' ').substring(0, 40);
            if (!first) first = nm;
            if (o.perObject) try { target.name = nm; } catch (e2) {}
            made.push(copy);
        }
        if (o.perObject) try { base.remove(); } catch (e3) {}

        var ab = tmp.artboards[0].artboardRect, L = null, T = null;
        for (i = 0; i < made.length; i++) {
            vb = made[i].visibleBounds;
            if (L === null || vb[0] < L) L = vb[0];
            if (T === null || vb[1] > T) T = vb[1];
        }
        for (i = 0; i < made.length; i++) made[i].translate(ab[0] - L, ab[1] - T);

        var opts = new IllustratorSaveOptions();
        opts.compatibility = Compatibility.ILLUSTRATOR17;
        opts.pdfCompatible = true;
        tmp.saveAs(art, opts);
        tmp.close(SaveOptions.DONOTSAVECHANGES); tmp = null;
        app.activeDocument = doc;

        var title = (sel.length === 1 ? first : doc.name.replace(/\.[^.]+$/, '') + ' (' + sel.length + ')');
        var mf = new File(dir.fsName + '/manifest.tmp');
        mf.encoding = 'UTF-8'; mf.open('w');
        mf.write('{"id":' + q(o.id) + ',"app":"ILST","kind":"ai","file":"art.ai","title":' + q(title) + ',"count":' + sel.length + ',"width":' + w + ',"height":' + h + ',"time":' + (new Date()).getTime() + '}');
        mf.close();
        mf.rename('manifest.json');                           /* written last so the receiver never sees half a transfer */
        return 'OK:' + encodeURIComponent('Sent ' + sel.length + ' object' + (sel.length === 1 ? '' : 's') + ' to After Effects.');
    } catch (e) {
        try { if (job) { var bad = new Folder(job.base + '/transfers/' + job.id); if (bad.exists && !new File(bad.fsName + '/manifest.json').exists) purge(bad); } } catch (ignore0) {}
        try { if (tmp) tmp.close(SaveOptions.DONOTSAVECHANGES); if (doc) app.activeDocument = doc; } catch (ignore) {}
        return err(String(e.message || e) + (e.line ? ' (line ' + e.line + ')' : ''));
    } finally {
        try { if (level !== null) app.userInteractionLevel = level; } catch (ignore2) {}
    }
}
