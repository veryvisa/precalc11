/* Pre-calc 11 Clear — all state lives in this browser (localStorage); nothing is sent anywhere. */
(function () {
  'use strict';
  var PC = window.PC || { units: [], topics: {}, order: [], cards: [] };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var DAY = 864e5;
  var KEY = 'pc11.state';
  var S;
  try { S = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { S = {}; }
  ['m', 'p', 'c', 'ex'].forEach(function (k) { S[k] = S[k] || {}; });
  S.log = S.log || []; S.test = S.test || {}; S.h = S.h || []; S.t = S.t || {}; S.f = S.f || {}; S.dg = S.dg || {}; S.ck = S.ck || [];
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function lang() { return document.documentElement.dataset.lang || 'both'; }
  function T(en, zh) { var l = lang(); return l === 'en' ? en : l === 'zh' ? zh : en + ' · ' + zh; }
  function tt(id) { var t = PC.topics[id]; return t ? T(t.title.en, t.title.zh) : id; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function today0() { var d = new Date(); d.setHours(0, 0, 0, 0); return +d; }
  function fmt(sec) { var s = Math.abs(Math.round(sec)); return (sec < 0 ? '+' : '') + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

  /* ---------- fill-in answer matching (accept list or [value, tol]) ---------- */
  function matchAns(val, acc, num) {
    var v = String(val || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!v) return null;
    if (num && num.length) { var x = parseFloat(v.replace(/[^0-9.eE+-]/g, '')); return !isNaN(x) && Math.abs(x - num[0]) <= (num[1] || 0); }
    return (acc || []).some(function (a) { a = String(a).toLowerCase().trim(); return v === a || (a.length >= 2 && v.indexOf(a) >= 0); });
  }
  function wireFill(box, onResult) {
    var inp = $('input', box), btn = $('button', box), res = $('.fill-res', box);
    var acc = JSON.parse(box.dataset.accept || '[]'), num = JSON.parse(box.dataset.num || '[]');
    function go() { var ok = matchAns(inp.value, acc, num); if (ok === null) { inp.focus(); return; }
      res.textContent = ok ? '✓ ' + T('Correct!', '答对了！') : '✗ ' + T('Not quite — see the answer below.', '不太对——看下面的答案。');
      res.className = 'fill-res ' + (ok ? 'ok' : 'no'); onResult(ok); }
    if (btn) btn.addEventListener('click', go);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    return { check: function () { return matchAns(inp.value, acc, num); }, input: inp, show: go };
  }

  /* ---------- language ---------- */
  $$('[data-set-lang]').forEach(function (b) {
    b.addEventListener('click', function () {
      document.documentElement.dataset.lang = b.dataset.setLang;
      try { localStorage.setItem('pc11.lang', b.dataset.setLang); } catch (e) {}
      rerender();
    });
  });
  var rerenders = [];
  function applyLangAttrs() {
    var l = lang();
    $$('[data-en][data-zh]').forEach(function (o) { o.textContent = l === 'en' ? o.dataset.en : l === 'zh' ? o.dataset.zh : o.dataset.en + ' · ' + o.dataset.zh.replace(/^\W+\s*/, ''); });
    $$('[data-ph-en]').forEach(function (i) { i.placeholder = l === 'en' ? i.dataset.phEn : l === 'zh' ? i.dataset.phZh : i.dataset.phEn + ' · ' + i.dataset.phZh; });
  }
  function rerender() { applyLangAttrs(); rerenders.forEach(function (f) { f(); }); }

  /* ---------- mastery ---------- */
  var INTERVAL = { 1: 1, 2: 3, 3: 7 };
  function lvl(id) { return (S.m[id] && S.m[id].lvl) || 0; }
  function due(id) { var m = S.m[id]; return !!(m && m.next && m.next <= Date.now()); }
  function setMastery(id, l) {
    var prev = S.m[id];
    var interval = INTERVAL[l];
    if (prev && prev.lvl === 3 && l === 3 && prev.iv) interval = Math.min(prev.iv * 2, 60);
    S.m[id] = { lvl: l, at: Date.now(), next: today0() + interval * DAY, iv: interval };
    save();
  }
  function decorate() {
    $$('[data-topic]').forEach(function (el) {
      var id = el.dataset.topic; if (!PC.topics[id]) return;
      var tgt = el.classList.contains('trow') ? $('.dot', el) : el;
      if (!tgt) return;
      ['m1', 'm2', 'm3', 'due', 'next'].forEach(function (c) { tgt.classList.remove(c); });
      var l = lvl(id); if (l) tgt.classList.add('m' + l);
      if (due(id)) tgt.classList.add('due');
    });
    var nx = nextTopic();
    if (nx) $$('.node[data-topic="' + nx + '"]').forEach(function (n) { n.classList.add('next'); });
    $$('.ucard[data-unit]').forEach(function (c) {
      var u = PC.units.filter(function (u) { return u.id === c.dataset.unit; })[0]; if (!u) return;
      var sum = u.topics.reduce(function (a, id) { return a + lvl(id); }, 0);
      $('.up i', c).style.width = Math.round(100 * sum / (3 * u.topics.length)) + '%';
    });
  }
  function nextTopic() {
    for (var i = 0; i < PC.order.length; i++) {
      var id = PC.order[i], t = PC.topics[id];
      if (!t.ready || lvl(id) >= 2) continue;
      if (t.prereq.every(function (p) { return lvl(p) >= 1; })) return id;
    }
    for (var j = 0; j < PC.order.length; j++) if (PC.topics[PC.order[j]].ready && lvl(PC.order[j]) < 2) return PC.order[j];
    return null;
  }
  function dueTopics() { return PC.order.filter(function (id) { return due(id); }).sort(function (a, b) { return S.m[a].next - S.m[b].next; }); }

  /* ---------- personal speed ---------- */
  function speed() {
    var r = S.log.filter(function (l) { return l.est > 0 && l.act > 0; }).slice(-12).map(function (l) { return l.act / l.est; }).sort(function (a, b) { return a - b; });
    if (r.length < 3) return { f: 1, n: r.length };
    var med = r[Math.floor(r.length / 2)];
    return { f: Math.max(0.7, Math.min(2, med)), n: r.length };
  }

  /* ---------- plan builder ---------- */
  function makePlan(total, focus) {
    var f = speed().f, left = total, blocks = [], worked = 0;
    function add(b) { blocks.push(b); left -= b.min; if (b.kind !== 'break') worked += b.min; }
    function maybeBreak() { if (total >= 60 && worked >= 25 && left > 15) { add({ kind: 'break', min: 5, label: T('Break — water, stretch, look outside', '休息：喝水、伸展、看看窗外') }); worked = 0; } }
    var cardsDue = PC.cards.filter(function (c) { var s = S.c[c.id]; return s && s.due <= Date.now(); }).length;
    if (total >= 25 || cardsDue) add({ kind: 'cards', min: 5, label: T('Flashcards warm-up', '卡片热身') + (cardsDue ? ' (' + cardsDue + ')' : ''), href: 'cards.html' });
    var reviews = dueTopics().filter(function (id) { return id !== focus; });
    var rN = total >= 60 ? 2 : total >= 25 ? 1 : 0;
    if (total < 25 && !focus && reviews.length) rN = 1;
    reviews.slice(0, rN).forEach(function (id) { if (left >= 10) add({ kind: 'review', min: 10, topic: id, label: T('Review: ', '复习：') + tt(id) + T(' — 3 practice questions', '——做 3 道练习'), href: 'topic-' + id + '.html#pr' }); });
    var wrap = total >= 25 ? 3 : 0;
    var main = focus || nextTopic();
    while (main && left - wrap >= 10) {
      var need = Math.round((PC.topics[main].budget || PC.topics[main].minutes) * f / 5) * 5;   // course-level budget (bin/timebox.py)
      var room = left - wrap;
      if (lvl(main) >= 1) {
        var m = Math.min(room, 20);
        add({ kind: 'practice', min: m, topic: main, label: T('Practice: ', '练习：') + tt(main), href: 'topic-' + main + '.html#pr' });
      } else if (need <= room) {
        add({ kind: 'learn', min: need, topic: main, label: T('Learn + examples + practice: ', '学习＋例题＋练习：') + tt(main), href: 'topic-' + main + '.html' });
      } else if (room >= need * 0.5 || !blocks.some(function (b) { return b.kind === 'learn'; })) {
        add({ kind: 'learn', min: room, topic: main, label: T('Learn + examples (part 1): ', '学习＋例题（第一部分）：') + tt(main), href: 'topic-' + main + '.html', note: T('Not enough time for the whole topic — finish the practice next time.', '时间不够学完整个知识点，练习留到下次。') });
      }
      else break;
      maybeBreak();
      if (focus) break;
      var nx = PC.order.filter(function (id) { return id !== main && PC.topics[id].ready && lvl(id) < 2 && PC.topics[id].prereq.every(function (p) { return lvl(p) >= 1 || p === main; }) && !blocks.some(function (b) { return b.topic === id; }); })[0];
      main = nx;
    }
    if (left - wrap >= 5 && blocks.length) add({ kind: 'practice', min: left - wrap, topic: blocks[blocks.length - 1].topic, label: T('Extra practice / catch-up', '加练或补上没做完的'), href: blocks[blocks.length - 1].topic ? 'topic-' + blocks[blocks.length - 1].topic + '.html#pr' : 'cards.html' });
    if (wrap) add({ kind: 'wrap', min: wrap, label: T('Write one line: where you will restart next time', '写一行：下次从哪里接着做') });
    return { blocks: blocks, factor: f };
  }
  function planHTML(p, total) {
    var used = p.blocks.reduce(function (a, b) { return a + b.min; }, 0);
    var h = p.blocks.map(function (b, i) {
      var go = b.href ? '<a class="go" href="' + b.href + '" data-start="' + i + '">▶ ' + T('Start', '开始') + '</a>' : b.kind === 'break' ? '<span>☕</span>' : '<span>✍️</span>';
      return '<div class="pblock"><span class="pm">' + b.min + '′</span><span>' + esc(b.label) + (b.note ? '<br><span class="muted small">' + esc(b.note) + '</span>' : '') + '</span>' + go + '</div>';
    }).join('');
    var sp = speed();
    var note = sp.n >= 3 ? T('Times are adjusted to your real speed (×' + sp.f.toFixed(2) + ', from ' + sp.n + ' timed blocks).', '时间已按你的真实速度调整（×' + sp.f.toFixed(2) + '，来自 ' + sp.n + ' 段计时）。')
      : T('Time 3 blocks with the timer and plans will adapt to your real speed.', '用计时器计 3 段之后，计划会按你的真实速度调整。');
    return h + '<p class="muted small">' + used + ' / ' + total + ' min. ' + note + '</p>';
  }
  function wirePlan(box, p) {
    $$('[data-start]', box).forEach(function (a) {
      a.addEventListener('click', function () {
        var b = p.blocks[+a.dataset.start];
        startTimer({ label: b.label, est: b.min, topic: b.topic || null });
        if (a.tagName === 'BUTTON') location.href = 'plan.html#timerCard';
      });
    });
  }

  /* ---------- timer (survives navigation) ---------- */
  function startTimer(o) { S.timer = { label: o.label, est: o.est, topic: o.topic, start: Date.now(), paused: 0, pauseAt: null }; save(); }
  function elapsed() { var t = S.timer; if (!t) return 0; var now = t.pauseAt || Date.now(); return (now - t.start - t.paused) / 1000; }
  function finishTimer() {
    var t = S.timer; if (!t) return null;
    var act = Math.max(1, Math.round(elapsed() / 60));
    var row = { d: today0(), ts: Date.now(), topic: t.topic, label: t.label, est: t.est, act: act };
    S.log.push(row); if (S.log.length > 400) S.log = S.log.slice(-400);
    S.timer = null; save(); return row;
  }
  var beeped = false;
  function beep() { try { var c = new (window.AudioContext || window.webkitAudioContext)(); var o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 660; g.gain.value = .15; o.start(); o.stop(c.currentTime + .6); } catch (e) {} }

  /* ---------- topic page ---------- */
  var topicEl = $('.topic[data-topic]');
  if (topicEl) {
    var tid = topicEl.dataset.topic;
    /* one long page in a fixed order (no tabs): old #learn/#ex/#pr/#cards links still land on the right section */
    function goHash() {
      var h = location.hash.slice(1); if (!h) return;
      var el = document.getElementById({ learn: 's-key' }[h] || h); if (!el) return;
      for (var p = el; p && p !== topicEl; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true;
      setTimeout(function () { el.scrollIntoView(); }, 60);
    }
    goHash(); window.addEventListener('hashchange', goHash);
    $$('.ex').forEach(function (ex) {
      $$('.methods button', ex).forEach(function (b) {
        b.addEventListener('click', function () {
          $$('.methods button', ex).forEach(function (x) { x.classList.toggle('on', x === b); });
          $$('ol.steps', ex).forEach(function (o) { o.hidden = !o.classList.contains('m' + b.dataset.m); });
        });
      });
    });
    $$('.vplayer').forEach(function (vp) {
      $$('[data-vsrc]', vp).forEach(function (b) { b.addEventListener('click', function () {
        $$('[data-vsrc]', vp).forEach(function (x) { x.classList.toggle('on', x === b); });
        var v = $('video', vp); v.src = b.dataset.vsrc; v.play().catch(function () {}); }); });
      if (lang() === 'en') { var eb = $$('[data-vsrc]', vp).filter(function (b) { return /\.en\.mp4/.test(b.dataset.vsrc); })[0];
        if (eb) { $$('[data-vsrc]', vp).forEach(function (x) { x.classList.toggle('on', x === eb); }); $('video', vp).src = eb.dataset.vsrc; } }
    });
    $$('.pr').forEach(function (pr) {
      var pid = pr.dataset.pid;
      $$('[data-show]', pr).forEach(function (b) { b.addEventListener('click', function () { $('.' + b.dataset.show, pr).hidden = false; }); });
      $$('.choices button', pr).forEach(function (b) {
        b.addEventListener('click', function () {
          $$('.choices button', pr).forEach(function (x) { if (x.dataset.ok === '1') x.classList.add('right'); });
          if (b.dataset.ok !== '1') b.classList.add('wrong');
          $('.sol', pr).hidden = false;
          mark(pr, pid, b.dataset.ok === '1' ? 2 : 0);
        });
      });
      $$('[data-self]', pr).forEach(function (b) { b.addEventListener('click', function () { mark(pr, pid, +b.dataset.self); }); });
      var fb = $('.fill', pr); if (fb) wireFill(fb, function (ok) { $('.sol', pr).hidden = false; mark(pr, pid, ok ? 2 : 0); });
      if (pid in S.p) paint(pr, S.p[pid]);
    });
    function paint(pr, v) { pr.classList.remove('done-0', 'done-1', 'done-2'); pr.classList.add('done-' + v); $$('[data-self]', pr).forEach(function (x) { x.classList.toggle('on', +x.dataset.self === v); }); }
    function mark(pr, pid, v) {
      S.p[pid] = v; S.h.push({ q: pid, v: v, ts: Date.now() }); if (S.h.length > 3000) S.h = S.h.slice(-3000); save(); paint(pr, v);
      var all = $$('.pr', topicEl).map(function (x) { return S.p[x.dataset.pid]; }).filter(function (x) { return x !== undefined; });
      if (all.length >= 4) {
        var avg = all.reduce(function (a, b) { return a + b; }, 0) / all.length;
        var sug = avg >= 1.7 ? 3 : avg >= 1 ? 2 : 1;
        $$('[data-mastery]', topicEl).forEach(function (x) { x.classList.toggle('sug', +x.dataset.mastery === sug); });
      }
    }
    function paintM() { $$('[data-mastery]', topicEl).forEach(function (x) { x.classList.toggle('on', +x.dataset.mastery === lvl(tid)); }); }
    $$('[data-mastery]', topicEl).forEach(function (b) { b.addEventListener('click', function () { setMastery(tid, +b.dataset.mastery); paintM(); }); });
    paintM();
    if (!S.m[tid]) { S.m[tid] = { lvl: 0, seen: Date.now() }; save(); }
    $$('.flip', topicEl).forEach(function (c) { c.addEventListener('click', function () { c.classList.toggle('on'); }); });
  }

  /* ---------- home ---------- */
  var todayBox = $('#todayPlan');
  if (todayBox) {
    var cur = null;
    function drawToday() { if (!cur) return; var p = makePlan(cur); todayBox.innerHTML = planHTML(p, cur); todayBox.classList.remove('muted'); wirePlan(todayBox, p); }
    $$('.today .chips button').forEach(function (b) {
      b.addEventListener('click', function () { $$('.today .chips button').forEach(function (x) { x.classList.toggle('on', x === b); }); cur = +b.dataset.min; drawToday(); });
    });
    rerenders.push(drawToday);
    var nu = $('#nextUp');
    function drawNext() {
      var parts = [];
      if (S.timer) parts.push('<b>⏱️ ' + T('A focus block is running', '有一段专注正在计时') + '</b> ' + esc(S.timer.label) + ' — <a href="plan.html#timerCard">' + T('open timer', '打开计时器') + '</a>');
      var d = dueTopics(); if (d.length) parts.push('<b>🔁 ' + T('Review due', '该复习了') + '</b> ' + d.slice(0, 3).map(function (id) { return '<a href="topic-' + id + '.html#pr">' + esc(tt(id)) + '</a>'; }).join(' · '));
      var n = nextTopic(); if (n && $('#heroNext')) $('#heroNext').href = 'topic-' + n + '.html';
      if (n) parts.push('<b>➡️ ' + T('Next new topic', '下一个新知识点') + '</b> <a href="topic-' + n + '.html">' + esc(tt(n)) + '</a>');
      if (S.test.date) { var days = Math.ceil((new Date(S.test.date + 'T00:00') - today0()) / DAY); if (days >= 0) parts.push('<b>📅 ' + T('Test in ' + days + ' days', '距考试 ' + days + ' 天') + '</b> <a href="plan.html">' + T('see plan', '看规划') + '</a>'); }
      nu.innerHTML = parts.map(function (p) { return '<p>' + p + '</p>'; }).join(''); nu.hidden = !parts.length;
    }
    drawNext(); rerenders.push(drawNext);
  }

  /* ---------- plan page ---------- */
  if ($('#planOut')) {
    var sel = $('#planTopic');
    PC.order.forEach(function (id) { if (!PC.topics[id].ready) return; var o = document.createElement('option'); o.value = id; o.dataset.en = PC.topics[id].title.en; o.dataset.zh = PC.topics[id].title.zh; o.textContent = tt(id); sel.appendChild(o); });
    var q = new URLSearchParams(location.search);
    if (q.get('topic')) sel.value = q.get('topic');
    var pmin = null;
    function drawPlan() { if (!pmin) return; var p = makePlan(pmin, sel.value || null); $('#planOut').innerHTML = planHTML(p, pmin); wirePlan($('#planOut'), p); }
    $$('#planChips button').forEach(function (b) { b.addEventListener('click', function () { $$('#planChips button').forEach(function (x) { x.classList.toggle('on', x === b); }); pmin = +b.dataset.min; drawPlan(); }); });
    sel.addEventListener('change', drawPlan);
    if (q.get('topic')) { pmin = 45; $$('#planChips button').forEach(function (x) { x.classList.toggle('on', x.dataset.min === '45'); }); drawPlan(); }
    rerenders.push(drawPlan);

    // timer
    var clock = $('#tClock'), est = $('#tEst');
    function tick() {
      if (!S.timer) { clock.textContent = fmt(+est.value * 60); clock.parentNode.classList.remove('over'); $('#timerTask').textContent = T('Start a block from your plan, or set one here.', '从计划里开始一段，或在这里设置。'); return; }
      var left = S.timer.est * 60 - elapsed();
      clock.textContent = fmt(left); clock.parentNode.classList.toggle('over', left < 0);
      $('#timerTask').textContent = S.timer.label + (S.timer.pauseAt ? ' — ' + T('paused', '已暂停') : '');
      if (left < 0 && !beeped && !S.timer.pauseAt) { beeped = true; beep(); }
    }
    if (S.timer) est.value = S.timer.est;
    est.addEventListener('input', tick);
    $('#tStart').addEventListener('click', function () {
      if (S.timer && S.timer.pauseAt) { S.timer.paused += Date.now() - S.timer.pauseAt; S.timer.pauseAt = null; save(); }
      else if (!S.timer) { startTimer({ label: T('Free study block', '自由学习一段'), est: +est.value || 25, topic: sel.value || null }); beeped = false; }
      tick();
    });
    $('#tPause').addEventListener('click', function () { if (S.timer && !S.timer.pauseAt) { S.timer.pauseAt = Date.now(); save(); tick(); } });
    $('#tDone').addEventListener('click', function () {
      var r = finishTimer(); if (!r) return;
      var diff = r.act - r.est;
      $('#tNote').textContent = T('Estimated ' + r.est + ' min, took ' + r.act + ' min', '估计 ' + r.est + ' 分钟，实际 ' + r.act + ' 分钟') + ' (' + (diff === 0 ? '✓' : (diff > 0 ? '+' : '') + diff) + '). ' +
        (Math.abs(diff) <= Math.max(3, r.est * .15) ? T('Great estimate!', '估得很准！') : diff > 0 ? T('Next time add a little buffer — or cut the task smaller.', '下次多留一点余量，或把任务切小一些。') : T('Faster than you thought — you can plan a bit more.', '比你想的快，可以多安排一点。'));
      beeped = false; tick(); drawSpeed();
    });
    setInterval(tick, 1000); tick();

    // test countdown
    var tu = $('#testUnits');
    tu.innerHTML = PC.units.map(function (u) { return '<label><input type="checkbox" value="' + u.id + '"' + ((S.test.units || []).indexOf(u.id) >= 0 ? ' checked' : '') + '> ' + u.emoji + ' ' + esc(T(u.title.en, u.title.zh)) + '</label>'; }).join('');
    if (S.test.date) $('#testDate').value = S.test.date;
    if (S.test.daily) $('#testDaily').value = S.test.daily;
    function drawTest() {
      S.test = { date: $('#testDate').value, daily: +$('#testDaily').value || 45, units: $$('input:checked', tu).map(function (i) { return i.value; }) }; save();
      var out = $('#testOut');
      if (!S.test.date || !S.test.units.length) { out.innerHTML = '<p class="muted">' + T('Pick the test date and the units it covers.', '选好考试日期和考试覆盖的单元。') + '</p>'; return; }
      var days = Math.ceil((new Date(S.test.date + 'T00:00') - today0()) / DAY);
      if (days < 1) { out.innerHTML = '<p class="warn">' + T('That date is today or past.', '这个日期是今天或已经过去。') + '</p>'; return; }
      var f = speed().f, W = { 0: 1, 1: .6, 2: .35, 3: .1 };
      var list = [];
      PC.units.forEach(function (u) { if (S.test.units.indexOf(u.id) < 0) return; u.topics.forEach(function (id) { var t = PC.topics[id]; list.push({ id: id, ess: t.essential, need: Math.max(5, Math.round((t.budget || t.minutes) * W[lvl(id)] * f)) }); }); });
      var exam = 45;
      var need = list.reduce(function (a, b) { return a + b.need; }, 0) + exam;
      var cap = Math.max(0, days - 1) * S.test.daily;
      var pick = list, msg;
      if (need <= cap) msg = '<p class="okmsg">✅ ' + T('It fits: about ' + need + ' min of work, ' + cap + ' min available before the last day. The last day is for a mock exam and rest.', '装得下：约 ' + need + ' 分钟的活，最后一天之前有 ' + cap + ' 分钟。最后一天做模拟题、休息。') + '</p>';
      else {
        pick = list.filter(function (x) { return x.ess; });
        var need2 = pick.reduce(function (a, b) { return a + b.need; }, 0) + exam;
        msg = '<p class="warn">⚠️ ' + T('Everything needs ~' + need + ' min but you have ' + cap + ' min. Plan below keeps only ★ essential topics (~' + need2 + ' min).', '全部做完要约 ' + need + ' 分钟，你只有 ' + cap + ' 分钟。下面的计划只保留 ★ 必会内容（约 ' + need2 + ' 分钟）。') +
          (need2 > cap ? ' ' + T('Still too much: raise your daily minutes to ' + Math.ceil(need2 / Math.max(1, days - 1)) + ', or ask your teacher which topics matter most.', '还是太多：把每天时间提到 ' + Math.ceil(need2 / Math.max(1, days - 1)) + ' 分钟，或请老师指出最重要的部分。') : '') + '</p>';
      }
      var sched = [], d = 0, used = 0, daily = S.test.daily;
      pick.forEach(function (x) { if (used + x.need > daily && used > 0) { d++; used = 0; } if (d >= days - 1) return; (sched[d] = sched[d] || []).push(x); used += x.need; });
      var rows = sched.map(function (arr, i) { var dt = new Date(today0() + i * DAY); return '<tr><td>' + dt.toLocaleDateString(lang() === 'en' ? 'en-CA' : 'zh-CN', { weekday: 'short', month: 'short', day: 'numeric' }) + '</td><td>' + arr.map(function (x) { return '<a href="topic-' + x.id + '.html">' + esc(tt(x.id)) + '</a> <span class="muted small">' + x.need + '′</span>'; }).join('<br>') + '</td></tr>'; }).join('');
      var last = new Date(new Date(S.test.date + 'T00:00') - DAY);
      rows += '<tr><td>' + last.toLocaleDateString(lang() === 'en' ? 'en-CA' : 'zh-CN', { weekday: 'short', month: 'short', day: 'numeric' }) + '</td><td>📝 <a href="exams.html">' + T('Mock exam, then rest early', '做一套模拟题，然后早点休息') + '</a></td></tr>';
      out.innerHTML = msg + '<table class="log"><tr><th>' + T('Day', '日期') + '</th><th>' + T('Do', '做什么') + '</th></tr>' + rows + '</table>';
    }
    ['#testDate', '#testDaily'].forEach(function (s) { $(s).addEventListener('change', drawTest); });
    tu.addEventListener('change', drawTest);
    drawTest(); rerenders.push(drawTest);

    function drawSpeed() {
      var sp = speed();
      $('#speedOut').innerHTML = sp.n >= 3 ? T('You usually take <b>×' + sp.f.toFixed(2) + '</b> of your estimate. ', '你的实际用时通常是估计的 <b>×' + sp.f.toFixed(2) + '</b>。') + (sp.f > 1.25 ? T('Plans now include this extra time.', '计划已经把这部分多出的时间算进去了。') : sp.f < .85 ? T('You are faster than you think!', '你比自己想的快！') : T('Your estimates are accurate.', '你的估计很准。'))
        : T('Finish 3 timed blocks to see your real speed.', '完成 3 段计时，就能看到你的真实速度。');
      var days = []; for (var i = 6; i >= 0; i--) days.push(today0() - i * DAY);
      var tot = days.map(function (d) { return S.log.filter(function (l) { return l.d === d; }).reduce(function (a, l) { return a + l.act; }, 0); });
      var mx = Math.max.apply(null, tot.concat([30]));
      var bars = '<div class="bars">' + tot.map(function (v, i) { return '<div style="height:' + Math.round(100 * v / mx) + '%" title="' + v + ' min"><span>' + new Date(days[i]).toLocaleDateString(lang() === 'en' ? 'en-CA' : 'zh-CN', { weekday: 'short' }) + ' ' + v + '′</span></div>'; }).join('') + '</div><br>';
      var last = S.log.slice(-8).reverse().map(function (l) { return '<tr><td>' + new Date(l.ts).toLocaleDateString() + '</td><td>' + esc(l.label) + '</td><td>' + l.est + '′ → ' + l.act + '′</td></tr>'; }).join('');
      $('#logOut').innerHTML = S.log.length ? bars + '<table class="log">' + last + '</table>' : '';
    }
    drawSpeed(); rerenders.push(drawSpeed);
  }

  /* ---------- flashcards ---------- */
  var deck = $('#deck');
  if (deck) {
    var BOX = [0, 1, 2, 4, 8, 16, 30];
    var dsel = $('#deckUnit');
    var qp = new URLSearchParams(location.search);
    if (qp.get('unit')) dsel.value = qp.get('unit');
    var queue = [], cur = null;
    function pool() {
      var v = dsel.value;
      if (v === 'all') return PC.cards.slice();
      if (v === 'due') {
        var d = PC.cards.filter(function (c) { var s = S.c[c.id]; return s && s.due <= Date.now(); });
        var fresh = PC.cards.filter(function (c) { return !S.c[c.id] && lvl(c.topic) >= 1; }).slice(0, Math.max(0, 20 - d.length));
        var out = d.concat(fresh);
        return out.length ? out : PC.cards.filter(function (c) { return !S.c[c.id]; }).slice(0, 10);
      }
      return PC.cards.filter(function (c) { return c.unit === v; });
    }
    function load() { queue = pool().sort(function () { return Math.random() - .5; }); nextCard(); }
    function nextCard() {
      cur = queue.shift();
      $('#deckCount').textContent = cur ? (queue.length + 1) + ' ' + T('left', '张待做') : '';
      $('#deckBtns').hidden = true;
      if (!cur) { deck.innerHTML = '<div class="bigcard"><div>🎉 ' + T('Done for now!', '这一轮完成了！') + '<br><span class="muted small">' + T('Come back tomorrow — short and often wins.', '明天再来——少量多次最有效。') + '</span></div></div>'; return; }
      deck.innerHTML = '<button class="bigcard"><div><span class="tag">' + esc(tt(cur.topic)) + '</span>' + cur.f + '</div></button>';
      $('.bigcard', deck).addEventListener('click', function () {
        var b = this; b.classList.toggle('on');
        b.firstChild.innerHTML = '<span class="tag">' + esc(tt(cur.topic)) + '</span>' + (b.classList.contains('on') ? cur.b : cur.f);
        $('#deckBtns').hidden = false;
      });
    }
    $$('#deckBtns button').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!cur) return;
        var s = S.c[cur.id] || { box: 0 }, g = +b.dataset.grade;
        s.box = g === 2 ? Math.min(s.box + 1, BOX.length - 1) : g === 1 ? Math.max(1, s.box) : 0;
        s.due = today0() + BOX[s.box] * DAY;
        S.c[cur.id] = s; save();
        if (g === 0) queue.splice(Math.min(3, queue.length), 0, cur);
        nextCard();
      });
    });
    dsel.addEventListener('change', load);
    load();
    $('#printCards').addEventListener('click', function () {
      var cards = pool();
      $('#printSheet').innerHTML = cards.map(function (c) { return '<div class="pc"><span class="tag">' + esc(tt(c.topic)) + '</span>' + c.f + '</div><div class="pc">' + c.b + '</div>'; }).join('');
      window.print();
    });
  }

  /* ---------- exams ---------- */
  var examEl = $('.exam[data-exam]');
  if (examEl) {
    var eid = examEl.dataset.exam, mins = +examEl.dataset.minutes, ek = 'pc11.exam.' + eid;
    var es; try { es = JSON.parse(localStorage.getItem(ek) || '{}'); } catch (e) { es = {}; }
    es.ans = es.ans || {}; es.score = es.score || {};
    function esave() { try { localStorage.setItem(ek, JSON.stringify(es)); } catch (e) {} }
    var eclock = $('#eClock');
    function etick() {
      if (!es.start || es.done) { eclock.textContent = es.done ? '🏁' : mins + ':00'; return; }
      var left = mins * 60 - (Date.now() - es.start) / 1000;
      eclock.textContent = fmt(left); eclock.style.color = left < 300 ? 'var(--mid)' : '';
    }
    $('#eStart').addEventListener('click', function () { if (!es.start) { es.start = Date.now(); esave(); } etick(); });
    $$('.eq').forEach(function (q) {
      var n = q.dataset.q;
      $$('.exam-ch button', q).forEach(function (b) {
        b.addEventListener('click', function () {
          if (es.done) return;
          $$('.exam-ch button', q).forEach(function (x) { x.classList.toggle('on', x === b); x.style.outline = x === b ? '3px solid var(--accent)' : ''; });
          es.ans[n] = +b.dataset.c; esave();
        });
        if (es.ans[n] === +b.dataset.c) b.style.outline = '3px solid var(--accent)';
      });
      $$('[data-score]', q).forEach(function (b) { b.addEventListener('click', function () { es.score[n] = +b.dataset.score; esave(); paintScore(); }); });
      es.txt = es.txt || {};
      var fl = $('.exam-fill', q), ta = $('.exam-text', q), fw = null;
      if (fl) { fw = wireFill(fl, function () {}); fw.input.value = es.txt[n] || ''; fw.input.addEventListener('input', function () { es.txt[n] = fw.input.value; esave(); }); q._fw = fw; }
      if (ta) { ta.value = es.txt[n] || ''; ta.addEventListener('input', function () { es.txt[n] = ta.value; esave(); }); }
      var qc = $('.qcheck', q);
      if (qc) qc.addEventListener('click', function () { revealQ(q); paintScore(); });
    });
    function revealQ(q) {
      var n = q.dataset.q; $('.esolwrap', q).hidden = false; q.classList.add('checked');
      if (q.dataset.mc === '1') {
        $$('.exam-ch button', q).forEach(function (b) { if (b.dataset.ok === '1') b.classList.add('right'); else if (es.ans[n] === +b.dataset.c) b.classList.add('wrong'); });
        es.score[n] = $$('.exam-ch button', q).some(function (b) { return b.dataset.ok === '1' && es.ans[n] === +b.dataset.c; }) ? 1 : 0; $('.self', q).hidden = true;
      } else if (q._fw) { var ok = q._fw.check(); if (ok !== null) q._fw.show(); es.score[n] = ok ? 1 : 0; $('.self', q).hidden = true; }
      esave();
    }
    function finish() {
      es.done = es.done || Date.now(); esave();
      examEl.classList.add('finished');
      $$('.esolwrap').forEach(function (w) { w.hidden = false; });
      $$('.eq').forEach(function (q) { if (q.dataset.mc === '1' || q._fw) revealQ(q); });
      esave(); paintScore();
    }
    function paintScore() {
      var got = 0, max = 0, miss = {};
      $$('.eq').forEach(function (q) {
        var n = q.dataset.q, mk = +q.dataset.marks; max += mk;
        var sc = es.score[n]; $$('[data-score]', q).forEach(function (b) { b.classList.toggle('on', +b.dataset.score === sc); });
        if (sc !== undefined) got += sc * mk;
        if (sc === undefined || sc < 1) miss[q.dataset.topic] = 1;
      });
      if (!es.done) return;
      var r = $('#eResult'); r.hidden = false;
      var pct = Math.round(100 * got / max);
      var used = Math.round((es.done - (es.start || es.done)) / 60000);
      r.innerHTML = '<h2>🏁 ' + T('Result', '成绩') + ': ' + got + ' / ' + max + ' (' + pct + '%)</h2>' +
        (es.start ? '<p class="muted">' + T('Time used: ' + used + ' of ' + mins + ' min', '用时 ' + used + ' / ' + mins + ' 分钟') + '</p>' : '') +
        '<p>' + T('Mark the written questions yourself — the score updates. Review these topics:', '解答题请自己评分，成绩会自动更新。需要复习的知识点：') + '</p><p>' +
        Object.keys(miss).filter(function (t) { return PC.topics[t]; }).map(function (t) { return '<a class="chip" href="topic-' + t + '.html">' + esc(tt(t)) + '</a>'; }).join(' ') + '</p>' +
        '<button class="ghost" id="eReset">↺ ' + T('Reset and retake', '清空重做') + '</button>';
      S.ex[eid] = { score: got, max: max, at: es.done };
      if (!es.logged) {
        $$('.eq').forEach(function (q) { var sc = es.score[q.dataset.q]; if (sc === undefined) return;
          var k = 'exam:' + eid + ':' + q.dataset.q;
          PC.q[k] = { t: q.dataset.topic, l: +q.dataset.level || 3, s: (q.dataset.skills || '').split(',').filter(Boolean) };
          S.h.push({ q: k, v: sc * 2, ts: Date.now(), meta: PC.q[k] }); });
        es.logged = Object.keys(es.score).length >= $$('.eq').length; esave();
      }
      save();
      $('#eReset').addEventListener('click', function () { localStorage.removeItem(ek); location.reload(); });
    }
    $('#eFinish').addEventListener('click', function () { finish(); $('#eResult').scrollIntoView(); });
    if (es.done) finish();
    setInterval(etick, 1000); etick();
  }
  $$('.ex-score[data-exam]').forEach(function (el) { var e = S.ex[el.dataset.exam]; if (e) el.textContent = '✓ ' + e.score + '/' + e.max; });


  /* ---------- decks: lesson slides + one question per page ---------- */
  function fetchDecks(ids) { return Promise.all(ids.map(function (u) { return fetch('deck/' + u + '.json').then(function (r) { return r.json(); }); })); }
  function weakTopics() { return PC.order.filter(function (id) { return PC.topics[id].ready && (lvl(id) <= 1 && (S.m[id] || S.dg[id]) || (S.dg[id] && S.dg[id].score < 1) || due(id) || Object.keys(S.f).some(function (k) { return S.f[k] && k.split(/[:.]/)[0] === id; })); }); }
  function recordQ(id, v) { S.p[id] = v; S.h.push({ q: id, v: v, ts: Date.now() }); if (S.h.length > 3000) S.h = S.h.slice(-3000); save(); }
  var track = $('#dkTrack');
  if (track) {
    var qs0 = new URLSearchParams(location.search);
    var mode = qs0.get('mode') || 'learn', items = [], cur = 0, streak = 0, done = 0, right = 0;
    var uSel = $('#dkUnit'), fSel = $('#dkFilter');
    if (qs0.get('unit')) uSel.value = qs0.get('unit');
    if (qs0.get('filter')) fSel.value = qs0.get('filter');
    var onlyTopic = qs0.get('topic');
    $$('.seg2 button').forEach(function (b) { b.classList.toggle('on', b.dataset.mode === mode); b.addEventListener('click', function () { mode = b.dataset.mode; $$('.seg2 button').forEach(function (x) { x.classList.toggle('on', x === b); }); loadDeck(); }); });
    uSel.addEventListener('change', function () { onlyTopic = null; loadDeck(); }); fSel.addEventListener('change', loadDeck);
    function loadDeck() {
      var v = uSel.value, weak = v === 'weak' ? weakTopics() : null;
      var ids = onlyTopic ? [PC.topics[onlyTopic].unit] : v === 'all' || v === 'weak' ? PC.units.map(function (u) { return u.id; }) : [v];
      track.innerHTML = '<div class="slide"><div class="s-card loading">…</div></div>';
      fetchDecks(ids).then(function (ds) {
        var all = []; ds.forEach(function (d) { all = all.concat(mode === 'learn' ? d.learn : d.quiz); });
        if (onlyTopic) all = all.filter(function (x) { return x.t === onlyTopic; });
        if (weak) all = all.filter(function (x) { return weak.indexOf(x.t) >= 0 || S.f[x.id]; });
        var f = fSel.value;
        if (f === 'flag') all = all.filter(function (x) { return S.f[x.id] || (mode === 'learn' && S.f[x.t + ':any']); });
        if (f === 'miss') all = all.filter(function (x) { return mode === 'quiz' ? S.p[x.id] !== undefined && S.p[x.id] < 2 : Object.keys(S.p).some(function (k) { return k.indexOf(x.t + '.p') === 0 && S.p[k] < 2; }); });
        if (f === 'hard') all = all.filter(function (x) { return mode === 'learn' ? x.k === 'hard' : x.l >= 3; });
        items = all; cur = 0; streak = 0; done = 0; right = 0; render();
      }).catch(function () { track.innerHTML = '<div class="slide"><div class="s-card">' + T('Could not load — check the connection once; afterwards it works offline.', '加载失败——请先联网打开一次，之后可离线使用。') + '</div></div>'; });
    }
    function empty() {
      var msg = uSel.value === 'weak' ? T('Nothing to show yet. Take the 🩺 Check-up, flag slides 🚩, or rate topics — your personal deck builds itself from that.', '暂时没有内容。做一次 🩺 测评、给幻灯标记 🚩、或给知识点打掌握度——专属卡组就会自动生成。') : T('No slides match this filter.', '没有符合筛选的内容。');
      return '<div class="slide"><div class="s-card center"><div class="s-big">🐾</div><p>' + msg + '</p><a class="primary" href="check.html">🩺 ' + T('Check-up', '去测评') + '</a></div></div>';
    }
    function quizHTML(x, i) {
      var lv = '<span class="lv l' + x.l + '">L' + x.l + ' ' + esc(T(PC.levels[x.l].en, PC.levels[x.l].zh)) + '</span>';
      var sk = x.s.map(function (c) { return PC.abil[c] ? '<span class="sk">' + PC.abil[c].e + ' ' + esc(T(PC.abil[c].n.en, PC.abil[c].n.zh)) + '</span>' : ''; }).join('');
      var fill = !x.c && (x.acc || x.num);
      var ch = x.c ? '<div class="choices s-choices">' + x.c.map(function (c, j) { return '<button data-j="' + j + '">' + 'ABCD'[j] + '. ' + c + '</button>'; }).join('') + '</div>'
        : fill ? '<div class="fill" data-accept="' + esc(JSON.stringify(x.acc || [])) + '" data-num="' + esc(JSON.stringify(x.num || [])) + '"><input type="text" autocomplete="off" autocapitalize="off" placeholder="' + T('Your answer', '你的答案') + '"><button class="primary">' + T('Check', '提交') + '</button><span class="fill-res"></span></div>'
        : '<button class="primary s-reveal">' + T('Show answer', '看答案') + '</button>';
      var self = (x.c || fill) ? '' : '<div class="self">' + T('How did it go?', '做得怎样？') + '<button data-self="2">✓</button><button data-self="1">〜</button><button data-self="0">✗</button></div>';
      return '<div class="s-card quiz" data-i="' + i + '"><div class="s-kicker">' + esc(tt(x.t)) + ' · ' + lv + sk + '</div>' + (x.goal ? '<div class="s-goal">🎯 ' + x.goal + '</div>' : '') +
        '<div class="s-q">' + x.q + '</div>' + ch + '<div class="s-sol" hidden><div class="answer">' + x.a + '</div>' + (x.sol ? '<ol class="steps">' + x.sol + '</ol>' : '') +
        (x.idea ? '<div class="s-idea">💡 ' + x.idea + '</div>' : '') + self + '</div></div>';
    }
    function render() {
      if (!items.length) { track.innerHTML = empty(); update(); return; }
      track.innerHTML = items.map(function (x, i) { return '<div class="slide" data-i="' + i + '">' + (mode === 'learn' ? '<div class="s-card k-' + x.k + '">' + x.h + '</div>' : quizHTML(x, i)) + '</div>'; }).join('') +
        '<div class="slide end"><div class="s-card center" id="dkEnd"></div></div>';
      $$('.s-card.quiz', track).forEach(function (card) {
        var x = items[+card.dataset.i];
        $$('.s-choices button', card).forEach(function (b) {
          b.addEventListener('click', function () {
            if (card.classList.contains('answered')) return; card.classList.add('answered');
            var ok = +b.dataset.j === x.ok;
            $$('.s-choices button', card).forEach(function (y) { if (+y.dataset.j === x.ok) y.classList.add('right'); });
            if (!ok) b.classList.add('wrong');
            $('.s-sol', card).hidden = false; score(card, x, ok ? 2 : 0);
          });
        });
        var fl = $('.fill', card); if (fl) wireFill(fl, function (ok) { if (card.classList.contains('answered')) return; card.classList.add('answered'); $('.s-sol', card).hidden = false; score(card, x, ok ? 2 : 0); });
        var rv = $('.s-reveal', card); if (rv) rv.addEventListener('click', function () { $('.s-sol', card).hidden = false; rv.hidden = true; });
        $$('[data-self]', card).forEach(function (b) { b.addEventListener('click', function () { if (card.classList.contains('answered')) return; card.classList.add('answered'); b.classList.add('on'); score(card, x, +b.dataset.self); }); });
      });
      track.scrollLeft = 0; cur = 0; update();
    }
    function score(card, x, v) {
      recordQ(x.id, v); done++;
      if (v === 2) { right++; streak++; burst(card); } else streak = 0;
      update();
    }
    function burst(card) { var b = document.createElement('div'); b.className = 'burst'; b.textContent = ['🎉', '✨', '🌟', '💪', '🐱'][Math.floor(Math.random() * 5)]; card.appendChild(b); setTimeout(function () { b.remove(); }, 1100); }
    function update() {
      var n = items.length, x = items[cur];
      $('#dkBar').style.width = n ? Math.round(100 * Math.min(cur + 1, n) / n) + '%' : '0';
      $('#dkCount').textContent = n ? Math.min(cur + 1, n) + ' / ' + n : '';
      $('#dkStreak').textContent = mode === 'quiz' && done ? '✅ ' + right + '/' + done + (streak >= 2 ? '  🔥 ' + streak : '') : '';
      var fb = $('#dkFlag'); fb.disabled = !x; fb.classList.toggle('on', !!(x && S.f[x.id]));
      var op = $('#dkOpen'); if (x) op.href = x.link; op.style.visibility = x ? 'visible' : 'hidden';
      var end = $('#dkEnd');
      if (end) end.innerHTML = '<div class="s-big">' + (mode === 'quiz' && done ? '🏆' : '🐾') + '</div><h3>' + (mode === 'quiz' && done ? T('You solved ' + right + ' of ' + done + '!', '答对 ' + right + ' / ' + done + ' 题！') : T('End of the deck', '这一组看完了')) + '</h3>' +
        '<p>' + T('Flagged slides: ' + items.filter(function (y) { return S.f[y.id]; }).length + '. Choose "🚩 Flagged only" to go over just those.', '标记了 ' + items.filter(function (y) { return S.f[y.id]; }).length + ' 张。选「🚩 只看标记」就只复习这些。') + '</p>' +
        '<div class="row center"><button class="primary" id="dkAgain">↺ ' + T('Again', '再来一遍') + '</button><a class="btn" href="progress.html">📈 ' + T('My progress', '我的进度') + '</a></div>';
      var ag = $('#dkAgain'); if (ag) ag.onclick = function () { track.scrollTo({ left: 0, behavior: 'smooth' }); };
    }
    track.addEventListener('scroll', function () { var i = Math.round(track.scrollLeft / track.clientWidth); if (i !== cur) { cur = Math.min(i, items.length); update(); } }, { passive: true });
    function go(d) { track.scrollTo({ left: (cur + d) * track.clientWidth, behavior: 'smooth' }); }
    $('#dkPrev').addEventListener('click', function () { go(-1); }); $('#dkNext').addEventListener('click', function () { go(1); });
    document.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); });
    $('#dkFlag').addEventListener('click', function () { var x = items[cur]; if (!x) return; if (S.f[x.id]) delete S.f[x.id]; else S.f[x.id] = Date.now(); save(); update(); });
    rerenders.push(function () { if (items.length) render(); });
    loadDeck();
  }

  /* ---------- check-up (diagnostic) ---------- */
  if ($('#ckSetup')) {
    var boxes = $$('#ckSetup .ck-units input');
    function est() { var n = boxes.filter(function (b) { return b.checked; }).reduce(function (a, b) { return a + PC.units.filter(function (u) { return u.id === b.value; })[0].topics.length; }, 0) * ($('#ckQuick').checked ? 1 : 2);
      $('#ckEst').textContent = T(n + ' questions · about ' + Math.ceil(n * 1.5) + ' min', n + ' 题 · 约 ' + Math.ceil(n * 1.5) + ' 分钟'); return n; }
    boxes.concat([$('#ckQuick')]).forEach(function (b) { b.addEventListener('change', est); }); est();
    $('#ckAll').onclick = function () { boxes.forEach(function (b) { b.checked = true; }); est(); };
    $('#ckNone').onclick = function () { boxes.forEach(function (b) { b.checked = false; }); est(); };
    var cq = [], ci = 0, ans = {}, t0;
    $('#ckGo').addEventListener('click', function () {
      var us = boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; }); if (!us.length) return;
      fetchDecks(us).then(function (ds) {
        cq = []; ds.forEach(function (d) { cq = cq.concat(d.diag.filter(function (q) { return !$('#ckQuick').checked || /\.d1$/.test(q.id); })); });
        if (!cq.length) { $('#ckEst').textContent = T('Diagnostic questions are still being written for these units.', '这些单元的测评题还在编写中。'); return; }
        ci = 0; ans = {}; t0 = Date.now(); $('#ckSetup').hidden = true; $('#ckRun').hidden = false; showQ();
      });
    });
    function showQ() {
      if (ci >= cq.length) return finish();
      var x = cq[ci];
      $('#ckBar').style.width = Math.round(100 * ci / cq.length) + '%'; $('#ckCount').textContent = (ci + 1) + ' / ' + cq.length;
      $('#ckCard').innerHTML = '<div class="s-card quiz"><div class="s-kicker">' + esc(tt(x.t)) + ' · <span class="lv l' + x.l + '">L' + x.l + '</span></div><div class="s-q">' + x.q + '</div><div class="choices s-choices">' +
        x.c.map(function (c, j) { return '<button data-j="' + j + '">' + 'ABCD'[j] + '. ' + c + '</button>'; }).join('') + '</div></div>';
      $$('#ckCard .s-choices button').forEach(function (b) { b.addEventListener('click', function () { b.classList.add('chosen'); ans[x.id] = +b.dataset.j; ci++; setTimeout(showQ, 250); }); });
    }
    $('#ckSkip').onclick = function () { ans[cq[ci].id] = -1; ci++; showQ(); };
    $('#ckEnd').onclick = finish;
    function finish() {
      $('#ckRun').hidden = true;
      var per = {}, ab = {}, mis = [];
      cq.forEach(function (x) {
        if (!(x.id in ans)) return;
        var ok = ans[x.id] === x.ok; per[x.t] = per[x.t] || { n: 0, s: 0 }; per[x.t].n++; per[x.t].s += ok ? 1 : 0;
        x.s.forEach(function (c) { ab[c] = ab[c] || { n: 0, s: 0 }; ab[c].n++; ab[c].s += ok ? 1 : 0; });
        recordQ(x.id, ok ? 2 : 0);
        if (!ok && ans[x.id] >= 0 && x.why) mis.push({ t: x.t, w: x.why[ans[x.id]] });
        if (!ok && ans[x.id] < 0) mis.push({ t: x.t, w: '<span>' + T('Skipped — not sure yet.', '跳过——还没把握。') + '</span>' });
      });
      var tot = 0, got = 0;
      Object.keys(per).forEach(function (t) { var r = per[t].s / per[t].n; tot++; got += r;
        S.dg[t] = { score: r, at: Date.now() };
        var L = lvl(t); if (r === 1 && L < 2) setMastery(t, 2); else if (r === 0 && L >= 2) setMastery(t, 1); else if (r === 0 && !S.m[t]) setMastery(t, 1); });
      var pct = tot ? Math.round(100 * got / tot) : 0;
      S.ck.push({ at: Date.now(), pct: pct, n: Object.keys(ans).length, min: Math.round((Date.now() - t0) / 60000) }); save();
      var cell = function (t) { var r = per[t]; var c = !r ? 'nt' : r.s / r.n === 1 ? 'g' : r.s ? 'a' : 'r'; return '<a class="tc ' + c + '" href="topic-' + t + '.html">' + esc(tt(t)) + '</a>'; };
      var weak = PC.order.filter(function (t) { return per[t] && per[t].s < per[t].n; });
      var plan = weak.slice(0, 6).map(function (t, i) { return '<div class="pblock"><span class="pm">' + (i + 1) + '</span><span>' + esc(tt(t)) + '</span><span class="row" style="margin:0"><a class="go" href="slides.html?topic=' + t + '">🎴</a><a class="go" href="topic-' + t + '.html">📖</a><a class="go" href="slides.html?topic=' + t + '&mode=quiz">🎯</a></span></div>'; }).join('');
      var r = $('#ckResult'); r.hidden = false;
      r.innerHTML = '<section class="card result-hero"><div class="donut" style="--p:' + pct + '"><b>' + pct + '%</b></div><div><h2>' + T('Your mastery map', '你的掌握地图') + '</h2><p class="muted">' +
        T(Object.keys(ans).length + ' questions · ' + Math.round((Date.now() - t0) / 60000) + ' min. Green = solid, amber = half, red = needs work. Your topic colours on the map were updated.', Object.keys(ans).length + ' 题 · ' + Math.round((Date.now() - t0) / 60000) + ' 分钟。绿＝扎实，橙＝一半，红＝要加强。图谱上的颜色已同步更新。') + '</p></div></section>' +
        '<section class="card"><h2>📚 ' + T('Topics', '知识点') + '</h2>' + PC.units.map(function (u) { var ts = u.topics.filter(function (t) { return per[t]; }); return ts.length ? '<div class="tcu"><b>' + u.emoji + ' ' + esc(T(u.title.en, u.title.zh)) + '</b><div class="tcs">' + ts.map(cell).join('') + '</div></div>' : ''; }).join('') + '</section>' +
        '<section class="card"><h2>💪 ' + T('Abilities', '能力') + '</h2>' + Object.keys(PC.abil).filter(function (c) { return ab[c]; }).map(function (c) { var a = ab[c], p = Math.round(100 * a.s / a.n); return '<div class="pbar"><span>' + PC.abil[c].e + ' ' + esc(T(PC.abil[c].n.en, PC.abil[c].n.zh)) + '</span><div class="track"><i style="width:' + p + '%;background:' + (p >= 80 ? 'var(--good)' : p >= 50 ? 'var(--mid)' : 'var(--bad)') + '"></i></div><b>' + p + '%</b><span class="muted small">' + a.n + '</span></div>'; }).join('') + '</section>' +
        (mis.length ? '<section class="card"><h2>🔍 ' + T('What went wrong — exactly', '错在哪里——具体原因') + '</h2><ul class="mis">' + mis.map(function (m) { return '<li><a class="chip" href="topic-' + m.t + '.html">' + esc(tt(m.t)) + '</a>' + m.w + '</li>'; }).join('') + '</ul></section>' : '') +
        '<section class="card"><h2>🧭 ' + T('Your plan: start here', '你的计划：从这里开始') + '</h2><p class="muted small">' + T('In course order, so earlier gaps are fixed first. 🎴 slides · 📖 lesson · 🎯 one question per page.', '按课程顺序排，先补前面的缺口。🎴 幻灯 · 📖 讲解 · 🎯 一题一页。') + '</p>' + (plan || '<p>🎉 ' + T('Nothing to fix in these units!', '这些单元没有要补的！') + '</p>') +
        '<div class="row"><a class="primary" href="slides.html?unit=weak">💡 ' + T('Open my personal deck', '打开我的专属卡组') + '</a><a class="btn" href="check.html">↺ ' + T('New check-up', '再测一次') + '</a></div></section>';
      window.scrollTo({ top: 0 });
    }
    var h = $('#ckHist');
    if (S.ck.length) h.innerHTML = '<h2>🕘 ' + T('Past check-ups', '历次测评') + '</h2><table class="log">' + S.ck.slice(-8).reverse().map(function (c) { return '<tr><td>' + new Date(c.at).toLocaleDateString() + '</td><td>' + c.n + ' Q</td><td>' + c.min + ' min</td><td><b>' + c.pct + '%</b></td></tr>'; }).join('') + '</table>'; else h.hidden = true;
  }

  /* ---------- automatic study-time tracking: counts only while the page is visible and you touched it in the last 2 min ---------- */
  var lastAct = Date.now();
  ['touchstart', 'pointerdown', 'keydown', 'scroll'].forEach(function (ev) { window.addEventListener(ev, function () { lastAct = Date.now(); }, { passive: true }); });
  var where = topicEl ? topicEl.dataset.topic : examEl ? 'exam' : deck ? 'cards' : track ? 'slides' : $('#ckSetup') ? 'check' : 'other';
  setInterval(function () {
    if (document.hidden || Date.now() - lastAct > 120000) return;
    var d = String(today0()); S.t[d] = S.t[d] || {}; S.t[d][where] = (S.t[d][where] || 0) + 15; save();
  }, 15000);

  /* ---------- progress page ---------- */
  if ($('#pgStrategy')) {
    var Q = PC.q || {};
    function stats() {
      var last = {}; S.h.forEach(function (h) { last[h.q] = h; });
      var ab = {}, lv = {}, tp = {};
      Object.keys(last).forEach(function (k) {
        var h = last[k], m = Q[k] || h.meta; if (!m) return;
        var sc = h.v / 2;
        (m.s || []).forEach(function (c) { ab[c] = ab[c] || { n: 0, s: 0 }; ab[c].n++; ab[c].s += sc; });
        lv[m.l] = lv[m.l] || { n: 0, s: 0 }; lv[m.l].n++; lv[m.l].s += sc;
        tp[m.t] = tp[m.t] || { n: 0, s: 0, wrong: [] }; tp[m.t].n++; tp[m.t].s += sc; if (h.v < 2) tp[m.t].wrong.push(k);
      });
      return { last: last, ab: ab, lv: lv, tp: tp };
    }
    function bar(label, pct, n, href) {
      var col = pct >= 80 ? 'var(--good)' : pct >= 60 ? 'var(--mid)' : 'var(--bad)';
      return '<div class="pbar">' + (href ? '<a href="' + href + '">' + label + '</a>' : '<span>' + label + '</span>') + '<div class="track"><i style="width:' + pct + '%;background:' + col + '"></i></div><b>' + (n ? pct + '%' : '—') + '</b><span class="muted small">' + (n ? n + ' ' + T('Q', '题') : '') + '</span></div>';
    }
    function drawProgress() {
      var st = stats();
      // time
      var days = []; for (var i = 13; i >= 0; i--) days.push(today0() - i * DAY);
      var mins = days.map(function (d) { var o = S.t[String(d)] || {}; return Math.round(Object.keys(o).reduce(function (a, k) { return a + o[k]; }, 0) / 60); });
      var week = mins.slice(7).reduce(function (a, b) { return a + b; }, 0), prev = mins.slice(0, 7).reduce(function (a, b) { return a + b; }, 0);
      var mx = Math.max.apply(null, mins.concat([30]));
      $('#pgTime').innerHTML = '<p>' + T('This week: <b>' + week + ' min</b> (last week ' + prev + ' min).', '本周：<b>' + week + ' 分钟</b>（上周 ' + prev + ' 分钟）。') + '</p><div class="bars">' +
        mins.map(function (v, i) { return '<div style="height:' + Math.round(100 * v / mx) + '%"><span>' + new Date(days[i]).getDate() + '</span></div>'; }).join('') + '</div><br>';
      // abilities
      var codes = Object.keys(PC.abil);
      $('#pgAbil').innerHTML = codes.map(function (c) { var a = st.ab[c] || { n: 0, s: 0 }; var A = PC.abil[c]; return bar(A.e + ' ' + esc(T(A.n.en, A.n.zh)), a.n ? Math.round(100 * a.s / a.n) : 0, a.n); }).join('');
      $('#pgLevel').innerHTML = [1, 2, 3, 4].map(function (n) { var a = st.lv[n] || { n: 0, s: 0 }; var L = PC.levels[n]; return bar('L' + n + ' ' + esc(T(L.en, L.zh)), a.n ? Math.round(100 * a.s / a.n) : 0, a.n); }).join('');
      // topics
      var rows = PC.order.filter(function (id) { return st.tp[id] || lvl(id); }).map(function (id) { var a = st.tp[id] || { n: 0, s: 0 }; return { id: id, pct: a.n ? Math.round(100 * a.s / a.n) : 0, n: a.n }; })
        .sort(function (x, y) { return (x.n ? x.pct : 101) - (y.n ? y.pct : 101); });
      $('#pgTopics').innerHTML = rows.length ? rows.map(function (r) { return bar(esc(tt(r.id)) + (due(r.id) ? ' 🔁' : ''), r.pct, r.n, 'topic-' + r.id + '.html#pr'); }).join('') : '<p class="muted">' + T('Mark some practice questions to see this.', '给练习题打过分后这里就有数据。') + '</p>';
      // wrong list
      var wrong = Object.keys(st.last).filter(function (k) { return st.last[k].v < 2 && Q[k]; }).sort(function (a, b) { return st.last[b].ts - st.last[a].ts; });
      $('#pgWrong').innerHTML = wrong.length ? '<ul class="wlist">' + wrong.slice(0, 40).map(function (k) { var m = Q[k], n = k.split('.p')[1]; return '<li><a href="topic-' + m.t + '.html#pr">' + esc(tt(m.t)) + ' · ' + T('Q', '第') + n + T('', '题') + '</a> <span class="muted small">L' + m.l + ' ' + (m.s || []).map(function (c) { return PC.abil[c] ? PC.abil[c].e : ''; }).join('') + (st.last[k].v === 1 ? ' 〜' : ' ✗') + '</span></li>'; }).join('') + '</ul>' : '<p class="muted">' + T('No mistakes recorded yet.', '还没有错题记录。') + '</p>';
      // strategy
      var tips = [];
      var weakAb = codes.filter(function (c) { var a = st.ab[c]; return a && a.n >= 4 && a.s / a.n < 0.65; }).sort(function (a, b) { return st.ab[a].s / st.ab[a].n - st.ab[b].s / st.ab[b].n; });
      var ABTIP = {
        K: ['Re-read the Learn tab and do the flashcards for these topics before practising.', '先回到「讲解」和卡片，把概念弄清楚再做题。'],
        P: ['Slow down and write every step; redo 3 missed questions without looking, then check.', '放慢，每一步都写出来；把 3 道错题不看答案重做一遍，再对答案。'],
        R: ['Sketch a graph or number line for every question this week, even when not asked.', '这一周每道题都随手画个图象或数轴，即使题目没要求。'],
        M: ['Before solving, write one line: what the variable means and its units; at the end, answer in a sentence.', '动手前先写一行：变量代表什么、单位是什么；最后用一句话回答问题。'],
        S: ['For each question, name two possible methods first, then pick one and say why.', '每道题先说出两种可能的方法，再选一种并说出理由。'],
        V: ['Make checking a habit: substitute every answer back into the ORIGINAL equation and ask "is it reasonable?"', '养成检验习惯：每个答案代回原方程，并问一句「合理吗？」'],
        C: ['Use the knowledge map: open each missed topic\'s "Builds on" links and review those first.', '用知识图谱：打开错题知识点的「先会」链接，先把那些补上。'],
        T: ['Write solutions as if for someone else: full statements, units, and a final answer line.', '把解答写成给别人看的样子：完整句子、单位、最后一行写答案。']
      };
      weakAb.slice(0, 2).forEach(function (c) { tips.push('<b>' + PC.abil[c].e + ' ' + esc(T(PC.abil[c].n.en, PC.abil[c].n.zh)) + '</b> ' + Math.round(100 * st.ab[c].s / st.ab[c].n) + '% — ' + T(ABTIP[c][0], ABTIP[c][1])); });
      var l12 = [1, 2].reduce(function (a, n) { var x = st.lv[n]; return x ? { n: a.n + x.n, s: a.s + x.s } : a; }, { n: 0, s: 0 });
      var l34 = [3, 4].reduce(function (a, n) { var x = st.lv[n]; return x ? { n: a.n + x.n, s: a.s + x.s } : a; }, { n: 0, s: 0 });
      if (l12.n >= 5 && l12.s / l12.n < 0.7) tips.push(T('<b>Foundations first.</b> L1–L2 accuracy is ' + Math.round(100 * l12.s / l12.n) + '%. Spend the next sessions on Learn + L1/L2 practice; skip L4 for now.', '<b>先打基础。</b>L1–L2 正确率 ' + Math.round(100 * l12.s / l12.n) + '%。接下来几次学习先做讲解和 L1/L2 练习，L4 暂时跳过。'));
      else if (l12.n >= 5 && l34.n >= 3 && l34.s / l34.n < 0.6) tips.push(T('<b>Basics are solid — stretch.</b> Do one L3 question every day and one L4 at the weekend; read the "Other ways to think" box after each.', '<b>基础扎实，往上走。</b>每天做 1 道 L3，周末做 1 道 L4；每题做完读一读「不同的思考方式」。'));
      var worst = rows.filter(function (r) { return r.n >= 3 && r.pct < 60; }).slice(0, 3);
      if (worst.length) tips.push(T('<b>Re-teach these topics:</b> ', '<b>重学这几个知识点：</b>') + worst.map(function (r) { return '<a href="topic-' + r.id + '.html">' + esc(tt(r.id)) + '</a>'; }).join(' · ') + T(' — Learn tab, then the examples, then redo the missed questions.', '——先看讲解，再看例题，然后重做错题。'));
      var dt = dueTopics(); if (dt.length) tips.push(T('<b>Due for review:</b> ', '<b>到期复习：</b>') + dt.slice(0, 4).map(function (id) { return '<a href="topic-' + id + '.html#pr">' + esc(tt(id)) + '</a>'; }).join(' · '));
      var sp = speed(); if (sp.n >= 3 && sp.f > 1.3) tips.push(T('<b>Time:</b> you take ×' + sp.f.toFixed(1) + ' your estimate. Cut blocks smaller (15–20 min) and stop at "good enough".', '<b>时间：</b>实际用时是估计的 ×' + sp.f.toFixed(1) + '。把每段切小（15–20 分钟），到「够好」就停。'));
      if (week < 60 && week < prev) tips.push(T('<b>Rhythm:</b> less time than last week. Two 25-minute blocks on weekdays is enough to keep going.', '<b>节奏：</b>比上周少。工作日每天两段 25 分钟就够保持住。'));
      if (!tips.length) tips.push(T('Not enough data yet — do some practice and mark yourself honestly. The plan appears here.', '数据还不够——做些练习并如实打分，复习策略就会出现在这里。'));
      $('#pgStrategy').innerHTML = '<h2>🧠 ' + T('Your review strategy', '你的复习策略') + '</h2><ol class="strat">' + tips.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ol>';
    }
    drawProgress(); rerenders.push(drawProgress);
    $('#pgExport').addEventListener('click', function () {
      var dp = null; try { dp = JSON.parse(localStorage.getItem('pc11.deep') || 'null'); } catch (e) {}
      var qk = null; try { qk = JSON.parse(localStorage.getItem('pc11.quick.v1') || 'null'); } catch (e) {}
      var tbk = 'tb.v1.' + (PC.site || 'site'), tb = null; try { tb = JSON.parse(localStorage.getItem(tbk) || 'null'); } catch (e) {}   // time log, park-it list, tasks (web/timebox.js)
      var blob = new Blob([JSON.stringify({ app: 'pc11', at: Date.now(), state: S, deep: dp, quick: qk, tb: tb, lang: lang() })], { type: 'application/json' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'precalc11-progress-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
    });
    $('#pgImport').addEventListener('change', function () {
      var f = this.files[0]; if (!f) return;
      f.text().then(function (t) { var d = JSON.parse(t); if (d.app !== 'pc11') throw 0; S = d.state; save(); if (d.deep) try { localStorage.setItem('pc11.deep', JSON.stringify(d.deep)); } catch (e) {} if (d.quick) try { localStorage.setItem('pc11.quick.v1', JSON.stringify(d.quick)); } catch (e) {} if (d.tb) try { localStorage.setItem('tb.v1.' + (PC.site || 'site'), JSON.stringify(d.tb)); } catch (e) {} location.reload(); }).catch(function () { alert('Not a Pre-calc 11 backup file'); });
    });
  }

  applyLangAttrs();
  decorate();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () {});
})();
