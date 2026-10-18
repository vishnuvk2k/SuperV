/* SuperV Send - Photoshop. Copies the selected layers into a new document and saves it as a layered .psd. */
function superv_send(enc) {
    var units = null, dup = null, src = null;
    var job = null;
    function purge(d) { try { var a = d.getFiles(), i; for (i = 0; i < a.length; i++) a[i].remove(); d.remove(); } catch (e) {} }
    function err(m) { return 'ERR:' + encodeURIComponent(m); }
    function q(s) { return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]/g, ' ') + '"'; }
    function selectedCount() {
        var ref = new ActionReference();
        ref.putEnumerated(charIDToTypeID('Dcmn'), charIDToTypeID('Ordn'), charIDToTypeID('Trgt'));
        var d = executeActionGet(ref), key = stringIDToTypeID('targetLayers');
        return d.hasKey(key) ? d.getList(key).count : 0;
    }
    try {
        var o = eval('(' + decodeURIComponent(enc) + ')'); job = o;
        if (app.documents.length === 0) return err('Open a document first.');
        src = app.activeDocument;
        var n = selectedCount();
        if (n < 1) return err('Select one or more layers first.');

        units = app.preferences.rulerUnits; app.preferences.rulerUnits = Units.PIXELS;
        var dir = new Folder(o.base + '/transfers/' + o.id);
        if (!dir.exists && !dir.create()) return err('Could not create the link folder: ' + dir.fsName);
        var art = new File(dir.fsName + '/art.psd');

        var name = 'SuperVSend' + o.id;
        dup = app.documents.add(src.width, src.height, src.resolution, name, NewDocumentMode.RGB, DocumentFill.TRANSPARENT);
        app.activeDocument = src;

        var desc = new ActionDescriptor(), from = new ActionReference(), to = new ActionReference();
        from.putEnumerated(charIDToTypeID('Lyr '), charIDToTypeID('Ordn'), charIDToTypeID('Trgt'));
        to.putName(charIDToTypeID('Dcmn'), name);
        desc.putReference(charIDToTypeID('null'), from);
        desc.putReference(charIDToTypeID('T   '), to);
        desc.putInteger(charIDToTypeID('Vrsn'), 5);
        executeAction(charIDToTypeID('Dplc'), desc, DialogModes.NO);
        app.activeDocument = dup;

        /* drop the empty starter layer that a transparent new document comes with */
        var i;
        for (i = dup.layers.length - 1; i >= 0; i--) {
            var ly = dup.layers[i];
            if (ly.typename === 'ArtLayer' && ly.name === 'Layer 1' && ly.kind === LayerKind.NORMAL) {
                try { if (ly.bounds[2].as('px') - ly.bounds[0].as('px') <= 0 && dup.layers.length > 1) ly.remove(); } catch (e0) {}
            }
        }
        var psd = new PhotoshopSaveOptions();
        psd.layers = true; psd.embedColorProfile = true; psd.maximizeCompatibility = true;
        dup.saveAs(art, psd, true, Extension.LOWERCASE);
        dup.close(SaveOptions.DONOTSAVECHANGES); dup = null;
        app.activeDocument = src;

        var title = src.name.replace(/\.[^.]+$/, '') + ' (' + n + ' layer' + (n === 1 ? '' : 's') + ')';
        var mf = new File(dir.fsName + '/manifest.tmp');
        mf.encoding = 'UTF-8'; mf.open('w');
        mf.write('{"id":' + q(o.id) + ',"app":"PHXS","kind":"psd","file":"art.psd","title":' + q(title) + ',"count":' + n + ',"time":' + (new Date()).getTime() + '}');
        mf.close();
        mf.rename('manifest.json');
        return 'OK:' + encodeURIComponent('Sent ' + n + ' layer' + (n === 1 ? '' : 's') + ' to After Effects.');
    } catch (e) {
        try { if (job) { var bad = new Folder(job.base + '/transfers/' + job.id); if (bad.exists && !new File(bad.fsName + '/manifest.json').exists) purge(bad); } } catch (ignore0) {}
        try { if (dup) dup.close(SaveOptions.DONOTSAVECHANGES); if (src) app.activeDocument = src; } catch (ignore) {}
        return err(String(e.message || e) + (e.line ? ' (line ' + e.line + ')' : ''));
    } finally {
        try { if (units !== null) app.preferences.rulerUnits = units; } catch (ignore2) {}
    }
}
