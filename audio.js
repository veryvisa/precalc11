
(function () {
  'use strict';
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function q(name) { try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; } }
  var items = $$('.ep');
  var st = { unit: 'all', layer: 'all', topic: 'all', lang: 'en', text: '' };
  var uSel = $('#aud-unit'), tSel = $('#aud-topic'), sBox = $('#aud-search');
  function apply() {
    var n = 0;
    items.forEach(function (li) {
      var ok = (st.unit === 'all' || li.dataset.unit === st.unit) && (st.layer === 'all' || li.dataset.layer === st.layer) &&
        (st.topic === 'all' || li.dataset.topic === st.topic) && li.dataset.lang === st.lang &&
        (!st.text || li.dataset.text.indexOf(st.text) >= 0);
      li.hidden = !ok; if (ok) n++;
    });
    var c = $('#aud-count'); if (c) { c.querySelector('.n').textContent = n; }
    var em = $('#aud-empty'); if (em) em.hidden = n > 0;
    $$('.aud-chips[data-k="layer"] button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === st.layer)); });
    $$('.aud-chips[data-k="lang"] button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === st.lang)); });
  }
  function fillTopics() {
    if (!tSel) return;
    var keep = st.topic;
    $$('option', tSel).forEach(function (o) { o.hidden = !(o.value === 'all' || st.unit === 'all' || o.dataset.unit === st.unit); });
    var cur = $('option[value="' + keep + '"]', tSel);
    if (!cur || cur.hidden) { st.topic = 'all'; tSel.value = 'all'; }
  }
  if (uSel) uSel.addEventListener('change', function () { st.unit = uSel.value; fillTopics(); apply(); });
  if (tSel) tSel.addEventListener('change', function () { st.topic = tSel.value; apply(); });
  if (sBox) sBox.addEventListener('input', function () { st.text = sBox.value.trim().toLowerCase(); apply(); });
  $$('.aud-chips button').forEach(function (b) {
    b.addEventListener('click', function () { st[b.parentNode.dataset.k] = b.dataset.v; apply(); });
  });
  if (items.length) {
    var want = q('ep');
    if (want) {
      var li = document.getElementById('ep-' + want);
      if (li) { st.lang = 'en'; }
    }
    fillTopics(); apply();
    if (want) { var t = document.getElementById('ep-' + want); if (t) { t.hidden = false; setTimeout(function () { t.scrollIntoView({ block: 'center' }); }, 60); } }
  }
  /* offline page: save every audio file of the unit one after another (no zip) */
  var all = $('#dl-all');
  if (all) all.addEventListener('click', function () {
    var links = $$('a.dl[data-all]'), i = 0;
    var msg = $('#dl-msg');
    (function next() {
      if (i >= links.length) { if (msg) msg.textContent = (msg.dataset.done || 'Done') + ' (' + links.length + ')'; return; }
      var a = document.createElement('a'); a.href = links[i].href; a.download = links[i].getAttribute('download') || ''; a.target = '_blank'; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove(); i++;
      if (msg) msg.textContent = i + ' / ' + links.length;
      setTimeout(next, 1200);
    })();
  });
  /* weak spots: items marked Again in the focus deck (fd.v1) or answered wrong in quick checks; localStorage only, nothing is sent */
  var box = $('#weak-audio');
  if (box) {
    var lang = function () { return document.documentElement.getAttribute('data-lang') || 'both'; };
    fetch('audio-data.json').then(function (r) { return r.json(); }).then(function (D) {
      var ids = [];
      try { var f = JSON.parse(localStorage.getItem('fd.v1')) || {}; ids = ids.concat(Object.keys(f.again || {})); } catch (e) { }
      (D.weak_keys || []).forEach(function (k) {
        try { var j = JSON.parse(localStorage.getItem(k)) || {}; var m = j.i || {}; Object.keys(m).forEach(function (id) { if (m[id] && m[id].b === 0 && m[id].w) ids.push(id); }); } catch (e) { }
      });
      var seen = {}, out = [];
      function add(key) { if (key && !seen[key] && D.eps[key]) { seen[key] = 1; out.push(key); } }
      ids.forEach(function (id) {
        var cands = [id, id.replace(/^cu\.q\./, ''), id.replace(/\.[^.]*$/, '')];
        var hit = null;
        cands.forEach(function (c) { if (!hit && D.points[c]) hit = D.points[c]; });
        if (hit) { add(hit[0]); return; }
        var m = id.match(/^(u\d+)/);
        if (m && D.units[m[1]]) add(D.units[m[1]][0]);
      });
      if (!out.length) { box.hidden = true; return; }
      var ul = $('ul', box); ul.innerHTML = '';
      out.slice(0, 8).forEach(function (key) {
        var e = D.eps[key], li = document.createElement('li');
        var pub = e.pub ? '<a href="audio.html?ep=' + key + '#ep-' + key + '">' : '';
        var end = e.pub ? '</a>' : '';
        li.innerHTML = pub + '<span class="en" lang="en">' + e.en + '</span><span class="zh" lang="zh-Hans">' + e.zh + '</span>' + end +
          ' <small>' + e.layer + (e.pub ? '' : ' · <span class="en">coming soon</span><span class="zh">即将上线</span>') + '</small>';
        ul.appendChild(li);
      });
      box.hidden = false;
    }).catch(function () { box.hidden = true; });
  }
})();
