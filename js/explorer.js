// Interactive dot plot of every OKC game for one Four Factors measure.
// Data comes from data/okc-games.js (window.OKC_GAMES). Each row:
// [date, opponent, win (1/0), efg, tov_pct, orb_pct, ft_rate, opp_efg, opp_tov_pct, opp_orb_pct, opp_ft_rate]
(function () {
  var G = window.OKC_GAMES;
  var picker = document.getElementById('picker');
  var chart = document.getElementById('chart');
  var readout = document.getElementById('readout');
  var note = document.getElementById('note');
  if (!G || !picker || !chart || !readout || !note) return;

  // Column index in each row, and the logistic regression coefficient (log-odds per 1 SD)
  var FACTORS = [
    { k: 3, id: 'efg', name: 'OKC shooting (eFG%)', coef: 7.8 },
    { k: 7, id: 'opp_efg', name: 'Opponent shooting', coef: -7.3 },
    { k: 8, id: 'opp_tov', name: 'Turnovers OKC forces', coef: 4.5 },
    { k: 4, id: 'tov', name: 'OKC turnovers', coef: -3.4 },
    { k: 10, id: 'opp_ft', name: 'Opponent free throws', coef: -3.1 },
    { k: 9, id: 'opp_orb', name: 'Opponent off. rebounding', coef: -2.4 },
    { k: 5, id: 'orb', name: 'OKC off. rebounding', coef: 2.4 },
    { k: 6, id: 'ft', name: 'OKC free throws', coef: 1.9 }
  ];
  var NS = 'http://www.w3.org/2000/svg';
  var css = getComputedStyle(document.documentElement);
  var COLOR = {
    win: css.getPropertyValue('--chart-win').trim(),
    loss: css.getPropertyValue('--chart-loss').trim(),
    ink: css.getPropertyValue('--ink').trim()
  };
  var pct = new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
  var dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  var wins = G.filter(function (g) { return g[2] === 1; });
  var losses = G.filter(function (g) { return g[2] === 0; });

  var requested = new URLSearchParams(location.search).get('factor');
  var current = FACTORS.find(function (f) { return f.id === requested; }) || FACTORS[0];

  FACTORS.forEach(function (f) {
    var label = document.createElement('label');
    var input = document.createElement('input');
    input.type = 'radio';
    input.name = 'factor';
    input.value = f.id;
    input.checked = f === current;
    input.addEventListener('change', function () {
      current = f;
      draw();
      rememberFactor(f.id);
    });
    label.appendChild(input);
    label.appendChild(document.createTextNode(f.name));
    picker.appendChild(label);
  });

  function rememberFactor(id) {
    try {
      var u = new URL(location.href);
      u.searchParams.set('factor', id);
      history.replaceState(null, '', u);
    } catch (e) { /* URL state is a convenience; the chart works without it */ }
  }

  function svgEl(name, attrs) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function mean(rows, k) {
    return rows.reduce(function (s, g) { return s + g[k]; }, 0) / rows.length;
  }
  // Stable pseudo-random number in [0, 1) for a game, so the layout never changes between draws
  function jitter(i) {
    var x = Math.sin(i * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  function draw() {
    var f = current;
    var vals = G.map(function (g) { return g[f.k]; });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), pad = (hi - lo) * 0.04;
    lo -= pad; hi += pad;
    var W = 1000, H = 360, L = 70, R = 20, BAND = 78, DOT = 5.2;
    var rowY = { 1: 110, 0: 250 };
    var x = function (v) { return L + (v - lo) / (hi - lo) * (W - L - R); };
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': f.name + ' in each of ' + G.length + ' games' });

    [[1, 'Wins'], [0, 'Losses']].forEach(function (r) {
      var t = svgEl('text', { x: 0, y: rowY[r[0]] + 5, 'font-weight': '700' });
      t.textContent = r[1];
      svg.appendChild(t);
    });

    var step = (hi - lo) / 5;
    for (var i = 0; i <= 5; i++) {
      var v = lo + step * i;
      var tick = svgEl('text', { x: x(v), y: H - 6, 'text-anchor': 'middle' });
      tick.textContent = pct.format(v);
      svg.appendChild(tick);
    }

    // Stack dots that land in the same spot; past the band edge, spread them with a stable jitter
    var bins = {};
    G.map(function (g, idx) { return { g: g, idx: idx }; })
      .sort(function (a, b) { return a.g[f.k] - b.g[f.k]; })
      .forEach(function (o) {
        var g = o.g, won = g[2], cx = x(g[f.k]);
        var key = won + ':' + Math.round(cx / (DOT * 2.1));
        var n = bins[key] = (bins[key] || 0) + 1;
        var off = (n % 2 ? 1 : -1) * Math.floor(n / 2) * DOT * 2.05;
        if (Math.abs(off) > BAND / 2) off = (jitter(o.idx) - 0.5) * BAND;
        var dot = svgEl('circle', { cx: cx.toFixed(1), cy: (rowY[won] + off).toFixed(1), r: DOT, fill: won ? COLOR.win : COLOR.loss, class: 'dot' });
        dot.dataset.i = o.idx;
        svg.appendChild(dot);
      });

    [[1, wins], [0, losses]].forEach(function (r) {
      var m = mean(r[1], f.k), y = rowY[r[0]];
      svg.appendChild(svgEl('rect', { x: x(m) - 2, y: y - BAND / 2 - 8, width: 4, height: BAND + 16, fill: COLOR.ink }));
      var t = svgEl('text', { x: x(m), y: y - BAND / 2 - 14, 'text-anchor': 'middle', 'font-weight': '700' });
      t.textContent = 'avg ' + pct.format(m);
      svg.appendChild(t);
    });
    chart.replaceChildren(svg);

    readout.replaceChildren(
      stat(pct.format(mean(wins, f.k)), 'average in ' + wins.length + ' wins', 'win'),
      stat(pct.format(mean(losses, f.k)), 'average in ' + losses.length + ' losses', 'loss'),
      stat((f.coef > 0 ? '+' : '−') + Math.abs(f.coef).toFixed(1), 'model effect on win odds')
    );
    note.textContent = 'Hover or tap a dot to see the game.';
  }

  function stat(value, label, kind) {
    var d = document.createElement('div');
    var b = document.createElement('b');
    var s = document.createElement('span');
    b.className = 'num' + (kind ? ' readout-' + kind : '');
    b.textContent = value;
    s.textContent = label;
    d.append(b, s);
    return d;
  }

  function show(e) {
    var t = e.target;
    if (!t.classList || !t.classList.contains('dot')) return;
    var g = G[+t.dataset.i];
    chart.querySelectorAll('.dot').forEach(function (d) { d.style.opacity = d === t ? 1 : 0.35; });
    note.textContent = dateFmt.format(new Date(g[0])) + ' vs. ' + g[1] + ': OKC ' + (g[2] ? 'won' : 'lost') +
      ', ' + current.name + ' ' + pct.format(g[current.k]) + '.';
  }
  function clear() {
    chart.querySelectorAll('.dot').forEach(function (d) { d.style.opacity = ''; });
  }

  chart.addEventListener('pointerover', show);
  chart.addEventListener('click', show);
  chart.addEventListener('pointerleave', clear);
  draw();
})();
