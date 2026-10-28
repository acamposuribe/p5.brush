// Fill explorer compositions, shared by the standalone and p5 explorers:
// a loose cluster of round washes and a swatch grid (after watercolour dot
// studies), and a study of Hilma af Klint's "The Evolution, No. 1".
// Classic script: defines window.fillCompositions(brush, state), which
// returns { dots, swatches, klint }, each taking the canvas (w, h). `state`
// holds the explorer's bleed, opacity, texture, border, shift and seed.

window.fillCompositions = (brush, state) => {
  const DOT_COLORS = ["#002185", "#003c32", "#fcd300", "#ff2702", "#6b9404", "#d6336c", "#f08c00", "#1c7ed6"];

  // Small seeded generator for layouts, independent of brush's own RNG.
  function layoutRandom(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function washDot(color, x, y, d, opacity) {
    brush.fill(color, opacity);
    brush.fillBleed(state.bleed, "out");
    brush.fillTexture(state.texture, state.border, true, state.shift);
    brush.circle(x, y, d / 2);
    brush.noFill();
  }

  function drawDots(w, h) {
    const rand = layoutRandom(state.seed);
    const dots = [];
    for (let tries = 0; dots.length < 26 && tries < 400; tries++) {
      const d = 50 + rand() * rand() * 110;
      const x = w * 0.12 + rand() * w * 0.76;
      const y = h * 0.12 + rand() * h * 0.76;
      // Allow overlaps, but not dots buried inside others.
      if (dots.some((o) => Math.hypot(o.x - x, o.y - y) < (o.d + d) * 0.32)) continue;
      dots.push({ x, y, d });
    }
    for (const { x, y, d } of dots) {
      const color = DOT_COLORS[Math.floor(rand() * DOT_COLORS.length)];
      washDot(color, x, y, d, Math.round(state.opacity * (0.5 + rand())));
    }
  }

  function drawSwatches(w, h) {
    const rand = layoutRandom(state.seed);
    const COLS = 4, ROWS = 5;
    const cell = Math.min(w / COLS, h / ROWS);
    const x0 = (w - cell * COLS) / 2, y0 = (h - cell * ROWS) / 2;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const color = DOT_COLORS[(r * COLS + c) % DOT_COLORS.length];
        const jitter = () => (rand() - 0.5) * cell * 0.06;
        washDot(color, x0 + cell * (c + 0.5) + jitter(), y0 + cell * (r + 0.5) + jitter(),
          cell * (0.68 + rand() * 0.08), Math.round(state.opacity * (0.7 + rand() * 0.6)));
      }
    }
  }

  // A composition after Hilma af Klint's "The Evolution, No. 1" (1908):
  // four blue triangles, four pink lobes around a black square, pairs of
  // white and blue ovals, and white lines through the centre. Washes are
  // laid down in painting order, light to dark.
  function drawKlint(w, h) {
    const pw = w * 0.9, ph = pw * 0.78;
    const x0 = (w - pw) / 2, y0 = (h - ph) / 2;
    const X = (u) => x0 + u * pw, Y = (v) => y0 + v * ph;
    const cx = X(0.5), cy = Y(0.5);
    const wash = (color, opacity, bleed = state.bleed) => {
      brush.fill(color, Math.round(opacity * state.opacity / 92));
      brush.fillBleed(bleed, "out");
      brush.fillTexture(state.texture, state.border, true, state.shift);
    };
    const shape = (pts) => {
      brush.beginShape(0);
      for (const [x, y] of pts) brush.vertex(x, y);
      brush.endShape(true);
    };
    // Half-ellipse lobe from a straight side (a→b) bulging outward.
    const lobe = (ax, ay, bx, by, depth) => {
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const len = Math.hypot(bx - ax, by - ay);
      const ux = (bx - ax) / len, uy = (by - ay) / len;
      const nx = uy, ny = -ux; // outward for clockwise sides (y down)
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const t = Math.PI * i / 24;
        const along = -Math.cos(t) * len / 2, out = Math.sin(t) ** 0.7 * depth;
        pts.push([mx + ux * along + nx * out, my + uy * along + ny * out]);
      }
      return pts;
    };
    const oval = (x, y, rx, ry, color, opacity) => {
      wash(color, opacity, 0.05);
      const pts = [];
      for (let i = 0; i < 20; i++) {
        const a = 2 * Math.PI * i / 20;
        pts.push([x + rx * Math.cos(a), y + ry * Math.sin(a)]);
      }
      shape(pts);
    };

    // Pink lobes on the four sides of the square, outward, side by side
    // as (start, end) of the side, clockwise.
    const sq = { l: X(0.24), r: X(0.76), t: Y(0.24), b: Y(0.76) };
    const sides = [
      [sq.l, sq.t, sq.r, sq.t, ph * 0.22],
      [sq.r, sq.t, sq.r, sq.b, pw * 0.21],
      [sq.r, sq.b, sq.l, sq.b, ph * 0.22],
      [sq.l, sq.b, sq.l, sq.t, pw * 0.21],
    ];
    const lobes = sides.map(([ax, ay, bx, by, d]) => lobe(ax, ay, bx, by, d));

    // Blue ground, painted around the lobes and the square: per side, the
    // triangle from the two frame corners to the centre, minus the lobe.
    const corners = [[X(0), Y(0)], [X(1), Y(0)], [X(1), Y(1)], [X(0), Y(1)]];
    const blues = ["#1c5fc0", "#3f86d6", "#1c5fc0", "#3f86d6"];
    corners.forEach((c, i) => {
      wash(blues[i], 150);
      shape([c, corners[(i + 1) % 4], ...lobes[i].slice().reverse()]);
    });

    lobes.forEach((pts, i) => {
      wash(i % 2 ? "#e9a98f" : "#dc8a6a", i % 2 ? 190 : 220);
      shape(pts);
    });

    // The black square.
    // Two glazes: one wash of watercolour does not reach black.
    for (let k = 0; k < 2; k++) {
      wash("#1d1714", 255, 0.06);
      brush.fillTexture(state.texture * 0.3, state.border, true, state.shift);
      brush.rect(sq.l, sq.t, sq.r - sq.l, sq.b - sq.t);
      // Dry between glazes so the second sits on the first. Standalone only:
      // p5 has no render(); its frame ends after draw().
      brush.render?.();
    }

    // Ovals: white pairs on the lobes, blue pairs inside the square.
    const ow = pw * 0.035, oh = ph * 0.032;
    for (const s of [-1, 1]) {
      oval(cx + s * ow * 1.05, sq.t - oh * 0.9, ow, oh, "#f6f1e8", 255);
      oval(cx + s * ow * 1.05, sq.b + oh * 0.9, ow, oh, "#f6f1e8", 255);
    }
    for (const [x, y] of [[sq.l + ow * 1.4, cy - oh * 1.6], [sq.l + ow * 1.4, cy + oh * 0.4],
                          [sq.r - ow * 1.4, cy], [sq.r - ow * 1.4, cy + oh * 2]]) {
      oval(x, y, ow * 1.05, oh * 1.1, "#1f4fb8", 220);
    }

    // White lines: the diagonals and four curves through the centre.
    brush.noFill();
    brush.set("pen", "#f6f1e8", 1.4);
    for (const [a, b] of [[corners[0], corners[2]], [corners[1], corners[3]]]) {
      brush.line(a[0], a[1], b[0], b[1]);
    }
    for (const [ex, ey, kx, ky] of [
      [cx - ow * 0.4, sq.t, cx - pw * 0.04, cy - ph * 0.15],
      [cx + ow * 0.6, sq.b, cx + pw * 0.03, cy + ph * 0.18],
      [sq.l + ow * 2.4, cy - oh * 0.5, cx - pw * 0.12, cy + ph * 0.06],
      [sq.r - ow * 2.4, cy + oh, cx + pw * 0.12, cy - ph * 0.06],
    ]) {
      brush.beginShape(1);
      brush.vertex(ex, ey);
      brush.vertex(kx, ky);
      brush.vertex(cx, cy);
      brush.endShape();
    }
  }

  return { dots: drawDots, swatches: drawSwatches, klint: drawKlint };
};
