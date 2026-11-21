/* Hands-on pictures for the catch-up core (self-built SVG, no library, no network, works offline on an iPad).
   Each widget: a few sliders -> a picture -> one line of algebra that updates. The math helpers at the top are pure functions;
   tools/viz_test.py compares them with SymPy for every slider position (node loads THIS file). */
(function (root) {
  'use strict';
  /* ---------------- pure math (tested) ---------------- */
  function simplifySqrt(n) { var s = 1; for (var f = Math.floor(Math.sqrt(n)); f >= 2; f--) if (n % (f * f) === 0) { s = f; break; } return [s, n / (s * s)]; }
  function vertexFacts(a, h, k) {
    var disc = -k / a, xs = disc >= 0 ? (disc === 0 ? [h] : [h - Math.sqrt(disc), h + Math.sqrt(disc)]) : [];
    return { up: a > 0, vertex: [h, k], axis: h, yint: a * h * h + k, xints: xs };
  }
  function factoredFacts(a, r, s) { var h = (r + s) / 2; return { zeros: [r, s], axis: h, vertex: [h, a * (h - r) * (h - s)], yint: a * r * s, up: a > 0 }; }
  function tilesFacts(p, q) { return { b: p + q, c: p * q, xsq: 1, xs: p + q, units: p * q }; }
  function dosFacts(a, b) { return { area: a * a - b * b, w: a + b, h: a - b, rect: (a + b) * (a - b) }; }
  function ctsFacts(b, c) { var hb = b / 2; return { h: -hb, sq: hb * hb, k: c - hb * hb, vertex: [-hb, c - hb * hb] }; }
  function ratexpFacts(base, m, n) { var r = Math.round(Math.pow(base, 1 / n)), exact = Math.pow(r, n) === base; var root = exact ? r : Math.pow(base, 1 / n);
    return { exact: exact, root: root, val: Math.pow(root, m) }; }
  function rationalFacts(r, s, t) { return { excluded: [r, t].sort(function (x, y) { return x - y; }), zero: s === r ? null : s, hole: [r, (r - s) / (r - t)], va: t }; }
  function maxAreaFacts(P) { var w = P / 4; return { w: w, area: w * (P / 2 - w) }; }
  function gcfFacts(n1, n2, d) { var g = gcd(n1, n2); return { g: g, left: [n1 / d, n2 / d], leftGcd: gcd(n1 / d, n2 / d), done: d === g }; }
  var MATH = { gcfFacts: gcfFacts, simplifySqrt: simplifySqrt, vertexFacts: vertexFacts, factoredFacts: factoredFacts, tilesFacts: tilesFacts, dosFacts: dosFacts, ctsFacts: ctsFacts, ratexpFacts: ratexpFacts, rationalFacts: rationalFacts, maxAreaFacts: maxAreaFacts };
  if (typeof module !== 'undefined' && module.exports) { module.exports = MATH; return; }
  root.PCVZ = MATH;
  if (typeof document === 'undefined') return;

  /* ---------------- helpers ---------------- */
  var NS = 'http://www.w3.org/2000/svg';
  function lang() { return document.documentElement.dataset.lang || 'both'; }
  function B(en, zh) { return '<span class="bi"><span class="en" lang="en">' + en + '</span><span class="zh" lang="zh-Hans">' + zh + '</span></span>'; }
  function el(tag, at, parent, text) { var e = document.createElementNS(NS, tag); for (var k in at) e.setAttribute(k, at[k]); if (text !== undefined) e.textContent = text; if (parent) parent.appendChild(e); return e; }
  function num(v, d) { var r = Math.round(v * Math.pow(10, d == null ? 2 : d)) / Math.pow(10, d == null ? 2 : d); return String(r).replace('-', '−'); }
  function sg(v) { return v < 0 ? '− ' + num(-v) : '+ ' + num(v); }          // "+ 3" / "− 3"
  function pw(v, name) { return v === 0 ? name : '(' + name + ' ' + sg(-v) + ')'; }  // (x − h)
  function fr(n, d) { var g = gcd(Math.abs(n), Math.abs(d)); n /= g; d /= g; if (d < 0) { n = -n; d = -d; } return d === 1 ? String(n).replace('-', '−') : String(n).replace('-', '−') + '/' + d; }
  function gcd(a, b) { return b ? gcd(b, a % b) : (a || 1); }
  function slider(host, id, label, vals, init, cb) {      // vals: array of allowed values; the range input walks the indices
    var wrap = document.createElement('label'); wrap.className = 'vz-ctl';
    var i0 = Math.max(0, vals.indexOf(init));
    wrap.innerHTML = '<span class="vz-name">' + label + '</span><input type="range" min="0" max="' + (vals.length - 1) + '" step="1" value="' + i0 + '" aria-label="' + id + '"><output>' + num(vals[i0]) + '</output>';
    var inp = wrap.querySelector('input'), out = wrap.querySelector('output');
    inp.addEventListener('input', function () { out.textContent = num(vals[+inp.value]); cb(vals[+inp.value]); });
    host.appendChild(wrap); return { get: function () { return vals[+inp.value]; }, set: function (v) { var i = Math.max(0, vals.indexOf(v)); inp.value = i; out.textContent = num(vals[i]); } };
  }
  function box(host, vb) { var svg = el('svg', { viewBox: '0 0 ' + vb[0] + ' ' + vb[1], class: 'vz-svg', role: 'img', 'aria-hidden': 'true', preserveAspectRatio: 'xMidYMid meet' }); host.appendChild(svg); return svg; }
  function readout(host) { var d = document.createElement('div'); d.className = 'vz-out'; d.setAttribute('aria-live', 'polite'); host.appendChild(d); return d; }
  var C = { ink: '#3a3c55', grid: '#e6e0d4', axis: '#6c6d82', acc: '#4f46e5', soft: '#dfe3ff', teal: '#17a398', tealS: '#d5f3ef', apr: '#e08a12', aprS: '#ffe7c7', rose: '#c2417a' };
  function css(name, d) { var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || d; }

  /* graph frame: x in [x0,x1], y in [y0,y1] mapped into a W x H box */
  function frame(svg, W, H, xr, yr, gx, gy) {
    gx = gx || 1; gy = gy || 1;
    var padL = 26, padB = 20, padT = 8, padR = 10, w = W - padL - padR, h = H - padT - padB;
    var X = function (x) { return padL + (x - xr[0]) / (xr[1] - xr[0]) * w; }, Y = function (y) { return padT + (yr[1] - y) / (yr[1] - yr[0]) * h; };
    var g = el('g', {}, svg);
    for (var x = Math.ceil(xr[0] / gx) * gx; x <= xr[1]; x += gx) el('line', { x1: X(x), x2: X(x), y1: Y(yr[0]), y2: Y(yr[1]), stroke: x === 0 ? C.axis : C.grid, 'stroke-width': x === 0 ? 1.4 : 1 }, g);
    for (var y = Math.ceil(yr[0] / gy) * gy; y <= yr[1]; y += gy) el('line', { x1: X(xr[0]), x2: X(xr[1]), y1: Y(y), y2: Y(y), stroke: y === 0 ? C.axis : C.grid, 'stroke-width': y === 0 ? 1.4 : 1 }, g);
    for (var tx = Math.ceil(xr[0] / (2 * gx)) * 2 * gx; tx <= xr[1]; tx += 2 * gx) if (tx !== 0) el('text', { x: X(tx), y: Y(0) + 12, 'text-anchor': 'middle', 'font-size': 9, fill: C.axis }, g, num(tx, 0));
    for (var ty = Math.ceil(yr[0] / (2 * gy)) * 2 * gy; ty <= yr[1]; ty += 2 * gy) if (ty !== 0) el('text', { x: X(0) - 4, y: Y(ty) + 3, 'text-anchor': 'end', 'font-size': 9, fill: C.axis }, g, num(ty, 0));
    var dyn = el('g', {}, svg);
    function curve(fn, color, lo, hi, step) {   // splits the path wherever the curve leaves the box or is undefined
      var d = '', pen = false; lo = lo == null ? xr[0] : lo; hi = hi == null ? xr[1] : hi; step = step || (xr[1] - xr[0]) / 240;
      for (var x = lo; x <= hi + 1e-9; x += step) { var y = fn(x); if (y == null || !isFinite(y) || y < yr[0] - 0.5 || y > yr[1] + 0.5) { pen = false; continue; } d += (pen ? 'L' : 'M') + X(x).toFixed(1) + ' ' + Y(y).toFixed(1); pen = true; }
      el('path', { d: d, fill: 'none', stroke: color, 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, dyn);
    }
    return { X: X, Y: Y, dyn: dyn, curve: curve, clear: function () { while (dyn.firstChild) dyn.removeChild(dyn.firstChild); },
      dot: function (x, y, fill, r) { return el('circle', { cx: X(x), cy: Y(y), r: r || 4.5, fill: fill || C.acc, stroke: '#fff', 'stroke-width': 1.5 }, dyn); },
      ring: function (x, y, color) { return el('circle', { cx: X(x), cy: Y(y), r: 5, fill: '#fff', stroke: color || C.rose, 'stroke-width': 2 }, dyn); },
      vline: function (x, color) { el('line', { x1: X(x), x2: X(x), y1: Y(yr[0]), y2: Y(yr[1]), stroke: color || C.apr, 'stroke-width': 1.6, 'stroke-dasharray': '5 4' }, dyn); },
      label: function (x, y, t, anchor, color) { el('text', { x: X(x), y: Y(y), 'text-anchor': anchor || 'start', 'font-size': 10.5, 'font-weight': 600, fill: color || C.ink }, dyn, t); } };
  }
  var AS = [-3, -2, -1, -0.5, 0.5, 1, 2, 3];
  function range(a, b, st, skip0) { var o = []; for (var v = a; v <= b + 1e-9; v += (st || 1)) { v = Math.round(v * 100) / 100; if (!(skip0 && v === 0)) o.push(v); } return o; }

  /* ---------------- widgets ---------------- */
  var W = {};
  W.vertex = function (host) {      // y = a(x - h)^2 + k
    var svg = box(host, [320, 250]), f = frame(svg, 320, 250, [-8, 8], [-8, 8]), out = readout(host), ctl = document.createElement('div'); ctl.className = 'vz-ctls'; host.appendChild(ctl);
    var st = { a: 1, h: 0, k: 0 };
    function draw() {
      f.clear(); var a = st.a, h = st.h, k = st.k, F = vertexFacts(a, h, k);
      f.vline(h); f.curve(function (x) { return a * (x - h) * (x - h) + k; }, C.acc);
      F.xints.forEach(function (x) { f.dot(x, 0, C.teal, 3.8); }); f.dot(h, k, C.rose, 5);
      f.label(h + 0.4, k + (a > 0 ? -0.9 : 1.2), '(' + num(h) + ', ' + num(k) + ')', 'start', C.rose);
      out.innerHTML = '<div class="vz-eq">y = ' + (a === 1 ? '' : a === -1 ? '−' : num(a)) + pw(h, 'x') + '² ' + sg(k) + '</div>' +
        '<ul class="vz-facts"><li>' + B('Opens ' + (F.up ? 'up: the vertex is the lowest point' : 'down: the vertex is the highest point'), '开口向' + (F.up ? '上：顶点是最低点' : '下：顶点是最高点')) + '</li>' +
        '<li>' + B('Vertex', '顶点') + ' (' + num(h) + ', ' + num(k) + ') · ' + B('axis', '对称轴') + ' x = ' + num(h) + '</li>' +
        '<li>' + B('y-intercept', 'y 截距') + ' ' + num(F.yint) + ' · ' + B('x-intercepts', 'x 截距') + ' ' + (F.xints.length ? F.xints.map(function (x) { return num(x); }).join(', ') : B('none', '没有')) + '</li></ul>';
    }
    slider(ctl, 'a', 'a', AS, 1, function (v) { st.a = v; draw(); }); slider(ctl, 'h', 'h', range(-6, 6), 0, function (v) { st.h = v; draw(); }); slider(ctl, 'k', 'k', range(-6, 6), 0, function (v) { st.k = v; draw(); }); draw();
  };
  W.factored = function (host) {    // y = a(x - r)(x - s)
    var svg = box(host, [320, 250]), f = frame(svg, 320, 250, [-8, 8], [-8, 8]), out = readout(host), ctl = document.createElement('div'); ctl.className = 'vz-ctls'; host.appendChild(ctl);
    var st = { a: 1, r: -2, s: 3 };
    function draw() {
      f.clear(); var a = st.a, r = st.r, s = st.s, F = factoredFacts(a, r, s);
      f.vline(F.axis); f.curve(function (x) { return a * (x - r) * (x - s); }, C.acc);
      f.dot(r, 0, C.teal, 5); f.dot(s, 0, C.teal, 5); f.dot(F.vertex[0], F.vertex[1], C.rose, 5);
      f.label(F.vertex[0] + 0.4, F.vertex[1] + (a > 0 ? -0.9 : 1.2), '(' + num(F.vertex[0]) + ', ' + num(F.vertex[1]) + ')', 'start', C.rose);
      out.innerHTML = '<div class="vz-eq">y = ' + (a === 1 ? '' : a === -1 ? '−' : num(a)) + pw(r, 'x') + pw(s, 'x') + '</div>' +
        '<ul class="vz-facts"><li>' + B('Zeros: where the curve crosses the x-axis', '零点：曲线穿过 x 轴的地方') + ' x = ' + num(r) + ', ' + num(s) + '</li>' +
        '<li>' + B('Axis: exactly halfway between the zeros', '对称轴：正好在两个零点中间') + ' x = (' + num(r) + ' ' + sg(s) + ') ÷ 2 = ' + num(F.axis) + '</li>' +
        '<li>' + B('Vertex height: put the axis value back in', '顶点高度：把对称轴的值代回去') + ' y = ' + num(F.vertex[1]) + ' · ' + B('y-intercept', 'y 截距') + ' ' + num(F.yint) + '</li></ul>';
    }
    slider(ctl, 'a', 'a', AS, 1, function (v) { st.a = v; draw(); }); slider(ctl, 'r', 'r', range(-6, 6), -2, function (v) { st.r = v; draw(); }); slider(ctl, 's', 's', range(-6, 6), 3, function (v) { st.s = v; draw(); }); draw();
  };
  W.tiles = function (host) {       // (x + p)(x + q) as an area of algebra tiles
    var svg = box(host, [320, 210]), out = readout(host), ctl = document.createElement('div'); ctl.className = 'vz-ctls'; host.appendChild(ctl); var st = { p: 3, q: 4 };
    function draw() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var p = st.p, q = st.q, X = 76, u = 15, x0 = 40, y0 = 8, F = tilesFacts(p, q);
      el('rect', { x: x0, y: y0, width: X, height: X, fill: C.soft, stroke: C.acc, 'stroke-width': 1.6 }, svg); el('text', { x: x0 + X / 2, y: y0 + X / 2 + 5, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, fill: C.acc }, svg, 'x²');
      for (var i = 0; i < q; i++) { el('rect', { x: x0 + X + i * u, y: y0, width: u, height: X, fill: C.tealS, stroke: C.teal }, svg); el('text', { x: x0 + X + i * u + u / 2, y: y0 + X / 2 + 4, 'text-anchor': 'middle', 'font-size': 11, fill: C.teal, 'font-weight': 700 }, svg, 'x'); }
      for (var j = 0; j < p; j++) { el('rect', { x: x0, y: y0 + X + j * u, width: X, height: u, fill: C.tealS, stroke: C.teal }, svg); el('text', { x: x0 + X / 2, y: y0 + X + j * u + 11, 'text-anchor': 'middle', 'font-size': 11, fill: C.teal, 'font-weight': 700 }, svg, 'x'); }
      for (var a = 0; a < p; a++) for (var b = 0; b < q; b++) el('rect', { x: x0 + X + b * u, y: y0 + X + a * u, width: u, height: u, fill: C.aprS, stroke: C.apr }, svg);
      el('text', { x: x0 + X / 2, y: y0 - 0 + X + p * u + 16, 'text-anchor': 'middle', 'font-size': 11, fill: C.ink }, svg, 'x');
      el('text', { x: x0 + X + q * u + 6, y: y0 + X / 2, 'font-size': 11, fill: C.ink }, svg, '');
      out.innerHTML = '<div class="vz-eq">x² + ' + F.b + 'x + ' + F.c + ' = (x + ' + p + ')(x + ' + q + ')</div><ul class="vz-facts"><li>' + B('One big square, ' + F.xs + ' strips of x, ' + F.units + ' small squares: that is the whole area.', '一个大方块、' + F.xs + ' 条 x 长条、' + F.units + ' 个小方块：合起来就是总面积。') + '</li>' +
        '<li>' + B('Small squares: ' + p + ' × ' + q + ' = ' + F.c + ' · strips of x: ' + p + ' + ' + q + ' = ' + F.b, '小方块：' + p + ' × ' + q + ' = ' + F.c + ' · x 长条：' + p + ' + ' + q + ' = ' + F.b) + '</li><li>' + B('Factoring = finding the two side lengths: two numbers that multiply to ' + F.c + ' and add to ' + F.b + '.', '分解因式 = 找出两条边长：积为 ' + F.c + '、和为 ' + F.b + ' 的两个数。') + '</li></ul>';
    }
    slider(ctl, 'p', 'p', range(1, 6), 3, function (v) { st.p = v; draw(); }); slider(ctl, 'q', 'q', range(1, 6), 4, function (v) { st.q = v; draw(); }); draw();
  };
  W.dos = function (host) {         // a^2 - b^2 = (a - b)(a + b)
    var svg = box(host, [320, 270]), out = readout(host), ctl = document.createElement('div'); ctl.className = 'vz-ctls'; host.appendChild(ctl); var st = { a: 8, b: 3 };
    function draw() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var a = st.a, b = Math.min(st.b, a - 1), s = 12, F = dosFacts(a, b), x0 = 20, y0 = 8;
      // 1) the L-shape: a x a square with a b x b corner cut away = piece A (a wide, a-b tall) + piece B (b wide, a-b tall... standing at the left)
      el('rect', { x: x0, y: y0, width: a * s, height: (a - b) * s, fill: C.soft, stroke: C.acc, 'stroke-width': 1.4 }, svg);
      el('rect', { x: x0, y: y0 + (a - b) * s, width: (a - b) * s, height: b * s, fill: C.tealS, stroke: C.teal, 'stroke-width': 1.4 }, svg);
      el('rect', { x: x0 + (a - b) * s, y: y0 + (a - b) * s, width: b * s, height: b * s, fill: 'none', stroke: C.axis, 'stroke-dasharray': '4 3' }, svg);
      el('text', { x: x0 + a * s + 8, y: y0 + 12, 'font-size': 11, fill: C.ink }, svg, 'a² − b²'); 
      // 2) rearranged: piece B turned and placed beside piece A -> rectangle (a + b) wide, (a - b) tall
      var y1 = y0 + a * s + 24;
      el('rect', { x: x0, y: y1, width: a * s, height: (a - b) * s, fill: C.soft, stroke: C.acc, 'stroke-width': 1.4 }, svg);
      el('rect', { x: x0 + a * s, y: y1, width: b * s, height: (a - b) * s, fill: C.tealS, stroke: C.teal, 'stroke-width': 1.4 }, svg);
      el('text', { x: x0 + (a + b) * s / 2, y: y1 + (a - b) * s + 13, 'text-anchor': 'middle', 'font-size': 11, fill: C.ink }, svg, '(a + b)');
      el('text', { x: x0 + (a + b) * s + 6, y: y1 + (a - b) * s / 2 + 4, 'font-size': 11, fill: C.ink }, svg, '(a − b)');
      svg.setAttribute('viewBox', '0 0 320 ' + Math.max(150, y1 + (a - b) * s + 22));
      out.innerHTML = '<div class="vz-eq">' + a + '² − ' + b + '² = ' + a * a + ' − ' + b * b + ' = ' + F.area + ' = (' + a + ' − ' + b + ')(' + a + ' + ' + b + ') = ' + F.h + ' × ' + F.w + '</div>' +
        '<ul class="vz-facts"><li>' + B('Top: a big square with a small square cut from its corner. Bottom: the same pieces moved into one rectangle.', '上：大正方形缺了一个角。下：把同样的两块拼成一个长方形。') + '</li><li>' + B('Same area, so a² − b² = (a − b)(a + b).', '面积不变，所以 a² − b² = (a − b)(a + b)。') + '</li></ul>';
    }
    var bs;
    slider(ctl, 'a', 'a', range(2, 10), 8, function (v) { st.a = v; if (st.b >= v) { st.b = v - 1; bs.set(st.b); } draw(); });
    bs = slider(ctl, 'b', 'b', range(1, 9), 3, function (v) { st.b = Math.min(v, st.a - 1); if (st.b !== v) bs.set(st.b); draw(); }); draw();
  };
  W.gcf = function (host) {         // two bars of unit blocks; group them by d: is the GCF the biggest d that still works?
    var svg = box(host, [320, 130]), out = readout(host), ctl = document.createElement('div'); ctl.className = 'vz-ctls'; host.appendChild(ctl);
    var PAIRS = [[12, 18], [8, 20], [15, 25], [24, 36]], st = { pi: 0, d: 2 }, ds, ps;
    function divs(p) { var o = []; for (var d = 1; d <= p[0]; d++) if (p[0] % d === 0 && p[1] % d === 0) o.push(d); return o; }
    function draw() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var p = PAIRS[st.pi], d = st.d, F = gcfFacts(p[0], p[1], d), u = Math.min(11, 290 / p[1]), x0 = 14;
      [[p[0], 14], [p[1], 62]].forEach(function (r) {
        for (var i = 0; i < r[0]; i++) el('rect', { x: x0 + i * u + Math.floor(i / d) * 3, y: r[1], width: u - 1.5, height: 30, fill: Math.floor(i / d) % 2 ? C.tealS : C.soft, stroke: C.axis, 'stroke-width': 0.6 }, svg);
      });
      el('text', { x: x0, y: 120, 'font-size': 11, fill: C.ink }, svg, '');
      out.innerHTML = '<div class="vz-eq">' + p[0] + 'x\u00b2 + ' + p[1] + 'x = ' + d + '(' + F.left[0] + 'x\u00b2 + ' + F.left[1] + 'x)</div><ul class="vz-facts"><li>' +
        B('Each bar is cut into groups of ' + d + ': ' + F.left[0] + ' groups and ' + F.left[1] + ' groups.', '每条按 ' + d + ' 个一组切开：分别是 ' + F.left[0] + ' 组和 ' + F.left[1] + ' 组。') + '</li><li>' +
        (F.done ? B('The groups ' + F.left[0] + ' and ' + F.left[1] + ' share nothing more, so ' + d + ' is the GREATEST common factor. Done.', F.left[0] + ' 和 ' + F.left[1] + ' 再没有公因数了，所以 ' + d + ' 就是最大公因数。完成。')
          : B('The groups ' + F.left[0] + ' and ' + F.left[1] + ' still share a factor of ' + F.leftGcd + ': ' + d + ' works but is not the greatest. Try a bigger group size.', F.left[0] + ' 和 ' + F.left[1] + ' 还有公因数 ' + F.leftGcd + '：' + d + ' 可以提，但不是最大的。试试更大的组。')) + '</li></ul>';
    }
    ps = slider(ctl, 'pair', B('numbers', '数字'), [0, 1, 2, 3], 0, function (v) { st.pi = v; var dd = divs(PAIRS[v]); st.d = dd[Math.min(1, dd.length - 1)]; draw(); });
    ds = slider(ctl, 'd', B('group size', '每组个数'), range(1, 12), 2, function (v) { var dd = divs(PAIRS[st.pi]); var best = dd.filter(function (x) { return x <= v; }).pop() || 1; st.d = best; if (best !== v) ds.set(best); draw(); }); draw();
  };
  W.radical = function (host) {     // where does sqrt(n) sit, and what is its simplest form?
    var svg = box(host, [320, 100]), out = readout(host), ctl = document.createElement('div'); ctl.className = 'vz-ctls'; host.appendChild(ctl);
    var X = function (v) { return 14 + v / 15 * 292; };
    function draw(n) {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      el('line', { x1: X(0), x2: X(15), y1: 58, y2: 58, stroke: C.axis, 'stroke-width': 1.6 }, svg);
      for (var i = 0; i <= 15; i++) { el('line', { x1: X(i), x2: X(i), y1: 53, y2: 63, stroke: C.axis }, svg); el('text', { x: X(i), y: 78, 'text-anchor': 'middle', 'font-size': 9.5, fill: C.axis }, svg, String(i)); }
      var v = Math.sqrt(n), lo = Math.floor(v), sq = simplifySqrt(n);
      el('rect', { x: X(lo), y: 50, width: X(lo + 1) - X(lo), height: 16, fill: C.aprS, opacity: 0.8 }, svg);
      el('circle', { cx: X(v), cy: 58, r: 6, fill: C.rose, stroke: '#fff', 'stroke-width': 1.5 }, svg);
      el('text', { x: Math.min(Math.max(X(v), 30), 292), y: 38, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700, fill: C.rose }, svg, '√' + n);
      var simple = sq[0] === 1 ? B('Already simplest: ' + n + ' has no perfect-square factor.', '已经最简：' + n + ' 没有完全平方因数。') : B('Largest perfect-square factor of ' + n + ' is ' + (sq[0] * sq[0]) + ' = ' + sq[0] + '².', n + ' 的最大完全平方因数是 ' + (sq[0] * sq[0]) + ' = ' + sq[0] + '²。');
      out.innerHTML = '<div class="vz-eq">√' + n + ' = ' + (sq[0] === 1 ? '√' + n : sq[1] === 1 ? String(sq[0]) : sq[0] + '√' + sq[1]) + ' ≈ ' + num(v, 3) + '</div><ul class="vz-facts"><li>' + simple + '</li>' +
        (sq[0] > 1 && sq[1] > 1 ? '<li>' + n + ' = ' + (sq[0] * sq[0]) + ' × ' + sq[1] + ' → √' + (sq[0] * sq[0]) + ' × √' + sq[1] + ' = ' + sq[0] + '√' + sq[1] + '</li>' : '') +
        '<li>' + B('It sits between ' + lo + ' and ' + (lo + 1) + ' because ' + (lo * lo) + ' ≤ ' + n + ' < ' + ((lo + 1) * (lo + 1)) + (lo * lo === n ? ' (a perfect square: it lands exactly on ' + lo + ')' : '') + '.', '它在 ' + lo + ' 和 ' + (lo + 1) + ' 之间，因为 ' + (lo * lo) + ' ≤ ' + n + ' < ' + ((lo + 1) * (lo + 1)) + (lo * lo === n ? '（完全平方数：正好落在 ' + lo + '）' : '') + '。') + '</li></ul>';
    }
    slider(ctl, 'n', 'n', range(2, 200), 72, draw); draw(72);
  };
  W.expo = function (host) {        // the halving ladder: b^5 ... b^-4
    var out = readout(host), ctl = document.createElement('div'); ctl.className = 'vz-ctls'; host.appendChild(ctl); var st = { b: 2, n: -3 };
    function draw() {
      var b = st.b, rows = '';
      for (var e = 5; e >= -4; e--) {
        var v = e >= 0 ? String(Math.pow(b, e)) : '1/' + Math.pow(b, -e), dec = e >= 0 ? '' : ' = ' + num(Math.pow(b, e), 4);
        rows += '<div class="vz-row' + (e === st.n ? ' on' : '') + '"><span class="vz-e">' + b + '<sup>' + num(e, 0) + '</sup></span><span class="vz-v">' + v + dec + '</span>' + (e > -4 ? '<span class="vz-arr">↓ ÷' + b + '</span>' : '') + '</div>';
      }
      out.innerHTML = '<div class="vz-ladder">' + rows + '</div><div class="vz-eq">' + b + '<sup>' + num(st.n, 0) + '</sup> = ' + (st.n >= 0 ? Math.pow(b, st.n) : '1 / ' + b + '<sup>' + (-st.n) + '</sup> = 1/' + Math.pow(b, -st.n)) + '</div>' +
        '<p class="vz-note">' + B('Each step down divides by ' + b + '. Keep going past ' + b + '⁰ = 1 and the numbers become fractions — never negatives.', '每往下一格就除以 ' + b + '。过了 ' + b + '⁰ = 1 继续往下，数变成分数——不会变成负数。') + '</p>';
    }
    var bs = [2, 3, 5, 10]; slider(ctl, 'b', B('base', '底数'), bs, 2, function (v) { st.b = v; draw(); }); slider(ctl, 'n', B('exponent', '指数'), range(-4, 5), -3, function (v) { st.n = v; draw(); }); draw();
  };
  W.ratexp = function (host) {      // b^(m/n) = (nth root of b)^m
    var out = readout(host), ctl = document.createElement('div'); ctl.className = 'vz-ctls'; host.appendChild(ctl); var st = { b: 27, m: 2, n: 3 };
    var BASES = [4, 8, 16, 25, 27, 32, 64, 81, 125];
    function draw() {
      var b = st.b, m = st.m, n = st.n, R = ratexpFacts(b, m, n), root = R.exact ? String(R.root) : num(R.root, 3), part = Math.pow(R.root, Math.abs(m));
      var rootName = n === 2 ? '√' : n === 3 ? '∛' : '∜';
      var line1 = b + '<sup>' + fr(m, n) + '</sup> = (' + rootName + b + ')<sup>' + num(m, 0) + '</sup>';
      var s2 = '<li>' + B('Root first: ', '先开根：') + rootName + b + ' = ' + root + (R.exact ? '' : ' (' + B('not a whole number', '不是整数') + ')') + '</li><li>' + B('Then the power: ', '再乘方：') + root + '<sup>' + Math.abs(m) + '</sup> = ' + (R.exact ? String(part) : num(part, 3)) + '</li>' +
        (m < 0 ? '<li>' + B('The minus sign flips it: ', '负号再取倒数：') + '1/' + (R.exact ? part : num(part, 3)) + ' = ' + (R.exact ? '1/' + part : num(1 / part, 4)) + '</li>' : '');
      out.innerHTML = '<div class="vz-eq">' + line1 + ' = ' + (R.exact ? (m < 0 ? '1/' + part : String(part)) : '≈ ' + num(R.val, 4)) + '</div><ul class="vz-facts">' + s2 + '</ul>' +
        '<p class="vz-note">' + B('Bottom number of the fraction = which root. Top number = which power.', '分数的分母＝开几次方，分子＝几次幂。') + '</p>';
    }
    slider(ctl, 'b', B('base', '底数'), BASES, 27, function (v) { st.b = v; draw(); });
    slider(ctl, 'm', B('top (power)', '分子（幂）'), [-3, -2, -1, 1, 2, 3, 4], 2, function (v) { st.m = v; draw(); });
    slider(ctl, 'n', B('bottom (root)', '分母（根）'), [2, 3, 4], 3, function (v) { st.n = v; draw(); }); draw();
  };
  W.cts = function (host) {         // completing the square as tiles
    var svg = box(host, [320, 210]), out = readout(host), ctl = document.createElement('div'); ctl.className = 'vz-ctls'; host.appendChild(ctl); var st = { b: 6, c: 2 };
    function draw() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var b = st.b, c = st.c, hb = Math.abs(b) / 2, X = 80, u = 16, x0 = 40, y0 = 8, F = ctsFacts(b, c);
      el('rect', { x: x0, y: y0, width: X, height: X, fill: C.soft, stroke: C.acc, 'stroke-width': 1.6 }, svg); el('text', { x: x0 + X / 2, y: y0 + X / 2 + 5, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, fill: C.acc }, svg, 'x²');
      el('rect', { x: x0 + X, y: y0, width: hb * u, height: X, fill: C.tealS, stroke: C.teal }, svg); el('text', { x: x0 + X + hb * u / 2, y: y0 + X / 2 + 4, 'text-anchor': 'middle', 'font-size': 11, fill: C.teal, 'font-weight': 700 }, svg, hb + 'x');
      el('rect', { x: x0, y: y0 + X, width: X, height: hb * u, fill: C.tealS, stroke: C.teal }, svg); el('text', { x: x0 + X / 2, y: y0 + X + hb * u / 2 + 4, 'text-anchor': 'middle', 'font-size': 11, fill: C.teal, 'font-weight': 700 }, svg, hb + 'x');
      el('rect', { x: x0 + X, y: y0 + X, width: hb * u, height: hb * u, fill: C.aprS, stroke: C.apr, 'stroke-dasharray': '4 3', 'stroke-width': 1.6 }, svg); el('text', { x: x0 + X + hb * u + 6, y: y0 + X + hb * u / 2 + 4, 'font-size': 10.5, fill: C.apr, 'font-weight': 700 }, svg, '(' + hb + ')² = ' + F.sq);
      out.innerHTML = '<div class="vz-eq">x² ' + sg(b) + 'x ' + sg(c) + ' = (x ' + sg(b / 2) + ')² ' + sg(c - F.sq) + '</div><ul class="vz-facts"><li>' + B('x² and ' + hb * 2 + ' strips of x (half on each side) make a square with one corner missing.', 'x² 加上 ' + hb * 2 + ' 条 x（左右各一半）拼成缺一个角的正方形。') + '</li>' +
        '<li>' + B('The missing corner is (half of ' + num(Math.abs(b)) + ')² = ' + F.sq + '. Add it, then subtract it so nothing changes.', '缺的角是（' + num(Math.abs(b)) + ' 的一半）² = ' + F.sq + '。补上，再减掉，式子的值不变。') + '</li>' +
        '<li>' + B('Vertex: ', '顶点：') + '(' + num(F.vertex[0]) + ', ' + num(F.vertex[1]) + ')' + (b < 0 ? ' · ' + B('negative b means the strips are subtracted: the bracket is (x − ' + hb + ')', 'b 为负时长条是减去的：括号里是 (x − ' + hb + ')') : '') + '</li></ul>';
    }
    slider(ctl, 'b', 'b', range(-10, 10, 2, true), 6, function (v) { st.b = v; draw(); }); slider(ctl, 'c', 'c', range(-10, 10), 2, function (v) { st.c = v; draw(); }); draw();
  };
  W.maxmin = function (host) {      // fence: width w, perimeter P, area w(P/2 - w)
    var svg = box(host, [320, 250]), out = readout(host), ctl = document.createElement('div'); ctl.className = 'vz-ctls'; host.appendChild(ctl); var st = { P: 40, w: 4 }, w2;
    function draw() {
      var P = st.P, half = P / 2, w = Math.min(st.w, half - 1), A = w * (half - w), M = maxAreaFacts(P);
      svg.innerHTML = ''; var ym = Math.ceil((M.area + 10) / 20) * 20, f = frame(svg, 320, 250, [0, 30], [0, ym], 5, ym > 120 ? 40 : 20);
      f.curve(function (x) { return x * (half - x); }, C.acc, 0, half, half / 200); f.vline(w, C.apr); f.dot(w, A, C.rose, 5.5); f.dot(M.w, M.area, C.teal, 4.5);
      f.label(M.w + 0.5, M.area + ym * 0.04, 'max ' + num(M.area), 'start', C.teal);
      out.innerHTML = '<div class="vz-eq">' + B('width', '宽') + ' w = ' + w + ' · ' + B('length', '长') + ' = ' + (half) + ' − ' + w + ' = ' + (half - w) + ' · ' + B('area', '面积') + ' = ' + A + '</div><ul class="vz-facts"><li>' + B('With ' + P + ' m of fence the sides add to ' + half + ', so the area is w(' + half + ' − w): a downward parabola.', P + ' 米围栏，两边之和是 ' + half + '，面积 = w(' + half + ' − w)：开口向下的抛物线。') + '</li>' +
        '<li>' + B('The best width is halfway between the zeros 0 and ' + half + ': w = ' + num(M.w) + ', giving ' + num(M.area) + ' (a square).', '最好的宽在两个零点 0 和 ' + half + ' 的正中间：w = ' + num(M.w) + '，面积 ' + num(M.area) + '（正方形）。') + '</li></ul>';
    }
    slider(ctl, 'P', B('fence', '围栏'), range(20, 60, 4), 40, function (v) { st.P = v; draw(); }); w2 = slider(ctl, 'w', B('width w', '宽 w'), range(1, 29), 4, function (v) { st.w = v; draw(); }); draw();
  };
  W.rational = function (host) {    // f(x) = (x-r)(x-s) / ((x-r)(x-t))
    var svg = box(host, [320, 250]), f = frame(svg, 320, 250, [-8, 8], [-8, 8]), out = readout(host), ctl = document.createElement('div'); ctl.className = 'vz-ctls'; host.appendChild(ctl); var st = { r: 3, s: -2, t: 1 };
    function draw() {
      f.clear(); var r = st.r, s = st.s, t = st.t; while (t === r || t === s) t = t + 1; var F = rationalFacts(r, s, t);
      f.vline(t, C.apr); f.curve(function (x) { return Math.abs(x - t) < 0.02 ? null : (x - s) / (x - t); }, C.acc, -8, 8, 0.02);
      if (F.zero !== null) f.dot(s, 0, C.teal, 4.5); f.ring(r, F.hole[1], C.rose);
      f.label(r + 0.4, F.hole[1] + 0.9, 'hole', 'start', C.rose);
      out.innerHTML = '<div class="vz-eq">(x ' + sg(-r) + ')(x ' + sg(-s) + ') / ((x ' + sg(-r) + ')(x ' + sg(-t) + ')) = (x ' + sg(-s) + ') / (x ' + sg(-t) + ')</div><ul class="vz-facts">' +
        '<li>' + B('Non-permissible values (from the ORIGINAL denominator): x ≠ ' + num(F.excluded[0]) + ' and x ≠ ' + num(F.excluded[1]), '不允许值（看「原来的」分母）：x ≠ ' + num(F.excluded[0]) + ' 且 x ≠ ' + num(F.excluded[1])) + '</li>' +
        '<li>' + B('x = ' + num(r) + ' cancelled, so the graph has a hole there (open circle); x = ' + num(t) + ' is still in the denominator, so there is a vertical asymptote (dashed line).', 'x = ' + num(r) + ' 被约掉了，图象在那里有个洞（空心圆）；x = ' + num(t) + ' 还留在分母里，所以有竖直渐近线（虚线）。') + '</li></ul>';
    }
    slider(ctl, 'r', B('hole at', '洞在'), range(-6, 6), 3, function (v) { st.r = v; draw(); }); slider(ctl, 's', B('zero at', '零点在'), range(-6, 6), -2, function (v) { st.s = v; draw(); }); slider(ctl, 't', B('asymptote', '渐近线'), range(-6, 6), 1, function (v) { st.t = v; draw(); }); draw();
  };

  /* ---------------- mount ---------------- */
  document.querySelectorAll('.viz[data-viz]').forEach(function (fig) {
    var name = fig.getAttribute('data-viz'), body = fig.querySelector('.vz-body');
    if (!W[name] || !body) return;
    try { body.innerHTML = ''; W[name](body); fig.classList.add('live'); } catch (e) { body.innerHTML = '<p class="muted small">' + B('This picture needs a newer browser.', '这张图需要较新的浏览器。') + '</p>'; }
  });
})(typeof window !== 'undefined' ? window : this);
