/* Focus deck v1 — one thing per screen (slides to understand, flashcards to remember, questions to practise).
   Canonical copy: bc-teen-pathways/kit/focus.js + focus.css. Other sites copy both files verbatim (their gates compare sha1).
   Spec: fcgbbs/design/focus-deck-standard-2026-11-16.md.  No dependencies; works without localStorage.

   Page contract:
     <div class="fd-entry" data-fd-src="#fd-data" (inline <script type="application/json" id="fd-data">) or data-fd-src="focus/x.json">
       <button class="fd-btn" data-fd-open="cards|slides|quiz" data-fd-n="N">…label…</button> …
     </div>
   Data: {"v":1,"key":"page-key","title":"html","slides":[{"id","h"}],"cards":[{"id","f","b"}],
          "quiz":[{"id","q","opts":["html"]|null,"a":int|null,"hint":"html","ans":"html","why":"html","whys":["html per option"]|null}]}
   Text is HTML carrying the site's own language spans (.en/.zh or .l-en/.l-zh); the site's CSS picks the language. */
(function () {
  'use strict';
  var KEY = 'fd.v1';
  var T = {
    en: { cards: 'Flashcards', slides: 'Slides', quiz: 'Questions', close: 'Close', prev: 'Previous', next: 'Next',
          flip: 'Flip', got: 'Got it', again: 'Again', hint: 'Hint', answer: 'Answer', tap: 'Tap the card to flip',
          pick: 'Pick one, or tap Answer', start: 'Start over', redo: 'Just the “again” ones', done: 'Done',
          sumCards: function (n, m) { return 'Done: ' + n + (n === 1 ? ' card' : ' cards') + '. ' + (m ? m + ' to look at again tomorrow.' : 'Nothing left for tomorrow.'); },
          sumQuiz: function (n, m) { return 'Done: ' + n + (n === 1 ? ' question' : ' questions') + '. ' + (m ? m + ' to look at again tomorrow.' : 'Nothing left for tomorrow.'); },
          sumSlides: function (n) { return 'That was all ' + n + ' slides. You can stop here.'; },
          stop: 'Stopping here is fine. Your marks are saved on this device.' },
    zh: { cards: '闪卡', slides: '幻灯', quiz: '题目', close: '关闭', prev: '上一张', next: '下一张',
          flip: '翻面', got: '会了', again: '再看', hint: '提示', answer: '答案', tap: '点卡片翻面',
          pick: '选一个，或点「答案」', start: '从头再来', redo: '只看「再看」的', done: '完成',
          sumCards: function (n, m) { return '完成 ' + n + ' 张，' + (m ? m + ' 张明天再看。' : '明天没有要再看的。'); },
          sumQuiz: function (n, m) { return '完成 ' + n + ' 道，' + (m ? m + ' 道明天再看。' : '明天没有要再看的。'); },
          sumSlides: function (n) { return '全部 ' + n + ' 页看完了，可以停在这里。'; },
          stop: '停在这里就好。你的标记保存在这台设备上。' }
  };
  function lang() { var l = document.documentElement.getAttribute('data-lang'); return l === 'zh' ? 'zh' : l === 'both' ? 'both' : 'en'; }
  function tx(k) {
    var a = Array.prototype.slice.call(arguments, 1), l = lang();
    var f = function (x) { return typeof x === 'function' ? x.apply(null, a) : x; };
    return l === 'both' ? f(T.en[k]) + ' · ' + f(T.zh[k]) : f(T[l][k]);
  }
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode: still works, just not remembered */ } }
  function day(off) { var d = new Date(); d.setDate(d.getDate() + (off || 0)); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  var cache = {}, S = null, ov = null, pushed = false, lastFocus = null, opening = false;

  function getData(src) {
    if (cache[src]) return Promise.resolve(cache[src]);
    if (src.charAt(0) === '#') {
      var n = document.getElementById(src.slice(1));
      try { cache[src] = JSON.parse(n.textContent); } catch (e) { return Promise.reject(e); }
      return Promise.resolve(cache[src]);
    }
    return fetch(src).then(function (r) { return r.json(); }).then(function (d) { cache[src] = d; return d; });
  }

  function open(kind, src, btn) {
    if (ov || opening) return;
    opening = true;
    getData(src).then(function (d) {
      opening = false;
      var items = (d[kind] || []).slice();
      if (!items.length || ov) return;
      var st = load(), again = st.again || {}, today = day(0);
      if (kind !== 'slides') {   // cards you asked to see again (due today or earlier) come first
        var due = items.filter(function (it) { return again[it.id] && again[it.id] <= today; });
        items = due.concat(items.filter(function (it) { return due.indexOf(it) < 0; }));
      }
      S = { kind: kind, key: d.key || location.pathname, all: items, queue: items.map(function (_, i) { return i; }), pos: 0,
            rev: false, picked: null, hint: false, seen: {}, last: {}, requeued: {} };
      lastFocus = btn || document.activeElement;
      build();
      try { history.pushState({ fd: 1 }, ''); pushed = true; } catch (e) { pushed = false; }
      render();
    }).catch(function () { opening = false; /* data missing: the button simply does nothing */ });
  }

  function build() {
    ov = el('div', 'fd-ov');
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = '<div class="fd-top"><span class="fd-count" aria-live="polite"></span><span class="fd-prog"><i></i></span>' +
      '<button type="button" class="fd-x"></button></div><div class="fd-stage"></div><div class="fd-ctl"></div>';
    document.body.appendChild(ov);
    document.documentElement.classList.add('fd-on');
    Array.prototype.forEach.call(document.querySelectorAll('audio,video'), function (a) { try { a.pause(); } catch (e) { } });
    ov.querySelector('.fd-x').addEventListener('click', close);
    var sx = 0, sy = 0, st = ov.querySelector('.fd-stage');
    st.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    st.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.3) { dx < 0 ? next() : prev(); }
    }, { passive: true });
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('popstate', onPop);
    if (window.MutationObserver) {
      S.mo = new MutationObserver(function () { if (S) render(); });
      S.mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });
    }
  }

  function teardown() {
    if (!ov) return;
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('popstate', onPop);
    if (S && S.mo) S.mo.disconnect();
    ov.parentNode.removeChild(ov); ov = null; S = null;
    document.documentElement.classList.remove('fd-on');
    if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) { }
  }
  function close() { if (pushed) { pushed = false; history.back(); } else teardown(); }
  function onPop() { pushed = false; teardown(); }

  function onKey(e) {
    if (!S) return;
    var k = e.key;
    if (k === 'Escape') { e.preventDefault(); close(); return; }
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (k === 'ArrowRight') { e.preventDefault(); next(); }
    else if (k === 'ArrowLeft') { e.preventDefault(); prev(); }
    else if (k === ' ' || k === 'Spacebar' || (k === 'Enter' && e.target === document.body)) {
      if (e.target && e.target.tagName === 'BUTTON' && k !== ' ') return;
      e.preventDefault();
      if (S.end) return;
      if (S.kind === 'slides') next(); else { S.rev = !S.rev; render(); }
    }
  }

  function cur() { return S.all[S.queue[S.pos]]; }
  function next() { if (!S || S.end) return; if (S.kind !== 'slides') S.seen[cur().id] = 1; go(S.pos + 1); }
  function prev() { if (!S) return; if (S.end) { S.end = false; go(S.queue.length - 1); return; } if (S.pos > 0) go(S.pos - 1); }
  function go(p) {
    S.rev = false; S.picked = null; S.hint = false;
    if (p >= S.queue.length) { finish(); return; }
    S.pos = p; render();
  }
  function rate(ok) {
    var it = cur(); S.seen[it.id] = 1; S.last[it.id] = ok ? 'got' : 'again';
    if (!ok && (S.requeued[it.id] || 0) < 2) { S.requeued[it.id] = (S.requeued[it.id] || 0) + 1; S.queue.push(S.queue[S.pos]); }
    go(S.pos + 1);
  }
  function finish() {
    S.end = true;
    if (S.kind !== 'slides') {
      var st = load(); st.again = st.again || {}; st.log = st.log || {};
      var n = 0, m = 0, tmr = day(1);
      Object.keys(S.seen).forEach(function (id) {
        n++;
        if (S.last[id] === 'again') { m++; st.again[id] = tmr; } else if (S.last[id] === 'got') delete st.again[id];
      });
      st.log[S.key + '#' + S.kind] = { d: day(0), n: n, m: m };
      save(st); S.sum = { n: n, m: m };
    }
    render();
  }

  function render() {
    if (!S || !ov) return;
    var stage = ov.querySelector('.fd-stage'), ctl = ov.querySelector('.fd-ctl'), total = S.queue.length;
    ov.setAttribute('aria-label', tx(S.kind));
    ov.className = 'fd-ov fd-k-' + S.kind;
    var x = ov.querySelector('.fd-x'); x.textContent = '✕'; x.setAttribute('aria-label', tx('close')); x.title = tx('close');
    ov.querySelector('.fd-count').textContent = S.end ? tx('done') : (S.pos + 1) + ' / ' + total;
    ov.querySelector('.fd-prog i').style.width = (S.end ? 100 : Math.round(100 * S.pos / total)) + '%';
    stage.innerHTML = ''; ctl.innerHTML = '';
    if (S.end) {
      var msg = S.kind === 'slides' ? tx('sumSlides', S.all.length) : tx(S.kind === 'quiz' ? 'sumQuiz' : 'sumCards', S.sum.n, S.sum.m);
      var c = el('article', 'fd-card fd-sum', '<p class="fd-sum-main">' + esc(msg) + '</p><p class="fd-sum-sub">' + esc(tx('stop')) + '</p>');
      stage.appendChild(c);
      if (S.sum && S.sum.m) ctl.appendChild(btn(tx('redo'), 'fd-b fd-main', function () {
        var ids = Object.keys(S.last).filter(function (id) { return S.last[id] === 'again'; });
        S.queue = S.all.map(function (_, i) { return i; }).filter(function (i) { return ids.indexOf(S.all[i].id) >= 0; });
        S.seen = {}; S.last = {}; S.requeued = {}; S.end = false; go(0);
      }));
      ctl.appendChild(btn(tx('start'), 'fd-b', function () { S.queue = S.all.map(function (_, i) { return i; }); S.seen = {}; S.last = {}; S.requeued = {}; S.end = false; go(0); }));
      ctl.appendChild(btn(tx('close'), 'fd-b', close));
      focusCard(c); return;
    }
    var it = cur(), card;
    if (S.kind === 'slides') {
      card = el('article', 'fd-card fd-slide', it.h);
      stage.appendChild(card);
      ctl.appendChild(nav('prev', S.pos === 0)); ctl.appendChild(nav('next', false));
    } else if (S.kind === 'cards') {
      card = el('article', 'fd-card fd-flash' + (S.rev ? ' fd-rev' : ''),
        '<div class="fd-face fd-front">' + it.f + '</div>' + (S.rev ? '<div class="fd-face fd-back">' + it.b + '</div>' : '<p class="fd-hintline">' + esc(tx('tap')) + '</p>'));
      card.setAttribute('role', 'button'); card.tabIndex = 0;
      card.addEventListener('click', function (e) { if (e.target.closest('a,button,details')) return; S.rev = !S.rev; render(); });
      stage.appendChild(card);
      ctl.appendChild(nav('prev', S.pos === 0));
      if (S.rev) { ctl.appendChild(btn(tx('again'), 'fd-b fd-again', function () { rate(false); })); ctl.appendChild(btn(tx('got'), 'fd-b fd-got fd-main', function () { rate(true); })); }
      else ctl.appendChild(btn(tx('flip'), 'fd-b fd-main', function () { S.rev = true; render(); }));
      ctl.appendChild(nav('next', false));
    } else {
      var opts = '';
      if (it.opts && it.opts.length) {
        opts = '<div class="fd-opts">' + it.opts.map(function (o, j) {
          var cls = 'fd-opt';
          if (S.rev && it.a === j) cls += ' fd-right';
          else if (S.rev && S.picked === j) cls += ' fd-notyet';
          return '<button type="button" class="' + cls + '" data-j="' + j + '"><b>' + 'ABCDEFG'.charAt(j) + '</b><span>' + o + '</span></button>';
        }).join('') + '</div>';
      }
      var back = S.rev ? '<div class="fd-face fd-back">' + (it.ans ? '<div class="fd-ans">' + it.ans + '</div>' : '') + (S.picked != null && S.picked !== it.a && it.whys && it.whys[S.picked] ? '<div class="fd-why fd-whymine">' + it.whys[S.picked] + '</div>' : '') +
        (it.why ? '<div class="fd-why">' + it.why + '</div>' : '') + '</div>' : '';
      var hint = (S.hint && it.hint && !S.rev) ? '<div class="fd-hint">💡 ' + it.hint + '</div>' : '';
      card = el('article', 'fd-card fd-q' + (S.rev ? ' fd-rev' : ''), '<div class="fd-face fd-front">' + it.q + '</div>' + opts + hint + back);
      stage.appendChild(card);
      Array.prototype.forEach.call(card.querySelectorAll('.fd-opt'), function (b) {
        b.addEventListener('click', function () { if (S.rev) return; S.picked = +b.getAttribute('data-j'); S.rev = true; render(); });
      });
      ctl.appendChild(nav('prev', S.pos === 0));
      if (S.rev) { ctl.appendChild(btn(tx('again'), 'fd-b fd-again', function () { rate(false); })); ctl.appendChild(btn(tx('got'), 'fd-b fd-got fd-main', function () { rate(true); })); }
      else {
        if (it.hint && !S.hint) ctl.appendChild(btn(tx('hint'), 'fd-b', function () { S.hint = true; render(); }));
        ctl.appendChild(btn(tx('answer'), 'fd-b fd-main', function () { S.rev = true; render(); }));
      }
      ctl.appendChild(nav('next', false));
    }
    if (window.renderMathInElement) try {
      window.renderMathInElement(card, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '\\(', right: '\\)', display: false }], throwOnError: false });
    } catch (e) { }
    focusCard(card);
  }
  function focusCard(c) { c.tabIndex = c.tabIndex >= 0 ? c.tabIndex : -1; try { c.focus({ preventScroll: true }); } catch (e) { } }
  function btn(label, cls, fn) { var b = el('button', cls); b.type = 'button'; b.textContent = label; b.addEventListener('click', fn); return b; }
  function nav(dir, dis) {
    var b = btn(dir === 'prev' ? '‹' : '›', 'fd-b fd-nav', dir === 'prev' ? prev : next);
    b.setAttribute('aria-label', tx(dir)); b.title = tx(dir); if (dis) b.disabled = true; return b;
  }

  document.addEventListener('click', function (e) {   // delegated at once, so an early tap is never lost
    var b = e.target.closest && e.target.closest('[data-fd-open]');
    if (!b || ov) return;
    var box = b.closest('[data-fd-src]');
    if (!box) return;
    e.preventDefault();
    open(b.getAttribute('data-fd-open'), box.getAttribute('data-fd-src'), b);
  });
  function init() {
    var st = load(), today = day(0), again = st.again || {};   // quiet note on the button: how many are due again today
    Array.prototype.forEach.call(document.querySelectorAll('[data-fd-src]'), function (box) {
      var src = box.getAttribute('data-fd-src');
      if (src.charAt(0) !== '#') return;
      getData(src).then(function (d) {
        ['cards', 'quiz'].forEach(function (k) {
          var n = (d[k] || []).filter(function (it) { return again[it.id] && again[it.id] <= today; }).length;
          var b = box.querySelector('[data-fd-open="' + k + '"] .fd-due');
          if (b && n) { b.textContent = '↻' + n; b.hidden = false; }
        });
      }).catch(function () { });
    });
  }
  window.FocusDeck = { open: open, close: close };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
