/* Pre-calc 11 Clear — learning-support layer (DEEPEN-1115): prerequisite check + repair cards, faded examples,
   spot-the-mistake, small-win path, lazy YouTube, lazy mind maps, calm timer. State only in this browser (key pc11.deep). */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var KEY = 'pc11.deep', D;
  try { D = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { D = {}; }
  ['g', 'pre', 'err', 'solo', 'fill'].forEach(function (k) { D[k] = D[k] || {}; });
  function save() { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {} }
  function lang() { return document.documentElement.dataset.lang || 'both'; }
  function T(en, zh) { var l = lang(); return l === 'en' ? en : l === 'zh' ? zh : en + ' · ' + zh; }
  var MARK = ['○', '◔', '◑', '●'];

  var topicEl = $('.topic[data-topic]');
  var tid = topicEl ? topicEl.dataset.topic : null;
  function bag(k) { if (!tid) return {}; D[k][tid] = D[k][tid] || {}; return D[k][tid]; }

  /* ---------- small-win path ---------- */
  function partState(part) {
    var v = 0, n, c;
    if (part === 'prereq') {
      var qs = $$('.pq', topicEl), p = bag('pre');
      n = qs.length; c = 0; var fixed = 0, seen = 0;
      qs.forEach(function (q) { var s = p[q.dataset.pq]; if (s !== undefined) seen++; if (s === 2) c++; if (s === 1) fixed++; });
      v = !seen ? 0 : (c === n ? 3 : (c + fixed === n ? 2 : 1));
    } else if (part === 'steps') {
      var gs = $$('.fx-fill [data-reveal]', topicEl); var f = bag('fill'); c = Object.keys(f).length;
      v = !gs.length ? 0 : c === 0 ? 0 : c >= gs.length ? 3 : 1;
    } else if (part === 'solo') {
      v = bag('solo').v || 0;
    } else if (part === 'mistakes') {
      c = Object.keys(bag('err')).length; n = $$('.err', topicEl).length;
      v = !c ? 0 : c >= Math.min(4, n) ? 3 : c >= 2 ? 2 : 1;
    } else if (part === 'quiz') {
      var S = {}; try { S = JSON.parse(localStorage.getItem('pc11.state') || '{}'); } catch (e) {}
      var pp = S.p || {}, done = 0, good = 0;
      Object.keys(pp).forEach(function (k) { if (k.indexOf(tid + '.p') === 0) { done++; if (pp[k] === 2) good++; } });
      v = !done ? 0 : good >= 3 ? 3 : done >= 3 ? 2 : 1;
    }
    return v;
  }
  function paintGoals() {
    if (!topicEl) return;
    var g = bag('g');
    $$('.goal', topicEl).forEach(function (li) {
      var i = li.dataset.goal, v = Math.max(g[i] || 0, partState(li.dataset.part));
      li.className = 'goal gs' + v; $('.gmark', li).textContent = MARK[v];
    });
  }
  if (topicEl) {
    $$('.goal .gmark', topicEl).forEach(function (m) {
      m.addEventListener('click', function (e) {   // tap the circle to set it yourself (e.g. "start" or "watch" goals)
        e.preventDefault(); var li = m.closest('.goal'), g = bag('g'); g[li.dataset.goal] = ((g[li.dataset.goal] || 0) + 1) % 4; save(); paintGoals();
      });
    });
    var st = $('#s-start');
    if (st && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (es, ob) { es.forEach(function (en) { if (en.isIntersecting) {
        $$('.goal[data-part="start"]', topicEl).forEach(function (li) { var g = bag('g'); if (!g[li.dataset.goal]) { g[li.dataset.goal] = 1; save(); } });
        paintGoals(); ob.disconnect(); } }); }, { threshold: 0.6 }).observe(st);
    }
  }

  /* ---------- multiple choice with a gentle result (prereq check, repair try) ---------- */
  function wireChoices(box, onPick) {
    $$('.choices button', box).forEach(function (b) {
      b.addEventListener('click', function () {
        var ok = b.dataset.ok === '1';
        $$('.choices button', box).forEach(function (x) { x.classList.remove('wrong'); if (ok && x.dataset.ok === '1') x.classList.add('right'); });
        if (!ok) b.classList.add('wrong');
        onPick(ok);
      });
    });
  }
  $$('.pq').forEach(function (q) {
    var i = q.dataset.pq, res = $('.pq-res', q), fix = $('.pq-fix', q);
    var top = $('.choices', q);
    wireChoices({ querySelectorAll: function (s) { return top.parentNode.querySelectorAll(':scope > .choices button'); } }, function (ok) {
      var p = bag('pre');
      res.hidden = false;
      if (ok) { if (p[i] === undefined) p[i] = 2; res.textContent = '✓ ' + T('Solid. On to the next one.', '没问题，下一题。'); }
      else { if (p[i] === undefined || p[i] === 2) p[i] = 0; fix.hidden = false;
        res.textContent = T('Not yet — this is a Grade 9–10 skill, and it is quick to fix. Five minutes below, then carry on.', '还不熟——这是九、十年级的技能，补起来很快。看下面五分钟，再继续。'); }
      save(); paintGoals();
    });
    var rp = $('.repair', q);
    if (rp) wireRepair(rp, function () { var p = bag('pre'); if (p[i] === 0) p[i] = 1; save(); paintGoals(); });
  });
  function wireRepair(rp, onFixed) {
    var r = $('.rp-res', rp);
    wireChoices($('.rp-try', rp), function (ok) {
      r.hidden = false;
      r.textContent = ok ? '✓ ' + T('Repaired. Go back to your topic — this skill is ready.', '补好了。回到你的知识点，这个技能已经可以用了。')
                         : T('Read the rule once more, look at the first worked line, then try another option.', '再读一遍规则，看看第一行例子，然后换一个选项试试。');
      if (ok && onFixed) onFixed();
    });
  }
  if (!topicEl) $$('.repair').forEach(function (rp) { wireRepair(rp); });

  /* ---------- faded examples ---------- */
  $$('.fx-fill [data-reveal]').forEach(function (b, k) {
    if (bag('fill')[k]) { b.hidden = true; b.nextElementSibling.hidden = false; }
    b.addEventListener('click', function () { b.hidden = true; b.nextElementSibling.hidden = false; bag('fill')[k] = 1; save(); paintGoals(); });
  });
  $$('.fx-solo').forEach(function (fx) {
    var hs = $$('.hints li', fx), n = 0, hb = $('[data-hint]', fx), sol = $('.solo-sol', fx);
    function used() { return n; }
    hb.addEventListener('click', function () {
      if (n < hs.length) { hs[n].hidden = false; n++; $('.hn', fx).textContent = n + '/' + hs.length; }
      if (n >= hs.length) hb.disabled = true;
      var s = bag('solo'); if (!s.v) { s.v = 1; save(); paintGoals(); }
    });
    $('[data-solo-sol]', fx).addEventListener('click', function () { sol.hidden = false; });
    $$('[data-solo-self]', fx).forEach(function (b) { b.addEventListener('click', function () {
      bag('solo').v = +b.dataset.soloSelf; save(); paintGoals();
      $$('[data-solo-self]', fx).forEach(function (x) { x.classList.toggle('on', x === b); }); }); });
    var fb = $('.fill', fx);
    if (fb) {
      var inp = $('input', fb), res = $('.fill-res', fb), acc = JSON.parse(fb.dataset.accept || '[]'), num = JSON.parse(fb.dataset.num || '[]');
      function go() {
        var v = String(inp.value || '').trim().toLowerCase().replace(/\s+/g, ''); if (!v) return;
        var ok = num.length ? Math.abs(parseFloat(v.replace(/[^0-9.eE+-]/g, '')) - num[0]) <= (num[1] || 0)
                            : acc.some(function (a) { a = String(a).toLowerCase().replace(/\s+/g, ''); return v === a || (a.length >= 2 && v.indexOf(a) >= 0); });
        res.textContent = ok ? '✓ ' + T('Yes!', '对了！') : T('Not yet — open the next hint, or compare with the full solution.', '还没对——打开下一个提示，或者对照完整过程。');
        res.className = 'fill-res ' + (ok ? 'ok' : 'no');
        if (ok) { bag('solo').v = Math.max(bag('solo').v || 0, used() ? 2 : 3); save(); paintGoals(); sol.hidden = false; }
      }
      $('button', fb).addEventListener('click', go);
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    }
  });

  /* ---------- spot the mistake ---------- */
  $$('.err').forEach(function (er) {
    var i = er.dataset.err, res = $('.wl-res', er), why = $('.err-why', er), tries = 0;
    function reveal() { why.hidden = false; $$('.wl', er).forEach(function (x) { if (x.dataset.bad === '1') x.classList.add('found'); }); }
    if (bag('err')[i]) reveal();
    $$('.wl', er).forEach(function (b) {
      b.addEventListener('click', function () {
        res.hidden = false;
        if (b.dataset.bad === '1') { res.textContent = '✓ ' + T('Found it. Here is the thinking behind it:', '找到了。背后的想法是这样的：'); reveal(); bag('err')[i] = 1; save(); paintGoals(); }
        else { tries++; b.classList.add('fine');
          res.textContent = tries < 2 ? T('That line is fine. Keep reading — the slip comes later or earlier.', '这一行没问题。接着看——错误在前面或后面。')
                                      : T('Here it is — no problem, spotting these takes practice.', '在这里——没关系，找错本来就要练。');
          if (tries >= 2) reveal(); }
      });
    });
  });

  /* ---------- lazy YouTube: no iframe until the student taps ---------- */
  $$('.yt[data-yt]').forEach(function (b) {
    b.addEventListener('click', function () {
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + b.dataset.yt + '?autoplay=1&rel=0&start=' + (+b.dataset.start || 0);
      f.title = 'YouTube video'; f.allow = 'accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.setAttribute('allowfullscreen', ''); f.loading = 'lazy'; f.className = 'yt-frame';
      b.replaceWith(f);
    });
  });

  /* ---------- mind map: mermaid loads only when the section opens ---------- */
  var mapSec = $('#s-map');
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function drawMaps() {
    var pres = $$('pre.mmd').filter(function (p) { return !p.dataset.done && p.offsetParent !== null; });
    if (!pres.length) return;
    function go() {
      try {
        window.mermaid.initialize({ startOnLoad: false, theme: 'base', securityLevel: 'strict',
          themeVariables: { fontFamily: css('--sans'), primaryColor: css('--mark-core-bg'), primaryTextColor: css('--ink'), lineColor: css('--sm0'),
            cScale0: css('--m1'), cScale1: css('--mark-core-bg'), cScale2: css('--m2'), cScale3: css('--mark-mix-bg'), cScale4: css('--m3'), cScale5: css('--calm-bg'),
            cScaleLabel0: css('--ink'), cScaleLabel1: css('--ink'), cScaleLabel2: css('--ink'), cScaleLabel3: css('--ink'), cScaleLabel4: css('--ink'), cScaleLabel5: css('--ink') } });
        pres.forEach(function (p) { p.dataset.done = '1'; p.classList.add('mermaid'); });
        window.mermaid.run({ nodes: pres }).catch(function () {});
      } catch (e) {}
    }
    if (window.mermaid) go();
    else { var s = document.createElement('script'); s.src = 'assets/mermaid.min.js'; s.onload = go; document.head.appendChild(s); }
  }
  if (mapSec) {
    mapSec.addEventListener('toggle', function () { if (mapSec.open) drawMaps(); });
    $$('[data-set-lang]').forEach(function (b) { b.addEventListener('click', function () { if (mapSec.open) setTimeout(drawMaps, 50); }); });
  }

  /* ---------- calm page: 2-minute routine, runs only when started ---------- */
  var bg = $('#breatheGo');
  if (bg) {
    var ring = $('.breathe span'), txt = $('#breatheTxt'), timer = null;
    bg.addEventListener('click', function () {
      if (timer) { clearInterval(timer); timer = null; ring.className = ''; txt.textContent = ''; return; }
      var t0 = Date.now();
      timer = setInterval(function () {
        var s = (Date.now() - t0) / 1000;
        if (s >= 120) { clearInterval(timer); timer = null; ring.className = ''; txt.textContent = T('Done. Find the first question you are sure about.', '好了。找到第一道有把握的题。'); return; }
        if (s < 50) { var c = s % 10; ring.className = c < 4 ? 'in' : 'out'; txt.textContent = c < 4 ? T('Breathe in… ', '吸气…… ') + Math.ceil(4 - c) : T('Breathe out… ', '呼气…… ') + Math.ceil(10 - c); }
        else if (s < 95) { ring.className = 'rest'; txt.textContent = T('Write the worry in one sentence.', '用一句话写下担心的事。'); }
        else { ring.className = 'rest'; txt.textContent = T('"My heart is fast because my body is getting ready."', '「心跳快，是身体在做准备。」'); }
      }, 250);
    });
  }

  paintGoals();
  window.addEventListener('storage', paintGoals);
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.pr')) setTimeout(paintGoals, 30); });
})();
