document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));

    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});

if (window.renderMathInElement) {
  renderMathInElement(document.body, {
    delimiters: [{ left: '$$', right: '$$', display: true }]
  });
}

// ---------------------------------------------------------------------------
// Generic 2D LP feasible-region grapher.
// Give it the constraint coefficients and it computes the feasible polygon,
// the optimal vertex, and draws everything as SVG — nothing is hand-placed.
// ---------------------------------------------------------------------------
(function () {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Keep the half-plane in the form a*x + b*y <= c.
  function clipPolygon(poly, a, b, c) {
    const out = [];
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const curr = poly[i];
      const prev = poly[(i + n - 1) % n];
      const currIn = a * curr.x + b * curr.y <= c + 1e-9;
      const prevIn = a * prev.x + b * prev.y <= c + 1e-9;
      if (currIn !== prevIn) out.push(segmentPlaneIntersection(prev, curr, a, b, c));
      if (currIn) out.push(curr);
    }
    return out;
  }

  function segmentPlaneIntersection(p1, p2, a, b, c) {
    const d1 = a * p1.x + b * p1.y - c;
    const d2 = a * p2.x + b * p2.y - c;
    const t = d1 / (d1 - d2);
    return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
  }

  // Intersect every constraint (plus x>=0, y>=0) against a generous bounding
  // box to get the feasible polygon.
  function feasibleRegion(constraints, xMax, yMax) {
    let poly = [
      { x: 0, y: 0 },
      { x: xMax, y: 0 },
      { x: xMax, y: yMax },
      { x: 0, y: yMax }
    ];
    const all = constraints.concat([
      { a: -1, b: 0, c: 0 }, // x >= 0
      { a: 0, b: -1, c: 0 }  // y >= 0
    ]);
    for (const { a, b, c } of all) poly = clipPolygon(poly, a, b, c);
    return poly;
  }

  // Clip the infinite line a*x + b*y = c against a rectangular box using
  // Liang-Barsky parametric clipping, so we can draw each constraint's full
  // boundary (not just the segment that ends up binding).
  function clipLineToBox(a, b, c, xMax, yMax) {
    let p0;
    if (Math.abs(a) > 1e-9) p0 = { x: c / a, y: 0 };
    else p0 = { x: 0, y: c / b };
    const dir = { x: -b, y: a };
    const FAR = 1e4;
    const p1 = { x: p0.x - FAR * dir.x, y: p0.y - FAR * dir.y };
    const p2 = { x: p0.x + FAR * dir.x, y: p0.y + FAR * dir.y };

    const box = [
      { a: -1, b: 0, c: 0 },
      { a: 1, b: 0, c: xMax },
      { a: 0, b: -1, c: 0 },
      { a: 0, b: 1, c: yMax }
    ];
    let tmin = 0, tmax = 1;
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    for (const plane of box) {
      const p = plane.a * dx + plane.b * dy;
      const q = plane.c - (plane.a * p1.x + plane.b * p1.y);
      if (Math.abs(p) < 1e-9) {
        if (q < 0) return null;
      } else {
        const r = q / p;
        if (p < 0) { if (r > tmax) return null; if (r > tmin) tmin = r; }
        else { if (r < tmin) return null; if (r < tmax) tmax = r; }
      }
    }
    if (tmin > tmax) return null;
    return {
      x1: p1.x + tmin * dx, y1: p1.y + tmin * dy,
      x2: p1.x + tmax * dx, y2: p1.y + tmax * dy
    };
  }

  function el(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }

  function renderLPGraph(container, config) {
    const { xMax, yMax, constraints, objective, varNames } = config;
    const scale = 40, padL = 50, padR = 25, padT = 20, padB = 30;
    const width = padL + xMax * scale + padR;
    const height = padT + yMax * scale + padB;
    const originX = padL, originY = height - padB;
    const toScreen = (x, y) => ({ x: originX + x * scale, y: originY - y * scale });

    const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': 'Feasible region graph' });

    // feasible polygon
    const poly = feasibleRegion(constraints, xMax, yMax);
    const polyPts = poly.map(p => toScreen(p.x, p.y));
    svg.appendChild(el('polygon', {
      points: polyPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
      fill: '#1a1a1a', 'fill-opacity': '0.06', stroke: '#1a1a1a', 'stroke-opacity': '0.5', 'stroke-width': '1.5'
    }));

    // each constraint's full boundary line, dashed/faded, for context
    constraints.forEach(cons => {
      const seg = clipLineToBox(cons.a, cons.b, cons.c, xMax, yMax);
      if (!seg) return;
      const s1 = toScreen(seg.x1, seg.y1), s2 = toScreen(seg.x2, seg.y2);
      svg.appendChild(el('line', {
        x1: s1.x.toFixed(1), y1: s1.y.toFixed(1), x2: s2.x.toFixed(1), y2: s2.y.toFixed(1),
        stroke: cons.color, 'stroke-width': '1.5', 'stroke-dasharray': '5,4', 'stroke-opacity': '0.6'
      }));
    });

    // axes
    const o = toScreen(0, 0);
    svg.appendChild(el('line', { x1: o.x, y1: o.y, x2: (originX + xMax * scale + 10).toFixed(1), y2: o.y, stroke: '#333' }));
    svg.appendChild(el('line', { x1: o.x, y1: o.y, x2: o.x, y2: (padT - 5).toFixed(1), stroke: '#333' }));

    // ticks + labels, every integer
    for (let x = 0; x <= xMax; x++) {
      const s = toScreen(x, 0);
      svg.appendChild(el('line', { x1: s.x, y1: s.y, x2: s.x, y2: s.y + 5, stroke: '#333' }));
      svg.appendChild(el('text', { x: s.x, y: s.y + 18, 'font-size': '11', fill: '#555', 'text-anchor': 'middle' })).textContent = x;
    }
    for (let y = 0; y <= yMax; y++) {
      const s = toScreen(0, y);
      svg.appendChild(el('line', { x1: s.x - 5, y1: s.y, x2: s.x, y2: s.y, stroke: '#333' }));
      const t = el('text', { x: s.x - 11, y: s.y + 3, 'font-size': '11', fill: '#555', 'text-anchor': 'end' });
      t.textContent = y;
      svg.appendChild(t);
    }

    // axis variable labels
    const xLabel = el('text', { x: originX + xMax * scale + 15, y: o.y + 4, 'font-size': '12', fill: '#1a1a1a' });
    xLabel.textContent = varNames[0];
    svg.appendChild(xLabel);
    const yLabel = el('text', { x: o.x, y: padT - 10, 'font-size': '12', fill: '#1a1a1a', 'text-anchor': 'middle' });
    yLabel.textContent = varNames[1];
    svg.appendChild(yLabel);

    // optimal vertex = polygon point maximizing the objective
    let best = poly[0], bestVal = -Infinity;
    poly.forEach(p => {
      const v = objective.a * p.x + objective.b * p.y;
      if (v > bestVal) { bestVal = v; best = p; }
    });
    const bs = toScreen(best.x, best.y);
    svg.appendChild(el('circle', { cx: bs.x.toFixed(1), cy: bs.y.toFixed(1), r: 4, fill: '#1a1a1a' }));
    const labelLeft = bs.x > width * 0.55;
    const label = el('text', {
      x: (bs.x + (labelLeft ? -10 : 10)).toFixed(1), y: (bs.y - 8).toFixed(1),
      'font-size': '11', fill: '#1a1a1a', 'text-anchor': labelLeft ? 'end' : 'start'
    });
    label.textContent = `optimal: (${fmt(best.x)}, ${fmt(best.y)})`;
    svg.appendChild(label);

    container.innerHTML = '';
    container.appendChild(svg);

    // legend, built from the same constraint list used to draw the lines
    const legend = document.createElement('div');
    legend.className = 'lp-legend';
    constraints.forEach(cons => {
      const span = document.createElement('span');
      const swatch = document.createElement('i');
      swatch.style.background = cons.color;
      span.appendChild(swatch);
      span.appendChild(document.createTextNode(cons.label));
      legend.appendChild(span);
    });
    container.appendChild(legend);

    // caption with the computed optimum and profit filled in
    const caption = document.createElement('p');
    caption.textContent = `The shaded region is every feasible production plan. The best one sits at a corner — here, (${varNames[0]}, ${varNames[1]}) = (${fmt(best.x)}, ${fmt(best.y)}), for a profit of ${fmt(bestVal)}.`;
    container.appendChild(caption);
  }

  function fmt(n) {
    return Math.abs(n - Math.round(n)) < 1e-6 ? String(Math.round(n)) : n.toFixed(2);
  }

  const mount = document.getElementById('lp-graph-root');
  if (mount) {
    renderLPGraph(mount, {
      xMax: 8,
      yMax: 7,
      varNames: ['x₁', 'x₂'],
      objective: { a: 5, b: 4 },
      constraints: [
        { a: 2, b: 4, c: 24, color: '#1a1a1a', label: 'milk: 2x₁ + 4x₂ ≤ 24' },
        { a: 1, b: 0, c: 6, color: '#e64980', label: 'peppermint extract: x₁ ≤ 6' },
        { a: 0, b: 1, c: 5, color: '#3b6bd6', label: 'blueberries: x₂ ≤ 5' }
      ]
    });
  }
})();
