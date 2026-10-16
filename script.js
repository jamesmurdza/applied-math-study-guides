function activateTab(tab, updateHash) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));

  tab.classList.add('active');
  document.getElementById(tab.dataset.tab).classList.add('active');
  if (updateHash) location.hash = tab.dataset.tab;
}

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => activateTab(tab, true));
});

// Tab state lives in the URL hash — shareable/bookmarkable, and gives
// back/forward button support for free.
function activateFromHash() {
  const id = location.hash.slice(1);
  const tab = id && document.querySelector(`.tab[data-tab="${id}"]`);
  if (tab) activateTab(tab, false);
}

window.addEventListener('hashchange', activateFromHash);
activateFromHash();

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

  // Native <title> tooltip — no extra markup/CSS, just the browser default.
  function withTitle(node, text) {
    const title = el('title', {});
    title.textContent = text;
    node.appendChild(title);
    return node;
  }

  function isFeasible(x, y, constraints) {
    if (x < -1e-9 || y < -1e-9) return false;
    return constraints.every(({ a, b, c }) => a * x + b * y <= c + 1e-9);
  }

  // Every integer point inside [0,xMax] x [0,yMax] that satisfies every constraint.
  function latticePoints(constraints, xMax, yMax) {
    const pts = [];
    for (let x = 0; x <= xMax; x++) {
      for (let y = 0; y <= yMax; y++) {
        if (isFeasible(x, y, constraints)) pts.push({ x, y });
      }
    }
    return pts;
  }

  function renderLPGraph(container, config) {
    const { xMax, yMax, constraints, objective, varNames, varColors, integer } = config;
    const colors = varColors || ['#1a1a1a', '#1a1a1a'];
    const objectiveLabel = config.objectiveLabel || 'value';
    const pointTitle = (p) => `(${fmt(p.x)}, ${fmt(p.y)}): ${objectiveLabel} = ${fmt(objective.a * p.x + objective.b * p.y)}`;
    const scale = 40, padL = 50, padR = 25, padT = 20, padB = 30;
    const width = padL + xMax * scale + padR;
    const height = padT + yMax * scale + padB;
    const originX = padL, originY = height - padB;
    const toScreen = (x, y) => ({ x: originX + x * scale, y: originY - y * scale });

    const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': 'Feasible region graph' });

    // feasible polygon — filled with a subtle gradient running along the
    // objective vector, so shading gets a touch darker toward "better".
    const poly = feasibleRegion(constraints, xMax, yMax);
    const polyPts = poly.map(p => toScreen(p.x, p.y));

    let worst = poly[0], worstVal = Infinity, bestForGrad = poly[0], bestForGradVal = -Infinity;
    poly.forEach(p => {
      const v = objective.a * p.x + objective.b * p.y;
      if (v < worstVal) { worstVal = v; worst = p; }
      if (v > bestForGradVal) { bestForGradVal = v; bestForGrad = p; }
    });
    const gradId = `objGrad-${container.id || Math.random().toString(36).slice(2)}`;
    const defs = el('defs', {});
    const wScreen = toScreen(worst.x, worst.y), bScreen = toScreen(bestForGrad.x, bestForGrad.y);
    const gradient = el('linearGradient', {
      id: gradId, gradientUnits: 'userSpaceOnUse',
      x1: wScreen.x.toFixed(1), y1: wScreen.y.toFixed(1),
      x2: bScreen.x.toFixed(1), y2: bScreen.y.toFixed(1)
    });
    gradient.appendChild(el('stop', { offset: '0%', 'stop-color': '#1a1a1a', 'stop-opacity': '0.02' }));
    gradient.appendChild(el('stop', { offset: '100%', 'stop-color': '#1a1a1a', 'stop-opacity': '0.16' }));
    defs.appendChild(gradient);
    svg.appendChild(defs);

    svg.appendChild(el('polygon', {
      points: polyPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
      fill: `url(#${gradId})`
    }));

    // invisible hover targets on each vertex (continuous mode has no visible
    // dots otherwise) — purely for the native tooltip, no visual change
    if (!integer) {
      poly.forEach(p => {
        const s = toScreen(p.x, p.y);
        svg.appendChild(withTitle(
          el('circle', { cx: s.x.toFixed(1), cy: s.y.toFixed(1), r: 8, fill: '#000', 'fill-opacity': '0' }),
          pointTitle(p)
        ));
      });
    }

    // each constraint's full boundary line, dashed gray, for context
    constraints.forEach(cons => {
      const seg = clipLineToBox(cons.a, cons.b, cons.c, xMax, yMax);
      if (!seg) return;
      const s1 = toScreen(seg.x1, seg.y1), s2 = toScreen(seg.x2, seg.y2);
      svg.appendChild(el('line', {
        x1: s1.x.toFixed(1), y1: s1.y.toFixed(1), x2: s2.x.toFixed(1), y2: s2.y.toFixed(1),
        stroke: '#999', 'stroke-width': '1.5', 'stroke-dasharray': '5,4'
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
    const xLabel = el('text', { x: originX + xMax * scale + 15, y: o.y + 4, 'font-size': '12', 'font-weight': '600', fill: colors[0] });
    xLabel.textContent = varNames[0];
    svg.appendChild(xLabel);
    const yLabel = el('text', { x: o.x, y: padT - 10, 'font-size': '12', 'font-weight': '600', fill: colors[1], 'text-anchor': 'middle' });
    yLabel.textContent = varNames[1];
    svg.appendChild(yLabel);

    // continuous LP-relaxation optimum = polygon point maximizing the objective
    let bestCont = poly[0], bestContVal = -Infinity;
    poly.forEach(p => {
      const v = objective.a * p.x + objective.b * p.y;
      if (v > bestContVal) { bestContVal = v; bestCont = p; }
    });

    let best = bestCont, bestVal = bestContVal;

    if (integer) {
      // lattice points inside the feasible region
      const pts = latticePoints(constraints, xMax, yMax);
      pts.forEach(p => {
        const s = toScreen(p.x, p.y);
        svg.appendChild(el('circle', { cx: s.x.toFixed(1), cy: s.y.toFixed(1), r: 2.5, fill: '#1a1a1a', 'fill-opacity': '0.35' }));
        // slightly larger invisible hit target, same tooltip approach as the continuous vertices
        svg.appendChild(withTitle(
          el('circle', { cx: s.x.toFixed(1), cy: s.y.toFixed(1), r: 6, fill: '#000', 'fill-opacity': '0' }),
          pointTitle(p)
        ));
      });

      // true integer optimum = best lattice point
      let bestInt = pts[0], bestIntVal = -Infinity;
      pts.forEach(p => {
        const v = objective.a * p.x + objective.b * p.y;
        if (v > bestIntVal) { bestIntVal = v; bestInt = p; }
      });
      best = bestInt; bestVal = bestIntVal;

      // hollow marker for the (generally non-integer, and possibly worse-looking) LP relaxation optimum
      if (Math.abs(bestCont.x - bestInt.x) > 1e-6 || Math.abs(bestCont.y - bestInt.y) > 1e-6) {
        const cs = toScreen(bestCont.x, bestCont.y);
        svg.appendChild(withTitle(
          el('circle', { cx: cs.x.toFixed(1), cy: cs.y.toFixed(1), r: 4, fill: 'none', stroke: '#1a1a1a', 'stroke-width': '1.5', 'stroke-dasharray': '2,2' }),
          pointTitle(bestCont)
        ));
        const clabel = el('text', {
          x: (cs.x + 10).toFixed(1), y: (cs.y - 8).toFixed(1),
          'font-size': '10', fill: '#888'
        });
        clabel.textContent = `LP relaxation: (${fmt(bestCont.x)}, ${fmt(bestCont.y)})`;
        svg.appendChild(clabel);
      }
    }

    const bs = toScreen(best.x, best.y);
    svg.appendChild(withTitle(
      el('circle', { cx: bs.x.toFixed(1), cy: bs.y.toFixed(1), r: 4, fill: '#1a1a1a' }),
      pointTitle(best)
    ));
    const label = el('text', {
      x: (bs.x + 10).toFixed(1), y: (bs.y - 8).toFixed(1),
      'font-size': '11', fill: '#1a1a1a'
    });
    label.textContent = `optimal: (${fmt(best.x)}, ${fmt(best.y)})`;
    svg.appendChild(label);

    container.innerHTML = '';
    container.appendChild(svg);

    // caption with the computed optimum and profit filled in
    const caption = document.createElement('p');
    if (integer) {
      caption.textContent = `The shaded region is the continuous feasible area; the dots are the integer points inside it. The best integer point is (${varNames[0]}, ${varNames[1]}) = (${fmt(best.x)}, ${fmt(best.y)}), for a value of ${fmt(bestVal)} — not the same as rounding the LP relaxation's optimum.`;
    } else {
      caption.textContent = `The shaded region is every feasible production plan. The best one sits at a corner — here, (${varNames[0]}, ${varNames[1]}) = (${fmt(best.x)}, ${fmt(best.y)}), for a profit of ${fmt(bestVal)}.`;
    }
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
      varColors: ['#e64980', '#3b6bd6'],
      objective: { a: 5, b: 4 },
      objectiveLabel: 'profit',
      constraints: [
        { a: 2, b: 4, c: 24, color: '#1a1a1a', label: 'milk: 2x₁ + 4x₂ ≤ 24' },
        { a: 1, b: 0, c: 6, color: '#e64980', label: 'peppermint extract: x₁ ≤ 6' },
        { a: 0, b: 1, c: 5, color: '#3b6bd6', label: 'blueberries: x₂ ≤ 5' }
      ]
    });
  }

  const ilpMount = document.getElementById('ilp-graph-root');
  if (ilpMount) {
    renderLPGraph(ilpMount, {
      xMax: 6,
      yMax: 5,
      integer: true,
      varNames: ['x₁', 'x₂'],
      varColors: ['#2f9e44', '#c2525c'],
      objective: { a: 7, b: 10 },
      objectiveLabel: 'protein',
      constraints: [
        { a: 0.7, b: 0.9, c: 3, color: '#1a1a1a', label: 'budget: 0.7x₁ + 0.9x₂ ≤ €3' }
      ]
    });
  }
})();
