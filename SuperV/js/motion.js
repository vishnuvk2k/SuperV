/* SuperV 1.4.3 Motion Panel: live preview stage, keys that perform their own move, 3D key tilt, press ripple and
   shockwave, number-key shortcuts. Display only: it reads the panel's own inputs and never runs a tool itself. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var lcd = $('lcd'), cv = $('stage');
  if (!lcd || !cv || !cv.getContext) return;
  var cx = cv.getContext('2d'), W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- keys: badge, number and hover move ---------- */
  var MOVE = { null: 'bob', crop: 'crop', ease: 'glide', loop: 'spin', wiggle: 'shake', spin: 'spin', depth: 'pulse', counter: 'bob', comp: 'squeeze', gif: 'blink',
    organize: 'bob', decomp: 'pulse', duplicate: 'glide', animate: 'bob', box: 'pulse', split: 'squeeze', case: 'skew', cursor: 'blink' };
  var BOLT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>';
  function decorate() {
    Array.prototype.forEach.call(document.querySelectorAll('.tiles'), function (grid) {
      Array.prototype.forEach.call(grid.querySelectorAll('.tile'), function (t, i) {
        if (t.dataset.decorated) return; t.dataset.decorated = '1';
        t.dataset.m = MOVE[t.dataset.tool] || 'bob';
        var mark = document.createElement('i');
        mark.className = t.dataset.oneclick ? 'one' : 'kled';
        if (t.dataset.oneclick) { mark.innerHTML = BOLT; t.title = (t.textContent.trim() || 'Tool') + ' · runs in one click'; }
        t.appendChild(mark);
        if (i < 9) { var k = document.createElement('em'); k.className = 'knum'; k.textContent = i + 1; t.appendChild(k); }
        t.addEventListener('pointermove', function (e) {
          if (reduce) return;
          var r = t.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
          t.style.setProperty('--ry', (x * 14).toFixed(1) + 'deg'); t.style.setProperty('--rx', (-y * 14).toFixed(1) + 'deg');
        });
        t.addEventListener('pointerleave', function () { t.style.removeProperty('--ry'); t.style.removeProperty('--rx'); });
      });
    });
  }

  /* ---------- press feedback: ripple on the key, shockwave around the stage ---------- */
  function ripple(el, e) {
    var r = el.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2, s = document.createElement('span');
    s.className = 'rip'; s.style.width = s.style.height = d + 'px';
    s.style.left = ((e && e.clientX ? e.clientX - r.left : r.width / 2) - d / 2) + 'px';
    s.style.top = ((e && e.clientY ? e.clientY - r.top : r.height / 2) - d / 2) + 'px';
    el.appendChild(s); setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 650);
  }
  function shock() { var s = $('shock'); if (!s) return; s.classList.remove('go'); void s.offsetWidth; s.classList.add('go'); }
  document.addEventListener('pointerdown', function (e) {
    var b = e.target.closest && e.target.closest('.primary, .tile[data-oneclick]');
    if (!b || b.disabled) return;
    ripple(b, e); shock();
  });

  /* ---------- status message slides up on the stage, then hides ---------- */
  var bar = $('statusbar'), hideT = null;
  if (bar) new MutationObserver(function () {
    var k = bar.className;
    if (k !== 'working' && k !== 'success' && k !== 'error') return;
    lcd.setAttribute('data-msg', '1'); clearTimeout(hideT);
    if (k !== 'working') hideT = setTimeout(function () { lcd.removeAttribute('data-msg'); }, k === 'error' ? 5000 : 2600);
  }).observe(bar, { attributes: true, attributeFilter: ['class'] });

  /* ---------- keyboard: 1-9 pick a tool, Enter presses the open tool's main button ---------- */
  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (/INPUT|SELECT|TEXTAREA/.test(tag) || e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key === 'Enter' && tag === 'BUTTON') return;                 /* a focused button already handles its own Enter */
    var tab = document.querySelector('main > .tab.active');
    if (!tab) return;
    var n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9) { var t = tab.querySelectorAll('.tile')[n - 1]; if (t && !t.dataset.oneclick) { t.click(); e.preventDefault(); } return; }
    if (e.key === 'Enter') { var p = tab.querySelector('.opts:not([hidden]) .primary'); if (p && !p.disabled) { p.click(); shock(); e.preventDefault(); } }
  });

  /* ---------- live stage ---------- */
  var S = new Image(), sReady = false; S.onload = function () { sReady = true; }; S.src = 'img/superv-s.png';
  function size() { var r = cv.getBoundingClientRect(); if (!r.width) return; W = r.width; H = r.height; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); cx.setTransform(DPR, 0, 0, DPR, 0, 0); }
  if (window.ResizeObserver) new ResizeObserver(size).observe(cv); else window.addEventListener('resize', size);
  var acc = '#2f8bff';
  function readAcc() { var v = getComputedStyle(document.documentElement).getPropertyValue('--acc').trim(); if (v) acc = v; }
  function num(id, d) { var e = $(id), v = e ? parseFloat(e.value) : NaN; return isFinite(v) ? v : d; }
  function val(id, d) { var e = $(id); return e && e.value !== '' ? e.value : d; }
  function seg(id, d) { var e = $(id), on = e && e.querySelector('.on'); return on ? on.dataset.value : d; }
  function on(id) { var e = $(id); return !!(e && e.checked); }
  function easeCurve() {
    var p = String(val('ease-values', '0.65,0,0.35,1')).split(/[\s,]+/).map(parseFloat);
    return p.length === 4 && p.every(isFinite) ? [Math.min(1, Math.max(0, p[0])), p[1], Math.min(1, Math.max(0, p[2])), p[3]] : [0.65, 0, 0.35, 1];
  }
  function bez(t, p) {
    var u = t, i, x, dx;
    for (i = 0; i < 8; i++) {
      x = 3 * (1 - u) * (1 - u) * u * p[0] + 3 * (1 - u) * u * u * p[2] + u * u * u - t;
      dx = 3 * (1 - u) * (1 - u) * p[0] + 6 * (1 - u) * u * (p[2] - p[0]) + 3 * u * u * (1 - p[2]);
      if (Math.abs(dx) < 1e-6) break; u = Math.min(1, Math.max(0, u - x / dx));
    }
    return 3 * (1 - u) * (1 - u) * u * p[1] + 3 * (1 - u) * u * u * p[3] + u * u * u;
  }
  var SMOOTH = [0.65, 0, 0.35, 1], POP = [0.2, 0.9, 0.1, 1];
  function rr(x, y, w, h, r) { cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); }
  /* the "layer": a rounded key with the S from the SuperV logo */
  function layer(x, y, s, rot, alpha, col) {
    cx.save(); cx.translate(x, y); if (rot) cx.rotate(rot); cx.globalAlpha = alpha == null ? 1 : alpha;
    rr(-s / 2, -s / 2, s, s, s * 0.24); cx.fillStyle = col || acc; cx.fill();
    if (sReady && s > 12) { var w = s * 0.58, h = w * S.height / S.width; cx.drawImage(S, -w / 2, -h / 2, w, h); }
    cx.restore();
  }
  function text(str, x, y, font, col, align) { cx.font = font; cx.fillStyle = col; cx.textAlign = align || 'center'; cx.textBaseline = 'middle'; cx.fillText(str, x, y); }
  function grid() { cx.strokeStyle = 'rgba(255,255,255,.035)'; cx.lineWidth = 1; cx.beginPath(); for (var i = 0.5; i < W; i += 18) { cx.moveTo(i, 0); cx.lineTo(i, H); } for (i = 0.5; i < H; i += 18) { cx.moveTo(0, i); cx.lineTo(W, i); } cx.stroke(); }
  function fmt(v) { try { return window.VKFormatNumber(v, Math.max(0, Math.min(6, Math.floor(num('counter-decimals', 0)))), on('counter-separator'), Math.max(1, num('counter-first', 3)), Math.max(1, num('counter-every', 3)), val('counter-prefix', ''), val('counter-suffix', '')); } catch (e) { return String(Math.round(v)); } }

  var tool = '', tab = '', t0 = 0;
  function current() {
    var a = document.querySelector('main > .tab.active'), id = a ? a.id : 'effects', tl = a ? a.querySelector('.tile.active') : null, tt = tl ? tl.dataset.tool : '';
    if (tt !== tool || id !== tab) { tool = tt; tab = id; t0 = performance.now(); }
  }
  var SANS = '"Segoe UI Variable Display","Segoe UI",system-ui,sans-serif', MONO = 'Consolas,"Cascadia Mono",monospace';
  function draw(now) {
    var t = (now - t0) / 1000, mx = W / 2, my = H / 2 + 6, s = Math.min(36, H * 0.3), L = 34, R = W - 34, k, p;
    cx.clearRect(0, 0, W, H); grid();
    if (tab === 'link') {
      var ps = $('link-dot-PHXS'), ai = $('link-dot-ILST'), live = [ps && ps.classList.contains('on'), ai && ai.classList.contains('on')];
      [[W * 0.18, my - 22, 'Ps', live[0]], [W * 0.18, my + 22, 'Ai', live[1]]].forEach(function (a) {
        cx.strokeStyle = a[3] ? acc : '#2c2f36'; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(a[0] + 16, a[1]); cx.bezierCurveTo(mx - 30, a[1], mx - 50, my, mx - s / 2, my); cx.stroke();
        rr(a[0] - 16, a[1] - 13, 32, 26, 6); cx.fillStyle = '#15171b'; cx.fill(); cx.strokeStyle = a[3] ? acc : '#2c2f36'; cx.stroke();
        text(a[2], a[0], a[1] + 1, '700 12px ' + MONO, a[3] ? '#fff' : '#6b7079');
        if (a[3]) { var q = (t % 1.2) / 1.2, bx = a[0] + 16 + (mx - s / 2 - a[0] - 16) * q; cx.fillStyle = acc; cx.beginPath(); cx.arc(bx, a[1] + (my - a[1]) * q * q, 2.5, 0, 7); cx.fill(); }
      });
      layer(mx, my, s); return;
    }
    if (tab === 'settings' || !tool) { layer(mx, my + Math.sin(t * 2) * 4, s, 0, 1); return; }
    switch (tool) {
      case 'ease': var e = easeCurve(), dur = 1.6; p = Math.min(1, (t % (dur + 0.6)) / dur);
        for (k = 0; k <= 10; k++) layer(L + (R - L) * bez(k / 10, e), my, 12, 0, 0.16);
        layer(L + (R - L) * bez(p, e), my, s); break;
      case 'wiggle': var f = Math.max(0.2, Math.min(12, num('wiggle-speed', 1))), am = Math.max(3, Math.min(H * 0.32, num('wiggle-pixels', 50) * 0.5));
        layer(mx + Math.sin(t * f * 2.1) * am * 0.7 + Math.sin(t * f * 3.7) * am * 0.3, my + Math.cos(t * f * 1.7) * am * 0.45 + Math.sin(t * f * 4.3) * am * 0.2, s); break;
      case 'spin': var dir = seg('spin-direction', 'cw') === 'ccw' ? -1 : 1, a = t * Math.min(720, Math.max(10, num('spin-speed', 90))) * dir * Math.PI / 180;
        if (seg('spin-mode', 'spin') === 'orbit') { var rad = Math.min(H * 0.32, 14 + num('spin-radius', 200) * 0.08); cx.strokeStyle = '#23262c'; cx.beginPath(); cx.arc(mx, my, rad, 0, 7); cx.stroke(); layer(mx + Math.cos(a) * rad, my + Math.sin(a) * rad, s * 0.8); }
        else layer(mx, my, s + 6, a); break;
      case 'loop': var ty = val('loop-type', 'cycle'), per = 1.5, q2 = (t % per) / per, cyc = Math.floor(t / per), v = ty === 'pingpong' && cyc % 2 ? 1 - q2 : q2;
        var off = ty === 'offset' ? ((cyc % 3) - 1) * 18 : 0, x0 = ty === 'continue' ? L + ((t * 70) % (R - L)) : L + (R - L) * bez(v, SMOOTH);
        layer(x0, my + off, s); text(ty.toUpperCase(), W - 12, H - 12, '600 9px ' + MONO, '#4d525b', 'right'); break;
      case 'depth': var sp = Math.max(6, Math.min(60, num('depth-spacing', 500) * 0.08)), near = seg('depth-order', 'near') === 'near';
        [[-1, 0.55], [0, 0.8], [1, 1.05]].forEach(function (d) { var z = near ? d[1] : 1.6 - d[1]; layer(mx + d[0] * sp * 1.6 + Math.sin(t * 1.3) * 16 * z, my, s * z, 0, 0.3 + z * 0.6); }); break;
      case 'counter': var from = num('counter-from', 0), to = num('counter-to', 1000), cd = Math.max(0.3, Math.min(4, num('counter-duration', 2)));
        var c = bez(Math.min(1, (t % (cd + 1)) / cd), SMOOTH), str = fmt(from + (to - from) * c), fs = Math.min(42, (W - 24) / Math.max(4, str.length) * 1.7);
        text(str, mx, my, '700 ' + fs + 'px ' + SANS, '#fff'); break;
      case 'comp': var pre = seg('comp-preset', 'hd'), dims = { hd: [16, 9], uhd: [16, 9], vertical: [9, 16], square: [1, 1], portrait: [4, 5], custom: [Math.max(1, num('comp-width', 1920)), Math.max(1, num('comp-height', 1080))] }[pre] || [16, 9];
        var e2 = bez(Math.min(1, (t % 2.6) / 1.2), SMOOTH), maxH = H - 44, sc = Math.min((W - 60) / dims[0], maxH / dims[1]), w1 = dims[0] * sc, h1 = dims[1] * sc, w0 = Math.min(W - 60, maxH * 16 / 9), h0 = w0 * 9 / 16;
        var w = w0 + (w1 - w0) * e2, hh = h0 + (h1 - h0) * e2; cx.strokeStyle = acc; cx.lineWidth = 1.5; cx.setLineDash([5, 4]); cx.strokeRect(mx - w / 2, my - hh / 2, w, hh); cx.setLineDash([]);
        layer(mx, my, Math.min(w, hh) * 0.42); break;
      case 'gif': for (k = 0; k < 7; k++) { var gx = ((k * 46 + t * 55) % (W + 46)) - 23; cx.strokeStyle = '#2a2d33'; cx.lineWidth = 1; cx.strokeRect(gx - 18, my - 20, 36, 40); layer(gx, my, 16, k * 0.5); }
        if (Math.floor(t * 2) % 2) { cx.fillStyle = '#ff3b3b'; cx.beginPath(); cx.arc(W - 20, H - 16, 3.5, 0, 7); cx.fill(); } text(val('gif-format', 'gif').toUpperCase(), W - 30, H - 16, '700 9px ' + MONO, '#8a8f98', 'right'); break;
      case 'null': var nx = mx + Math.cos(t * 1.4) * 26, ny = my + Math.sin(t * 1.4) * 12; cx.strokeStyle = acc; cx.lineWidth = 1.5; cx.strokeRect(nx - 8, ny - 8, 16, 16);
        [-1, 1].forEach(function (d) { cx.beginPath(); cx.moveTo(nx, ny); cx.lineTo(nx + d * 58, ny + 8); cx.stroke(); layer(nx + d * 58, ny + 8, s * 0.7); }); break;
      case 'crop': var e3 = bez(Math.min(1, (t % 2.4) / 1.1), SMOOTH); cx.strokeStyle = '#2a2d33'; cx.strokeRect(14, 14, W - 28, H - 28);
        var cw = (W - 28) - e3 * (W - 28 - s * 3.2), ch = (H - 28) - e3 * (H - 28 - s * 1.6); cx.strokeStyle = acc; cx.lineWidth = 2; cx.strokeRect(mx - cw / 2, my - ch / 2 - 3, cw, ch);
        layer(mx - s * 0.6, my - 3, s * 0.8); layer(mx + s * 0.65, my - 3, s * 0.6, 0.4); break;
      case 'organize': for (k = 0; k < 9; k++) { var e4 = bez(Math.min(1, Math.max(0, ((t % 2.8) - k * 0.05) / 1)), SMOOTH), sx = 24 + ((k * 73) % (W - 48)), sy = 24 + ((k * 41) % (H - 48)), tx = mx - 60 + (k % 3) * 60, tyy = my - 18 + Math.floor(k / 3) * 18;
        layer(sx + (tx - sx) * e4, sy + (tyy - sy) * e4, 13); } break;
      case 'decomp': var e5 = bez(Math.min(1, (t % 2.4) / 1.1), POP); cx.strokeStyle = '#3a3d44'; cx.setLineDash([4, 4]); cx.strokeRect(mx - 28 - 52 * e5, my - 26, 56 + 104 * e5, 52); cx.setLineDash([]);
        for (k = -1; k <= 1; k++) layer(mx + k * 52 * e5, my, s - 6, 0, k ? e5 : 1); break;
      case 'duplicate': var e6 = bez(Math.min(1, (t % 2.2) / 1), POP); for (k = 3; k >= 0; k--) layer(mx - 34 + k * 22 * e6, my - 12 + k * 8 * e6, s, 0, 1 - k * 0.2); break;
      case 'animate': var word = 'SuperV', fz = Math.min(40, W / 7), x1; cx.font = '800 ' + fz + 'px ' + SANS; var tw = cx.measureText(word).width; x1 = mx - tw / 2;
        var by = val('text-by', 'word'), dirIn = seg('text-direction', 'in') === 'in';
        for (k = 0; k < word.length; k++) { var dl = by === 'character' ? k * 0.07 : 0, pp = bez(Math.min(1, Math.max(0, ((t % 2.6) - dl) / 0.6)), POP); if (!dirIn) pp = 1 - pp;
          var chW = cx.measureText(word[k]).width; cx.save(); cx.globalAlpha = Math.min(1, pp * 1.4); cx.translate(x1 + chW / 2, my + (1 - pp) * 22); text(word[k], 0, 0, '800 ' + fz + 'px ' + SANS, k === 5 ? acc : '#fff'); cx.restore(); x1 += chW; } break;
      case 'box': var pad = Math.max(2, Math.min(28, num('box-padding', 24) * 0.6)), rad2 = Math.min(18, num('box-roundness', 12) * 0.6), g2 = bez(Math.min(1, (t % 2.4) / 0.8), POP), col = val('box-colour', acc);
        cx.font = '700 26px ' + SANS; var w3 = cx.measureText('New drop').width; cx.save(); cx.globalAlpha = Math.max(0.05, num('box-opacity', 100) / 100); rr(mx - (w3 / 2 + pad) * g2, my - (14 + pad), Math.max(1, (w3 + pad * 2) * g2), 28 + pad * 2, rad2); cx.fillStyle = col; cx.fill(); cx.restore();
        text('New drop', mx, my, '700 26px ' + SANS, '#fff'); break;
      case 'split': var unit = seg('split-by', 'line'), parts = unit === 'character' ? ['S', 'P', 'L', 'I', 'T'] : unit === 'word' ? ['Split', 'into', 'words'] : ['Line one', 'Line two'], gp = bez(Math.min(1, (t % 2.4) / 1), SMOOTH);
        parts.forEach(function (pt, i) { var vert = unit === 'line', n2 = parts.length, ox = vert ? 0 : (i - (n2 - 1) / 2) * ((W - 40) / n2) * (0.75 + gp * 0.25), oy = vert ? (i - 0.5) * (24 + gp * 14) : 0;
          cx.font = '700 ' + (unit === 'character' ? 28 : 18) + 'px ' + SANS; var bw = cx.measureText(pt).width + 10; if (gp > 0.25) { cx.strokeStyle = acc; cx.lineWidth = 1; cx.strokeRect(mx + ox - bw / 2, my + oy - 15, bw, 30); }
          text(pt, mx + ox, my + oy, '700 ' + (unit === 'character' ? 28 : 18) + 'px ' + SANS, '#fff'); }); break;
      case 'case': var mode = seg('case-mode', 'upper'), shown = Math.floor(t / 1.1) % 2, out = mode === 'upper' ? 'MOTION DESIGN' : mode === 'lower' ? 'motion design' : 'Motion Design';
        text(shown ? out : 'Motion design', mx, my, '700 ' + Math.min(26, W / 11) + 'px ' + SANS, shown ? '#fff' : '#5d626b'); break;
      case 'cursor': var full = 'Typing...', td = Math.max(0.3, num('cursor-duration', 2)), n3 = Math.min(full.length, Math.floor((t % (td + 1.2)) / td * full.length)), sub = full.slice(0, n3);
        cx.font = '600 26px ' + MONO; var fw = cx.measureText(full).width, cw2 = cx.measureText(sub).width; text(sub, mx - fw / 2, my, '600 26px ' + MONO, '#fff', 'left');
        if (Math.floor(t * Math.max(0.5, num('cursor-blink', 2)) * 2) % 2 === 0 || n3 < full.length) text(val('cursor-char', '|'), mx - fw / 2 + cw2 + 2, my, '600 26px ' + MONO, acc, 'left'); break;
      default: layer(mx, my, s);
    }
  }

  /* 30 fps, and nothing at all while the panel is hidden */
  var last = 0, running = false;
  function loop(now) {
    if (document.hidden) { running = false; return; }
    if (now - last >= 33) { last = now; if (!W) size(); current(); if (W) draw(now); }
    requestAnimationFrame(loop);
  }
  function start() { if (!running && !document.hidden) { running = true; readAcc(); requestAnimationFrame(loop); } }
  document.addEventListener('visibilitychange', start);
  decorate(); size(); if (reduce) { current(); requestAnimationFrame(function (n) { draw(n); }); } else start();
})();
