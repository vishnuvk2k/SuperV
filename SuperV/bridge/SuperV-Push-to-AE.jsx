/* SuperV Bridge · Illustrator side.
   Saves the open document and tells the SuperV panel in After Effects where the file is.
   Two ways to run it:
   1) Automatically: in After Effects press "Pull from Illustrator" in SuperV > Bridge. Nothing to install.
   2) By hand: Illustrator > File > Scripts > Other Script… and choose this file
      (or copy it into Illustrator's Presets\Scripts folder to get it in the Scripts menu).
   Plain ExtendScript (ES3). It never changes your artwork. A saved .ai document is saved in place;
   an untitled document is saved once into %APPDATA%\SuperV-Bridge. */
(function () {
    function esc(s) {
        return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
    }
    function slash(p) { return String(p).replace(/\\/g, '/'); }
    function write(folder, json) {
        var tmp = new File(folder.fsName + '/latest.tmp'), out = new File(folder.fsName + '/latest.json');
        tmp.encoding = 'UTF-8';
        if (!tmp.open('w')) throw new Error('Cannot write to ' + folder.fsName);
        tmp.write(json);
        tmp.close();
        if (out.exists) out.remove();
        if (!tmp.rename('latest.json')) throw new Error('Cannot finish writing ' + out.fsName);
    }
    var folder = new Folder(Folder.userData.fsName + '/SuperV-Bridge');
    try {
        if (!folder.exists && !folder.create()) throw new Error('Cannot create ' + folder.fsName);
        if (app.documents.length === 0) throw new Error('Open the artwork in Illustrator first.');
        var doc = app.activeDocument, file = null, named = false;
        try { file = doc.fullName; named = !!(file && file.exists && /\.ai$/i.test(file.name)); } catch (e0) { named = false; }
        if (!named) {
            var base = String(doc.name).replace(/\.[^.]*$/, '').replace(/[^\w\- ]+/g, '_');
            if (!base) base = 'Artwork';
            file = new File(folder.fsName + '/' + base + '.ai');
            var opts = new IllustratorSaveOptions();
            opts.pdfCompatible = true; // After Effects reads the layers through the PDF data inside the .ai file
            doc.saveAs(file, opts);
        } else if (!doc.saved) {
            doc.save();
        }
        var width = 0, height = 0;
        try {
            var r = doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect;
            width = Math.round(r[2] - r[0]); height = Math.round(r[1] - r[3]);
        } catch (e1) { }
        write(folder, '{"v":1,"ok":true,"stamp":' + new Date().getTime() + ',"path":"' + esc(slash(file.fsName)) + '","name":"' + esc(file.name) +
            '","width":' + width + ',"height":' + height + ',"artboards":' + doc.artboards.length + ',"layers":' + doc.layers.length + '}');
        return 'SuperV Bridge: sent ' + file.name;
    } catch (e) {
        try { write(folder, '{"v":1,"ok":false,"stamp":' + new Date().getTime() + ',"error":"' + esc(e.message || e) + '"}'); }
        catch (e2) { alert('SuperV Bridge: ' + (e.message || e)); }
        return 'SuperV Bridge error: ' + (e.message || e);
    }
})();
