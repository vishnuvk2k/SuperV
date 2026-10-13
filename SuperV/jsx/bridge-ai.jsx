/* SuperV: Illustrator Bridge. Pull the open Illustrator document into After Effects as an editable comp. ES3 only. */
function VKIllustrator(h) {
    function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }
    function bridgeFolder(name) {
        var root = app.project.rootFolder, i, item;
        for (i = 1; i <= app.project.numItems; i++) {
            item = app.project.item(i);
            if (item instanceof FolderItem && item.parentFolder === root && item.name === name) return item;
        }
        item = app.project.items.addFolder(name);
        return item;
    }
    /* ---------- Ask the running Illustrator to send its document (BridgeTalk) ---------- */
    function illustratorTarget() {
        var specs = [], seen = {}, i, s, installed = false;
        function add(x) { if (x && !seen[x]) { seen[x] = true; specs.push(x); } }
        try { s = BridgeTalk.getSpecifier('illustrator'); if (s) { installed = true; add(s); } } catch (e0) { }
        try { var list = BridgeTalk.getTargets(); for (i = 0; i < list.length; i++) if (/^illustrator/i.test(String(list[i]))) { installed = true; add(String(list[i])); } } catch (e1) { }
        for (i = 0; i < specs.length; i++) {
            try { if (BridgeTalk.isRunning(specs[i])) return specs[i]; } catch (e2) { }
        }
        if (!installed) h.fail('Illustrator was not found on this computer. Use "Choose .ai file" instead.');
        h.fail('Illustrator is not running. Open Illustrator with your artwork, then try again.');
    }
    function bridgePull() {
        var script = new File(h.moduleRoot.fsName + '/bridge/SuperV-Push-to-AE.jsx');
        if (!script.exists) h.fail('The Illustrator script is missing: ' + script.fsName + '. Reinstall the complete package.');
        script.encoding = 'UTF-8';
        if (!script.open('r')) h.fail('Cannot read ' + script.fsName);
        var body = script.read();
        script.close();
        var target = illustratorTarget();
        var bt = new BridgeTalk();
        bt.target = target;
        bt.body = body;
        bt.onError = function (m) { $.global.__VK_BRIDGE_ERROR__ = String(m && m.body ? m.body : m); };
        $.global.__VK_BRIDGE_ERROR__ = '';
        bt.send(10);
        return { message: 'Asked Illustrator to send the open document…', target: target };
    }

    /* ---------- Import the pushed file ---------- */
    function convertToShapes(comp) {
        var cmd = 0, i, l, removed = 0, before = comp.numLayers;
        try { cmd = app.findMenuCommandId('Create Shapes from Vector Layer'); } catch (e0) { cmd = 0; }
        if (!cmd) return { ok: false, note: 'Shape conversion needs the English After Effects menus, so the layers were left as vector footage.' };
        comp.openInViewer();
        for (i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = true;
        app.executeCommand(cmd);
        // The command leaves each original switched off above or below its new shape layer. Remove only those originals.
        for (i = comp.numLayers; i >= 1; i--) {
            l = comp.layer(i);
            if (l instanceof AVLayer && !l.enabled && l.source instanceof FootageItem && l.source.file && /\.(ai|eps|pdf)$/i.test(l.source.file.name)) { l.remove(); removed++; }
        }
        if (comp.numLayers <= before - removed) return { ok: false, note: 'After Effects did not create shape layers, so the vector layers were kept.' };
        return { ok: true, removed: removed };
    }
    function bridgeImport(o) {
        var file = new File(String(o.path || ''));
        if (!file.exists) h.fail('File not found: ' + o.path);
        if (!/\.(ai|eps|pdf)$/i.test(file.name)) h.fail('Choose an Illustrator (.ai) file.');
        var kind = o.as === 'footage' ? ImportAsType.FOOTAGE : (o.as === 'cropped' ? ImportAsType.COMP_CROPPED_LAYERS : ImportAsType.COMP);
        var io = new ImportOptions(file);
        if (!io.canImportAs(kind)) h.fail('After Effects cannot read the layers of this file. In Illustrator use File > Save As and tick "Create PDF Compatible File", then push again.');
        io.importAs = kind;
        var active = app.project.activeItem, target = (active instanceof CompItem) ? active : null;
        var item;
        try { item = app.project.importFile(io); }
        catch (e) { h.fail('After Effects could not import ' + file.name + '. ' + (e.message || e)); }
        var notes = [], layerCount = 0, i, l;
        if (item instanceof CompItem) {
            layerCount = item.numLayers;
            if (o.shapes) {
                var shaped = convertToShapes(item);
                if (!shaped.ok) notes.push(shaped.note);
            } else if (o.crisp) {
                for (i = 1; i <= item.numLayers; i++) {
                    l = item.layer(i);
                    try { if (l instanceof AVLayer && l.canSetCollapseTransformation) l.collapseTransformation = true; } catch (e1) { }
                }
            }
        }
        // Tidy: keep the comp and its layer footage together in one project folder.
        var home = bridgeFolder('SuperV Bridge');
        item.parentFolder = home;
        var layersFolder = null, root = app.project.rootFolder;
        for (i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if (it instanceof FolderItem && it.parentFolder === root && it.name === item.name + ' Layers') { layersFolder = it; break; }
        }
        if (layersFolder) layersFolder.parentFolder = home;
        var added = false;
        if (o.into && item instanceof CompItem) {
            if (target && target !== item) { target.layers.add(item); added = true; }
            else notes.push('Open a comp first to add the artwork into it.');
        }
        if (item instanceof CompItem && !added) item.openInViewer();
        var what = item instanceof CompItem ? 'comp "' + item.name + '" (' + item.width + ' × ' + item.height + ', ' + plural(item.numLayers, 'layer') + ')' : 'footage "' + item.name + '"';
        return { message: 'Imported ' + what + (added ? ' and added it to "' + target.name + '"' : '') + '.' + (notes.length ? ' ' + notes.join(' ') : ''), layers: layerCount };
    }
    return { bridgePull: bridgePull, bridgeImport: bridgeImport };
}
