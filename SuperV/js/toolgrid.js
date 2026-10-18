/* SuperV 1.4.1 tool grid: category filter and search for the Effects tab. */
(function () {
  'use strict';
  var effects = document.getElementById('effects'), grid = effects && effects.querySelector('.tiles');
  if (!grid) return;
  var cat = { ease: 'Animate', loop: 'Animate', wiggle: 'Animate', spin: 'Animate', depth: 'Animate', counter: 'Animate', null: 'Layers', duplicate: 'Layers', decomp: 'Layers', crop: 'Comp', comp: 'Comp', organize: 'Comp', gif: 'Export' };
  var tiles = Array.prototype.slice.call(grid.querySelectorAll('.tile')), current = 'All', query = '';
  var bar = document.createElement('div'); bar.className = 'cats';
  ['All', 'Animate', 'Layers', 'Comp', 'Export'].forEach(function (name) {
    var b = document.createElement('button'); b.type = 'button'; b.textContent = name; if (name === 'All') b.className = 'on';
    b.onclick = function () { current = name; Array.prototype.forEach.call(bar.children, function (x) { x.classList.toggle('on', x === b); }); apply(); };
    bar.appendChild(b);
  });
  var search = document.createElement('input'); search.id = 'tool-search'; search.type = 'search'; search.placeholder = 'Search tools';
  search.addEventListener('input', function () { query = search.value.trim().toLowerCase(); apply(); });
  grid.parentNode.insertBefore(bar, grid); grid.parentNode.insertBefore(search, grid);
  function apply() {
    tiles.forEach(function (t) {
      var name = (t.querySelector('span:not(.star)') || t).textContent.toLowerCase();
      var okCat = current === 'All' || cat[t.dataset.tool] === current;
      t.hidden = !(okCat && (!query || name.indexOf(query) >= 0 || t.dataset.tool.indexOf(query) >= 0));
    });
  }
  var toggle = document.getElementById('search-toggle');
  if (toggle) toggle.onclick = function () {
    var tab = document.querySelector('.tabs button[data-tab="effects"]');
    if (tab && !effects.classList.contains('active')) tab.click();
    var open = search.classList.toggle('open');
    if (open) search.focus(); else { search.value = ''; query = ''; apply(); }
  };
})();
