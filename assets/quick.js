/* Quick checks (auto-graded, instant feedback), explain-it-back boxes and the mixed-practice page. All state stays in this browser: localStorage 'pc11.quick.v1'.
   The grader below is a pure function; tools/quick_test.js runs THIS file in node against every item (keys, traps, wrong answers). */
(function (root) {
  'use strict';
  /* ---------- tiny expression evaluator (+ - * / ^, brackets, sqrt, implicit multiplication, unicode minus and superscripts) ---------- */
  function tokenize(s) {
    s = String(s).replace(/−|–|—/g, '-').replace(/[×·⋅]/g, '*').replace(/÷/g, '/').replace(/\*\*/g, '^')
      .replace(/²/g, '^2').replace(/³/g, '^3').replace(/√/g, 'sqrt').replace(/\s+/g, '');
    var out = [], i = 0, m;
    while (i < s.length) {
      var rest = s.slice(i);
      if ((m = /^(\d+\.?\d*|\.\d+)/.exec(rest))) { out.push({ t: 'n', v: parseFloat(m[1]) }); i += m[1].length; }
      else if (/^sqrt/.test(rest)) { out.push({ t: 'f', v: 'sqrt' }); i += 4; }
      else if (/^[a-zA-Z]/.test(rest)) { out.push({ t: 'v', v: rest[0] }); i += 1; }
      else if (/^[-+*\/^()]/.test(rest)) { out.push({ t: rest[0] }); i += 1; }
      else return null;
    }
    return out;
  }
  function parse(tokens) {
    var p = 0;
    function peek() { return tokens[p]; }
    function startsFactor(t) { return t && (t.t === 'n' || t.t === 'v' || t.t === '(' || t.t === 'f'); }
    function expr() { var a = term(); while (peek() && (peek().t === '+' || peek().t === '-')) { var o = tokens[p++].t, b = term(); a = { o: o, a: a, b: b }; } return a; }
    function term() {
      var a = unary();
      for (;;) {
        var t = peek();
        if (t && (t.t === '*' || t.t === '/')) { p++; a = { o: t.t, a: a, b: unary() }; }
        else if (startsFactor(t)) { a = { o: '*', a: a, b: unary() }; }
        else return a;
      }
    }
    function unary() { var t = peek(); if (t && t.t === '-') { p++; return { o: 'neg', a: unary() }; } if (t && t.t === '+') { p++; return unary(); } return power(); }
    function power() {
      var a = atom();
      if (peek() && peek().t === '^') { p++; var neg = false; if (peek() && peek().t === '-') { neg = true; p++; } else if (peek() && peek().t === '+') p++;
        var e = atom(); if (peek() && peek().t === '^') { p++; e = { o: '^', a: e, b: atom() }; } a = { o: '^', a: a, b: neg ? { o: 'neg', a: e } : e }; }
      return a;
    }
    function atom() {
      var t = tokens[p++]; if (!t) throw new Error('end');
      if (t.t === 'n') return { n: t.v };
      if (t.t === 'v') return { v: t.v };
      if (t.t === '(') { var e = expr(); if (!peek() || peek().t !== ')') throw new Error('paren'); p++; return e; }
      if (t.t === 'f') { return { o: 'sqrt', a: atom() }; }
      throw new Error('atom');
    }
    var tree = expr(); if (p !== tokens.length) throw new Error('trailing'); return tree;
  }
  function evalTree(n, env) {
    if (n.n !== undefined) return n.n;
    if (n.v !== undefined) { if (!(n.v in env)) throw new Error('var'); return env[n.v]; }
    var a = evalTree(n.a, env);
    switch (n.o) {
      case 'neg': return -a; case 'sqrt': return Math.sqrt(a);
      case '+': return a + evalTree(n.b, env); case '-': return a - evalTree(n.b, env);
      case '*': return a * evalTree(n.b, env); case '/': return a / evalTree(n.b, env);
      case '^': return Math.pow(a, evalTree(n.b, env));
    }
    throw new Error('op');
  }
  function exprValues(str, vars, pts) {
    var tk = tokenize(str); if (!tk || !tk.length) return null;
    var tree; try { tree = parse(tk); } catch (e) { return null; }
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      var env = {}; vars.forEach(function (v, j) { env[v] = pts[i][j]; });
      var r; try { r = evalTree(tree, env); } catch (e) { return null; }
      if (typeof r !== 'number' || !isFinite(r)) return null; out.push(r);
    }
    return out;
  }
  function parseNum(s) {
    s = String(s == null ? '' : s).replace(/−|–/g, '-').replace(/\s+/g, '').replace(/,/g, '');
    var m;
    if ((m = /^([+-]?)(\d+\.?\d*|\.\d+)$/.exec(s))) return parseFloat(s);
    if ((m = /^([+-]?\d+)\/(\d+)$/.exec(s)) && +m[2] !== 0) return +m[1] / +m[2];
    return NaN;
  }
  function close(a, b) { return Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b)); }
  function sameVals(a, b) { if (!a || a.length !== b.length) return false; for (var i = 0; i < a.length; i++) if (!close(a[i], b[i])) return false; return true; }
  function sameTuple(a, b) { if (a.length !== b.length) return false; for (var i = 0; i < a.length; i++) if (!close(a[i], b[i])) return false; return true; }

  /* grade(spec, answer): answer = array of strings (blanks), a string (num, expr) or an index (choice).
     -> {st: 'ok' | 'trap' | 'format' | 'no' | 'empty', trap: index} */
  function grade(spec, ans) {
    var k = spec.k;
    if (k === 'choice') { if (ans === null || ans === undefined || ans === '') return { st: 'empty' }; return { st: +ans === spec.correct ? 'ok' : 'no' }; }
    if (k === 'blanks') {
      var nums = (ans || []).map(parseNum);
      if (!nums.length || nums.some(function (x) { return isNaN(x); })) return { st: 'empty' };
      if (spec.ok.some(function (t) { return sameTuple(nums, t); })) return { st: 'ok' };
      for (var i = 0; i < (spec.traps || []).length; i++) if (spec.traps[i].ok.some(function (t) { return sameTuple(nums, t); })) return { st: 'trap', trap: i };
      return { st: 'no' };
    }
    if (k === 'num') {
      var v = parseNum(ans); if (isNaN(v)) return { st: 'empty' };
      if (close(v, spec.val)) return { st: 'ok' };
      for (var j = 0; j < (spec.traps || []).length; j++) if (close(v, spec.traps[j].val)) return { st: 'trap', trap: j };
      return { st: 'no' };
    }
    if (k === 'expr') {
      var raw = String(ans || ''); if (!raw.trim()) return { st: 'empty' };
      var vals = exprValues(raw, spec.vars, spec.pts); if (!vals) return { st: 'no', parse: true };
      if (sameVals(vals, spec.vals)) {
        var flat = raw.replace(/\s+/g, '').replace(/−/g, '-');
        if ((spec.forbid || []).some(function (f) { return flat.indexOf(f) >= 0; })) return { st: 'format' };
        return { st: 'ok' };
      }
      for (var q = 0; q < (spec.traps || []).length; q++) if (sameVals(vals, spec.traps[q].vals)) return { st: 'trap', trap: q };
      return { st: 'no' };
    }
    return { st: 'no' };
  }
  var API = { grade: grade, parseNum: parseNum, exprValues: exprValues };
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; return; }
  root.PCQ = API;
  if (typeof document === 'undefined') return;

  /* ====================== browser side ====================== */
  var $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function lang() { return document.documentElement.dataset.lang || 'both'; }
  function T(en, zh) { var l = lang(); return l === 'en' ? en : l === 'zh' ? zh : en + ' · ' + zh; }
  var KEY = 'pc11.quick.v1', DAY = 86400000, BOX = [1, 1, 3, 7, 14, 30];
  var S; try { S = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { S = {}; }
  S.i = S.i || {}; S.x = S.x || {};
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function today0() { var d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function record(id, ok) {
    var r = S.i[id] || { b: 0, n: 0, w: 0 }; r.n++; r.t = Date.now();
    if (ok) { r.b = Math.min(5, r.b + 1); r.due = today0() + BOX[r.b] * DAY; } else { r.b = 0; r.w++; r.due = today0() + DAY; }
    S.i[id] = r; save(); return r;
  }
  root.PCQ.state = function () { return S; };

  function readSpec(card) { try { return JSON.parse(card.getAttribute('data-spec')); } catch (e) { return null; } }
  function msgFor(card, cls, i) { var el = $('.qc-' + cls + '[data-i="' + i + '"]', card); return el ? el.innerHTML : ''; }
  function wire(card, onDone) {
    var spec = readSpec(card); if (!spec) return;
    var res = $('.qc-res', card), ans = $('.qc-ans', card), chosen = null, done = false, failedOnce = false;
    function answer() {
      if (spec.k === 'choice') return chosen;
      var ins = $$('input', card).map(function (i) { return i.value; });
      return spec.k === 'blanks' ? ins : ins[0];
    }
    function show(cls, html) { res.className = 'qc-res ' + cls; res.innerHTML = html; }
    function check() {
      var g = grade(spec, answer()), id = card.dataset.qid;
      if (g.st === 'empty') { show('', '<span class="muted">' + T('Fill in your answer first.', '先写上你的答案。') + '</span>'); return; }
      if (g.st === 'ok') {
        show('ok', '✓ ' + T('Correct!', '答对了！')); ans.hidden = false; card.classList.add('right'); card.classList.remove('nope');
        if (!done) { record(id, !failedOnce); } done = true; if (onDone) onDone(id, !failedOnce);
      } else {
        failedOnce = true; card.classList.add('nope');
        var extra = g.st === 'trap' ? '<div class="qc-trapmsg">' + msgFor(card, 'trap', g.trap) + '</div>' : g.st === 'format' ? '<div class="qc-trapmsg">' + msgFor(card, 'fmt', 0) + '</div>'
          : g.parse ? '<div class="qc-trapmsg">' + T('I could not read that. Use x, + - * / ^ and brackets, like 2x^2-3x.', '我读不懂这个写法。可以用 x、+ - * / ^ 和括号，比如 2x^2-3x。') + '</div>' : '';
        show('no', T('Not yet — try once more, or tap Hint / Show answer.', '还没对——再试一次，或点「提示」「显示答案」。') + extra);
        if (!done) { record(id, false); done = 'failed'; if (onDone) onDone(id, false, true); }
      }
    }
    var btn = $('.qc-check', card); if (btn) btn.addEventListener('click', check);
    $$('input', card).forEach(function (i) { i.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); check(); } }); });
    $$('.qc-ch button', card).forEach(function (b) { b.addEventListener('click', function () { chosen = +b.dataset.c; $$('.qc-ch button', card).forEach(function (x) { x.classList.toggle('on', x === b); }); check(); }); });
    var sb = $('.qc-show', card); if (sb) sb.addEventListener('click', function () { ans.hidden = false; if (!done) { record(card.dataset.qid, false); done = 'failed'; failedOnce = true; if (onDone) onDone(card.dataset.qid, false, true); } });
    var hb = $('.qc-hint-b', card); if (hb) hb.addEventListener('click', function () { var h = $('.qc-hint', card); if (h) h.hidden = !h.hidden; });
  }
  root.PCQ.wire = wire;

  /* ---------- topic pages: wire every card, explain-it-back boxes ---------- */
  $$('.qc').forEach(function (c) { if (!c.closest('#mixRun')) wire(c); });
  $$('.qc-explain').forEach(function (b) {
    var tid = b.dataset.tid, ta = $('textarea', b), model = $('.qc-model', b), rb = $('.qc-reveal', b);
    if (S.x[tid]) ta.value = S.x[tid];
    ta.addEventListener('input', function () { S.x[tid] = ta.value; save(); });
    rb.addEventListener('click', function () { model.hidden = !model.hidden; rb.setAttribute('aria-expanded', String(!model.hidden)); });
  });

  /* ---------- mixed practice page ---------- */
  var mix = $('#mixRun'); if (!mix) return;
  var BASE = mix.dataset.base || '';
  fetch(BASE + 'quick/all.json').then(function (r) { return r.json(); }).then(function (D) { startMix(D); }).catch(function () { mix.innerHTML = '<p class="muted">' + T('Could not load the questions. Check your connection once; after that they work offline.', '题目没能加载。请联网打开一次，之后可以离线用。') + '</p>'; });
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function tt(D, t) { var x = D.topics[t]; return x ? (lang() === 'zh' ? x.title.zh : lang() === 'en' ? x.title.en : x.title.en + ' · ' + x.title.zh) : t; }
  function pickMix(D, n) {
    var now = Date.now(), items = D.items, seen = S.i;
    var due = items.filter(function (it) { var r = seen[it.id]; return r && r.due && r.due <= now + 0; }).sort(function (a, b) { return (seen[a.id].due || 0) - (seen[b.id].due || 0); });
    var fresh = items.filter(function (it) { return !seen[it.id]; });
    var later = items.filter(function (it) { return seen[it.id] && !(seen[it.id].due <= now); }).sort(function (a, b) { return (seen[a.id].b || 0) - (seen[b.id].b || 0) || (seen[a.id].t || 0) - (seen[b.id].t || 0); });
    var pool = due.slice(0, Math.ceil(n * 0.6)); var rem = n - pool.length;
    // fresh items: round robin over topics in catch-up order, so neighbours are never from the same topic
    var byT = {}; fresh.forEach(function (it) { (byT[it.t] = byT[it.t] || []).push(it); });
    var order = D.order.filter(function (t) { return byT[t]; });
    var addF = []; for (var guard = 0; addF.length < rem && guard < 200; guard++) { var any = false; for (var k = 0; k < order.length && addF.length < rem; k++) { var q = byT[order[k]]; if (q.length) { addF.push(q.shift()); any = true; } } if (!any) break; }
    pool = pool.concat(addF); rem = n - pool.length;
    if (rem > 0) pool = pool.concat(due.slice(pool.length, pool.length + rem)).slice(0, n);
    rem = n - pool.length; if (rem > 0) pool = pool.concat(later.slice(0, rem));
    // interleave: no two neighbours from the same topic where avoidable
    var out = [], left = pool.slice();
    while (left.length) { var last = out.length ? out[out.length - 1].t : null, i = left.findIndex(function (x) { return x.t !== last; }); if (i < 0) i = 0; out.push(left.splice(i, 1)[0]); }
    return out;
  }
  function shaky(D) { return D.items.filter(function (it) { var r = S.i[it.id]; return r && r.w > 0 && r.b <= 1; }); }
  function startMix(D) {
    var n = 8, queue = [], idx = 0, ok = 0, retry = [];
    function head() {
      var sh = shaky(D), seenN = Object.keys(S.i).length;
      var due = D.items.filter(function (it) { var r = S.i[it.id]; return r && r.due && r.due <= Date.now(); }).length;
      var el = $('#mixHead');
      el.innerHTML = '<p class="small muted">' + T('Questions answered so far: ', '已做过的题：') + '<b>' + seenN + '</b> / ' + D.items.length + ' · ' + T('due for review: ', '到期复习：') + '<b>' + due + '</b> · ' + T('still shaky: ', '还不稳：') + '<b>' + sh.length + '</b></p>' +
        (sh.length ? '<details class="more-ex"><summary>' + T('Error log — questions to look at again', '错题记录——需要再看看的题') + ' (' + sh.length + ')</summary><ul class="mis">' + sh.slice(0, 30).map(function (it) { return '<li><a class="chip" href="topic-' + it.t + '.html#s-quiz">' + esc(tt(D, it.t)) + '</a> ' + T('question ', '第') + it.n + T('', ' 题') + '</li>'; }).join('') + '</ul></details>' : '');
    }
    function begin() {
      queue = pickMix(D, n); idx = 0; ok = 0; retry = [];
      mix.innerHTML = ''; show();
    }
    function show() {
      var el = mix; el.innerHTML = '';
      if (idx >= queue.length) { if (retry.length) { queue = queue.concat(retry); retry = []; } else return finish(); }
      var it = queue[idx], box = document.createElement('div'); box.className = 'mix-card';
      box.innerHTML = '<div class="mix-top"><span class="muted small">' + T('Question ', '第 ') + (idx + 1) + ' / ' + queue.length + ' · <a href="topic-' + it.t + '.html">' + esc(tt(D, it.t)) + '</a></span></div>' + it.html +
        '<div class="row mix-next" hidden><button class="primary" id="mixNext">' + T('Next', '下一题') + ' →</button></div>';
      el.appendChild(box);
      var card = $('.qc', box); wire(card, function (id, right, failed) { if (right) ok++; else if (failed && retry.indexOf(it) < 0 && !it._r) { it._r = true; retry.push(it); } $('.mix-next', box).hidden = false; });
      $('#mixNext', box).addEventListener('click', function () { idx++; show(); });
      var rm = window.renderMathInElement; // math is pre-rendered at build time; nothing to do
    }
    function finish() {
      var left = D.items.filter(function (it) { var r = S.i[it.id]; return r && r.due && r.due <= today0() + DAY; }).length;
      mix.innerHTML = '<div class="card mix-done"><h2>🌿 ' + T('Done for now', '这一组做完了') + '</h2><p>' + T('You got ', '答对 ') + '<b>' + ok + '</b> / ' + (queue.length - 0) + T(' on the first try. Questions you missed come back tomorrow, then in 3 days, a week and two weeks.', ' 题（第一次就对）。答错的会明天回来，然后是 3 天、一周、两周后。') + '</p>' +
        '<div class="row"><button class="primary" id="mixAgain">' + T('Another set', '再来一组') + '</button><a class="btn" href="catch-up.html">' + T('Back to the catch-up plan', '回到补课计划') + '</a></div></div>';
      $('#mixAgain').addEventListener('click', function () { head(); begin(); });
      head();
    }
    head();
    $('#mixSize').addEventListener('change', function (e) { n = +e.target.value; });
    $('#mixStart').addEventListener('click', begin);
  }
})(typeof window !== 'undefined' ? window : this);
