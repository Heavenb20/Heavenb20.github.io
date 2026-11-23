// Live charts drawn from the real outputs of each project (data/charts.js, window.CHARTS).
// Every chart: drawn at its real width, redrawn on resize, a hover/tap tooltip,
// a draw-in the first time it scrolls into view, and a screen-reader table.
(function () {
  var D = window.CHARTS;
  if (!D) return;
  var NS = 'http://www.w3.org/2000/svg';
  var css = getComputedStyle(document.documentElement);
  function v(n) { return css.getPropertyValue(n).trim(); }
  var C = { a: v('--lime'), b: v('--slate'), ctx: v('--context'), ink: v('--ink'), ink2: v('--ink-2'), ink3: v('--ink-3'), line: v('--line'), bg: v('--plate') };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var nf = function (d) { return new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); };
  var int = nf(0), one = nf(1);
  function signed(f, x) { return (x > 0 ? '+' : '') + f.format(x).replace('-', '−'); }

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, s, attrs) {
    var t = el('text', Object.assign({ x: x, y: y }, attrs || {}), parent);
    t.textContent = s;
    return t;
  }
  function ticks(lo, hi, n) {
    var span = hi - lo, step = Math.pow(10, Math.floor(Math.log10(span / n)));
    [1, 2, 2.5, 5, 10].some(function (m) { if (span / (step * m) <= n) { step *= m; return true; } });
    var out = [];
    for (var t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) out.push(+t.toFixed(6));
    return out;
  }

  // ---------- shared figure plumbing ----------
  function setup(fig) {
    var plot = fig.querySelector('.plot');
    if (!plot) { plot = document.createElement('div'); plot.className = 'plot'; fig.insertBefore(plot, fig.firstChild); }
    var tip = fig.querySelector('.tip');
    if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; tip.setAttribute('aria-hidden', 'true'); plot.appendChild(tip); }
    return { plot: plot, tip: tip };
  }
  function svgFor(plot, W, H, label) {
    var old = plot.querySelector('svg');
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': label });
    if (old) plot.replaceChild(svg, old); else plot.insertBefore(svg, plot.firstChild);
    return svg;
  }
  function showTip(o, html, x, y, W) {
    o.tip.innerHTML = html;
    o.tip.classList.add('on');
    var tw = o.tip.offsetWidth, th = o.tip.offsetHeight;
    var left = Math.min(Math.max(x - tw / 2, 0), W - tw);
    var top = y - th - 14;
    if (top < 0) top = y + 18;
    o.tip.style.transform = 'translate(' + left + 'px,' + top + 'px)';
  }
  function hideTip(o) { o.tip.classList.remove('on'); }
  function srTable(fig, head, rows) {
    if (fig.querySelector('.sr-table')) return;
    var box = document.createElement('div');
    box.className = 'sr-only sr-table';
    var t = document.createElement('table');
    box.appendChild(t);
    var cap = fig.querySelector('figcaption');
    if (cap) { var c = document.createElement('caption'); c.textContent = cap.textContent; t.appendChild(c); }
    var tr = document.createElement('tr');
    head.forEach(function (h) { var th = document.createElement('th'); th.scope = 'col'; th.textContent = h; tr.appendChild(th); });
    t.appendChild(tr);
    rows.forEach(function (r) {
      var row = document.createElement('tr');
      r.forEach(function (cell) { var td = document.createElement('td'); td.textContent = cell; row.appendChild(td); });
      t.appendChild(row);
    });
    fig.appendChild(box);
  }
  function legend(fig, items) {
    if (fig.querySelector('.legend')) return;
    var ul = document.createElement('ul');
    ul.className = 'legend';
    items.forEach(function (it) {
      var li = document.createElement('li');
      var sw = document.createElement('span');
      sw.className = 'sw' + (it.dash ? ' dash' : '');
      sw.style.background = it.dash ? 'none' : it.color;
      if (it.dash) sw.style.borderColor = it.color;
      li.append(sw, document.createTextNode(it.name));
      ul.appendChild(li);
    });
    fig.insertBefore(ul, fig.querySelector('.plot'));
  }

  // ---------- line chart (months or seasons on x) ----------
  function line(fig, d, o) {
    var W = o.plot.clientWidth, narrow = W < 520;
    var H = Math.round(Math.min(Math.max(W * (fig.dataset.aspect ? +fig.dataset.aspect : 0.52), 240), 440));
    var all = [].concat.apply([], d.series.map(function (s) { return s.values; }));
    var lo = +fig.dataset.min || Math.floor(Math.min.apply(null, all) - 1), hi = +fig.dataset.max || Math.ceil(Math.max.apply(null, all) + 1);
    var endLabelW = narrow ? 8 : 150;
    var M = { t: 16, r: endLabelW, b: 30, l: 40 };
    var x = function (i) { return M.l + i * (W - M.l - M.r) / (d.x.length - 1); };
    var y = function (val) { return M.t + (hi - val) / (hi - lo) * (H - M.t - M.b); };
    var svg = svgFor(o.plot, W, H, fig.getAttribute('aria-label') || '');
    var unit = fig.dataset.unit || '';
    ticks(lo, hi, narrow ? 4 : 6).forEach(function (t) {
      el('line', { x1: M.l, x2: W - M.r + (narrow ? 0 : 8), y1: y(t), y2: y(t), class: 'grid' }, svg);
      text(svg, M.l - 8, y(t) + 4, (t % 1 ? one.format(t) : int.format(t)) + unit, { class: 'tick', 'text-anchor': 'end' });
    });
    var every = narrow && d.x.length > 6 ? 2 : 1;
    d.x.forEach(function (lab, i) { if (i % every === 0) text(svg, x(i), H - 8, lab, { class: 'tick', 'text-anchor': 'middle' }); });
    var colors = [C.a, C.b];
    d.series.forEach(function (s, si) {
      var path = s.values.map(function (val, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(val).toFixed(1); }).join('');
      el('path', { d: path, fill: 'none', stroke: colors[si], 'stroke-width': 2.25, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', class: 'draw', pathLength: 1 }, svg);
      var last = s.values.length - 1;
      el('circle', { cx: x(last), cy: y(s.values[last]), r: 3.5, fill: colors[si], class: 'fade' }, svg);
      if (!narrow) text(svg, x(last) + 10, y(s.values[last]) + 4, s.name, { class: 'direct fade' });
    });
    if (fig.dataset.note) {
      var ni = +fig.dataset.noteAt, s0 = d.series[0];
      text(svg, x(ni), y(s0.values[ni]) + 22, fig.dataset.note, { class: 'anno fade', 'text-anchor': 'middle' });
    }
    // crosshair
    var cross = el('line', { y1: M.t, y2: H - M.b, class: 'cross' }, svg);
    var marks = d.series.map(function (s, si) { return el('circle', { r: 5, fill: colors[si], stroke: C.bg, 'stroke-width': 2, class: 'hovermark' }, svg); });
    var hit = el('rect', { x: M.l - 10, y: 0, width: W - M.l - M.r + 20, height: H, fill: 'transparent' }, svg);
    function move(e) {
      var r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * W / r.width;
      var i = Math.max(0, Math.min(d.x.length - 1, Math.round((px - M.l) / ((W - M.l - M.r) / (d.x.length - 1)))));
      cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.classList.add('on');
      var rows = d.series.map(function (s, si) {
        marks[si].setAttribute('cx', x(i)); marks[si].setAttribute('cy', y(s.values[i])); marks[si].classList.add('on');
        return '<span class="k"><i style="background:' + colors[si] + '"></i>' + s.name + '</span><b>' + one.format(s.values[i]) + unit + '</b>';
      });
      showTip(o, '<strong>' + (fig.dataset.xname ? fig.dataset.xname + ' ' : '') + d.x[i] + '</strong>' + rows.join(''), x(i) * r.width / W, y(d.series[0].values[i]) * r.height / H, r.width);
    }
    function leave() { cross.classList.remove('on'); marks.forEach(function (m) { m.classList.remove('on'); }); hideTip(o); }
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', leave);
    legend(fig, d.series.map(function (s, si) { return { name: s.name, color: colors[si] }; }));
    srTable(fig, [fig.dataset.xname || 'Period'].concat(d.series.map(function (s) { return s.name; })),
      d.x.map(function (lab, i) { return [lab].concat(d.series.map(function (s) { return one.format(s.values[i]) + unit; })); }));
  }

  // ---------- horizontal bars: one value per row, or two (paired), or signed (diverging) ----------
  function bars(fig, rows, o, mode) {
    var W = o.plot.clientWidth, narrow = W < 560;
    var keys = mode === 'pair' ? JSON.parse(fig.dataset.keys) : null;
    var per = keys ? keys.length : 1;
    var barH = keys ? 11 : 16, gap = keys ? 3 : 0;
    var labelAbove = narrow;
    var rowH = per * barH + (per - 1) * gap + (labelAbove ? 38 : 18);
    var maxLab = Math.max.apply(null, rows.map(function (r) { return r.label.length; }));
    var M = { t: 6, r: 64, b: 26, l: labelAbove ? 0 : Math.min(Math.max(maxLab * 7.4 + 14, 90), W * 0.42) };
    var H = M.t + rows.length * rowH + M.b;
    var unit = fig.dataset.unit || '';
    var dec = +fig.dataset.dec || 0, fmt = nf(dec);
    var svg = svgFor(o.plot, W, H, fig.getAttribute('aria-label') || '');
    var vals = [].concat.apply([], rows.map(function (r) { return keys ? keys.map(function (k) { return r[k.k]; }) : [r.value]; }));
    var lo = mode === 'div' ? Math.min(0, Math.min.apply(null, vals)) : 0;
    var hi = +fig.dataset.max || Math.max.apply(null, vals);
    if (mode === 'div') { var ext = Math.max(Math.abs(lo), Math.abs(hi)) * 1.22; lo = -ext; hi = ext; }
    var x = function (val) { return M.l + (val - lo) / (hi - lo) * (W - M.l - M.r); };
    ticks(lo, hi, narrow ? 4 : 5).forEach(function (t) {
      el('line', { x1: x(t), x2: x(t), y1: M.t, y2: H - M.b + 4, class: t === 0 ? 'zero' : 'grid' }, svg);
      text(svg, x(t), H - 6, (mode === 'div' ? signed(int, t) : int.format(t)) + unit, { class: 'tick', 'text-anchor': 'middle' });
    });
    var hl = fig.dataset.highlight !== undefined ? +fig.dataset.highlight : -1;
    var colors = keys ? keys.map(function (k, i) { return i ? C.b : C.a; }) : null;
    var hits = [];
    rows.forEach(function (r, ri) {
      var top = M.t + ri * rowH + (labelAbove ? 24 : 9);
      if (labelAbove) text(svg, 0, top - 8, r.label, { class: 'cat' });
      else text(svg, M.l - 10, top + (per * barH + (per - 1) * gap) / 2 + 4, r.label, { class: 'cat', 'text-anchor': 'end' });
      (keys || [{ k: 'value' }]).forEach(function (k, ki) {
        var val = r[k.k], y0 = top + ki * (barH + gap);
        var x0 = x(Math.min(0, val)), x1 = x(Math.max(0, val));
        var fill = keys ? colors[ki] : mode === 'div' ? (val >= 0 ? C.a : C.b) : (hl < 0 || ri === hl ? C.a : C.ctx);
        el('rect', { x: x0, y: y0, width: Math.max(x1 - x0, 1), height: barH, rx: 2, fill: fill, class: 'grow' + (val < 0 ? ' neg' : '') }, svg);
        var lx = val >= 0 ? x1 + 6 : x0 - 6;
        text(svg, lx, y0 + barH / 2 + 4, (mode === 'div' ? signed(fmt, val) : fmt.format(val)) + unit, { class: 'val fade', 'text-anchor': val >= 0 ? 'start' : 'end' });
      });
      var h = el('rect', { x: 0, y: top - (labelAbove ? 18 : 8), width: W, height: rowH, fill: 'transparent', class: 'rowhit' }, svg);
      h.addEventListener('pointerenter', function () { tipRow(r, ri, top); });
      h.addEventListener('pointerdown', function () { tipRow(r, ri, top); });
      hits.push(h);
    });
    function tipRow(r, ri, top) {
      var rect = svg.getBoundingClientRect(), s = rect.width / W;
      var body = keys ? keys.map(function (k, ki) { return '<span class="k"><i style="background:' + colors[ki] + '"></i>' + k.name + '</span><b>' + fmt.format(r[k.k]) + unit + '</b>'; }).join('')
        : '<span class="k">' + (fig.dataset.vname || 'Value') + '</span><b>' + (mode === 'div' ? signed(fmt, r.value) : fmt.format(r.value)) + unit + '</b>';
      if (r.n !== undefined) body += '<span class="k">Late requests</span><b>' + int.format(r.n) + '</b>';
      if (r.closed !== undefined) body += '<span class="k">Closed requests</span><b>' + int.format(r.closed) + '</b>';
      if (r.pct !== undefined) body += '<span class="k">On time</span><b>' + one.format(r.pct) + '%</b>';
      svg.querySelectorAll('.rowhit').forEach(function (e, i) { e.classList.toggle('on', i === ri); });
      showTip(o, '<strong>' + r.label + '</strong>' + body, x(keys ? r[keys[0].k] : Math.max(0, r.value)) * s, top * s, rect.width);
    }
    svg.addEventListener('pointerleave', function () { hideTip(o); svg.querySelectorAll('.rowhit').forEach(function (e) { e.classList.remove('on'); }); });
    if (keys) legend(fig, keys.map(function (k, i) { return { name: k.name, color: colors[i] }; }));
    srTable(fig, ['Category'].concat(keys ? keys.map(function (k) { return k.name; }) : [fig.dataset.vname || 'Value']),
      rows.map(function (r) { return [r.label].concat(keys ? keys.map(function (k) { return fmt.format(r[k.k]) + unit; }) : [fmt.format(r.value) + unit]); }));
  }

  // ---------- ROC curve ----------
  function roc(fig, d, o) {
    var W = o.plot.clientWidth, S = Math.min(W, 460);
    var M = { t: 12, r: 14, b: 40, l: 48 }, H = S;
    var pw = S - M.l - M.r, ph = H - M.t - M.b;
    var x = function (val) { return M.l + val * pw; }, y = function (val) { return M.t + (1 - val) * ph; };
    var svg = svgFor(o.plot, S, H, fig.getAttribute('aria-label') || '');
    [0, 0.25, 0.5, 0.75, 1].forEach(function (t) {
      el('line', { x1: x(t), x2: x(t), y1: M.t, y2: M.t + ph, class: 'grid' }, svg);
      el('line', { x1: M.l, x2: M.l + pw, y1: y(t), y2: y(t), class: 'grid' }, svg);
      text(svg, x(t), H - 22, int.format(t * 100) + '%', { class: 'tick', 'text-anchor': 'middle' });
      text(svg, M.l - 8, y(t) + 4, int.format(t * 100) + '%', { class: 'tick', 'text-anchor': 'end' });
    });
    text(svg, M.l + pw / 2, H - 4, 'Non-buyers wrongly flagged', { class: 'axis', 'text-anchor': 'middle' });
    text(svg, 12, M.t + ph / 2, 'Buyers caught', { class: 'axis', 'text-anchor': 'middle', transform: 'rotate(-90 12 ' + (M.t + ph / 2) + ')' });
    el('line', { x1: x(0), y1: y(0), x2: x(1), y2: y(1), class: 'chance' }, svg);
    var pts = d.pts;
    var p = pts.map(function (q, i) { return (i ? 'L' : 'M') + x(q[0]).toFixed(1) + ',' + y(q[1]).toFixed(1); }).join('');
    el('path', { d: p + 'L' + x(1) + ',' + y(0) + 'L' + x(0) + ',' + y(0) + 'Z', fill: C.a, 'fill-opacity': 0.08, class: 'fade' }, svg);
    el('path', { d: p, fill: 'none', stroke: C.a, 'stroke-width': 2.25, class: 'draw', pathLength: 1 }, svg);
    // the model's real operating point (threshold 0.5) from the confusion matrix
    var cm = d.cm, op = [cm[0][1] / (cm[0][0] + cm[0][1]), cm[1][1] / (cm[1][0] + cm[1][1])];
    el('circle', { cx: x(op[0]), cy: y(op[1]), r: 5, fill: C.bg, stroke: C.ink, 'stroke-width': 2, class: 'fade' }, svg);
    text(svg, x(op[0]) + 10, y(op[1]) + 18, 'Threshold 0.5', { class: 'anno fade' });
    text(svg, x(0.62), y(0.36), 'AUC ' + d.auc.toFixed(2), { class: 'big fade' });
    text(svg, x(0.62), y(0.36) + 18, 'Random guess = 0.50', { class: 'anno fade' });
    var mark = el('circle', { r: 5, fill: C.a, stroke: C.bg, 'stroke-width': 2, class: 'hovermark' }, svg);
    var hit = el('rect', { x: M.l, y: M.t, width: pw, height: ph, fill: 'transparent' }, svg);
    function move(e) {
      var r = svg.getBoundingClientRect(), fx = ((e.clientX - r.left) * S / r.width - M.l) / pw;
      var best = pts[0];
      pts.forEach(function (q) { if (Math.abs(q[0] - fx) < Math.abs(best[0] - fx)) best = q; });
      mark.setAttribute('cx', x(best[0])); mark.setAttribute('cy', y(best[1])); mark.classList.add('on');
      showTip(o, '<strong>Flag a session above ' + (best[2] >= 1 ? '1.00' : best[2].toFixed(2)) + '</strong><span class="k">Buyers caught</span><b>' + int.format(best[1] * 100) + '%</b><span class="k">Non-buyers flagged</span><b>' + int.format(best[0] * 100) + '%</b>', x(best[0]) * r.width / S, y(best[1]) * r.height / H, r.width);
    }
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', function () { mark.classList.remove('on'); hideTip(o); });
    srTable(fig, ['Share of non-buyers flagged', 'Share of buyers caught', 'Probability cutoff'],
      pts.filter(function (q, i) { return i % 10 === 0; }).map(function (q) { return [int.format(q[0] * 100) + '%', int.format(q[1] * 100) + '%', q[2].toFixed(2)]; }));
  }

  // ---------- predicted vs actual scatter ----------
  function scatter(fig, d, o) {
    var W = o.plot.clientWidth, narrow = W < 520;
    var H = Math.round(Math.min(Math.max(W * 0.56, 300), 480));
    var M = { t: 12, r: 14, b: 42, l: narrow ? 44 : 56 };
    var all = [].concat.apply([], d.pts.map(function (q) { return [q[0], q[1]]; }));
    var lo = 0, hi = Math.ceil(Math.max.apply(null, all));
    var x = function (val) { return M.l + (val - lo) / (hi - lo) * (W - M.l - M.r); };
    var y = function (val) { return M.t + (hi - val) / (hi - lo) * (H - M.t - M.b); };
    var svg = svgFor(o.plot, W, H, fig.getAttribute('aria-label') || '');
    ticks(lo, hi, 4).forEach(function (t) {
      el('line', { x1: x(t), x2: x(t), y1: M.t, y2: H - M.b, class: 'grid' }, svg);
      el('line', { x1: M.l, x2: W - M.r, y1: y(t), y2: y(t), class: 'grid' }, svg);
      text(svg, x(t), H - 24, '$' + t + 'M', { class: 'tick', 'text-anchor': 'middle' });
      text(svg, M.l - 8, y(t) + 4, '$' + t + 'M', { class: 'tick', 'text-anchor': 'end' });
    });
    text(svg, M.l + (W - M.l - M.r) / 2, H - 4, 'Actual weekly sales', { class: 'axis', 'text-anchor': 'middle' });
    text(svg, 12, M.t + (H - M.t - M.b) / 2, 'Predicted', { class: 'axis', 'text-anchor': 'middle', transform: 'rotate(-90 12 ' + (M.t + (H - M.t - M.b) / 2) + ')' });
    el('line', { x1: x(lo), y1: y(lo), x2: x(hi), y2: y(hi), class: 'chance' }, svg);
    text(svg, x(hi * 0.9), y(hi * 0.9) - 8, 'Perfect forecast', { class: 'anno', 'text-anchor': 'end' });
    var g = el('g', { class: 'fade' }, svg);
    var r0 = narrow ? 2.2 : 2.8;
    d.pts.forEach(function (q) { el('circle', { cx: x(q[0]).toFixed(1), cy: y(q[1]).toFixed(1), r: r0, fill: C.a, 'fill-opacity': 0.5 }, g); });
    var mark = el('circle', { r: 6, fill: 'none', stroke: C.ink, 'stroke-width': 2, class: 'hovermark' }, svg);
    var hit = el('rect', { x: M.l, y: M.t, width: W - M.l - M.r, height: H - M.t - M.b, fill: 'transparent' }, svg);
    var dfmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    function move(e) {
      var r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * W / r.width, py = (e.clientY - r.top) * H / r.height;
      var best = null, bd = 1e9;
      d.pts.forEach(function (q) { var dx = x(q[0]) - px, dy = y(q[1]) - py, dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; best = q; } });
      if (!best || bd > 900) { mark.classList.remove('on'); hideTip(o); return; }
      mark.setAttribute('cx', x(best[0])); mark.setAttribute('cy', y(best[1])); mark.classList.add('on');
      var err = (best[1] - best[0]) / best[0] * 100;
      showTip(o, '<strong>Store ' + best[2] + ', week of ' + dfmt.format(new Date(best[3])) + '</strong><span class="k">Actual</span><b>$' + nf(2).format(best[0]) + 'M</b><span class="k">Predicted</span><b>$' + nf(2).format(best[1]) + 'M</b><span class="k">Error</span><b>' + (err > 0 ? '+' : '−') + one.format(Math.abs(err)) + '%</b>', x(best[0]) * r.width / W, y(best[1]) * r.height / H, r.width);
    }
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', function () { mark.classList.remove('on'); hideTip(o); });
    srTable(fig, ['Measure', 'Value'], [['Store-weeks forecast', int.format(d.n)], ['Average error (MAPE)', one.format(d.mape) + '%']]);
  }

  var TYPES = {
    line: line,
    bar: function (f, d, o) { bars(f, d, o, 'bar'); },
    pair: function (f, d, o) { bars(f, d, o, 'pair'); },
    div: function (f, d, o) { bars(f, d, o, 'div'); },
    roc: roc,
    scatter: scatter
  };

  var figs = [].slice.call(document.querySelectorAll('[data-chart]'));
  function render(fig) {
    var d = D[fig.dataset.chart], fn = TYPES[fig.dataset.type];
    if (!d || !fn) return;
    var o = setup(fig);
    fn(fig, d, o);
    fig.dataset.w = o.plot.clientWidth;
  }
  figs.forEach(render);

  // Draw in once, when the chart first scrolls into view
  if (reduce || !('IntersectionObserver' in window)) {
    figs.forEach(function (f) { f.classList.add('drawn'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('drawn'); io.unobserve(e.target); } });
    }, { threshold: 0.35 });
    figs.forEach(function (f) { f.classList.add('will-draw'); io.observe(f); });
  }

  var timer;
  window.addEventListener('resize', function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      figs.forEach(function (f) { if (+f.dataset.w !== f.querySelector('.plot').clientWidth) render(f); });
    }, 150);
  });
})();
