/* SuperV Send - runs inside Illustrator or Photoshop and drops artwork into the shared link folder. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var cep = window.__adobe_cep__;
  var req = window.cep_node && window.cep_node.require ? window.cep_node.require : (typeof require === 'function' ? require : null);
  var msg = $('msg');
  function say(t, k) { msg.textContent = t; msg.className = k || ''; }
  if (!cep || !req) { say('Open this panel inside Illustrator or Photoshop.', 'err'); $('send').disabled = true; return; }

  var fs = req('fs'), path = req('path');
  var host = 'ILST';
  try { host = JSON.parse(cep.getHostEnvironment()).appName || 'ILST'; } catch (_) {}
  var isPS = host === 'PHXS';
  $('appname').textContent = isPS ? 'Photoshop' : 'Illustrator';
  $('opt-ai').hidden = isPS; $('opt-ps').hidden = !isPS;

  var base = path.join(process.env.APPDATA || '.', 'SuperV', 'link');
  function mk(d) { try { fs.mkdirSync(d, { recursive: true }); } catch (_) {} }
  mk(path.join(base, 'status')); mk(path.join(base, 'transfers'));

  var here = decodeURI(location.pathname).replace(/^\//, '');          /* .../SuperV/send/index.html */
  var jsxFile = path.join(path.dirname(here), 'jsx', isPS ? 'ps.jsx' : 'ai.jsx').replace(/\\/g, '/');

  function beat() { try { fs.writeFileSync(path.join(base, 'status', host + '.json'), JSON.stringify({ app: host, time: Date.now() })); } catch (_) {} }
  function aeState() {
    var on = false;
    try { on = Date.now() - JSON.parse(fs.readFileSync(path.join(base, 'status', 'AEFT.json'), 'utf8')).time < 6000; } catch (_) {}
    $('dot').className = 'dot' + (on ? ' on' : ''); $('state').textContent = on ? 'connected' : 'not detected';
    return on;
  }
  beat(); aeState(); setInterval(function () { beat(); aeState(); }, 1500);

  $('send').onclick = function () {
    var btn = $('send'); btn.disabled = true; say('Sending…');
    var opts = { base: base.replace(/\\/g, '/'), perObject: $('mode-ai').value === 'each', id: String(Date.now()) };
    var call = '$.evalFile(new File(' + JSON.stringify(jsxFile) + '));superv_send(' + JSON.stringify(encodeURIComponent(JSON.stringify(opts))) + ')';
    cep.evalScript(call, function (raw) {
      btn.disabled = false;
      var text = raw === null || raw === undefined ? '' : String(raw);
      if (text.indexOf('OK:') === 0) { say(decodeURIComponent(text.slice(3)) + (aeState() ? '' : ' After Effects is not open yet; it will import when you open the Link tab.'), 'ok'); }
      else if (text.indexOf('ERR:') === 0) say(decodeURIComponent(text.slice(4)), 'err');
      else say('Illustrator/Photoshop returned an unexpected result' + (text ? ': ' + text.slice(0, 160) : '.'), 'err');
    });
  };
})();
