(function () {
  'use strict';
  var VERSION = '1.3.1';
  var $ = function (id) { return document.getElementById(id); };
  var all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var cep = window.__adobe_cep__, isAE = !!cep, node = window.cep_node && window.cep_node.require ? window.cep_node.require : (typeof require === 'function' ? require : null);
  var defaults = { encoder: '', ui: { tab: 'effects', effects: '', text: 'animate' } };
  var presetList = VKText.presets, category = presetList[0].group;
  var cancelRender = false, state, preset = 'slide', encoder = null, path = null, fs = null, extensionRoot = '', videoPath = '', outputPath = '', exportJob = null, busy = false, previewAnimations = [];
  try {
    var configRequest = new XMLHttpRequest(); configRequest.open('GET', 'config/defaults.json', false); configRequest.send();
    var config = JSON.parse(configRequest.responseText);
    if (/^#[0-9a-f]{6}$/i.test(config.theme)) document.documentElement.style.setProperty('--blue', config.theme);
  } catch (_) { /* Built-in defaults also support browser previews with local-file restrictions. */ }

  /* ---------- Status, settings ---------- */
  function status(message, kind) { $('status').textContent = String(message); $('statusbar').className = kind || ''; }
  function save() { try { localStorage.setItem('vk.gsd.settings.v1', JSON.stringify(state)); } catch (e) { status('Settings could not be saved: ' + e.message, 'error'); } }
  function validHex(s) { return typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s); }
  function load() {
    try { state = JSON.parse(localStorage.getItem('vk.gsd.settings.v1') || '{}'); } catch (_) { state = {}; }
    state = Object.assign({}, defaults, state);
    delete state.recentColours; delete state.pinnedColours; delete state.currentColour;
    state.ui = Object.assign({}, defaults.ui, state.ui || {});
    state.fields = state.fields || {};
    Object.keys(state.fields).forEach(function (id) {
      var el = $(id); if (!el) return;
      if (el.classList.contains('seg') || el.classList.contains('chips')) setSeg(id, state.fields[id], true);
      else if (el.type === 'checkbox') el.checked = !!state.fields[id];
      else el.value = state.fields[id];
    });
    $('encoder-path').value = state.encoder || '';
  }
  function value(id) { return $(id).value; }
  function checked(id) { return $(id).checked; }
  function n(id) { var e = $(id); if (!e.checkValidity()) throw new Error('Check ' + (e.closest('label') ? e.closest('label').firstChild.textContent.trim() : id) + ': ' + e.validationMessage); var x = Number(e.value); if (!Number.isFinite(x)) throw new Error('Enter a number.'); return x; }

  /* ---------- Segmented controls ---------- */
  function segValue(id) { var on = $(id).querySelector('.on'); return on ? on.dataset.value : ''; }
  function setSeg(id, v, quiet) {
    var buttons = all('button', $(id)), found = buttons.filter(function (b) { return b.dataset.value === v; })[0];
    if (!found) return;
    buttons.forEach(function (b) { b.classList.toggle('on', b === found); });
    if (!quiet) { state.fields[id] = v; save(); }
    updateDependents();
  }
  function updateDependents() {
    all('[data-show-for]').forEach(function (el) { el.hidden = el.dataset.show.split(' ').indexOf(segValue(el.dataset.showFor)) < 0; });
    all('[data-label-for]').forEach(function (el) { var v = segValue(el.dataset.labelFor); if (el.dataset[v]) el.textContent = el.dataset[v]; });
    var src = segValue('gif-source'), ch = value('gif-channels');
    $('video-row').hidden = src !== 'video'; $('gif-range-row').hidden = src !== 'comp';
    $('gif-background-row').hidden = ch !== 'rgb'; $('gif-threshold-row').hidden = ch !== 'rgba';
    $('channel-hint').textContent = ch === 'alpha' ? 'Alpha exports a grayscale mask. Video without alpha comes out white.' : ch === 'rgba' ? 'GIF transparency is hard-edged; soft edges are thresholded.' : 'RGB flattens transparency onto the background colour.';
  }

  /* ---------- AE connection ---------- */
  var connection;
  function bridge(action, args) {
    if (!connection) return Promise.reject(new Error('The After Effects connection could not start. Reinstall the complete ' + VERSION + ' package.'));
    return connection.call(action, args);
  }
  function setBusy(v) { busy = v; all('[data-action],#export-gif').forEach(function (b) { b.disabled = v; }); }
  function setBtn(btn, st) {
    if (!btn || !btn.classList.contains('primary')) return;
    clearTimeout(btn._t); btn.dataset.state = st;
    if (st === 'done' || st === 'error') btn._t = setTimeout(function () { btn.dataset.state = ''; }, 1600);
  }
  async function run(action, args, btn) {
    if (busy) return;
    setBusy(true); setBtn(btn, 'working'); status('Working…', 'working');
    try { var r = await bridge(action, args); status(r.message || 'Done.', 'success'); setBtn(btn, 'done'); return r; }
    catch (e) { status(e.message, 'error'); setBtn(btn, 'error'); }
    finally { setBusy(false); }
  }

  /* ---------- Tabs, tiles, drawers ---------- */
  function showTab(id) {
    all('.tab').forEach(function (t) { t.classList.toggle('active', t.id === id); });
    all('.tabs button').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === id); });
    document.querySelector('.tabs').classList.toggle('dimmed', id === 'settings');
    if (id !== 'settings') { state.ui.tab = id; save(); }
    if (id === 'text' && state.ui.text === 'animate') playPreview();
  }
  function openTool(section, tool) {
    var root = $(section);
    all('.tile', root).forEach(function (t) { t.classList.toggle('active', t.dataset.tool === tool); });
    all('.opts', root).forEach(function (o) { o.hidden = o.dataset.tool !== tool; });
    root.querySelector('.drawer').classList.toggle('has-tool', !!tool);
    state.ui[section] = tool; save();
    if (tool === 'animate') playPreview();
    if (tool === 'ease') drawEase();
  }

  /* ---------- Tool arguments ---------- */
  function toolArgs(action) {
    switch (action) {
      case 'crop': return { mode: segValue('crop-mode'), scope: value('crop-scope'), range: value('crop-range'), padding: n('crop-padding') };
      case 'null': return { position: value('null-position'), parent: checked('null-parent') };
      case 'copyKeys': case 'pasteKeys': return { expressions: checked('keys-expressions'), offset: value('keys-offset') };
      case 'loop': return { direction: value('loop-direction'), type: value('loop-type'), count: n('loop-count'), replace: checked('loop-replace') };
      case 'wiggle': return { amount: n('wiggle-pixels'), frequency: n('wiggle-speed'), replace: checked('wiggle-replace') };
      case 'ease': return { curve: easeEffective(), mode: segValue('ease-mode'), linear: easeFamily === 'linear' };
      case 'depth': return { lens: Number(value('depth-lens')), spacing: n('depth-spacing'), start: n('depth-start'), order: segValue('depth-order'), keepSize: checked('depth-keep'), camera: checked('depth-camera') };
      case 'spin': return { mode: segValue('spin-mode'), speed: n('spin-speed'), radius: n('spin-radius'), direction: segValue('spin-direction'), replace: checked('spin-replace') };
      case 'counter': return { from: n('counter-from'), to: n('counter-to'), duration: n('counter-duration'), decimals: n('counter-decimals'), prefix: value('counter-prefix'), suffix: value('counter-suffix'), separator: checked('counter-separator'), first: checked('counter-separator') ? n('counter-first') : 3, every: checked('counter-separator') ? n('counter-every') : 3, replace: checked('counter-replace') };
      case 'text': case 'textPreview': return textOptions();
      case 'textBox': return { padding: n('box-padding'), roundness: n('box-roundness'), color: value('box-colour'), opacity: n('box-opacity') };
      case 'splitText': return { by: segValue('split-by'), hideOriginal: checked('split-hide') };
      case 'changeCase': return { mode: segValue('case-mode') };
      case 'textCursor': return { duration: n('cursor-duration'), cursor: value('cursor-char'), blink: n('cursor-blink'), keep: checked('cursor-keep'), replace: checked('cursor-replace') };
      case 'compPreset': return { preset: segValue('comp-preset'), mode: segValue('comp-mode'), center: checked('comp-center'), fps: n('comp-fps'), duration: n('comp-duration') };
      default: return {};
    }
  }

  /* ---------- Counter preview ---------- */
  function counterPreview() {
    $('counter-comma-options').hidden = !checked('counter-separator');
    try {
      var o = toolArgs('counter');
      $('counter-preview').textContent = [o.from, o.to].map(function (v) { return VKFormatNumber(v, o.decimals, o.separator, o.first, o.every, o.prefix, o.suffix); }).join('  →  ');
    } catch (e) { $('counter-preview').textContent = 'Check the number settings'; }
  }


  /* ---------- Ease curve editor ---------- */
  var EASES = {
    sine: { in: [0.12, 0, 0.39, 0], out: [0.61, 1, 0.88, 1], inout: [0.37, 0, 0.63, 1] },
    quad: { in: [0.11, 0, 0.5, 0], out: [0.5, 1, 0.89, 1], inout: [0.45, 0, 0.55, 1] },
    cubic: { in: [0.32, 0, 0.67, 0], out: [0.33, 1, 0.68, 1], inout: [0.65, 0, 0.35, 1] },
    quart: { in: [0.5, 0, 0.75, 0], out: [0.25, 1, 0.5, 1], inout: [0.76, 0, 0.24, 1] },
    quint: { in: [0.64, 0, 0.78, 0], out: [0.22, 1, 0.36, 1], inout: [0.83, 0, 0.17, 1] },
    expo: { in: [0.7, 0, 0.84, 0], out: [0.16, 1, 0.3, 1], inout: [0.87, 0, 0.13, 1] },
    circ: { in: [0.55, 0, 1, 0.45], out: [0, 0.55, 0.45, 1], inout: [0.85, 0, 0.15, 1] },
    back: { in: [0.36, 0, 0.66, -0.56], out: [0.34, 1.64, 0.64, 1], inout: [0.68, -0.6, 0.32, 1.6] }
  };
  var LINEAR = [1 / 3, 1 / 3, 2 / 3, 2 / 3], easeBase = EASES.cubic.inout.slice(), easeFamily = 'cubic', easeAnim = null;
  function round2(v) { return Math.round(v * 100) / 100; }
  function easeStrength() { return Number($('ease-strength').value) / 100; }
  function easeEffective() {
    if (easeFamily === 'linear') return LINEAR.slice();
    var k = easeStrength(); return easeBase.map(function (v, i) { return round2(LINEAR[i] + (v - LINEAR[i]) * k); });
  }
  function gx(x) { return 20 + x * 200; } function gy(y) { return 170 - y * 120; }
  function drawEase() {
    var c = easeEffective(), x1 = gx(c[0]), y1 = gy(c[1]), x2 = gx(c[2]), y2 = gy(c[3]);
    $('eg-curve').setAttribute('d', 'M20 170 C' + x1 + ' ' + y1 + ' ' + x2 + ' ' + y2 + ' 220 50');
    [['eg-l1', 20, 170, x1, y1], ['eg-l2', 220, 50, x2, y2]].forEach(function (l) { var e = $(l[0]); e.setAttribute('x1', l[1]); e.setAttribute('y1', l[2]); e.setAttribute('x2', l[3]); e.setAttribute('y2', l[4]); });
    $('eg-h1').setAttribute('cx', x1); $('eg-h1').setAttribute('cy', y1); $('eg-h2').setAttribute('cx', x2); $('eg-h2').setAttribute('cy', y2);
    $('ease-values').value = c.join(', ');
    $('ease-strength-val').textContent = easeFamily === 'linear' ? '' : $('ease-strength').value + '%';
    all('#ease-family button').forEach(function (b) { b.classList.toggle('on', b.dataset.value === easeFamily); });
    if (easeAnim) easeAnim.cancel();
    var track = document.querySelector('.ease-track');
    if (track && track.offsetWidth) easeAnim = $('ease-ball').animate([{ transform: 'translateX(0)' }, { transform: 'translateX(' + (track.offsetWidth - 14) + 'px)' }], { duration: 1100, iterations: Infinity, direction: 'alternate', easing: 'cubic-bezier(' + c.join(',') + ')', delay: 150, endDelay: 250 });
    state.ui.ease = { base: easeBase, family: easeFamily, strength: $('ease-strength').value }; save();
  }
  function pickEasePreset() { if (easeFamily !== 'linear') easeBase = EASES[easeFamily][segValue('ease-dir')].slice(); drawEase(); }
  function setCustom(c) { easeBase = c; easeFamily = 'custom'; $('ease-strength').value = 100; drawEase(); }
  function initEase() {
    var saved = state.ui.ease;
    if (saved && Array.isArray(saved.base) && saved.base.length === 4) { easeBase = saved.base; easeFamily = saved.family || 'custom'; $('ease-strength').value = saved.strength || 100; }
    var svg = $('ease-graph'), dragging = null;
    function toGraph(e) { var pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; var q = pt.matrixTransform(svg.getScreenCTM().inverse()); return [Math.max(0, Math.min(1, (q.x - 20) / 200)), Math.max(-0.6, Math.min(1.6, (170 - q.y) / 120))]; }
    ['eg-h1', 'eg-h2'].forEach(function (id, which) {
      var h = $(id);
      h.addEventListener('pointerdown', function (e) { dragging = which; h.classList.add('dragging'); h.setPointerCapture(e.pointerId); e.preventDefault(); });
      h.addEventListener('pointermove', function (e) { if (dragging !== which) return; var c = easeEffective(), g = toGraph(e); c[which * 2] = round2(g[0]); c[which * 2 + 1] = round2(g[1]); setCustom(c); });
      h.addEventListener('pointerup', function () { dragging = null; h.classList.remove('dragging'); });
      h.addEventListener('keydown', function (e) {
        var c = easeEffective(), step = e.shiftKey ? 0.1 : 0.01, i = which * 2, moved = true;
        if (e.key === 'ArrowLeft') c[i] = Math.max(0, round2(c[i] - step)); else if (e.key === 'ArrowRight') c[i] = Math.min(1, round2(c[i] + step));
        else if (e.key === 'ArrowUp') c[i + 1] = round2(c[i + 1] + step); else if (e.key === 'ArrowDown') c[i + 1] = round2(c[i + 1] - step); else moved = false;
        if (moved) { e.preventDefault(); setCustom(c); }
      });
    });
    all('#ease-family button').forEach(function (b) { b.onclick = function () { easeFamily = b.dataset.value; pickEasePreset(); }; });
    all('#ease-dir button').forEach(function (b) { b.onclick = function () { setSeg('ease-dir', b.dataset.value); if (easeFamily === 'custom') easeFamily = 'cubic'; pickEasePreset(); }; });
    $('ease-strength').addEventListener('input', drawEase);
    $('ease-values').addEventListener('change', function () {
      var v = this.value.split(/[\s,]+/).filter(Boolean).map(Number);
      if (v.length !== 4 || v.some(function (x) { return !Number.isFinite(x); }) || v[0] < 0 || v[0] > 1 || v[2] < 0 || v[2] > 1) { status('Enter four numbers, for example 0.65, 0, 0.35, 1. The first and third must be between 0 and 1.', 'error'); drawEase(); return; }
      setCustom(v.map(round2));
    });
  }

  /* ---------- Text animation previews ---------- */
  function textOptions() { return { preset: preset, duration: n('text-duration'), stagger: n('text-stagger'), by: VKText.get(preset).by || value('text-by'), direction: segValue('text-direction') }; }
  function animateText(el, spec, o) {
    el.textContent = ''; var units = [], animations = [], by = spec.by || o.by, sample = VKText.sample(spec), lines = sample.split('\n');
    el.classList.toggle('has-lines', lines.length > 1);
    // One centred block holds every unit, so a flex parent never stacks letters as separate rows.
    var host = el; el = document.createElement('span'); el.className = 'units'; host.appendChild(el);
    lines.forEach(function (line, lineIndex) {
      var parts = by === 'line' ? [line] : by === 'word' ? line.split(' ') : line.split('');
      parts.forEach(function (part, i) { var unit = document.createElement('span'); unit.className = 'unit'; unit.textContent = part; el.appendChild(unit); units.push(unit); if (by === 'word' && i < parts.length - 1) el.appendChild(document.createTextNode(' ')); });
      if (lineIndex < lines.length - 1) el.appendChild(document.createElement('br'));
    });
    var ds = VKText.delays(sample, by, o.stagger, spec.parallelRows), rawTotal = o.duration + Math.max.apply(Math, ds), total = o.duration, factor = total / rawTotal, ratio = parseFloat(getComputedStyle(host).fontSize) / 66;
    units.forEach(function (unit, i) {
      var frames = [], delay = o.direction === 'out' && spec.reverseOut ? rawTotal - o.duration - ds[i] : ds[i];
      if (spec.step) { delay += (i + 1) * o.duration / units.length; animations.push(unit.animate([{ opacity: o.direction === 'out' ? 1 : 0 }, { opacity: o.direction === 'out' ? 0 : 1 }], { duration: 1, delay: Math.max(0, delay * factor * 1000 - 1), easing: 'steps(1,end)', fill: 'both' })); return; }
      for (var k = 0; k <= 60; k++) {
        var t = k * o.duration / 60, amount = VKText.amount(t, 1, 1, o.duration, 0, o.direction === 'out', false, spec.curve || 'smooth') / 100, visible = 1 - amount;
        var x = (spec.x || 0) * (spec.opposing ? (i % 2 === 0 ? -1 : 1) : 1);
        var frame = { opacity: spec.outline ? Math.min(1, visible * 8) : visible, transform: 'translate(' + x * amount * ratio + 'px,' + (spec.y || 0) * amount * ratio + 'px) scale(' + (1 + ((spec.scale === undefined ? 100 : spec.scale) - 100) / 100 * amount) + ')', filter: 'blur(' + (spec.blur || 0) * ratio * amount + 'px)' };
        if (spec.outline) { unit.style.webkitTextStroke = '0.7px currentColor'; frame.color = 'rgba(241,241,241,' + Math.max(.001, (visible - .18) / .82) + ')'; unit.style.webkitTextStrokeColor = 'rgba(241,241,241,0.55)'; }
        if (spec.tracking) frame.letterSpacing = spec.tracking * ratio * amount + 'px';
        frames.push(frame);
      }
      animations.push(unit.animate(frames, { duration: o.duration * factor * 1000, delay: delay * factor * 1000, fill: 'both', easing: 'linear' }));
    });
    return { animations: animations, total: total * 1000 };
  }
  function renderCategories() {
    var groups = []; presetList.forEach(function (p) { if (groups.indexOf(p.group) < 0) groups.push(p.group); });
    $('text-cats').textContent = '';
    groups.forEach(function (g) {
      var b = document.createElement('button'); b.textContent = g.charAt(0) + g.slice(1).toLowerCase(); b.classList.toggle('on', g === category);
      b.onclick = function () { category = g; var p = presetList.filter(function (x) { return x.group === g; })[0]; choosePreset(p); renderCategories(); renderPresets(); };
      $('text-cats').appendChild(b);
    });
  }
  function choosePreset(p) {
    preset = p.id; $('text-by').disabled = !!p.by; if (p.by) $('text-by').value = p.by;
    $('text-duration').value = p.duration; $('text-stagger').value = p.stagger; playPreview();
  }
  function renderPresets() {
    $('preset-grid').textContent = '';
    presetList.forEach(function (p) {
      if (p.group !== category) return;
      var b = document.createElement('button'); b.className = 'preset' + (p.id === preset ? ' active' : ''); b.dataset.preset = p.id;
      b.innerHTML = '<span class="sample">SuperV</span><span class="caption"></span>';
      b.querySelector('.caption').textContent = p.name.charAt(0) + p.name.slice(1).toLowerCase();
      var hover = [];
      b.addEventListener('click', function () { all('.preset').forEach(function (x) { x.classList.toggle('active', x === b); }); choosePreset(p); });
      b.addEventListener('mouseenter', function () { hover.forEach(function (a) { a.cancel(); }); hover = animateText(b.querySelector('.sample'), p, { by: p.by || 'word', duration: p.duration, stagger: p.stagger, direction: 'in' }).animations; });
      b.addEventListener('mouseleave', function () { hover.forEach(function (a) { a.cancel(); }); hover = []; });
      $('preset-grid').appendChild(b);
    });
  }
  function playPreview() {
    previewAnimations.forEach(function (a) { a.cancel(); }); previewAnimations = [];
    var o; try { o = textOptions(); } catch (_) { return; }
    var spec = VKText.get(preset); $('preview-label').textContent = spec.name.charAt(0) + spec.name.slice(1).toLowerCase();
    var preview = animateText($('preview-text'), spec, o); previewAnimations = preview.animations;
    previewAnimations.push($('preview-progress').animate([{ width: '0%' }, { width: '100%' }], { duration: preview.total, fill: 'both' }));
  }

  /* ---------- Encoder, GIF and crop ---------- */
  function executable() { var p = value('encoder-path').trim(); if (p) return p; if (path && extensionRoot) { var bundled = path.join(extensionRoot, 'bin', 'ffmpeg.exe'); if (fs.existsSync(bundled)) return bundled; } return 'ffmpeg'; }
  async function renderVerified(options, cancelButton) {
    var session = await bridge('renderBegin', options), success = false; cancelRender = false;
    if (cancelButton) $(cancelButton).hidden = false;
    try {
      for (var i = 0; i < session.frames;) {
        if (cancelRender) throw new Error('Cancelled. Nothing was changed.');
        status('Rendering frame ' + (i + 1) + ' of ' + session.frames + '…', 'working');
        var batch = await bridge('renderFrame', { token: session.token, index: i, count: 8 });
        var paths = batch.paths || [batch.path];
        for (var k = 0; k < paths.length; k++) await encoder.waitForPNG(paths[k]);
        i += paths.length;
      }
      encoder.validateSequence(options.directory, session.frames);
      success = true; return session;
    } finally { if (cancelButton) $(cancelButton).hidden = true; await bridge('renderFinish', { token: session.token, success: success }); }
  }
  async function exportGIF(btn) {
    if (busy) return;
    var temp = null;
    try {
      if (!isAE) throw new Error('GIF export runs inside After Effects.');
      if (!encoder) throw new Error('The CEP Node runtime is unavailable. Reinstall the extension.');
      var options = { width: n('gif-width'), fps: n('gif-fps'), channels: value('gif-channels'), colours: n('gif-colours'), dither: value('gif-dither'), loop: n('gif-loop'), threshold: n('gif-threshold'), background: value('gif-background') };
      encoder.buildArgs(Object.assign({}, options, { input: 'check', output: 'check' }));
      setBusy(true); setBtn(btn, 'working'); status('Checking encoder…', 'working'); await encoder.testEncoder(executable());
      if (segValue('gif-source') === 'video' && !videoPath) throw new Error('Choose a video file first.');
      var dest = await bridge('pickOutput'); if (!dest.path) { status('Export cancelled.'); setBtn(btn, ''); return; }
      options.output = dest.path;
      if (segValue('gif-source') === 'comp') {
        temp = encoder.makeTemp();
        var rendered = await renderVerified({ purpose: 'gif', directory: temp, range: value('gif-range'), fps: options.fps }, 'cancel-export');
        var sequence = encoder.validateSequence(temp, rendered.frames);
        options.input = sequence.input; options.sequence = true;
      } else { options.input = videoPath; options.sequence = false; }
      if (path.resolve(options.input).toLowerCase() === path.resolve(options.output).toLowerCase()) throw new Error('Choose an output different from your source file.');
      status('Encoding GIF…', 'working'); $('cancel-export').hidden = false;
      exportJob = encoder.encode(executable(), options, function (chunk) { var match = chunk.match(/frame=(\d+)/); if (match) status('Encoding GIF · ' + match[1] + ' frames', 'working'); });
      var result = await exportJob.promise; outputPath = result.path; $('output-size').textContent = (result.bytes / 1024 / 1024).toFixed(2) + ' MB'; $('export-result').hidden = false;
      var url = node('url').pathToFileURL ? node('url').pathToFileURL(outputPath).href : 'file:///' + outputPath.replace(/\\/g, '/');
      $('gif-preview').src = url + '?v=' + Date.now(); $('gif-preview').hidden = false; status('GIF exported · ' + outputPath, 'success'); setBtn(btn, 'done');
    } catch (e) { status(e.message, 'error'); setBtn(btn, 'error'); }
    finally { exportJob = null; $('cancel-export').hidden = true; setBusy(false); if (temp) try { encoder.cleanup(temp); } catch (e) { status('Export finished; temporary PNGs remain at ' + temp + '. ' + e.message, 'error'); } }
  }
  async function cropComp(btn) {
    if (busy) return;
    var temp = null, options;
    try { options = toolArgs('crop'); } catch (e) { status(e.message, 'error'); return; }
    if (options.mode !== 'exact') { await run('cropFast', options, btn); return; }
    try {
      if (!encoder) throw new Error('Open the extension inside After Effects. Exact crop uses the included encoder.');
      setBusy(true); setBtn(btn, 'working');
      await encoder.testEncoder(executable()); temp = encoder.makeTemp();
      status('Measuring artwork at half size…', 'working');
      var measurement = await renderVerified({ purpose: 'crop', scope: options.scope, range: options.range, directory: temp, scale: 2 }, 'crop-cancel');
      var sequence = encoder.validateSequence(temp, measurement.frames);
      status('Reading rendered transparency…', 'working');
      var b = await encoder.alphaBounds(executable(), sequence, function (frame, total) { status('Measuring transparency · ' + frame + ' / ' + total + ' frames', 'working'); });
      var rx = measurement.width / sequence.width, ry = measurement.height / sequence.height, extra = rx > 1 || ry > 1 ? 1 : 0;
      var bounds = { left: Math.max(0, Math.floor(b.left * rx) - extra), top: Math.max(0, Math.floor(b.top * ry) - extra), right: Math.min(measurement.width, Math.ceil(b.right * rx) + extra), bottom: Math.min(measurement.height, Math.ceil(b.bottom * ry) + extra) };
      bounds.left = Math.min(bounds.left, measurement.width - 1); bounds.top = Math.min(bounds.top, measurement.height - 1);
      var result = await bridge('cropApply', Object.assign({}, bounds, { token: measurement.token, padding: options.padding }));
      status(result.message, 'success'); setBtn(btn, 'done');
    } catch (e) { status(e.message, 'error'); setBtn(btn, 'error'); }
    finally { setBusy(false); if (temp) try { encoder.cleanup(temp); } catch (e) { status('Temporary PNGs remain at ' + temp + '. ' + e.message, 'error'); } }
  }

  /* ---------- Start up ---------- */
  load();
  renderCategories(); renderPresets(); counterPreview(); updateDependents(); initEase();
  if (node) { try { path = node('path'); fs = node('fs'); extensionRoot = isAE ? decodeURI(cep.getSystemPath('extension')) : path.dirname(decodeURI(location.pathname).replace(/^\/(\w:)/, '$1')); extensionRoot = extensionRoot.replace(/^file:\/\/\//, ''); encoder = node(path.join(extensionRoot, 'js', 'encoder.cjs')); } catch (e) { status('Encoder module: ' + e.message, 'error'); } }
  try { if (isAE) extensionRoot = decodeURI(cep.getSystemPath('extension')).replace(/^file:\/\/\//, ''); connection = window.VKBridge.create(cep, extensionRoot); } catch (e) { status('Connection setup: ' + e.message, 'error'); }
  if (!isAE) $('preview-notice').hidden = false;
  else bridge('ping').then(function (r) { status('SuperV ' + VERSION + ' · ' + r.message, 'success'); }).catch(function (e) { status(e.message, 'error'); });

  all('.tabs button').forEach(function (b) { b.onclick = function () { showTab(b.dataset.tab); }; });
  $('settings-toggle').onclick = function () { showTab($('settings').classList.contains('active') ? state.ui.tab : 'settings'); };
  $('settings-back').onclick = function () { showTab(state.ui.tab); };
  all('.tile').forEach(function (t) { t.onclick = function () { openTool(t.closest('.tab').id, t.dataset.tool); }; });
  all('.seg:not(#ease-dir), .chips:not(#text-cats):not(#ease-family)').forEach(function (s) { all('button', s).forEach(function (b) { b.onclick = function () { setSeg(s.id, b.dataset.value); if (s.id === 'text-direction') playPreview(); }; }); });

  all('[data-action]').forEach(function (b) {
    b.onclick = async function () {
      var action = b.dataset.action;
      if (action === 'crop') { await cropComp(b); return; }
      var args; try { args = toolArgs(action); } catch (e) { status(e.message, 'error'); setBtn(b, 'error'); return; }
      var r = await run(action === 'null' ? 'nullTool' : action, args, b);
      if (action === 'copyKeys' && r) $('clipboard-info').textContent = r.message;
    };
  });
  $('reconnect').onclick = async function () {
    if (busy || !connection) return; setBusy(true); status('Connecting to After Effects…', 'working');
    try { var r = await connection.reconnect(); status('SuperV ' + VERSION + ' · ' + r.message, 'success'); } catch (e) { status(e.message, 'error'); } finally { setBusy(false); }
  };

  ['counter-from', 'counter-to', 'counter-decimals', 'counter-prefix', 'counter-suffix', 'counter-separator', 'counter-first', 'counter-every'].forEach(function (id) { $(id).addEventListener('input', counterPreview); });
  ['text-duration', 'text-stagger', 'text-by'].forEach(function (id) { $(id).addEventListener('change', playPreview); });
  $('replay').onclick = playPreview;
  $('gif-channels').addEventListener('change', updateDependents);

  $('export-gif').onclick = function () { exportGIF(this); };
  $('cancel-export').onclick = function () { cancelRender = true; if (exportJob) exportJob.cancel(); };
  $('crop-cancel').onclick = function () { cancelRender = true; status('Cancelling after the current frames…', 'working'); };
  $('pick-video').onclick = async function () { var r = await run('pickFile', { title: 'Choose a video to convert' }); if (r && r.path) { videoPath = r.path; $('video-label').textContent = videoPath; } };
  $('pick-encoder').onclick = async function () { var r = await run('pickFile', { title: 'Choose ffmpeg.exe' }); if (r && r.path) { state.encoder = r.path; $('encoder-path').value = r.path; save(); } };
  $('encoder-path').onchange = function () { state.encoder = this.value.trim(); save(); };
  $('test-encoder').onclick = async function () { try { if (!encoder) throw new Error('Open the panel inside After Effects.'); status('Testing encoder…', 'working'); status(await encoder.testEncoder(executable()), 'success'); } catch (e) { status(e.message, 'error'); } };
  $('show-output').onclick = function () { if (outputPath && node) node('child_process').execFile('explorer.exe', ['/select,', outputPath], { windowsHide: true }, function () {}); };
  $('reset-settings').onclick = function () { try { localStorage.removeItem('vk.gsd.settings.v1'); } catch (_) {} location.reload(); };
  all('input,select').forEach(function (el) {
    if (!el.id || el.id === 'encoder-path') return;
    el.addEventListener('change', function () { state.fields[el.id] = el.type === 'checkbox' ? el.checked : el.value; save(); });
  });

  showTab(state.ui.tab === 'text' ? 'text' : 'effects');
  if (state.ui.effects) openTool('effects', state.ui.effects);
  if (state.ui.text) openTool('text', state.ui.text);
})();
