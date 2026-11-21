/* Catch-up page: scores, done marks, progress bar, day-plan ticks. Everything is stored in localStorage under one key and
   every access is wrapped: with storage blocked the page still reads and works, it just does not remember. No red anywhere. */
(function () {
  'use strict';
  var KEY = 'pc11.catchup.v1';
  var page = document.querySelector('.cu-page');
  if (!page) return;
  var PASS = parseInt(page.getAttribute('data-pass'), 10) || 4;
  var S = { s: {}, b: {} };
  function load() { try { var j = JSON.parse(localStorage.getItem(KEY)); if (j && j.s && j.b) S = j; } catch (e) { } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }
  function rec(tid) { return S.s[tid] || (S.s[tid] = {}); }
  function isDone(tid) { var r = S.s[tid] || {}; return !!r.d || (r.c != null && r.c >= PASS) || (r.r != null && r.r >= PASS); }
  var T = {
    en: { pass: 'Passed the check: nothing to study here.', study: 'Next: Learn, then Re-check.', again: 'Not yet. Learn again tomorrow, then re-check.', done: 'Done', todo: '' },
    zh: { pass: '小测通过：这里不用再学。', study: '下一步：学习，再再测。', again: '还没到。明天再学一遍，再测。', done: '完成', todo: '' }
  };
  function stateText(tid) {
    var r = S.s[tid] || {}, en, zh;
    if (r.c != null && r.c >= PASS) { en = T.en.pass; zh = T.zh.pass; }
    else if (r.r != null && r.r >= PASS) { en = T.en.done; zh = T.zh.done; }
    else if (r.d) { en = T.en.done; zh = T.zh.done; }
    else if (r.r != null) { en = T.en.again; zh = T.zh.again; }
    else if (r.c != null) { en = T.en.study; zh = T.zh.study; }
    else return '';
    return '<span class="en" lang="en">' + en + '</span><span class="zh" lang="zh-Hans">' + zh + '</span>';
  }
  function render() {
    var cards = page.querySelectorAll('.cu-topic'), nm = 0, nl = 0, tm = 0, tl = 0;
    Array.prototype.forEach.call(cards, function (c) {
      var tid = c.getAttribute('data-tid'), tier = c.getAttribute('data-tier'), r = S.s[tid] || {}, d = isDone(tid);
      c.classList.toggle('cu-done', d);
      c.classList.toggle('cu-needs', !d && (r.c != null || r.r != null));
      var skip = r.c != null && r.c >= PASS;
      c.querySelector('[data-step="learn"]').classList.toggle('cu-skip', skip);
      c.querySelector('[data-step="recheck"]').classList.toggle('cu-skip', skip);
      Array.prototype.forEach.call(c.querySelectorAll('.cu-chip'), function (b) {
        var k = b.getAttribute('data-k'), v = parseInt(b.getAttribute('data-v'), 10);
        b.setAttribute('aria-pressed', r[k] === v ? 'true' : 'false');
      });
      var btn = c.querySelector('.cu-done-btn');
      btn.firstChild.nodeValue = (r.d ? '☑ ' : '☐ ');
      c.querySelector('.cu-state').innerHTML = stateText(tid);
      if (tier === 'must') { tm++; if (d) nm++; } else { tl++; if (d) nl++; }
    });
    var n = nm + nl, N = tm + tl;
    Array.prototype.forEach.call(page.querySelectorAll('.cu-c-must'), function (x) { x.textContent = nm; });
    Array.prototype.forEach.call(page.querySelectorAll('.cu-c-later'), function (x) { x.textContent = nl; });
    var bar = page.querySelector('.cu-bar');
    bar.setAttribute('aria-valuenow', n);
    bar.firstElementChild.style.width = (N ? Math.round(100 * n / N) : 0) + '%';
    Array.prototype.forEach.call(page.querySelectorAll('.cu-bchk'), function (x) { x.checked = !!S.b[x.getAttribute('data-b')]; x.closest('.cu-blk').classList.toggle('cu-ok', x.checked); });
  }
  page.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('.cu-chip, .cu-done-btn, .cu-reset');
    if (!t) return;
    if (t.classList.contains('cu-chip')) {
      var r = rec(t.getAttribute('data-tid')), k = t.getAttribute('data-k'), v = parseInt(t.getAttribute('data-v'), 10);
      if (r[k] === v) delete r[k]; else r[k] = v;
    } else if (t.classList.contains('cu-done-btn')) {
      var q = rec(t.getAttribute('data-tid')); if (q.d) delete q.d; else q.d = 1;
    } else if (t.classList.contains('cu-reset')) {
      S = { s: {}, b: {} };
    }
    save(); render();
  });
  page.addEventListener('change', function (e) {
    var x = e.target; if (!x.classList || !x.classList.contains('cu-bchk')) return;
    var k = x.getAttribute('data-b'); if (x.checked) S.b[k] = 1; else delete S.b[k];
    save(); render();
  });
  load(); render();
})();
