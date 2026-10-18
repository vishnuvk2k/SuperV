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

    return { linkImport: linkImport };
}
