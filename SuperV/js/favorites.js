/* SuperV 1.4.1 favorites: star a tile to pin it to a row under the tabs. Stored in localStorage; the panel works without it. */
(function () {
  'use strict';
  var KEY = 'superv.favorites', favs = [];
  try { favs = JSON.parse(localStorage.getItem(KEY) || '[]'); if (!(favs instanceof Array)) favs = []; } catch (e) { favs = []; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(favs)); } catch (e) { /* ignore */ } }
  var tiles = Array.prototype.slice.call(document.querySelectorAll('.tile[data-tool]'));
  var bar = document.getElementById('favs');
  if (!bar || !tiles.length) return;
  function tileFor(id) { for (var i = 0; i < tiles.length; i++) if (tiles[i].dataset.tool === id) return tiles[i]; return null; }
  function label(t) { var s = t.querySelector('span:not(.star)'); return s ? s.textContent : t.dataset.tool; }
  function render() {
    favs = favs.filter(function (id) { return !!tileFor(id); });
    tiles.forEach(function (t) { var s = t.querySelector('.star'), on = favs.indexOf(t.dataset.tool) >= 0; if (s) { s.classList.toggle('on', on); s.setAttribute('aria-pressed', on ? 'true' : 'false'); } });
    bar.hidden = !favs.length;
    var list = bar.querySelector('.fav-list'); list.textContent = '';
    favs.forEach(function (id) {
      var t = tileFor(id), b = document.createElement('button');
      b.className = 'fav'; b.type = 'button'; b.textContent = label(t);
      b.onclick = function () {
        var tab = t.closest('.tab'), nav = document.querySelector('.tabs button[data-tab="' + tab.id + '"]');
        if (nav && !tab.classList.contains('active')) nav.click();
        t.click();
      };
      list.appendChild(b);
    });
  }
  tiles.forEach(function (t) {
    var s = document.createElement('span');
    s.className = 'star'; s.setAttribute('role', 'button'); s.setAttribute('tabindex', '0'); s.setAttribute('aria-label', 'Pin ' + label(t));
    s.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>';
    function toggle(e) {
      e.stopPropagation(); e.preventDefault();
      var id = t.dataset.tool, i = favs.indexOf(id);
      if (i >= 0) favs.splice(i, 1); else favs.push(id);
      save(); render();
    }
    s.addEventListener('click', toggle);
    s.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') toggle(e); });
    t.appendChild(s);
  });
  render();
})();
