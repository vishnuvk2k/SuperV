/* SuperV console display: mirrors the open section, the selected tool and the latest status line. Display only; it never runs tools. */
(function () {
  var lcd = document.getElementById('lcd');
  var statusEl = document.getElementById('status');
  var bar = document.getElementById('statusbar');
  var main = document.querySelector('main');
  if (!lcd || !statusEl || !bar || !main) return;
  var top = lcd.querySelector('.lcd-top b'), led = lcd.querySelector('.lcd-led');
  var big = lcd.querySelector('.lcd-big'), sub = lcd.querySelector('.lcd-sub');
  var names = { effects: 'FX', text: 'TEXT', link: 'LINK', settings: 'SETTINGS' };
  var pending = false;

  function render() {
    pending = false;
    var tab = document.querySelector('main > .tab.active');
    var id = tab ? tab.id : 'effects';
    var tile = tab ? tab.querySelector('.tile.active span') : null;
    var tool = tile ? tile.textContent : '';
    var heading = tab ? tab.querySelector('.opts:not([hidden]) h3') : null;
    document.body.classList.toggle('in-settings', id === 'settings');
    top.textContent = names[id] + (tool ? ' · ' + tool.toUpperCase() : '');
    if (heading) big.textContent = heading.textContent;
    else if (id === 'link') big.textContent = 'Illustrator · Photoshop';
    else if (id === 'settings') big.textContent = 'Settings';
    else big.textContent = 'Pick a tool';
    sub.textContent = statusEl.textContent || '';
    var kind = bar.className || '';
    lcd.className = kind;
    led.textContent = kind === 'working' ? 'WORKING' : kind === 'error' ? 'ERROR' : kind === 'success' ? 'DONE' : 'READY';
  }
  function later() { if (!pending) { pending = true; setTimeout(render, 0); } }

  new MutationObserver(later).observe(statusEl, { childList: true, characterData: true, subtree: true });
  new MutationObserver(later).observe(bar, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(later).observe(main, { attributes: true, subtree: true, attributeFilter: ['class', 'hidden'] });
  render();
})();
