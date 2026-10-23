// Each of Real Analysis / Optimization / Statistics is now its own page
// (real-analysis/, optimization/, statistics/) rather than a hash-toggled
// panel, so navigation between them is just plain <a href> links the
// browser handles natively — no tab-switching JS needed here anymore.

// The subject switcher is a native <details>/<summary> disclosure, so the
// open/close toggle itself needs zero JS. This just adds the usual
// dropdown politeness on top — click outside it, or press Escape, and it
// closes — which <details> doesn't do on its own.
document.querySelectorAll('details.menu-nav').forEach((menu) => {
  document.addEventListener('click', (e) => {
    if (menu.open && !menu.contains(e.target)) menu.open = false;
  });
  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') menu.open = false;
  });
});

// Floating "on this page" table of contents (right-hand gutter, wide
// viewports only — see the min-width media query in style.css). Built
// from the same .topic[id] elements the permalink-icon loop below walks;
// this one runs first so it reads each heading's clean title text before
// that loop prepends a "#" anchor into it.
(function () {
  const topics = Array.from(document.querySelectorAll('.topic[id]'));
  if (topics.length < 2) return; // not worth a TOC for a near-empty page

  const toc = document.createElement('nav');
  toc.className = 'toc';
  toc.setAttribute('aria-label', 'Table of contents');

  const label = document.createElement('p');
  label.className = 'toc-label';
  label.textContent = 'On this page';
  toc.appendChild(label);

  const list = document.createElement('ul');
  const headingToLink = new Map();
  topics.forEach((topic) => {
    const heading = topic.querySelector('h2');
    if (!heading) return;
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = '#' + topic.id;
    a.textContent = heading.textContent.trim();
    li.appendChild(a);
    list.appendChild(li);
    headingToLink.set(heading, a);
  });
  toc.appendChild(list);
  document.querySelector('.container').appendChild(toc);

  // Scrollspy: highlight whichever section's heading you've most recently
  // scrolled past — the usual floating-TOC behavior. Deliberately a plain
  // scroll listener rather than IntersectionObserver: that only fires when
  // a heading *crosses* the trigger line, so there's no event at all when
  // you scroll back above every heading, and the last-active link would
  // just stay stuck active forever. Recomputing from scratch on every
  // scroll (rAF-throttled) instead picks the single heading closest to,
  // but still above, the trigger line — and correctly clears to "none" the
  // moment you're above all of them.
  const headings = Array.from(headingToLink.keys());
  let activeLink = null;
  function updateActiveTocLink() {
    const triggerY = window.innerHeight * 0.15;
    let current = null;
    for (const heading of headings) {
      const top = heading.getBoundingClientRect().top;
      if (top <= triggerY && (!current || top > current.top)) {
        current = { heading, top };
      }
    }
    const next = current ? headingToLink.get(current.heading) : null;
    if (next === activeLink) return; // no change — skip the DOM churn below
    if (activeLink) activeLink.classList.remove('active');
    if (next) next.classList.add('active');
    activeLink = next;
    // Keep the active item in view within the TOC's own scrollable list as
    // it changes — "nearest" only moves the TOC's internal scrollbar (the
    // list is the closest scrollable ancestor; the page itself can't bring
    // a position:fixed element into view by scrolling), smoothly rather
    // than snapping, matching the page's own smooth-scroll anchor behavior.
    if (next) next.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateActiveTocLink();
      ticking = false;
    });
  });
  updateActiveTocLink();
})();

// GitHub-markdown-style permalink icons: every .topic already carries a
// unique id (used for the site's own cross-references, like the "complete"
// link in Open and Closed Sets), so rather than hand-adding an anchor tag
// to all ~30 topic headings across three pages, inject one here — any
// topic with an id gets one for free, including ones added later.
//
// The anchor goes into a wrapping .heading-wrap around the h2, not into
// the h2 itself — see the CSS comment on .heading-wrap for why: it keeps
// the heading's own text and border-bottom flush with the body text
// below, instead of nudging them over to make room for the icon.
document.querySelectorAll('.topic[id]').forEach((topic) => {
  const heading = topic.querySelector('h2');
  if (!heading) return;
  const wrap = document.createElement('div');
  wrap.className = 'heading-wrap';
  heading.before(wrap);
  wrap.appendChild(heading);
  const anchor = document.createElement('a');
  anchor.className = 'heading-anchor';
  anchor.href = '#' + topic.id;
  anchor.setAttribute('aria-label', 'Link to this section');
  anchor.textContent = '#';
  wrap.insertBefore(anchor, heading);
});

if (window.renderMathInElement) {
  renderMathInElement(document.body, {
    delimiters: [{ left: '$$', right: '$$', display: true }]
  });

  // Shrink display equations that are wider than their container instead of
  // letting them scroll — the same "pinned at natural size, fluid below
  // that" rule the diagrams follow, just without a viewBox to pin to.
  //
  // Measuring "natural width" is the subtle part: .katex-display is
  // display:block (from katex.css), so its own offsetWidth/scrollWidth are
  // clamped to the paragraph's width — they can't reveal that KaTeX's
  // inner .base span (the actual formula glyphs, display:inline-block)
  // already needs more room and is silently overflowing past it. Switching
  // .katex-display to inline-block just for the measurement makes the
  // browser's own shrink-to-fit sizing report that true width instead.
  //
  // The overflowing content also renders flush with the paragraph's left
  // edge, not centered within it (confirmed by comparing the pre- and
  // post-scale position of that inner span) — so the shrink has to scale
  // from the left edge too (transform-origin: left top). Scaling from
  // center would shrink the formula by the right amount but center it on
  // a wider box than actually exists, leaving the same overflow on the
  // right that we were trying to remove.
  function fitMathBlocks() {
    document.querySelectorAll('.topic .math .katex-display').forEach((display) => {
      const container = display.closest('.math');
      if (!container) return;
      display.style.transform = 'none';
      display.style.height = 'auto';
      display.style.display = 'inline-block';
      const naturalWidth = display.offsetWidth;
      const naturalHeight = display.offsetHeight;
      display.style.display = '';
      // -3px safety margin: sub-pixel rounding (offsetWidth itself rounds
      // to the nearest integer, and the transform matrix's own pixel
      // snapping can round up) can land a formula a couple of pixels past
      // its container even though the scale was computed "exactly" — and
      // since .math is overflow-x:hidden, not auto, anything past the edge
      // is a genuinely clipped glyph, not just a dormant scrollbar.
      const scale = Math.min(1, (container.clientWidth - 3) / naturalWidth);
      if (scale < 1) {
        display.style.transformOrigin = 'left top';
        display.style.transform = `scale(${scale})`;
        display.style.height = (naturalHeight * scale) + 'px';
      }
    });
  }
  fitMathBlocks();
  // KaTeX's own math fonts load asynchronously, after this script already
  // ran — measuring scrollWidth before they're in means every formula is
  // briefly measured against a fallback font's (narrower) glyph metrics, so
  // the scale computed here can undershoot once the real font swaps in.
  // Re-running once fonts finish loading catches that reflow.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(fitMathBlocks);
  }

  let mathResizeTicking = false;
  window.addEventListener('resize', () => {
    if (mathResizeTicking) return;
    mathResizeTicking = true;
    requestAnimationFrame(() => {
      fitMathBlocks();
      mathResizeTicking = false;
    });
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

  // Small filled triangle pointing along `angle` (radians), tip at `tip`.
  function arrowHead(svg, tip, angle, color, size) {
    size = size || 7;
    const a1 = angle + Math.PI - 0.45, a2 = angle - Math.PI + 0.45;
    const p1 = { x: tip.x + size * Math.cos(a1), y: tip.y + size * Math.sin(a1) };
    const p2 = { x: tip.x + size * Math.cos(a2), y: tip.y + size * Math.sin(a2) };
    svg.appendChild(el('polygon', {
      points: `${tip.x.toFixed(1)},${tip.y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`,
      fill: color
    }));
  }

  // Small HTML legend placed under a chart: one swatch + label per item.
  // item.type is 'line' | 'dashed' | 'fill' | 'dot'; item.color sets the
  // swatch's color via currentColor so the CSS stays shape-only.
  function renderLegend(container, items) {
    const legend = document.createElement('div');
    legend.className = 'chart-legend';
    items.forEach(item => {
      const entry = document.createElement('span');
      entry.className = 'chart-legend-item';
      const swatch = document.createElement('span');
      swatch.className = `chart-legend-swatch ${item.type}`;
      swatch.style.color = item.color;
      entry.appendChild(swatch);
      const label = document.createElement('span');
      label.textContent = item.label;
      entry.appendChild(label);
      legend.appendChild(entry);
    });
    container.appendChild(legend);
  }

  // Custom on-page tooltip — a single shared floating element, shown/moved/
  // hidden via mouse events. More reliable than a native <title> tooltip
  // (no hover delay, works the same everywhere, and is actually verifiable).
  function getTooltipEl() {
    if (!window.__chartTooltip) {
      const div = document.createElement('div');
      div.className = 'chart-tooltip';
      document.body.appendChild(div);
      window.__chartTooltip = div;
    }
    return window.__chartTooltip;
  }

  function withTitle(node, text) {
    node.addEventListener('mouseenter', (e) => {
      const tip = getTooltipEl();
      tip.textContent = text;
      tip.style.display = 'block';
      tip.style.left = (e.clientX + 12) + 'px';
      tip.style.top = (e.clientY + 12) + 'px';
    });
    node.addEventListener('mousemove', (e) => {
      const tip = getTooltipEl();
      tip.style.left = (e.clientX + 12) + 'px';
      tip.style.top = (e.clientY + 12) + 'px';
    });
    node.addEventListener('mouseleave', () => {
      getTooltipEl().style.display = 'none';
    });
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

  // Every integer point inside [0,xMax] x [0,yMax] that fails at least one constraint —
  // drawn very faded, just to show the lattice continuing outside the feasible region.
  function infeasibleLatticePoints(constraints, xMax, yMax) {
    const pts = [];
    for (let x = 0; x <= xMax; x++) {
      for (let y = 0; y <= yMax; y++) {
        if (!isFeasible(x, y, constraints)) pts.push({ x, y });
      }
    }
    return pts;
  }

  function renderLPGraph(container, config) {
    const { xMax, yMax, constraints, objective, varNames, varColors, integer, axisLabels, cut, path } = config;
    const colors = varColors || ['#1a1a1a', '#1a1a1a'];
    const objectiveLabel = config.objectiveLabel || 'value';
    const pointTitle = (p) => `(${fmt(p.x)}, ${fmt(p.y)}): ${objectiveLabel} = ${fmt(objective.a * p.x + objective.b * p.y)}`;
    // A "cut" is just one more constraint — feasibleRegion()/isFeasible() see
    // the tightened set automatically. We keep the original list too, so the
    // pre-cut region can still be drawn for comparison.
    const effectiveConstraints = cut ? constraints.concat([cut]) : constraints;
    // Extra left/bottom room is needed to fit the descriptive axis titles
    // (rotated beside the y-axis, centered under the x-axis) without
    // crowding the tick numbers.
    const scale = 40, padL = axisLabels ? 64 : 50, padR = 25, padT = 20, padB = axisLabels ? 46 : 30;
    const width = padL + xMax * scale + padR;
    const height = padT + yMax * scale + padB;
    const originX = padL, originY = height - padB;
    const toScreen = (x, y) => ({ x: originX + x * scale, y: originY - y * scale });

    const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, style: `width:100%;max-width:${width}px`, role: 'img', 'aria-label': 'Feasible region graph' });
    // Collected and appended last (so they sit on top of every other element
    // in SVG's paint order) — otherwise axis lines, labels, and markers drawn
    // afterward would intercept the hover before it reaches these.
    const hoverTargets = [];

    // feasible polygon — filled with a subtle gradient running along the
    // objective vector, so shading gets a touch darker toward "better".
    const poly = feasibleRegion(effectiveConstraints, xMax, yMax);
    const polyPts = poly.map(p => toScreen(p.x, p.y));

    // pre-cut region, drawn as a faint outline underneath so the slice the
    // cut removes is visible by comparison.
    if (cut) {
      const basePoly = feasibleRegion(constraints, xMax, yMax);
      const basePts = basePoly.map(p => toScreen(p.x, p.y));
      svg.appendChild(el('polygon', {
        points: basePts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
        fill: 'none', stroke: '#bbb', 'stroke-width': '1.5', 'stroke-dasharray': '3,3'
      }));
    }

    // Find the range of objective values across the polygon, but place the
    // gradient's two endpoints ON the true objective-vector line (through the
    // origin), not at whichever vertices happen to be extreme — the chord
    // between two extreme vertices is generally NOT parallel to (a, b).
    let worstVal = Infinity, bestForGradVal = -Infinity;
    poly.forEach(p => {
      const v = objective.a * p.x + objective.b * p.y;
      if (v < worstVal) worstVal = v;
      if (v > bestForGradVal) bestForGradVal = v;
    });
    const gradMag = Math.hypot(objective.a, objective.b) || 1;
    const gradDirX = objective.a / gradMag, gradDirY = objective.b / gradMag;
    // Point on the objective-direction line whose objective value equals v
    // is (v/gradMag)*dir, since a*(t*dirX)+b*(t*dirY) = t*gradMag.
    const worst = { x: (worstVal / gradMag) * gradDirX, y: (worstVal / gradMag) * gradDirY };
    const bestForGrad = { x: (bestForGradVal / gradMag) * gradDirX, y: (bestForGradVal / gradMag) * gradDirY };
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

    // hover targets on each vertex (continuous mode has no visible dots
    // otherwise) — purely for the native tooltip, no visual change
    if (!integer) {
      poly.forEach(p => {
        const s = toScreen(p.x, p.y);
        hoverTargets.push({ x: s.x, y: s.y, r: 8, title: pointTitle(p) });
      });
    }

    // each constraint's full boundary line, dashed gray, for context — except
    // the cut (if any), drawn solid and in its own color since it's the point.
    effectiveConstraints.forEach(cons => {
      const seg = clipLineToBox(cons.a, cons.b, cons.c, xMax, yMax);
      if (!seg) return;
      const s1 = toScreen(seg.x1, seg.y1), s2 = toScreen(seg.x2, seg.y2);
      const isCut = cons === cut;
      svg.appendChild(el('line', {
        x1: s1.x.toFixed(1), y1: s1.y.toFixed(1), x2: s2.x.toFixed(1), y2: s2.y.toFixed(1),
        stroke: isCut ? (cut.color || '#c0392b') : '#999', 'stroke-width': isCut ? '2' : '1.5',
        'stroke-dasharray': isCut ? 'none' : '5,4'
      }));
      if (isCut && cut.label) {
        const mx = (s1.x + s2.x) / 2, my = (s1.y + s2.y) / 2;
        const lbl = el('text', { x: (mx + 6).toFixed(1), y: (my - 6).toFixed(1), 'font-size': '12', fill: cut.color || '#c0392b' });
        lbl.textContent = cut.label;
        svg.appendChild(lbl);
      }
    });

    // axes
    const o = toScreen(0, 0);
    svg.appendChild(el('line', { x1: o.x, y1: o.y, x2: (originX + xMax * scale + 10).toFixed(1), y2: o.y, stroke: '#333' }));
    svg.appendChild(el('line', { x1: o.x, y1: o.y, x2: o.x, y2: (padT - 5).toFixed(1), stroke: '#333' }));

    // ticks + labels, every integer
    for (let x = 0; x <= xMax; x++) {
      const s = toScreen(x, 0);
      svg.appendChild(el('line', { x1: s.x, y1: s.y, x2: s.x, y2: s.y + 5, stroke: '#333' }));
      svg.appendChild(el('text', { x: s.x, y: s.y + 18, 'font-size': '12', fill: '#555', 'text-anchor': 'middle' })).textContent = x;
    }
    for (let y = 0; y <= yMax; y++) {
      const s = toScreen(0, y);
      svg.appendChild(el('line', { x1: s.x - 5, y1: s.y, x2: s.x, y2: s.y, stroke: '#333' }));
      const t = el('text', { x: s.x - 11, y: s.y + 3, 'font-size': '12', fill: '#555', 'text-anchor': 'end' });
      t.textContent = y;
      svg.appendChild(t);
    }

    // axis variable tags, right at the axis tips (original placement)
    const xLabel = el('text', { x: originX + xMax * scale + 15, y: o.y + 4, 'font-size': '12', 'font-weight': '600', fill: colors[0] });
    xLabel.textContent = varNames[0];
    svg.appendChild(xLabel);
    const yLabel = el('text', { x: o.x, y: padT - 10, 'font-size': '12', 'font-weight': '600', fill: colors[1], 'text-anchor': 'middle' });
    yLabel.textContent = varNames[1];
    svg.appendChild(yLabel);

    // axis titles — descriptive name for each variable (e.g. "pink peppermint
    // ice cream, x₁ (l)"), centered under the x-axis and rotated beside the y-axis.
    if (axisLabels) {
      const xTitle = el('text', {
        x: originX + (xMax * scale) / 2, y: height - 6,
        'font-size': '12', 'font-weight': '600', fill: colors[0], 'text-anchor': 'middle'
      });
      xTitle.textContent = axisLabels[0];
      svg.appendChild(xTitle);
      const yTitleY = originY - (yMax * scale) / 2;
      const yTitle = el('text', {
        x: 14, y: yTitleY, 'font-size': '12', 'font-weight': '600', fill: colors[1],
        'text-anchor': 'middle', transform: `rotate(-90, 14, ${yTitleY.toFixed(1)})`
      });
      yTitle.textContent = axisLabels[1];
      svg.appendChild(yTitle);
    }

    // continuous LP-relaxation optimum = polygon point maximizing the objective
    let bestCont = poly[0], bestContVal = -Infinity;
    poly.forEach(p => {
      const v = objective.a * p.x + objective.b * p.y;
      if (v > bestContVal) { bestContVal = v; bestCont = p; }
    });

    // pre-cut optimum, for comparison against the (tighter) post-cut one above
    if (cut) {
      const basePoly = feasibleRegion(constraints, xMax, yMax);
      let baseBest = basePoly[0], baseBestVal = -Infinity;
      basePoly.forEach(p => {
        const v = objective.a * p.x + objective.b * p.y;
        if (v > baseBestVal) { baseBestVal = v; baseBest = p; }
      });
      if (Math.abs(baseBest.x - bestCont.x) > 1e-6 || Math.abs(baseBest.y - bestCont.y) > 1e-6) {
        const cs = toScreen(baseBest.x, baseBest.y);
        svg.appendChild(el('circle', { cx: cs.x.toFixed(1), cy: cs.y.toFixed(1), r: 4, fill: 'none', stroke: '#bbb', 'stroke-width': '1.5', 'stroke-dasharray': '2,2' }));
        const clabel = el('text', { x: (cs.x + 10).toFixed(1), y: (cs.y - 8).toFixed(1), 'font-size': '12', fill: '#999' });
        clabel.textContent = `before cut: (${fmt(baseBest.x)}, ${fmt(baseBest.y)})`;
        svg.appendChild(clabel);
      }
    }

    let best = bestCont, bestVal = bestContVal;

    // Lattice dots can be shown independently of whether the chart's "best"
    // point is the integer optimum (ILP topic) or a continuous one (Gomory,
    // which wants the dots visible but still reports the cut's LP optimum).
    const showLattice = config.showLattice !== undefined ? config.showLattice : integer;
    let pts = null;
    if (showLattice || integer) {
      pts = latticePoints(effectiveConstraints, xMax, yMax);
    }

    if (showLattice) {
      // lattice points outside the feasible region — drawn first (so feasible
      // points and markers sit on top) and very faded, just to show the grid
      // continuing past the boundary.
      const outsidePts = infeasibleLatticePoints(effectiveConstraints, xMax, yMax);
      outsidePts.forEach(p => {
        const s = toScreen(p.x, p.y);
        svg.appendChild(el('circle', { cx: s.x.toFixed(1), cy: s.y.toFixed(1), r: 2.5, fill: '#1a1a1a', 'fill-opacity': '0.08' }));
      });

      // lattice points inside the feasible region
      pts.forEach(p => {
        const s = toScreen(p.x, p.y);
        svg.appendChild(el('circle', { cx: s.x.toFixed(1), cy: s.y.toFixed(1), r: 2.5, fill: '#1a1a1a', 'fill-opacity': '0.35' }));
        hoverTargets.push({ x: s.x, y: s.y, r: 6, title: pointTitle(p) });
      });
    }

    if (integer) {
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
        svg.appendChild(el('circle', { cx: cs.x.toFixed(1), cy: cs.y.toFixed(1), r: 4, fill: 'none', stroke: '#1a1a1a', 'stroke-width': '1.5', 'stroke-dasharray': '2,2' }));
        hoverTargets.push({ x: cs.x, y: cs.y, r: 6, title: pointTitle(bestCont) });
        const clabel = el('text', {
          x: (cs.x + 10).toFixed(1), y: (cs.y - 8).toFixed(1),
          'font-size': '12', fill: '#888'
        });
        clabel.textContent = `LP relaxation: (${fmt(bestCont.x)}, ${fmt(bestCont.y)})`;
        svg.appendChild(clabel);
      }
    }

    // a walked path (e.g. simplex pivoting vertex-to-vertex) drawn as solid
    // arrows, under the final optimal marker so its dot/label stay on top
    if (path && path.length > 1) {
      const pathColor = config.pathColor || '#c0392b';
      const pPts = path.map(p => toScreen(p.x, p.y));
      for (let i = 0; i < pPts.length - 1; i++) {
        svg.appendChild(el('line', {
          x1: pPts[i].x.toFixed(1), y1: pPts[i].y.toFixed(1),
          x2: pPts[i + 1].x.toFixed(1), y2: pPts[i + 1].y.toFixed(1),
          stroke: pathColor, 'stroke-width': '2'
        }));
        const angle = Math.atan2(pPts[i + 1].y - pPts[i].y, pPts[i + 1].x - pPts[i].x);
        arrowHead(svg, pPts[i + 1], angle, pathColor);
      }
      for (let i = 1; i < pPts.length - 1; i++) {
        svg.appendChild(el('circle', { cx: pPts[i].x.toFixed(1), cy: pPts[i].y.toFixed(1), r: 3.5, fill: pathColor }));
      }
      const startLabel = el('text', { x: (pPts[0].x + 8).toFixed(1), y: (pPts[0].y - 8).toFixed(1), 'font-size': '12', fill: pathColor });
      startLabel.textContent = 'start';
      svg.appendChild(startLabel);
    }

    // a plain reference point for context (e.g. the true integer optimum,
    // shown alongside a cutting-plane's continuous optimum)
    if (config.referencePoint) {
      const rp = config.referencePoint;
      const rs = toScreen(rp.x, rp.y);
      svg.appendChild(el('circle', { cx: rs.x.toFixed(1), cy: rs.y.toFixed(1), r: 3.5, fill: '#555' }));
      const rl = el('text', { x: (rs.x + 8).toFixed(1), y: (rs.y + 15).toFixed(1), 'font-size': '12', fill: '#555' });
      rl.textContent = rp.label;
      svg.appendChild(rl);
    }

    const bs = toScreen(best.x, best.y);
    svg.appendChild(el('circle', { cx: bs.x.toFixed(1), cy: bs.y.toFixed(1), r: 4, fill: '#1a1a1a' }));
    hoverTargets.push({ x: bs.x, y: bs.y, r: 6, title: pointTitle(best) });
    const label = el('text', {
      x: (bs.x + 10).toFixed(1), y: (bs.y - 8).toFixed(1),
      'font-size': '12', fill: '#1a1a1a'
    });
    label.textContent = `${config.optimalLabel || 'optimal'}: (${fmt(best.x)}, ${fmt(best.y)})`;
    svg.appendChild(label);

    // Append every hover target last so it's painted on top of everything
    // else (axis lines, labels, markers) and reliably catches the pointer.
    // Dedupe by location — the optimal point is both "a vertex" and "best",
    // so it'd otherwise get two identical, redundantly stacked targets.
    const seen = new Set();
    hoverTargets.filter(t => {
      const key = `${t.x.toFixed(1)},${t.y.toFixed(1)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).forEach(t => {
      svg.appendChild(withTitle(
        el('circle', {
          cx: t.x.toFixed(1), cy: t.y.toFixed(1), r: Math.max(t.r, 6),
          fill: '#000', 'fill-opacity': '0', 'pointer-events': 'all'
        }),
        t.title
      ));
    });

    container.innerHTML = '';
    container.appendChild(svg);
    // No caption appended here — the explanation lives as an ordinary
    // paragraph in the surrounding HTML instead of a figure caption.
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
      axisLabels: ['pink peppermint ice cream (l)', 'blueberry ice cream (l)'],
      objective: { a: 5, b: 4 },
      objectiveLabel: 'profit',
      constraints: [
        { a: 3, b: 4, c: 24, color: '#1a1a1a', label: 'milk: 3x₁ + 4x₂ ≤ 24' },
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
      axisLabels: ['green eggs', 'ham'],
      objective: { a: 7, b: 10 },
      objectiveLabel: 'protein',
      constraints: [
        { a: 0.7, b: 0.9, c: 3, color: '#1a1a1a', label: 'budget: 0.7x₁ + 0.9x₂ ≤ €3' }
      ]
    });
  }

  // Simplex: the same ice-cream polytope, with arrows tracing the vertex-to-
  // vertex path simplex actually walks along the boundary toward the optimum.
  const simplexMount = document.getElementById('simplex-graph-root');
  if (simplexMount) {
    renderLPGraph(simplexMount, {
      xMax: 8,
      yMax: 7,
      varNames: ['x₁', 'x₂'],
      varColors: ['#e64980', '#3b6bd6'],
      axisLabels: ['pink peppermint ice cream (l)', 'blueberry ice cream (l)'],
      objective: { a: 5, b: 4 },
      objectiveLabel: 'profit',
      constraints: [
        { a: 3, b: 4, c: 24 },
        { a: 1, b: 0, c: 6 },
        { a: 0, b: 1, c: 5 }
      ],
      path: [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 1.5 }]
    });
  }

  // Two-phase simplex: the same polytope, further cut by the minimum-order
  // constraint x1+x2>=2 (written as -x1-x2<=-2), which shaves off the corner
  // nearest the origin — so phase one's starting point is (2, 0), not (0, 0).
  const twoPhaseMount = document.getElementById('two-phase-graph-root');
  if (twoPhaseMount) {
    renderLPGraph(twoPhaseMount, {
      xMax: 8,
      yMax: 7,
      varNames: ['x₁', 'x₂'],
      varColors: ['#e64980', '#3b6bd6'],
      axisLabels: ['pink peppermint ice cream (l)', 'blueberry ice cream (l)'],
      objective: { a: 5, b: 4 },
      objectiveLabel: 'profit',
      constraints: [
        { a: 3, b: 4, c: 24 },
        { a: 1, b: 0, c: 6 },
        { a: 0, b: 1, c: 5 },
        { a: -1, b: -1, c: -2 }
      ],
      path: [{ x: 2, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 1.5 }]
    });
  }

  // Gomory cutting planes: the same green-eggs-and-ham ILP, but showing just
  // the continuous relaxation (no integer lattice) before and after a cut
  // slices off the fractional corner.
  const gomoryMount = document.getElementById('gomory-graph-root');
  if (gomoryMount) {
    renderLPGraph(gomoryMount, {
      xMax: 6,
      yMax: 5,
      varNames: ['x₁', 'x₂'],
      varColors: ['#2f9e44', '#c2525c'],
      axisLabels: ['green eggs', 'ham'],
      objective: { a: 7, b: 10 },
      objectiveLabel: 'protein',
      constraints: [
        { a: 0.7, b: 0.9, c: 3 }
      ],
      cut: { a: 0, b: 1, c: 3, color: '#c0392b', label: 'cut: x₂ ≤ 3' },
      showLattice: true,
      optimalLabel: 'after cut',
      referencePoint: { x: 3, y: 1, label: 'integer optimum = 31' }
    });
  }
})();

// ---------------------------------------------------------------------------
// Simplex / two-phase simplex: step through the actual pivoting tableau, one
// pivot per slider tick. Same approach as Dijkstra below — run the real
// algorithm, snapshot the tableau before each pivot, let the slider scrub
// through the recorded snapshots. Nothing here is a hand-placed per-step
// table; every number is produced by the pivot arithmetic itself.
// ---------------------------------------------------------------------------
(function () {
  const COL = ['x₁', 'x₂', 's₁', 's₂', 's₃', 's₄', 'a₁'];
  const COL_COLOR = { 'x₁': '#e64980', 'x₂': '#3b6bd6' };

  function fmt(n) {
    if (Math.abs(n) < 1e-9) n = 0;
    return Math.abs(n - Math.round(n)) < 1e-6 ? String(Math.round(n)) : n.toFixed(2);
  }

  // Zero out the objective row's entries in every currently-basic column, so
  // it holds correct reduced costs relative to the starting basis (needed
  // whenever the raw objective row isn't already reduced — e.g. phase one's
  // artificial-variable objective, or phase two's fresh real objective).
  function reduceObjRow(tableau, basis, numRows, numCols) {
    const obj = tableau[numRows];
    for (let i = 0; i < numRows; i++) {
      const factor = obj[basis[i]];
      if (Math.abs(factor) > 1e-9) {
        const row = tableau[i];
        for (let j = 0; j <= numCols; j++) obj[j] -= factor * row[j];
      }
    }
  }

  // Most-negative-reduced-cost entering rule + minimum-ratio-test leaving
  // rule — standard Dantzig simplex. Returns null when optimal.
  function findPivot(tableau, basis, numRows, numCols) {
    const obj = tableau[numRows];
    let enterCol = -1, best = -1e-7;
    for (let j = 0; j < numCols; j++) if (obj[j] < best) { best = obj[j]; enterCol = j; }
    if (enterCol === -1) return null;
    let leaveRow = -1, bestRatio = Infinity;
    for (let i = 0; i < numRows; i++) {
      const a = tableau[i][enterCol];
      if (a > 1e-7) {
        const ratio = tableau[i][numCols] / a;
        if (ratio < bestRatio - 1e-7 || (Math.abs(ratio - bestRatio) <= 1e-7 && (leaveRow === -1 || basis[i] < basis[leaveRow]))) {
          bestRatio = ratio; leaveRow = i;
        }
      }
    }
    if (leaveRow === -1) return null; // unbounded — not reached by these examples
    return { enterCol, leaveRow, ratio: bestRatio, element: tableau[leaveRow][enterCol] };
  }

  function applyPivot(tableau, basis, pivot, numRows, numCols) {
    const { enterCol, leaveRow, element } = pivot;
    const prow = tableau[leaveRow];
    for (let j = 0; j <= numCols; j++) prow[j] /= element;
    for (let i = 0; i <= numRows; i++) {
      if (i === leaveRow) continue;
      const factor = tableau[i][enterCol];
      if (Math.abs(factor) < 1e-9) continue;
      const row = tableau[i];
      for (let j = 0; j <= numCols; j++) row[j] -= factor * prow[j];
    }
    basis[leaveRow] = enterCol;
  }

  // Runs simplex to completion, recording a frame BEFORE each pivot is
  // applied (so the frame can show the pivot cell about to be used), plus
  // one final frame once no reduced cost is negative.
  function runSimplexFrames(rows, basisInit, objRaw, numCols) {
    const numRows = rows.length;
    const tableau = rows.map(r => [...r.coeffs, r.rhs]);
    tableau.push([...objRaw, 0]);
    const basis = basisInit.slice();
    reduceObjRow(tableau, basis, numRows, numCols);
    const frames = [];
    for (let iter = 0; iter < 20; iter++) {
      const pivot = findPivot(tableau, basis, numRows, numCols);
      frames.push({ tableau: tableau.map(r => r.slice()), basis: basis.slice(), pivot });
      if (!pivot) break;
      applyPivot(tableau, basis, pivot, numRows, numCols);
    }
    return frames;
  }

  function solutionValues(frame, numStructural) {
    const vals = new Array(numStructural).fill(0);
    frame.basis.forEach((col, i) => {
      if (col < numStructural) vals[col] = frame.tableau[i][frame.tableau[i].length - 1];
    });
    return vals;
  }

  function pivotCaption(frame, varNames, objectiveLabel, numStructural) {
    if (!frame.pivot) {
      const vals = solutionValues(frame, numStructural);
      const objVal = frame.tableau[frame.tableau.length - 1][frame.tableau[0].length - 1];
      const parts = varNames.map((n, i) => `${n} = ${fmt(vals[i])}`).join(', ');
      return `Every reduced cost is now ≥ 0 — optimal. ${parts}, ${objectiveLabel} = ${fmt(objVal)}.`;
    }
    const { enterCol, leaveRow, element, ratio } = frame.pivot;
    const objRow = frame.tableau[frame.tableau.length - 1];
    const rc = objRow[enterCol];
    const leaveLab = COL[frame.basis[leaveRow]];
    const rhs = frame.tableau[leaveRow][frame.tableau[leaveRow].length - 1];
    return `${COL[enterCol]} enters — its reduced cost (${fmt(rc)}) is the most negative. ${leaveLab} leaves by the minimum ratio test (${fmt(rhs)} / ${fmt(element)} = ${fmt(ratio)}).`;
  }

  function mountTableau(mount, frames, varNames, objectiveLabel, numStructural, phaseAt) {
    if (!mount) return;
    mount.innerHTML = '';
    let lastPhase = null;

    frames.forEach((frame, idx) => {
      const numCols = frame.tableau[0].length - 1;
      const numRows = frame.tableau.length - 1;

      if (phaseAt) {
        const phase = phaseAt(idx);
        if (phase !== lastPhase) {
          const label = document.createElement('p');
          label.className = 'tableau-phase';
          label.textContent = `Phase ${phase}`;
          mount.appendChild(label);
          lastPhase = phase;
        }
      }

      const card = document.createElement('div');
      card.className = 'tableau-card';

      const table = document.createElement('table');
      table.className = 'tableau';

      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');
      headRow.appendChild(document.createElement('th'));
      for (let j = 0; j < numCols; j++) {
        const th = document.createElement('th');
        th.textContent = COL[j];
        if (COL_COLOR[COL[j]]) th.style.color = COL_COLOR[COL[j]];
        if (frame.pivot && frame.pivot.enterCol === j) th.classList.add('pivot-cell');
        headRow.appendChild(th);
      }
      const rhsTh = document.createElement('th');
      rhsTh.textContent = 'RHS';
      headRow.appendChild(rhsTh);
      thead.appendChild(headRow);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      for (let i = 0; i < numRows; i++) {
        const tr = document.createElement('tr');
        const basisTh = document.createElement('th');
        const basisName = COL[frame.basis[i]];
        basisTh.textContent = basisName;
        if (COL_COLOR[basisName]) basisTh.style.color = COL_COLOR[basisName];
        if (frame.pivot && frame.pivot.leaveRow === i) basisTh.classList.add('pivot-cell');
        tr.appendChild(basisTh);
        for (let j = 0; j < numCols; j++) {
          const td = document.createElement('td');
          td.textContent = fmt(frame.tableau[i][j]);
          if (frame.pivot && frame.pivot.leaveRow === i && frame.pivot.enterCol === j) td.classList.add('pivot-cell');
          tr.appendChild(td);
        }
        const rhsTd = document.createElement('td');
        rhsTd.textContent = fmt(frame.tableau[i][numCols]);
        tr.appendChild(rhsTd);
        tbody.appendChild(tr);
      }

      const zRow = document.createElement('tr');
      const zTh = document.createElement('th');
      zTh.textContent = 'z';
      zRow.appendChild(zTh);
      for (let j = 0; j < numCols; j++) {
        const td = document.createElement('td');
        td.textContent = fmt(frame.tableau[numRows][j]);
        zRow.appendChild(td);
      }
      const zRhs = document.createElement('td');
      zRhs.textContent = fmt(frame.tableau[numRows][numCols]);
      zRow.appendChild(zRhs);
      tbody.appendChild(zRow);
      table.appendChild(tbody);

      const scrollBox = document.createElement('div');
      scrollBox.className = 'tableau-scroll';
      scrollBox.appendChild(table);
      card.appendChild(scrollBox);

      mount.appendChild(card);

      // Plain paragraph, not a "caption" — reads as the ordinary narrative
      // text explaining each pivot, interwoven with the tables rather than
      // styled as a smaller note attached underneath them.
      const explanation = document.createElement('p');
      // Phase one's objective tracks the artificial variable, not the real
      // objective — "profit = 0" there would misleadingly read as a bad
      // outcome, so its optimal frame gets its own wording instead.
      if (phaseAt && phaseAt(idx) === 1 && !frame.pivot) {
        const vals = solutionValues(frame, numStructural);
        const parts = varNames.map((n, i) => `${n} = ${fmt(vals[i])}`).join(', ');
        explanation.textContent = `No artificial variable remains in the basis — a feasible corner is found (${parts}). Phase two now optimizes the real objective from here.`;
      } else {
        explanation.textContent = pivotCaption(frame, varNames, objectiveLabel, numStructural);
      }
      mount.appendChild(explanation);
    });
  }

  // --- Simplex (single phase): the pink-peppermint / blueberry LP ----------
  // max 5x1 + 4x2 s.t. 3x1+4x2<=24, x1<=6, x2<=5, x1,x2>=0
  const simplexFrames = runSimplexFrames(
    [
      { coeffs: [3, 4, 1, 0, 0], rhs: 24 },
      { coeffs: [1, 0, 0, 1, 0], rhs: 6 },
      { coeffs: [0, 1, 0, 0, 1], rhs: 5 }
    ],
    [2, 3, 4],
    [-5, -4, 0, 0, 0],
    5
  );
  mountTableau(document.getElementById('simplex-tableau-root'), simplexFrames, ['x₁', 'x₂'], 'profit', 2, null);

  // --- Two-phase simplex: same LP, plus a minimum order x1+x2>=2 -----------
  // Phase 1 drives the artificial variable a1 to 0 (feasible corner found);
  // phase 2 then optimizes the real profit from that corner onward.
  const phase1Frames = runSimplexFrames(
    [
      { coeffs: [3, 4, 1, 0, 0, 0, 0], rhs: 24 },
      { coeffs: [1, 0, 0, 1, 0, 0, 0], rhs: 6 },
      { coeffs: [0, 1, 0, 0, 1, 0, 0], rhs: 5 },
      { coeffs: [1, 1, 0, 0, 0, -1, 1], rhs: 2 }
    ],
    [2, 3, 4, 6],
    [0, 0, 0, 0, 0, 0, 1],
    7
  );
  const lastP1 = phase1Frames[phase1Frames.length - 1];
  const phase2Rows = lastP1.tableau.slice(0, 4).map(r => ({ coeffs: r.slice(0, 6), rhs: r[7] }));
  const phase2Frames = runSimplexFrames(phase2Rows, lastP1.basis.slice(), [-5, -4, 0, 0, 0, 0], 6);
  const twoPhaseFrames = phase1Frames.concat(phase2Frames);
  const phaseBoundary = phase1Frames.length;
  mountTableau(
    document.getElementById('two-phase-tableau-root'),
    twoPhaseFrames,
    ['x₁', 'x₂'],
    'profit',
    2,
    idx => (idx < phaseBoundary ? 1 : 2)
  );
})();

// ---------------------------------------------------------------------------
// Dijkstra's algorithm: the simplest graph that still forces a real relax
// (A-B-C-D, where the direct A-C edge isn't the cheapest way to reach C).
// Rendered as a fixed sequence of static diagrams, one per "settle" step,
// each followed by its own explanation — same pattern as the simplex
// tableau cards, not a slider. Distances/tree are computed live by running
// the real algorithm, not hand-placed per step.
// ---------------------------------------------------------------------------
(function () {
  const mount = document.getElementById('dijkstra-graph-root');
  if (!mount) return;
  mount.innerHTML = '';
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }

  const nodePos = {
    A: { x: 30, y: 140 },
    B: { x: 150, y: 50 },
    C: { x: 150, y: 230 },
    D: { x: 270, y: 140 }
  };
  const edgeList = [
    ['A', 'B', 4], ['A', 'C', 2], ['B', 'C', 1], ['B', 'D', 5], ['C', 'D', 8]
  ];
  const SOURCE = 'A';
  const names = Object.keys(nodePos);

  const adj = {};
  names.forEach(n => { adj[n] = []; });
  edgeList.forEach(([u, v, w]) => { adj[u].push([v, w]); adj[v].push([u, w]); });

  // Run the real algorithm once, recording a snapshot after each "settle"
  // step so every rendered diagram matches exactly what Dijkstra computed.
  function runDijkstra() {
    const dist = {}, prev = {}, visited = {};
    names.forEach(n => { dist[n] = Infinity; prev[n] = null; visited[n] = false; });
    dist[SOURCE] = 0;
    const steps = [];
    for (let i = 0; i < names.length; i++) {
      let u = null, best = Infinity;
      names.forEach(n => { if (!visited[n] && dist[n] < best) { best = dist[n]; u = n; } });
      if (u === null) break;
      visited[u] = true;
      const relaxed = [];
      adj[u].forEach(([v, w]) => {
        if (!visited[v] && dist[u] + w < dist[v]) {
          relaxed.push({ node: v, from: dist[v], to: dist[u] + w });
          dist[v] = dist[u] + w;
          prev[v] = u;
        }
      });
      steps.push({ settled: u, dist: { ...dist }, prev: { ...prev }, visited: { ...visited }, relaxed });
    }
    return steps;
  }

  const steps = runDijkstra();

  function fmtD(d) { return d === Infinity ? '∞' : String(d); }

  function renderStep(cur, idx) {
    const dist = cur.dist, prev = cur.prev, visited = cur.visited;
    const svg = el('svg', {
      viewBox: '0 0 300 260',
      style: `width:100%;max-width:300px${idx > 0 ? ';margin-top:24px' : ''}`,
      role: 'img',
      'aria-label': `Dijkstra step ${idx + 1}: settle ${cur.settled}`
    });

    // plain edges, underneath everything (weight labels drawn last, on top
    // of the tree lines and nodes below — otherwise the tree edge redrawn
    // over a shared segment, or a node circle sitting near the midpoint,
    // paints over the label instead of the other way around)
    edgeList.forEach(([u, v, w]) => {
      const p1 = nodePos[u], p2 = nodePos[v];
      svg.appendChild(el('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, stroke: '#ccc', 'stroke-width': '1.5' }));
    });

    // shortest-path tree so far: solid black to settled nodes, dashed gray to
    // frontier nodes whose distance is only tentative
    names.forEach(n => {
      if (!prev[n]) return;
      const p1 = nodePos[prev[n]], p2 = nodePos[n];
      svg.appendChild(el('line', {
        x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
        stroke: '#1a1a1a', 'stroke-width': visited[n] ? '2.5' : '2',
        'stroke-dasharray': visited[n] ? 'none' : '4,3'
      }));
    });

    // nodes on top
    names.forEach(n => {
      const p = nodePos[n];
      const isSettled = visited[n];
      const isCurrent = cur.settled === n;
      const isFrontier = !isSettled && dist[n] < Infinity;
      svg.appendChild(el('circle', {
        cx: p.x, cy: p.y, r: 16,
        fill: isSettled ? '#1a1a1a' : '#fff',
        stroke: isCurrent ? '#c0392b' : (isFrontier ? '#1a1a1a' : '#ccc'),
        'stroke-width': isCurrent ? '3' : '1.5'
      }));
      const label = el('text', { x: p.x, y: p.y + 4, 'font-size': '12', 'font-weight': '600', fill: isSettled ? '#fff' : '#1a1a1a', 'text-anchor': 'middle' });
      label.textContent = n;
      svg.appendChild(label);
    });

    // edge weight labels last, on top of every line/node drawn above
    edgeList.forEach(([u, v, w]) => {
      const p1 = nodePos[u], p2 = nodePos[v];
      const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      svg.appendChild(el('rect', { x: mx - 7, y: my - 8, width: 14, height: 13, fill: '#fff' }));
      const wl = el('text', { x: mx, y: my + 3, 'font-size': '12', fill: '#888', 'text-anchor': 'middle' });
      wl.textContent = w;
      svg.appendChild(wl);
    });

    return svg;
  }

  steps.forEach((cur, idx) => {
    mount.appendChild(renderStep(cur, idx));
    const caption = document.createElement('p');
    const parts = cur.relaxed.map(r => `${r.node}: ${fmtD(r.from)} → ${r.to}`);
    const relaxedText = parts.length ? ` Relaxes ${parts.join(', ')}.` : ' No shorter paths found through it.';
    caption.textContent = `Step ${idx + 1}: settle ${cur.settled} at distance ${cur.dist[cur.settled]} (the closest unvisited node).${relaxedText}`;
    mount.appendChild(caption);
  });
})();

// ---------------------------------------------------------------------------
// Statistics visuals — small curve charts (normal tail, likelihood, Bayes
// overlay). Each samples a plain JS function over a domain and draws it as
// an SVG path; nothing here is hand-placed.
// ---------------------------------------------------------------------------
(function () {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }

  // Small HTML legend placed under a chart: one swatch + label per item.
  // item.type is 'line' | 'dashed' | 'fill' | 'dot'; item.color sets the
  // swatch's color via currentColor so the CSS stays shape-only.
  // (Duplicated from the earlier IIFE, which has its own private copy —
  // this file is split into self-contained sections with no shared
  // module scope, so each section keeps its own helpers.)
  function renderLegend(container, items) {
    const legend = document.createElement('div');
    legend.className = 'chart-legend';
    items.forEach(item => {
      const entry = document.createElement('span');
      entry.className = 'chart-legend-item';
      const swatch = document.createElement('span');
      swatch.className = `chart-legend-swatch ${item.type}`;
      swatch.style.color = item.color;
      entry.appendChild(swatch);
      const label = document.createElement('span');
      label.textContent = item.label;
      entry.appendChild(label);
      legend.appendChild(entry);
    });
    container.appendChild(legend);
  }

  function sample(fn, xMin, xMax, n) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const x = xMin + (xMax - xMin) * i / n;
      pts.push({ x, y: fn(x) });
    }
    return pts;
  }

  function pathFor(pts, toScreen) {
    return pts.map((p, i) => {
      const s = toScreen(p.x, p.y);
      return `${i === 0 ? 'M' : 'L'}${s.x.toFixed(1)},${s.y.toFixed(1)}`;
    }).join(' ');
  }

  // A letter with a drawn circumflex above it (μ̂, θ̂, ...), used for
  // "estimate of" labels. The Unicode combining circumflex (U+0302) does
  // NOT render reliably over Greek letters in SVG <text> — it shows up as
  // a disconnected mark floating above-and-beside the glyph rather than
  // centered on top of it, varying by font/browser. Drawing the accent as
  // its own small path, centered on the letter's own x, sidesteps that
  // entirely.
  function hatLabel(svg, x, y, letter, color) {
    const t = el('text', { x, y, 'font-size': '12', fill: color, 'text-anchor': 'middle', 'font-weight': '600' });
    t.textContent = letter;
    svg.appendChild(t);
    const hatY = y - 12.5;
    svg.appendChild(el('path', {
      d: `M${(x - 4).toFixed(1)},${hatY.toFixed(1)} L${x.toFixed(1)},${(hatY - 3).toFixed(1)} L${(x + 4).toFixed(1)},${hatY.toFixed(1)}`,
      fill: 'none', stroke: color, 'stroke-width': '1.3', 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    }));
  }

  // Standard normal curve with a shaded right-tail rejection region, the
  // critical value z*, and an observed test statistic marked.
  function renderHypothesisChart(container) {
    const xMin = -4, xMax = 4;
    const zCrit = 1.645, zObs = 2.10;
    const normalPdf = x => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
    const width = 380, height = 190, padL = 16, padR = 20, padT = 18, padB = 24;
    const plotW = width - padL - padR, plotH = height - padT - padB;
    const yMax = normalPdf(0) * 1.15;
    const toScreen = (x, y) => ({
      x: padL + (x - xMin) / (xMax - xMin) * plotW,
      y: padT + plotH - (y / yMax) * plotH
    });

    const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, style: `width:100%;max-width:${width}px`, role: 'img', 'aria-label': 'Standard normal curve with rejection region' });

    const curvePts = sample(normalPdf, xMin, xMax, 200);
    svg.appendChild(el('path', { d: pathFor(curvePts, toScreen), fill: 'none', stroke: '#1a1a1a', 'stroke-width': '1.75' }));

    // shaded rejection region: zCrit..xMax, closed down to the x-axis
    const tailPts = sample(normalPdf, zCrit, xMax, 60);
    const baseLeft = toScreen(zCrit, 0), baseRight = toScreen(xMax, 0);
    let shadeD = `M${baseLeft.x.toFixed(1)},${baseLeft.y.toFixed(1)} `;
    shadeD += tailPts.map(p => { const s = toScreen(p.x, p.y); return `L${s.x.toFixed(1)},${s.y.toFixed(1)}`; }).join(' ');
    shadeD += ` L${baseRight.x.toFixed(1)},${baseRight.y.toFixed(1)} Z`;
    svg.appendChild(el('path', { d: shadeD, fill: '#c92a2a', 'fill-opacity': '0.25' }));

    // x axis
    const o = toScreen(xMin, 0), oR = toScreen(xMax, 0);
    svg.appendChild(el('line', { x1: o.x, y1: o.y, x2: oR.x, y2: oR.y, stroke: '#333' }));

    // y axis — drawn through z = 0 (the distribution's center), not the
    // plot's left edge, since that's the chart's natural reference point
    const zeroPt = toScreen(0, 0), topPt = toScreen(0, yMax);
    svg.appendChild(el('line', { x1: zeroPt.x, y1: zeroPt.y, x2: topPt.x, y2: topPt.y, stroke: '#333' }));
    const zeroTick = el('text', { x: zeroPt.x, y: zeroPt.y + 15, 'font-size': '12', fill: '#555', 'text-anchor': 'middle' });
    zeroTick.textContent = '0';
    svg.appendChild(zeroTick);

    const xAxisLabel = el('text', { x: width - 4, y: o.y + 4, 'font-size': '12', fill: '#555', 'text-anchor': 'end' });
    xAxisLabel.textContent = 'z';
    svg.appendChild(xAxisLabel);
    const yAxisLabel = el('text', { x: padL, y: padT + 10, 'font-size': '12', fill: '#555', 'text-anchor': 'start' });
    yAxisLabel.textContent = 'f(z)';
    svg.appendChild(yAxisLabel);

    // critical value marker
    const cs = toScreen(zCrit, normalPdf(zCrit));
    const cb = toScreen(zCrit, 0);
    svg.appendChild(el('line', { x1: cs.x, y1: cs.y, x2: cb.x, y2: cb.y, stroke: '#c92a2a', 'stroke-width': '1.25', 'stroke-dasharray': '3,3' }));
    const critLabel = el('text', { x: cs.x, y: padT - 5, 'font-size': '12', fill: '#c92a2a', 'text-anchor': 'middle' });
    critLabel.textContent = `z* = ${zCrit}`;
    svg.appendChild(critLabel);

    // alpha label — sits just above the axis out past the observed marker,
    // where the thin tail has room and nothing else is drawn
    const alphaScreenX = toScreen((xMax + zObs) / 2 + 0.3, 0).x;
    const alphaLabel = el('text', { x: alphaScreenX, y: padT + plotH - 12, 'font-size': '12', fill: '#c92a2a', 'text-anchor': 'middle', 'font-weight': '600' });
    alphaLabel.textContent = 'α';
    svg.appendChild(alphaLabel);

    // observed statistic marker — label sits directly above its own point,
    // clear of the α label beside it
    const os = toScreen(zObs, normalPdf(zObs));
    const ob = toScreen(zObs, 0);
    svg.appendChild(el('line', { x1: os.x, y1: os.y, x2: ob.x, y2: ob.y, stroke: '#1a1a1a', 'stroke-width': '1.25' }));
    svg.appendChild(el('circle', { cx: os.x.toFixed(1), cy: os.y.toFixed(1), r: 3, fill: '#1a1a1a' }));
    const obsLabel = el('text', { x: os.x, y: os.y - 8, 'font-size': '12', fill: '#1a1a1a', 'text-anchor': 'middle' });
    obsLabel.textContent = `z = ${zObs}`;
    svg.appendChild(obsLabel);

    container.innerHTML = '';
    container.appendChild(svg);
    renderLegend(container, [
      { type: 'line', color: '#1a1a1a', label: 'null distribution' },
      { type: 'fill', color: '#c92a2a', label: 'rejection region' },
      { type: 'dot', color: '#1a1a1a', label: 'observed statistic' }
    ]);
    // No trailing caption here — unlike the MLE/Bayesian charts, this
    // example's numbers (α = 0.05, z* = 1.645, z = 2.1) are already woven
    // into the surrounding prose above, so a repeated caption would just
    // restate it.
  }

  // Likelihood curve over θ for a Bernoulli sample, peaked at the MLE.
  function renderMLEChart(container) {
    const xMin = 0, xMax = 1;
    const n = 10, k = 7;
    const likelihood = theta => Math.pow(theta, k) * Math.pow(1 - theta, n - k);
    const thetaHat = k / n;
    const width = 380, height = 170, padL = 30, padR = 22, padT = 20, padB = 24;
    const plotW = width - padL - padR, plotH = height - padT - padB;
    const pts = sample(likelihood, xMin, xMax, 200);
    const maxY = Math.max(...pts.map(p => p.y));
    const toScreen = (x, y) => ({
      x: padL + (x - xMin) / (xMax - xMin) * plotW,
      y: padT + plotH - (y / maxY) * plotH
    });

    const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, style: `width:100%;max-width:${width}px`, role: 'img', 'aria-label': 'Likelihood curve peaked at the MLE' });
    svg.appendChild(el('path', { d: pathFor(pts, toScreen), fill: 'none', stroke: '#0b7285', 'stroke-width': '1.75' }));

    const o = toScreen(xMin, 0), oR = toScreen(xMax, 0), oT = toScreen(xMin, maxY);
    svg.appendChild(el('line', { x1: o.x, y1: o.y, x2: oR.x, y2: oR.y, stroke: '#333' }));
    svg.appendChild(el('line', { x1: o.x, y1: o.y, x2: oT.x, y2: oT.y, stroke: '#333' }));

    const xAxisLabel = el('text', { x: width - 4, y: o.y + 4, 'font-size': '12', fill: '#555', 'text-anchor': 'end' });
    xAxisLabel.textContent = 'θ';
    svg.appendChild(xAxisLabel);
    const yAxisLabel = el('text', { x: o.x, y: oT.y - 6, 'font-size': '12', fill: '#555', 'text-anchor': 'start' });
    yAxisLabel.textContent = 'L(θ)';
    svg.appendChild(yAxisLabel);

    const peak = toScreen(thetaHat, maxY);
    const peakBase = toScreen(thetaHat, 0);
    svg.appendChild(el('line', { x1: peak.x, y1: peak.y, x2: peakBase.x, y2: peakBase.y, stroke: '#0b7285', 'stroke-width': '1.25', 'stroke-dasharray': '3,3' }));
    svg.appendChild(el('circle', { cx: peak.x.toFixed(1), cy: peak.y.toFixed(1), r: 3, fill: '#0b7285' }));
    const label = el('text', { x: peak.x, y: peak.y - 8, 'font-size': '12', fill: '#0b7285', 'text-anchor': 'middle', 'font-weight': '600' });
    label.textContent = `θ̂ = ${thetaHat}`;
    svg.appendChild(label);

    [0, 1].forEach(v => {
      const s = toScreen(v, 0);
      const t = el('text', { x: s.x, y: s.y + 16, 'font-size': '12', fill: '#555', 'text-anchor': 'middle' });
      t.textContent = v;
      svg.appendChild(t);
    });

    container.innerHTML = '';
    container.appendChild(svg);
    renderLegend(container, [
      { type: 'line', color: '#0b7285', label: 'likelihood L(θ)' },
      { type: 'dot', color: '#0b7285', label: 'MLE θ̂' }
    ]);
    const caption = document.createElement('p');
    caption.textContent = `With 7 heads in 10 flips, the likelihood L(θ) = θ⁷(1−θ)³ peaks at θ̂ = 0.7 — the value that makes this exact data most probable.`;
    container.appendChild(caption);
  }

  // Prior, likelihood, and posterior curves overlaid (Beta-Binomial),
  // each normalized to its own peak so the three shapes are comparable.
  function renderBayesChart(container) {
    const xMin = 0, xMax = 1;
    const n = 10, k = 7;
    const priorFn = x => x * (1 - x);                       // Beta(2,2), unnormalized
    const likelihoodFn = x => Math.pow(x, k) * Math.pow(1 - x, n - k);
    const posteriorFn = x => priorFn(x) * likelihoodFn(x);  // Beta(9,5), unnormalized

    const width = 380, height = 190, padL = 16, padR = 16, padT = 18, padB = 24;
    const plotW = width - padL - padR, plotH = height - padT - padB;

    const curves = [
      { fn: priorFn, color: '#868e96', dash: '4,3', weight: '1.5' },
      { fn: likelihoodFn, color: '#e8590c', dash: '4,3', weight: '1.5' },
      { fn: posteriorFn, color: '#0b7285', dash: null, weight: '2' }
    ];

    const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, style: `width:100%;max-width:${width}px`, role: 'img', 'aria-label': 'Prior, likelihood, and posterior curves' });

    curves.forEach(c => {
      const pts = sample(c.fn, xMin, xMax, 200);
      const maxY = Math.max(...pts.map(p => p.y));
      const toScreen = (x, y) => ({
        x: padL + (x - xMin) / (xMax - xMin) * plotW,
        y: padT + plotH - (y / maxY) * plotH
      });
      const attrs = { d: pathFor(pts, toScreen), fill: 'none', stroke: c.color, 'stroke-width': c.weight };
      if (c.dash) attrs['stroke-dasharray'] = c.dash;
      svg.appendChild(el('path', attrs));
    });

    const oY = padT + plotH;
    svg.appendChild(el('line', { x1: padL, y1: oY, x2: padL + plotW, y2: oY, stroke: '#333' }));
    svg.appendChild(el('line', { x1: padL, y1: oY, x2: padL, y2: padT, stroke: '#333' }));
    [0, 1].forEach(v => {
      const sx = padL + (v - xMin) / (xMax - xMin) * plotW;
      const t = el('text', { x: sx, y: oY + 16, 'font-size': '12', fill: '#555', 'text-anchor': 'middle' });
      t.textContent = v;
      svg.appendChild(t);
    });

    const xAxisLabel = el('text', { x: width - 4, y: oY + 4, 'font-size': '12', fill: '#555', 'text-anchor': 'end' });
    xAxisLabel.textContent = 'θ';
    svg.appendChild(xAxisLabel);
    const yAxisLabel = el('text', { x: padL, y: padT + 10, 'font-size': '12', fill: '#555', 'text-anchor': 'start' });
    yAxisLabel.textContent = 'density';
    svg.appendChild(yAxisLabel);

    container.innerHTML = '';
    container.appendChild(svg);
    renderLegend(container, [
      { type: 'dashed', color: '#868e96', label: 'prior' },
      { type: 'dashed', color: '#e8590c', label: 'likelihood' },
      { type: 'line', color: '#0b7285', label: 'posterior' }
    ]);
    const caption = document.createElement('p');
    caption.innerHTML = `Starting from a <span class="var-prior">prior</span> centered on "fair" and updating with the <span class="var-likelihood">likelihood</span> of 7 heads in 10 flips produces a <span class="var-posterior">posterior</span> peaked near 0.67 — pulled toward the data, but not all the way to the data's own peak at 0.7.`;
    container.appendChild(caption);
  }

  // Approximate sampling distributions of two estimators of a Bernoulli p
  // (the same 7-heads-in-10-flips setup as MLEs/Bayesian inference above):
  // the unbiased MLE vs. the Bayesian posterior mean, whose bias trades for
  // a smaller variance. Both curves share one y-scale (unlike the prior/
  // likelihood/posterior curves above, each normalized to its own peak) so
  // the relative spread — the actual bias/variance tradeoff — is visible
  // directly: the narrower, taller curve has lower variance.
  function renderBiasMseChart(container) {
    const n = 10, p = 0.7;
    const mleMean = p, mleSd = Math.sqrt(p * (1 - p) / n);
    const bayesMean = (n * p + 2) / (n + 4), bayesSd = Math.sqrt(n * p * (1 - p)) / (n + 4);
    const normalPdf = (x, mu, sigma) => Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));

    const xMin = 0.15, xMax = 1.05;
    const width = 380, height = 190, padL = 16, padR = 16, padT = 18, padB = 24;
    const plotW = width - padL - padR, plotH = height - padT - padB;
    const yMax = Math.max(normalPdf(mleMean, mleMean, mleSd), normalPdf(bayesMean, bayesMean, bayesSd)) * 1.15;
    const toScreen = (x, y) => ({
      x: padL + (x - xMin) / (xMax - xMin) * plotW,
      y: padT + plotH - (y / yMax) * plotH
    });

    const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, style: `width:100%;max-width:${width}px`, role: 'img', 'aria-label': 'Sampling distributions of two estimators, compared by bias and variance' });

    const mlePts = sample(x => normalPdf(x, mleMean, mleSd), xMin, xMax, 200);
    svg.appendChild(el('path', { d: pathFor(mlePts, toScreen), fill: 'none', stroke: '#1a1a1a', 'stroke-width': '1.75' }));
    const bayesPts = sample(x => normalPdf(x, bayesMean, bayesSd), xMin, xMax, 200);
    svg.appendChild(el('path', { d: pathFor(bayesPts, toScreen), fill: 'none', stroke: '#0b7285', 'stroke-width': '1.75', 'stroke-dasharray': '5,3' }));

    // true p — the fixed target both estimators are judged against, so it's
    // a secondary reference line rather than one of the two main curves
    const trueTop = toScreen(p, yMax), trueBase = toScreen(p, 0);
    svg.appendChild(el('line', { x1: trueTop.x, y1: trueTop.y, x2: trueBase.x, y2: trueBase.y, stroke: '#999', 'stroke-width': '1.25', 'stroke-dasharray': '3,3' }));
    const trueLabel = el('text', { x: trueTop.x, y: padT - 5, 'font-size': '12', fill: '#999', 'text-anchor': 'middle' });
    trueLabel.textContent = `true p = ${p}`;
    svg.appendChild(trueLabel);

    const oY = padT + plotH;
    svg.appendChild(el('line', { x1: padL, y1: oY, x2: padL + plotW, y2: oY, stroke: '#333' }));
    svg.appendChild(el('line', { x1: padL, y1: oY, x2: padL, y2: padT, stroke: '#333' }));
    [0.25, 0.5, 0.75, 1].forEach(v => {
      const sx = toScreen(v, 0).x;
      const t = el('text', { x: sx, y: oY + 16, 'font-size': '12', fill: '#555', 'text-anchor': 'middle' });
      t.textContent = v;
      svg.appendChild(t);
    });

    const xAxisLabel = el('text', { x: width - 4, y: oY + 4, 'font-size': '12', fill: '#555', 'text-anchor': 'end' });
    xAxisLabel.textContent = 'estimate';
    svg.appendChild(xAxisLabel);
    const yAxisLabel = el('text', { x: padL, y: padT + 10, 'font-size': '12', fill: '#555', 'text-anchor': 'start' });
    yAxisLabel.textContent = 'density';
    svg.appendChild(yAxisLabel);

    container.innerHTML = '';
    container.appendChild(svg);
    renderLegend(container, [
      { type: 'line', color: '#1a1a1a', label: 'MLE p̂ (unbiased, higher variance)' },
      { type: 'dashed', color: '#0b7285', label: 'Bayes estimate (biased, lower variance)' },
      { type: 'dashed', color: '#999', label: 'true p' }
    ]);
  }

  // Method of Moments, Normal case: the true N(μ,σ²) the data was drawn
  // from, against the curve implied by plugging the moment-matched μ̂ = X̄
  // back into the model, both drawn as shaded regions (not bare outlines)
  // so overlap between the two densities is visible as blended fill, not
  // just two close-together lines. True is teal (solid), estimated is
  // gray (dashed) — the reverse of the Bias/MSE chart's convention above,
  // by request, so the ground truth reads as the salient curve here.
  function renderMomNormalChart(container) {
    const data = [4.1, 4.6, 5.0, 5.3, 5.5];
    const trueMu = 5.0, sigma = 0.6;
    const xHat = data.reduce((a, b) => a + b, 0) / data.length;
    const normalPdf = (x, mu, s) => Math.exp(-0.5 * ((x - mu) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));

    const xMin = 3.2, xMax = 6.8;
    const width = 380, height = 170, padL = 16, padR = 16, padT = 18, padB = 30;
    const plotW = width - padL - padR, plotH = height - padT - padB;
    const maxY = normalPdf(trueMu, trueMu, sigma) * 1.1;
    const axisY = padT + plotH;
    const toScreen = (x, y) => ({
      x: padL + (x - xMin) / (xMax - xMin) * plotW,
      y: axisY - (y / maxY) * plotH
    });

    function areaPath(fn) {
      const pts = sample(fn, xMin, xMax, 200);
      const left = toScreen(xMin, 0), right = toScreen(xMax, 0);
      let d = `M${left.x.toFixed(1)},${left.y.toFixed(1)} `;
      d += pts.map(p => { const s = toScreen(p.x, p.y); return `L${s.x.toFixed(1)},${s.y.toFixed(1)}`; }).join(' ');
      d += ` L${right.x.toFixed(1)},${right.y.toFixed(1)} Z`;
      return d;
    }

    const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, style: `width:100%;max-width:${width}px`, role: 'img', 'aria-label': 'True and estimated Normal densities, shaded, over five data points' });

    svg.appendChild(el('path', { d: areaPath(x => normalPdf(x, trueMu, sigma)), fill: '#0b7285', 'fill-opacity': '0.25', stroke: 'none' }));
    svg.appendChild(el('path', { d: areaPath(x => normalPdf(x, xHat, sigma)), fill: '#999', 'fill-opacity': '0.2', stroke: 'none' }));

    const truePts = sample(x => normalPdf(x, trueMu, sigma), xMin, xMax, 200);
    svg.appendChild(el('path', { d: pathFor(truePts, toScreen), fill: 'none', stroke: '#0b7285', 'stroke-width': '2' }));
    const estPts = sample(x => normalPdf(x, xHat, sigma), xMin, xMax, 200);
    svg.appendChild(el('path', { d: pathFor(estPts, toScreen), fill: 'none', stroke: '#999', 'stroke-width': '1.75', 'stroke-dasharray': '4,3' }));

    svg.appendChild(el('line', { x1: padL, y1: axisY, x2: padL + plotW, y2: axisY, stroke: '#333' }));
    data.forEach(x => {
      const s = toScreen(x, 0);
      svg.appendChild(el('circle', { cx: s.x, cy: s.y, r: 3, fill: '#1a1a1a' }));
    });

    // minimal parameter marks: μ and μ̂ are only 0.1 apart here, so both
    // peaks sit almost on top of each other — staggered horizontally
    // instead of vertically, so both labels stay above the curves (not
    // one dropped down to the axis) while still not colliding.
    const truePeak = toScreen(trueMu, normalPdf(trueMu, trueMu, sigma));
    const trueLabel = el('text', { x: truePeak.x - 14, y: truePeak.y - 8, 'font-size': '12', fill: '#0b7285', 'text-anchor': 'middle', 'font-weight': '600' });
    trueLabel.textContent = `μ`;
    svg.appendChild(trueLabel);

    const estPeak = toScreen(xHat, normalPdf(xHat, xHat, sigma));
    hatLabel(svg, estPeak.x + 16, estPeak.y - 8, 'μ', '#999');

    container.innerHTML = '';
    container.appendChild(svg);
    renderLegend(container, [
      { type: 'fill', color: '#0b7285', label: 'true N(μ, σ²)' },
      { type: 'fill', color: '#999', label: 'estimated N(μ̂, σ²)' },
      { type: 'dot', color: '#1a1a1a', label: 'data' }
    ]);
    // No trailing caption — the numbers are already in the prose right
    // above this chart (same precedent as the Hypothesis Testing chart).
  }

  // Method of Moments, Uniform(0,θ) case: both supports drawn as shaded
  // rectangles on a shared baseline — true density is 1/θ, so the wider
  // (true) region is shorter and the narrower (estimated) region is taller,
  // overlapping near the origin with the true region's uncovered tail
  // visible as the one part of it the estimate missed entirely. True is
  // teal (solid), estimated is gray (dashed) — same swapped convention as
  // the Normal chart above.
  function renderMomUniformChart(container) {
    const data = [1.0, 1.5, 3.0, 4.0, 5.5];
    const trueTheta = 7, xHat = 2 * (data.reduce((a, b) => a + b, 0) / data.length);

    const xMin = 0, xMax = 7.6;
    const width = 320, height = 150, padL = 16, padR = 16, padT = 18, padB = 30;
    const plotW = width - padL - padR, plotH = height - padT - padB;
    const axisY = padT + plotH;
    const toX = x => padL + (x - xMin) / (xMax - xMin) * plotW;
    const maxDensity = 1 / xHat;
    const toY = h => axisY - (h / maxDensity) * (plotH * 0.85);

    const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, style: `width:100%;max-width:${width}px`, role: 'img', 'aria-label': 'True and estimated Uniform densities, shaded, with five data points' });

    [[trueTheta, '#0b7285', null, false], [xHat, '#999', '4,3', true]].forEach(([end, color, dash, isEstimate]) => {
      const h = 1 / end;
      const top = toY(h);
      const attrs = { d: `M${toX(0)},${axisY} L${toX(0)},${top.toFixed(1)} L${toX(end)},${top.toFixed(1)} L${toX(end)},${axisY} Z`, fill: color, 'fill-opacity': '0.25', stroke: 'none' };
      svg.appendChild(el('path', attrs));
      const outline = { x1: toX(0), y1: top, x2: toX(end), y2: top, stroke: color, 'stroke-width': '2' };
      if (dash) outline['stroke-dasharray'] = dash;
      svg.appendChild(el('line', outline));
      svg.appendChild(el('line', { x1: toX(end), y1: top, x2: toX(end), y2: axisY, stroke: color, 'stroke-width': dash ? '1.5' : '2', 'stroke-dasharray': dash || 'none' }));
      // minimal parameter mark: just the symbol, right at the edge it
      // belongs to, instead of only naming it in the legend below
      if (isEstimate) {
        hatLabel(svg, toX(end) + 8, top - 6, 'θ', color);
      } else {
        const paramLabel = el('text', { x: toX(end), y: top - 6, 'font-size': '12', fill: color, 'text-anchor': 'middle', 'font-weight': '600' });
        paramLabel.textContent = 'θ';
        svg.appendChild(paramLabel);
      }
    });

    svg.appendChild(el('line', { x1: padL, y1: axisY, x2: padL + plotW, y2: axisY, stroke: '#333' }));
    data.forEach(x => {
      svg.appendChild(el('circle', { cx: toX(x), cy: axisY, r: 3, fill: '#1a1a1a' }));
    });

    container.innerHTML = '';
    container.appendChild(svg);
    renderLegend(container, [
      { type: 'fill', color: '#0b7285', label: `true θ = ${trueTheta}` },
      { type: 'fill', color: '#999', label: `estimated θ̂ = ${xHat}` },
      { type: 'dot', color: '#1a1a1a', label: 'data' }
    ]);
    // No trailing caption — same reasoning as the Normal chart above.
  }

  // Two mini residual-vs-fitted scatterplots, side by side: one with
  // roughly constant spread (assumptions met) and one whose spread visibly
  // fans out as the fitted value grows (a violated constant-variance
  // assumption) — exactly the two patterns a residual plot is used to tell
  // apart. Points come from a small deterministic PRNG (not Math.random),
  // so the figure is stable across reloads like every other diagram here.
  function renderResidualChart(container) {
    function mulberry32(seed) {
      return function () {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    // Sum of three uniforms approximates a bell shape well enough for a
    // diagram, without needing a full normal-variate transform.
    function jitter(rand, scale) {
      return ((rand() + rand() + rand()) - 1.5) / 1.5 * scale;
    }

    const n = 22;
    const randGood = mulberry32(7), randBad = mulberry32(13);
    const goodPts = [], badPts = [];
    for (let i = 0; i < n; i++) {
      const x = i / (n - 1);
      goodPts.push({ x, y: jitter(randGood, 1) });
      badPts.push({ x, y: jitter(randBad, 0.3 + 1.4 * x) });
    }

    const width = 400, height = 200;
    const panelW = 170, gap = 40, padL = 10, padT = 32, padB = 30;
    const plotH = height - padT - padB;
    const yAbsMax = 2.3;

    const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, style: `width:100%;max-width:${width}px`, role: 'img', 'aria-label': 'Residual plots: constant variance versus fanning variance' });

    const yAxisLabel = el('text', { x: padL, y: padT - 18, 'font-size': '12', fill: '#555', 'text-anchor': 'start' });
    yAxisLabel.textContent = 'residual';
    svg.appendChild(yAxisLabel);

    [
      { pts: goodPts, offsetX: padL, title: 'well-behaved', color: '#1a1a1a' },
      { pts: badPts, offsetX: padL + panelW + gap, title: 'fanning variance', color: '#c92a2a' }
    ].forEach(panel => {
      const toScreen = (x, y) => ({
        x: panel.offsetX + x * panelW,
        y: padT + plotH / 2 - (y / yAbsMax) * (plotH / 2)
      });
      const zL = toScreen(0, 0), zR = toScreen(1, 0);
      svg.appendChild(el('line', { x1: zL.x, y1: zL.y, x2: zR.x, y2: zR.y, stroke: '#999', 'stroke-width': '1', 'stroke-dasharray': '4,3' }));
      svg.appendChild(el('line', { x1: panel.offsetX, y1: padT, x2: panel.offsetX, y2: padT + plotH, stroke: '#ccc' }));
      svg.appendChild(el('line', { x1: panel.offsetX, y1: padT + plotH, x2: panel.offsetX + panelW, y2: padT + plotH, stroke: '#ccc' }));
      panel.pts.forEach(p => {
        const s = toScreen(p.x, p.y);
        svg.appendChild(el('circle', { cx: s.x.toFixed(1), cy: s.y.toFixed(1), r: 2.5, fill: panel.color, 'fill-opacity': '0.65' }));
      });
      const t = el('text', { x: panel.offsetX + panelW / 2, y: padT - 12, 'font-size': '12', 'font-weight': '600', fill: panel.color, 'text-anchor': 'middle' });
      t.textContent = panel.title;
      svg.appendChild(t);
      const xl = el('text', { x: panel.offsetX + panelW, y: padT + plotH + 16, 'font-size': '12', fill: '#555', 'text-anchor': 'end' });
      xl.textContent = 'fitted value';
      svg.appendChild(xl);
    });

    container.innerHTML = '';
    container.appendChild(svg);
    renderLegend(container, [
      { type: 'dot', color: '#1a1a1a', label: 'well-behaved residuals' },
      { type: 'dot', color: '#c92a2a', label: 'fanning variance (violated)' }
    ]);
  }

  const momNormalMount = document.getElementById('mom-normal-chart-root');
  if (momNormalMount) renderMomNormalChart(momNormalMount);

  const momUniformMount = document.getElementById('mom-uniform-chart-root');
  if (momUniformMount) renderMomUniformChart(momUniformMount);

  const mleMount = document.getElementById('mle-chart-root');
  if (mleMount) renderMLEChart(mleMount);

  const bayesMount = document.getElementById('bayes-chart-root');
  if (bayesMount) renderBayesChart(bayesMount);

  const hypMount = document.getElementById('hyp-chart-root');
  if (hypMount) renderHypothesisChart(hypMount);

  const biasMseMount = document.getElementById('bias-mse-chart-root');
  if (biasMseMount) renderBiasMseChart(biasMseMount);

  const residMount = document.getElementById('resid-chart-root');
  if (residMount) renderResidualChart(residMount);
})();
