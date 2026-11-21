/* Time sense (11-18): a study timer tied to each topic's course-level budget, the Park-it list, the task splitter and My time.
   Builder side: bin/timebox.py. State only in this browser: localStorage 'tb.v1.<site>' (included in the progress backup file).
   Calm by design: no red, no scores for time, notices are quiet text, nothing runs unless the student presses Start. */
(function () {
  'use strict';
  if (!window.PC) return;
  var KEY = 'tb.v1.' + (PC.site || 'site'), DAY = 86400000;
  var SPEED = 1; try { SPEED = +localStorage.getItem('tb.speed') || 1; } catch (e) {}   // tests only: accelerates the clock
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function lang() { return document.documentElement.dataset.lang || 'both'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function B(en, zh) { return '<span class="en" lang="en">' + en + '</span><span class="zh" lang="zh-Hans">' + zh + '</span>'; }   // html in, both languages out (CSS shows the right one)
  function P(en, zh) { return '<div class="bi"><span class="en" lang="en">' + en + '</span><span class="zh" lang="zh-Hans">' + zh + '</span></div>'; }
  function txt(o) { if (!o) return ''; if (typeof o === 'string') return o; var l = lang(); return l === 'zh' ? o.zh : l === 'en' ? o.en : o.en + ' · ' + o.zh; }
  function lab(o) { return typeof o === 'string' ? esc(o) : B(esc(o.en), esc(o.zh)); }
  function today0(t) { var d = new Date(t || Date.now()); d.setHours(0, 0, 0, 0); return +d; }
  function dstr(t, opt) { return new Date(t).toLocaleDateString(lang() === 'zh' ? 'zh-CN' : 'en-CA', opt || { month: 'short', day: 'numeric' }); }
  function mm(min) { return Math.round(min) + '′'; }
  function clock(sec) { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
  function title(tid) { var t = PC.topics[tid]; return t ? t.title : null; }

  /* ---------- state ---------- */
  var S;
  function load() { try { S = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { S = {}; } ['runs', 'parked', 'tasks'].forEach(function (k) { S[k] = S[k] || []; }); S.bars = S.bars || {}; S.v = 1; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} document.dispatchEvent(new CustomEvent('tb:change')); }
  load();
  window.addEventListener('storage', function (e) { if (e.key === KEY) { load(); paintAll(); } });
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  /* ---------- modal ---------- */
  function modal(html, wire) {
    close();
    var o = document.createElement('div'); o.className = 'tb-modal'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true');
    o.innerHTML = '<div class="tb-box">' + html + '</div>';
    document.body.appendChild(o);
    o.addEventListener('click', function (e) { if (e.target === o || e.target.closest('[data-tb-close]')) close(); });
    if (wire) wire(o);
    var f = $('input,textarea,button.primary', o); if (f) setTimeout(function () { f.focus(); }, 30);
    return o;
  }
  function close() { $$('.tb-modal').forEach(function (m) { m.remove(); }); }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  var toastT;
  function toast(html) {
    var t = $('#tbToast'); if (!t) { t = document.createElement('div'); t.id = 'tbToast'; t.className = 'tb-toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
    t.innerHTML = html; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 6000);
  }

  /* ---------- timer ---------- */
  function elapsed() { var r = S.run; if (!r) return 0; var now = r.pauseAt || Date.now(); return (now - r.start - r.paused) / 1000 * SPEED; }
  function begin(o) {   // o: {kind, topic, label, est, task, step}
    S.run = { kind: o.kind || 'topic', topic: o.topic || null, label: o.label, est: Math.max(1, +o.est || 25), task: o.task || null, step: o.step == null ? null : o.step,
              start: Date.now(), paused: 0, pauseAt: null, n50: false, n100: false };
    save(); dock(); tick();
  }
  function askStart(o) {
    if (S.run) { askStop(function () { askStart(o); }); return; }
    var bud = o.topic && PC.topics[o.topic] && PC.topics[o.topic].budget;
    modal('<h2>⏱️ ' + B('How long do you think you need?', '你觉得需要多久？') + '</h2>' +
      '<p class="tb-what">' + lab(o.label) + '</p>' +
      (bud ? '<p class="muted small">' + B('Course-level budget: about ' + bud + ' min. Your own guess is what counts.', '课程要求的预算：约 ' + bud + ' 分钟。以你自己的估计为准。') + '</p>' : '') +
      '<div class="row center"><label>' + B('My guess (min)', '我的估计（分钟）') + ' <input id="tbEst" type="number" min="1" max="240" inputmode="numeric" value="' + (o.est || bud || 25) + '"></label></div>' +
      '<p class="muted small">' + B('You will get a quiet note halfway and when the time is up. Nothing happens if you go over.', '过一半和到时间时，会有一条安静的提示。超时也不会怎样。') + '</p>' +
      '<div class="row center"><button type="button" class="primary" id="tbGo">▶ ' + B('Start', '开始') + '</button><button type="button" class="ghost" data-tb-close>' + B('Not now', '先不') + '</button></div>',
      function (m) {
        function go() { o.est = +$('#tbEst', m).value || o.est || bud || 25; close(); begin(o); }
        $('#tbGo', m).addEventListener('click', go);
        $('#tbEst', m).addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
      });
  }
  function barHTML(tid) {   // the topic's bar, cloned from the page when we are on it
    var card = tid && $('.tb-card[data-tb-topic="' + tid + '"]');
    if (!card) return tid ? '<p class="small"><a href="topic-' + tid + '.html#tb">' + B('Open this topic\'s "Enough when you can…" bar', '打开这个知识点的「能做到这些就够了」') + ' →</a></p>' : '';
    return '<ol class="tb-bar tb-bar-mini">' + $$('.tb-bar > li', card).map(function (li) { var s = $('label > span', li); return '<li>' + (s ? s.innerHTML : '') + '</li>'; }).join('') + '</ol>';
  }
  function askStop(after) {
    var r = S.run; if (!r) return;
    var act = elapsed() / 60;
    var step = r.kind === 'step';
    modal('<h2>⏹ ' + (step ? B('Is this step good enough?', '这一步够好了吗？') : B('Did you reach the bar?', '做到「够了」那一条了吗？')) + '</h2>' +
      '<p class="tb-what">' + lab(r.label) + ' · <b>' + mm(act) + '</b> / ' + mm(r.est) + '</p>' + (step ? '' : barHTML(r.topic)) +
      '<div class="row center tb-reach">' +
      '<button type="button" class="good" data-r="yes">✓ ' + (step ? B('Done', '完成') : B('Yes — moving on', '做到了——往下走')) + '</button>' +
      (step ? '' : '<button type="button" class="mid" data-r="part">◑ ' + B('Partly', '部分做到') + '</button>') +
      '<button type="button" class="ghost" data-r="no">○ ' + B('Not yet', '还没有') + '</button></div>' +
      '<p class="row center small"><button type="button" class="linkish" id="tbKeep">' + B('Keep going', '继续计时') + '</button></p>',
      function (m) {
        $$('[data-r]', m).forEach(function (b) { b.addEventListener('click', function () { var rec = finish(b.dataset.r); close(); summary(rec); if (after) after(); }); });
        $('#tbKeep', m).addEventListener('click', close);
      });
  }
  function finish(reached) {
    var r = S.run; if (!r) return null;
    var act = Math.round(elapsed() / 6) / 10;   // minutes, one decimal
    var rec = { id: uid(), kind: r.kind, topic: r.topic, label: r.label, est: r.est, act: Math.max(0.1, act), reached: reached, ts: Date.now(), d: today0() };
    if (r.task) {
      rec.task = r.task; rec.step = r.step;
      var t = S.tasks.filter(function (x) { return x.id === r.task; })[0];
      if (t && t.steps[r.step]) { t.steps[r.step].act = Math.round(((t.steps[r.step].act || 0) + rec.act) * 10) / 10; if (reached === 'yes') t.steps[r.step].done = true; }
    }
    S.runs.push(rec); if (S.runs.length > 1000) S.runs = S.runs.slice(-1000);
    S.run = null; save(); dock(); return rec;
  }
  function summary(rec) {
    if (!rec) return;
    var d = rec.act - rec.est, near = Math.abs(d) <= Math.max(2, rec.est * 0.15);
    var line = near ? B('Close to your guess.', '和估计很接近。')
      : d > 0 ? B('Longer than your guess — that happens to almost everyone. Next time guess a little more, or split the task smaller.', '比估计的久——几乎人人都这样。下次多估一点，或者把任务切小。')
      : B('Quicker than your guess — you can plan a little less next time.', '比估计的快——下次可以少估一点。');
    var next = rec.kind === 'step' ? nextStep(rec) : rec.reached === 'yes' ? B('Enough for this course. On to the next thing.', '对这门课够了。去做下一件事吧。')
      : rec.reached === 'part' ? B('Pick the one bar item that is not there yet; one short session tomorrow is plenty.', '挑出还没做到的那一条；明天再来一小段就够了。')
      : rec.reached === 'no' ? B('That is useful to know. Tomorrow: one short session, or mark a question for the teacher. Anything beyond the course can wait on the Park-it list.', '知道这一点很有用。明天：再来一小段，或者把一道题做个记号去问老师。超出课程的东西，放进「先存起来」清单等着。') : '';
    toast('<b>' + B('Guessed ' + mm(rec.est) + ', took ' + mm(rec.act) + '.', '估计 ' + mm(rec.est) + '，实际 ' + mm(rec.act) + '。') + '</b> ' + line + ' ' + next +
      ' <a href="mytime.html">' + B('My time', '我的时间') + ' →</a>');
  }
  function nextStep(rec) {   // after a task step: offer the next open step of the same task
    var t = S.tasks.filter(function (x) { return x.id === rec.task; })[0]; if (!t) return '';
    var i = -1; t.steps.forEach(function (s, k) { if (i < 0 && !s.done && k !== rec.step) i = k; });
    if (rec.reached !== 'yes' && t.steps[rec.step] && !t.steps[rec.step].done) i = rec.step;
    if (i < 0) return B('All steps done.', '所有步骤都完成了。');
    return B('Next', '下一步') + ': ' + esc(t.steps[i].t) + ' (' + t.steps[i].m + '′) <button type="button" class="tb-go" data-tb-next="' + t.id + ':' + i + '">▶ ' + B('Start', '开始') + '</button>';
  }
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-tb-next]'); if (!b) return; var a = b.dataset.tbNext.split(':'); $('#tbToast').classList.remove('on'); startStep(a[0], +a[1]); });
  function dock() {
    var d = $('#tbDock');
    if (!S.run) { if (d) d.remove(); document.body.classList.remove('tb-running'); return; }
    if (!d) {
      d = document.createElement('div'); d.id = 'tbDock'; d.className = 'tb-dock'; d.setAttribute('role', 'region'); d.setAttribute('aria-label', 'study timer');
      d.innerHTML = '<div class="tb-dl"><span class="tb-dlab"></span><span class="tb-dclock" aria-live="off"></span></div><div class="tb-dbar"><i></i></div>' +
        '<div class="tb-dmsg" aria-live="polite"></div><div class="tb-dbtn"><button type="button" class="ghost" data-act="pause"></button>' +
        '<button type="button" class="ghost" data-act="park">📌 ' + B('Park', '存想法') + '</button><button type="button" class="primary" data-act="stop">⏹ ' + B('Stop', '停') + '</button></div>';
      document.body.appendChild(d);
      d.addEventListener('click', function (e) {
        var b = e.target.closest('[data-act]'); if (!b) return;
        if (b.dataset.act === 'stop') askStop();
        else if (b.dataset.act === 'park') askPark(S.run && S.run.topic);
        else if (b.dataset.act === 'pause') { var r = S.run; if (!r) return; if (r.pauseAt) { r.paused += Date.now() - r.pauseAt; r.pauseAt = null; } else r.pauseAt = Date.now(); save(); tick(); }
      });
    }
    document.body.classList.add('tb-running');
    $('.tb-dlab', d).innerHTML = lab(S.run.label);
  }
  function tick() {
    var r = S.run, d = $('#tbDock'); if (!r || !d) return;
    var sec = elapsed(), f = sec / (r.est * 60);
    $('.tb-dclock', d).textContent = clock(sec) + ' / ' + r.est + ':00';
    $('.tb-dbar i', d).style.width = Math.min(100, f * 100) + '%';
    d.classList.toggle('tb-over', f >= 1);
    $('[data-act="pause"]', d).innerHTML = r.pauseAt ? '▶ ' + B('Resume', '继续') : '⏸ ' + B('Pause', '暂停');
    var msg = '';
    if (f >= 1) msg = B('Budget reached — check the bar. If you can do these, move on; park the rest.', '预算到了——对照「够了」那一条。能做到就往下走，其余的先存起来。');
    else if (f >= 0.5) msg = B('Halfway. A good moment to try one item on the bar.', '过一半了。正好试一试「够了」里的一条。');
    if ((f >= 0.5 && !r.n50) || (f >= 1 && !r.n100)) {   // quiet notice: the message appears in the dock and the dock glows twice (no sound, no pop-up)
      if (f >= 0.5) r.n50 = true; if (f >= 1) r.n100 = true; save();
      d.classList.remove('tb-flash'); void d.offsetWidth; d.classList.add('tb-flash');
    }
    $('.tb-dmsg', d).innerHTML = msg;
  }
  setInterval(tick, 1000);

  /* ---------- park it ---------- */
  function askPark(tid) {
    modal('<h2>📌 ' + B('Park a thought', '先存个想法') + '</h2>' +
      '<p class="muted small">' + B('Curious about something beyond the course? Write one line. It waits on your Park-it list.', '好奇的东西超出课程了？写一行，它会在「先存起来」清单里等你。') + '</p>' +
      (tid && title(tid) ? '<p class="tb-what">' + lab(title(tid)) + '</p>' : '') +
      '<textarea id="tbParkIn" rows="2" aria-label="thought"></textarea>' +
      '<div class="row center"><button type="button" class="primary" id="tbParkGo">📌 ' + B('Save', '保存') + '</button><button type="button" class="ghost" data-tb-close>' + B('Cancel', '取消') + '</button></div>',
      function (m) {
        $('#tbParkGo', m).addEventListener('click', function () {
          var v = $('#tbParkIn', m).value.trim(); if (!v) { $('#tbParkIn', m).focus(); return; }
          addPark(v, tid); close();
          toast(B('Parked. It will wait for you.', '存好了，它会等你。') + ' <a href="parked.html">' + B('Park-it list', '清单') + ' →</a>');
        });
      });
  }
  function addPark(text, tid) { S.parked.push({ id: uid(), text: text, topic: tid || null, ts: Date.now(), done: false }); save(); }

  /* ---------- buttons anywhere ---------- */
  document.addEventListener('click', function (e) {
    var s = e.target.closest('[data-tb-start]');
    if (s) {
      e.preventDefault();
      var tid = s.dataset.tbStart || null;
      var label = tid && title(tid) ? title(tid) : s.dataset.tbLabelEn ? { en: s.dataset.tbLabelEn, zh: s.dataset.tbLabelZh || s.dataset.tbLabelEn } : { en: 'Study session', zh: '学习一段' };
      askStart({ kind: tid ? 'topic' : 'free', topic: tid, label: label, est: +s.dataset.tbEst || null });
      return;
    }
    var p = e.target.closest('[data-tb-park]');
    if (p) { e.preventDefault(); askPark(p.dataset.tbPark || null); }
  });

  /* ---------- topic page: the bar's checkboxes ---------- */
  function paintBar() {
    $$('.tb-card').forEach(function (card) {
      var tid = card.dataset.tbTopic, st = S.bars[tid] || [], boxes = $$('.tb-chk', card);
      boxes.forEach(function (c, i) { c.checked = !!st[i]; });
      var all = boxes.length && boxes.every(function (c) { return c.checked; });
      card.classList.toggle('tb-all', !!all);
      var n = $('.tb-note', card);
      if (n) n.innerHTML = all ? B('All there — that is enough for this course. Move on when you like.', '都做到了——对这门课来说够了。想往下走随时可以。')
        : B('Can do these? Move on — the rest of this page is there if you need it.', '这些都能做到？往下走——这页其余的内容需要时再回来看。');
    });
  }
  document.addEventListener('change', function (e) {
    var c = e.target.closest('.tb-chk'); if (!c) return;
    var card = c.closest('.tb-card'), tid = card.dataset.tbTopic;
    S.bars[tid] = $$('.tb-chk', card).map(function (x) { return x.checked; }); save(); paintBar();
  });

  /* ---------- mixed practice: the set's time ---------- */
  function paintMix() {
    var mt = $('#mixTime'), sz = $('#mixSize'); if (!mt || !sz) return;
    var n = Math.round(+sz.value * (+mt.dataset.per || 1));
    $$('.tb-n', mt).forEach(function (b) { b.textContent = n; });
    var go = $('[data-tb-start]', mt); if (go) go.dataset.tbEst = n;
  }
  document.addEventListener('change', function (e) { if (e.target.id === 'mixSize') paintMix(); });

  /* ---------- Park-it list page ---------- */
  function paintParked() {
    var box = $('#tbParked'); if (!box) return;
    var open = S.parked.filter(function (p) { return !p.done; }).slice().reverse(), done = S.parked.filter(function (p) { return p.done; });
    function row(p) {
      var t = p.topic && title(p.topic);
      return '<li class="tb-pk' + (p.done ? ' done' : '') + '"><div class="tb-pkt">' + esc(p.text) + '</div><div class="small muted">' + dstr(p.ts) +
        (t ? ' · <a href="topic-' + p.topic + '.html">' + lab(t) + '</a>' : '') + '</div><div class="tb-pkb">' +
        (p.done ? '<button type="button" class="ghost" data-pk-undo="' + p.id + '">↺ ' + B('Back to the list', '放回清单') + '</button>'
                : '<button type="button" class="ghost" data-pk-done="' + p.id + '">✓ ' + B('Explored', '看过了') + '</button>') +
        '<button type="button" class="ghost" data-pk-del="' + p.id + '" aria-label="remove">✕</button></div></li>';
    }
    box.innerHTML = (open.length ? '<ul class="tb-pklist">' + open.map(row).join('') + '</ul>'
      : '<p class="muted">' + B('Nothing parked yet. On any topic page, tap 📌 when a question pulls you away from the bar.', '还没有存东西。在任何知识点页，有问题把你从「够了」那条拉开时，点 📌。') + '</p>') +
      (done.length ? '<details class="tb-pkdone"><summary>' + B('Explored (' + done.length + ')', '看过的（' + done.length + '）') + '</summary><ul class="tb-pklist">' + done.slice().reverse().map(row).join('') + '</ul></details>' : '');
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pk-done],[data-pk-undo],[data-pk-del]'); if (!b) return;
    var id = b.dataset.pkDone || b.dataset.pkUndo || b.dataset.pkDel;
    if (b.dataset.pkDel) S.parked = S.parked.filter(function (p) { return p.id !== id; });
    else S.parked.forEach(function (p) { if (p.id === id) p.done = !!b.dataset.pkDone; });
    save(); paintParked();
  });
  function wireParkPage() {
    var add = $('#tbParkAdd'); if (!add) return;
    function go() { var i = $('#tbParkTxt'), v = i.value.trim(); if (!v) { i.focus(); return; } addPark(v, null); i.value = ''; paintParked(); }
    add.addEventListener('click', go); $('#tbParkTxt').addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
  }

  /* ---------- task splitter page ---------- */
  var TPL = [];
  function stepRow(t, m) {
    return '<li class="tb-step"><input type="text" class="tb-st" aria-label="step" value="' + esc(t) + '"><label class="tb-sm"><input type="number" class="tb-smin" min="1" max="180" inputmode="numeric" aria-label="minutes" value="' + m + '"> ' + B('min', '分钟') + '</label>' +
      '<button type="button" class="ghost tb-sdel" aria-label="remove step">✕</button></li>';
  }
  function sumSteps() {
    var s = $$('#tbSteps .tb-smin').reduce(function (a, i) { return a + (+i.value || 0); }, 0), el = $('#tbSum');
    if (el) el.innerHTML = B('Total ≈ ' + s + ' min', '合计约 ' + s + ' 分钟');
  }
  function loadTpl(id) {
    var t = TPL.filter(function (x) { return x.id === id; })[0]; if (!t) return;
    $('#tbSteps').innerHTML = t.steps.map(function (s) { return stepRow(txt(s.t), s.m); }).join(''); sumSteps();
  }
  function fillSelects() {
    var tp = $('#tbTpl'), cur = tp.value;
    tp.innerHTML = TPL.map(function (t) { return '<option value="' + t.id + '">' + esc(txt(t.name)) + '</option>'; }).join(''); if (cur) tp.value = cur;
    var ts = $('#tbTopic'), cv = ts.value;
    ts.innerHTML = '<option value="">' + esc(txt({ en: '— none —', zh: '— 不选 —' })) + '</option>' +
      PC.order.map(function (id) { return '<option value="' + id + '">' + esc(txt(PC.topics[id].title)) + '</option>'; }).join(''); ts.value = cv;
  }
  function paintTasks() {
    var box = $('#tbTasks'); if (!box) return;
    if (!S.tasks.length) { box.innerHTML = '<p class="muted">' + B('No tasks yet. Name one above, check the steps, and save.', '还没有任务。在上面写一个，看看步骤，然后保存。') + '</p>'; return; }
    box.innerHTML = S.tasks.slice().reverse().map(function (t) {
      var est = t.steps.reduce(function (a, s) { return a + (+s.m || 0); }, 0), act = t.steps.reduce(function (a, s) { return a + (s.act || 0); }, 0);
      var nd = t.steps.filter(function (s) { return s.done; }).length, tp = t.topic && title(t.topic);
      var running = S.run && S.run.task === t.id ? S.run.step : -1;
      return '<article class="tb-task card" data-task="' + t.id + '"><div class="tb-th"><b>' + esc(t.title) + '</b><span class="muted small">' + dstr(t.ts) + ' · ' + nd + '/' + t.steps.length + ' · ' +
        B('guess ' + est + ' min, so far ' + Math.round(act) + ' min', '估计 ' + est + ' 分钟，已用 ' + Math.round(act) + ' 分钟') + '</span></div>' +
        (tp ? '<p class="small">📖 <a href="topic-' + t.topic + '.html#tb">' + lab(tp) + '</a> — ' + B('its "Enough when you can…" bar tells you when to stop.', '它的「能做到这些就够了」告诉你什么时候停。') + '</p>' : '') +
        '<ol class="tb-tsteps">' + t.steps.map(function (s, i) {
          return '<li class="' + (s.done ? 'done' : '') + (i === running ? ' run' : '') + '"><span class="tb-stt">' + esc(s.t) + '</span><span class="tb-stm">' + s.m + '′' + (s.act ? ' → ' + mm(s.act) : '') + '</span>' +
            (s.done ? '<span class="tb-ok">✓</span>' : i === running ? '<span class="muted small">' + B('running', '计时中') + '</span>'
              : '<button type="button" class="tb-go" data-step="' + i + '">▶ ' + B('Start', '开始') + '</button>') + '</li>';
        }).join('') + '</ol><div class="row"><button type="button" class="ghost small" data-tdel="' + t.id + '">✕ ' + B('Remove task', '删除任务') + '</button></div></article>';
    }).join('');
  }
  function wireSplit() {
    var tj = $('#tbTemplates'); if (!tj) return;
    try { TPL = JSON.parse(tj.textContent); } catch (e) { TPL = []; }
    fillSelects(); loadTpl(TPL[0] && TPL[0].id);
    $('#tbTpl').addEventListener('change', function () { loadTpl(this.value); });
    $('#tbAddStep').addEventListener('click', function () { $('#tbSteps').insertAdjacentHTML('beforeend', stepRow('', 5)); sumSteps(); $$('#tbSteps .tb-st').pop().focus(); });
    $('#tbSteps').addEventListener('input', sumSteps);
    $('#tbSteps').addEventListener('click', function (e) { var d = e.target.closest('.tb-sdel'); if (d) { d.closest('li').remove(); sumSteps(); } });
    $('#tbSave').addEventListener('click', function () {
      var name = $('#tbTask').value.trim(); if (!name) { $('#tbTask').focus(); return; }
      var steps = $$('#tbSteps li').map(function (li) { return { t: $('.tb-st', li).value.trim(), m: Math.max(1, +$('.tb-smin', li).value || 5), act: 0, done: false }; }).filter(function (s) { return s.t; });
      if (!steps.length) return;
      var t = { id: uid(), title: name, topic: $('#tbTopic').value || null, ts: Date.now(), steps: steps };
      S.tasks.push(t); save(); $('#tbTask').value = ''; paintTasks();
      startStep(t.id, 0);
    });
    $('#tbTasks').addEventListener('click', function (e) {
      var b = e.target.closest('[data-step]'); if (b) { startStep(b.closest('[data-task]').dataset.task, +b.dataset.step); return; }
      var d = e.target.closest('[data-tdel]'); if (d) { S.tasks = S.tasks.filter(function (t) { return t.id !== d.dataset.tdel; }); save(); paintTasks(); }
    });
  }
  function startStep(id, i) {
    var t = S.tasks.filter(function (x) { return x.id === id; })[0]; if (!t || !t.steps[i]) return;
    var o = { kind: 'step', topic: t.topic, label: t.title + ' · ' + (i + 1) + '. ' + t.steps[i].t, est: t.steps[i].m, task: id, step: i };
    if (S.run) { askStop(function () { begin(o); }); return; }
    begin(o);
  }

  /* ---------- My time page ---------- */
  function allRuns() {   // this page's sessions + the older planner timer (pc11.state log) for topics of this course
    var old = []; try { old = (JSON.parse(localStorage.getItem('pc11.state') || '{}').log || []); } catch (e) {}
    old = old.filter(function (l) { return l.topic && PC.topics[l.topic] && l.est > 0 && l.act > 0; })
      .map(function (l) { return { id: 'p' + l.ts, kind: 'plan', topic: l.topic, label: l.label, est: l.est, act: l.act, reached: null, ts: l.ts, d: l.d }; });
    return S.runs.concat(old).sort(function (a, b) { return a.ts - b.ts; });
  }
  function median(a) { if (!a.length) return null; a = a.slice().sort(function (x, y) { return x - y; }); return a[Math.floor(a.length / 2)]; }
  var RCH = { yes: '●', part: '◑', no: '○' };
  function paintMyTime() {
    if (!$('#tbWeek')) return;
    var R = allRuns();
    // week
    var days = []; for (var i = 6; i >= 0; i--) days.push(today0() - i * DAY);
    var tot = days.map(function (d) { return R.filter(function (r) { return today0(r.ts) === d; }).reduce(function (a, r) { return a + r.act; }, 0); });
    var wk = tot.reduce(function (a, b) { return a + b; }, 0), mx = Math.max.apply(null, tot.concat([30]));
    $('#tbWeek').innerHTML = '<p>' + B('Last 7 days: <b>' + Math.round(wk) + ' min</b> in ' + R.filter(function (r) { return r.ts >= days[0]; }).length + ' timed sessions.',
      '最近 7 天：计时 ' + R.filter(function (r) { return r.ts >= days[0]; }).length + ' 段，共 <b>' + Math.round(wk) + ' 分钟</b>。') + '</p>' +
      '<div class="bars">' + tot.map(function (v, i) { return '<div style="height:' + Math.round(100 * v / mx) + '%"><span>' + dstr(days[i], { weekday: 'short' }) + ' ' + Math.round(v) + '′</span></div>'; }).join('') + '</div>';
    // calibration
    var E = R.filter(function (r) { return r.est > 0 && r.act > 0; }), cal = $('#tbCal');
    if (E.length < 2) cal.innerHTML = '<p class="muted">' + B('Time two or more sessions with a guess, and your pattern shows up here.', '计时两段以上（每段先写估计），这里就会出现你的规律。') + '</p>';
    else {
      var last = E.slice(-20), W = 340, Hh = 150, pad = 26, ymax = 2.5;
      var ys = function (v) { return Hh - pad - (Math.min(ymax, v) / ymax) * (Hh - 2 * pad); }, xs = function (i) { return pad + (last.length < 2 ? 0 : i * (W - 2 * pad) / (last.length - 1)); };
      var pts = last.map(function (r, i) { return '<circle cx="' + xs(i).toFixed(1) + '" cy="' + ys(r.act / r.est).toFixed(1) + '" r="5" class="tb-pt"><title>' + mm(r.est) + ' → ' + mm(r.act) + '</title></circle>'; }).join('');
      var svg = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" class="tb-chart" role="img" aria-label="guess vs real time">' +
        '<rect x="' + pad + '" y="' + ys(1.15).toFixed(1) + '" width="' + (W - 2 * pad) + '" height="' + (ys(0.85) - ys(1.15)).toFixed(1) + '" class="tb-band"/>' +
        '<line x1="' + pad + '" x2="' + (W - pad) + '" y1="' + ys(1) + '" y2="' + ys(1) + '" class="tb-one"/>' +
        '<text x="2" y="' + (ys(1) + 4) + '" class="tb-ax">1×</text><text x="2" y="' + (ys(2) + 4) + '" class="tb-ax">2×</text>' +
        '<polyline points="' + last.map(function (r, i) { return xs(i).toFixed(1) + ',' + ys(r.act / r.est).toFixed(1); }).join(' ') + '" class="tb-line"/>' + pts + '</svg>';
      var miss = function (a) { return median(a.map(function (r) { return Math.abs(r.act - r.est) / r.est; })); };
      var ratio = median(E.slice(-8).map(function (r) { return r.act / r.est; }));
      var h = E.length >= 6 ? Math.floor(E.length / 2) : 0, m1 = h ? miss(E.slice(0, h)) : null, m2 = h ? miss(E.slice(h)) : null;
      var trend = !h ? B('After six sessions you will see whether your guesses are getting closer.', '六段之后，你就能看到估计是不是越来越准。')
        : m2 < m1 - 0.05 ? B('Getting closer: your guesses used to be off by about ' + Math.round(m1 * 100) + '%, lately about ' + Math.round(m2 * 100) + '%.', '越来越准：以前估计大约差 ' + Math.round(m1 * 100) + '%，最近大约差 ' + Math.round(m2 * 100) + '%。')
        : B('About the same as before (off by about ' + Math.round(m2 * 100) + '%). Try this: guess, then add a quarter.', '和以前差不多（大约差 ' + Math.round(m2 * 100) + '%）。试试：先估，再加四分之一。');
      var typ = ratio > 1.15 ? B('Lately things take about ×' + ratio.toFixed(1) + ' your guess. Planning with that in mind is a skill, not a weakness.', '最近实际用时大约是估计的 ×' + ratio.toFixed(1) + '。把这个算进计划里，是一种本事，不是缺点。')
        : ratio < 0.85 ? B('Lately you finish in about ×' + ratio.toFixed(1) + ' your guess — you can plan a little tighter.', '最近实际用时大约是估计的 ×' + ratio.toFixed(1) + '——可以计划得紧一点。')
        : B('Lately your guesses are close to the real time.', '最近你的估计和实际很接近。');
      cal.innerHTML = svg + '<p class="small muted">' + B('Each dot = one session: real time ÷ your guess. The shaded band is "close" (within 15%).', '每个点是一段：实际用时 ÷ 你的估计。阴影带表示「很接近」（差 15% 以内）。') + '</p><p>' + typ + '</p><p>' + trend + '</p>';
    }
    // topics
    var by = {};
    R.forEach(function (r) { if (!r.topic || !PC.topics[r.topic]) return; var x = by[r.topic] = by[r.topic] || { min: 0, n: 0, last: null, ts: 0 }; x.min += r.act; x.n++; if (r.reached) x.last = r.reached; x.ts = Math.max(x.ts, r.ts); });
    var ids = Object.keys(by).sort(function (a, b) { return by[b].ts - by[a].ts; });
    $('#tbTopics').innerHTML = ids.length ? '<table class="log tb-tt"><tr><th>' + B('Topic', '知识点') + '</th><th>' + B('Budget', '预算') + '</th><th>' + B('Your time', '你的用时') + '</th><th>' + B('Bar', '够了') + '</th></tr>' +
      ids.map(function (id) { var x = by[id], b = PC.topics[id].budget;
        return '<tr><td><a href="topic-' + id + '.html#tb">' + lab(PC.topics[id].title) + '</a></td><td>' + (b ? mm(b) : '—') + '</td><td>' + mm(x.min) + ' <span class="muted small">(' + x.n + ')</span></td><td>' + (x.last ? RCH[x.last] : '—') + '</td></tr>'; }).join('') + '</table>' +
      '<p class="small muted">' + B('● reached · ◑ partly · ○ not yet (your latest answer). More time than the budget is normal on a first pass — the bar, not the clock, says when to move on.', '● 做到 · ◑ 部分 · ○ 还没有（你最近一次的回答）。第一次学用时超过预算很正常——什么时候往下走，看「够了」那一条，不看时钟。') + '</p>'
      : '<p class="muted">' + B('Start a timed session from any topic page (▶ Time it) and it shows up here.', '在任何知识点页点「▶ 计时」开始一段，就会出现在这里。') + '</p>';
    // log
    var L = R.slice(-30).reverse();
    $('#tbLog').innerHTML = L.length ? '<table class="log">' + L.map(function (r) {
      return '<tr><td>' + dstr(r.ts) + '</td><td>' + lab(r.label) + '</td><td>' + mm(r.est) + ' → ' + mm(r.act) + '</td><td>' + (r.reached ? RCH[r.reached] : '') + '</td><td>' +
        (r.kind === 'plan' ? '' : '<button type="button" class="ghost tb-rdel" data-rdel="' + r.id + '" aria-label="remove">✕</button>') + '</td></tr>'; }).join('') + '</table>'
      : '<p class="muted">' + B('No sessions yet.', '还没有记录。') + '</p>';
  }
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-rdel]'); if (!b) return; S.runs = S.runs.filter(function (r) { return r.id !== b.dataset.rdel; }); save(); paintMyTime(); });

  /* ---------- wiring ---------- */
  function paintAll() { dock(); tick(); paintBar(); paintMix(); paintParked(); paintTasks(); paintMyTime(); }
  document.addEventListener('tb:change', function () { paintTasks(); });
  $$('[data-set-lang]').forEach(function (b) { b.addEventListener('click', function () { setTimeout(function () { if ($('#tbTpl')) fillSelects(); paintAll(); }, 0); }); });
  wireSplit(); wireParkPage(); paintAll();
  window.TimeBox = { state: function () { return S; }, key: KEY };
})();
