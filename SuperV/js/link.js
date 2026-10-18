/* SuperV Link - After Effects side. Watches the shared folder for artwork from Illustrator / Photoshop. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var nodeRequire = window.cep_node && window.cep_node.require ? window.cep_node.require : (typeof require === 'function' ? require : null);
  if (!nodeRequire || !$('link')) return;
  var fs, path, base;
  try {
    fs = nodeRequire('fs'); path = nodeRequire('path');
    base = path.join(process.env.APPDATA || process.env.HOME || '.', 'SuperV', 'link');
    mkdirs(path.join(base, 'status')); mkdirs(path.join(base, 'transfers'));
  } catch (e) { $('link-list').textContent = 'Link folder is not available: ' + e.message; return; }
  $('link-folder').textContent = base;

  var items = {}, order = [], importing = false, queue = [];
  function mkdirs(dir) { try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {} }
  function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return null; } }

  /* ---- heartbeat: tell the senders we are here ---- */
  function beat() {
    try { fs.writeFileSync(path.join(base, 'status', 'AEFT.json'), JSON.stringify({ app: 'AEFT', time: Date.now() })); } catch (_) {}
  }
  function senderState() {
    ['ILST', 'PHXS'].forEach(function (app) {
      var s = readJson(path.join(base, 'status', app + '.json')), on = !!(s && Date.now() - s.time < 6000);
      $('link-dot-' + app).className = 'dot' + (on ? ' on' : '');
      $('link-state-' + app).textContent = on ? 'connected' : 'not detected';
    });
  }

  /* ---- list ---- */
  function render() {
    var box = $('link-list');
    if (!order.length) { box.innerHTML = '<p class="empty">Nothing received yet. Open the SuperV Send panel in Illustrator or Photoshop, select artwork and press Send.</p>'; return; }
    box.innerHTML = '';
    order.slice().reverse().forEach(function (id) {
      var it = items[id], row = document.createElement('div');
      row.className = 'link-item ' + (it.state === 'done' ? 'ok' : it.state === 'error' ? 'err' : '');
      var name = document.createElement('b'); name.textContent = it.m.title || id;
      var small = document.createElement('small');
      small.textContent = it.state === 'done' ? 'imported' : it.state === 'error' ? 'failed' : it.state === 'working' ? 'importing…' : (it.m.app === 'PHXS' ? 'Photoshop' : 'Illustrator');
      if (it.error) row.title = it.error;
      var btn = document.createElement('button'); btn.textContent = it.state === 'done' ? 'Again' : 'Import';
      btn.onclick = function () { enqueue(id); };
      row.appendChild(name); row.appendChild(small); row.appendChild(btn); box.appendChild(row);
    });
  }

  /* ---- import ---- */
  function enqueue(id) { if (queue.indexOf(id) < 0) queue.push(id); pump(); }
  function pump() {
    if (importing || !queue.length) return;
    var id = queue.shift(), it = items[id];
    if (!it || typeof window.VKLinkBridge !== 'function') return;
    importing = true; it.state = 'working'; it.error = ''; render();
    var file = path.join(base, 'transfers', id, it.m.file);
    var job;
    if (it.m.kind === 'vector') {
      var data; try { data = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); } catch (e) { it.state = 'error'; it.error = 'Could not read the sent data: ' + e.message; importing = false; render(); return pump(); }
      job = window.VKLinkBridge('linkVector', { data: data, title: it.m.title, mode: $('link-mode').value });
    } else job = window.VKLinkBridge('linkImport', { file: file, kind: it.m.kind, title: it.m.title, mode: $('link-mode').value });
    job
      .then(function (r) {
        it.state = 'done';
        try { fs.writeFileSync(path.join(base, 'transfers', id, 'imported.json'), JSON.stringify({ time: Date.now(), message: r.message || '' })); } catch (_) {}
        if (window.VKLinkStatus) window.VKLinkStatus(r.message || 'Imported.', 'success');
      }, function (e) {
        it.state = 'error'; it.error = e.message;
        try { fs.writeFileSync(path.join(base, 'transfers', id, 'error.json'), JSON.stringify({ time: Date.now(), message: e.message })); } catch (_) {}
        if (window.VKLinkStatus) window.VKLinkStatus(e.message, 'error');
      })
      .then(function () { importing = false; render(); pump(); });
  }

  /* ---- scan for new transfers ---- */
  function scan() {
    var dir = path.join(base, 'transfers'), names;
    try { names = fs.readdirSync(dir); } catch (_) { return; }
    names.sort().forEach(function (id) {
      if (items[id]) return;
      var m = readJson(path.join(dir, id, 'manifest.json'));
      if (!m || !m.file) return;                         /* the sender writes the manifest last */
      if (!fs.existsSync(path.join(dir, id, m.file))) return;
      var done = fs.existsSync(path.join(dir, id, 'imported.json'));
      items[id] = { m: m, state: done ? 'done' : 'new', error: '' }; order.push(id);
      if (!done && $('link-auto').checked) enqueue(id);
    });
    /* forget transfers older than a day */
    names.forEach(function (id) {
      var m = items[id] && items[id].m;
      if (m && Date.now() - (m.time || 0) > 86400000) { try { rmrf(path.join(dir, id)); } catch (_) {} }
    });
    render();
  }
  function rmrf(p) {
    if (!fs.existsSync(p)) return;
    fs.readdirSync(p).forEach(function (f) {
      var q = path.join(p, f);
      if (fs.lstatSync(q).isDirectory()) rmrf(q); else fs.unlinkSync(q);
    });
    fs.rmdirSync(p);
  }

  $('link-clear').onclick = function () { order = []; items = {}; queue = []; render(); };
  /* Existing transfers from before the panel opened are listed but not auto-imported. */
  try {
    fs.readdirSync(path.join(base, 'transfers')).sort().forEach(function (id) {
      var m = readJson(path.join(base, 'transfers', id, 'manifest.json'));
      if (m && m.file) { items[id] = { m: m, state: fs.existsSync(path.join(base, 'transfers', id, 'imported.json')) ? 'done' : 'new', error: '' }; order.push(id); }
    });
  } catch (_) {}
  beat(); senderState(); render();
  setInterval(function () { beat(); senderState(); scan(); }, 1500);
})();
