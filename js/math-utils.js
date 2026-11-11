/* ==========================================================================
   IIP Math & 2D Scientific Chart Utilities (js/math-utils.js)
   ========================================================================== */
window.IIP = window.IIP || {};

(function () {
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  // Seeded PRNG (Mulberry32) for reproducible teaching experiments
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randn(rng = Math.random) {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  // Scientific Colormaps (t in [0, 1]) -> [r, g, b] (0..255)
  const stops = {
    turbo: [
      [48, 18, 59], [70, 107, 227], [40, 188, 235],
      [50, 242, 152], [164, 252, 60], [238, 207, 58],
      [251, 126, 33], [208, 47, 5], [122, 4, 3]
    ],
    viridis: [
      [68, 1, 84], [59, 82, 139], [33, 145, 140],
      [94, 201, 98], [253, 231, 37]
    ],
    plasma: [
      [13, 8, 135], [126, 3, 168], [204, 71, 120],
      [248, 149, 64], [240, 249, 33]
    ],
    coolwarm: [
      [59, 76, 192], [119, 154, 247], [221, 221, 221],
      [244, 152, 122], [180, 4, 38]
    ]
  };

  function colormap(t, name = "turbo") {
    const pal = stops[name] || stops.turbo;
    const x = clamp(t, 0, 1) * (pal.length - 1);
    const i = Math.min(pal.length - 2, Math.floor(x));
    const f = x - i;
    const c0 = pal[i], c1 = pal[i + 1];
    return [
      Math.round(lerp(c0[0], c1[0], f)),
      Math.round(lerp(c0[1], c1[1], f)),
      Math.round(lerp(c0[2], c1[2], f))
    ];
  }

  function rgbStr(rgb, alpha = 1) {
    return alpha >= 0.999
      ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
      : `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha.toFixed(3)})`;
  }

  // Fuzzy Membership Functions (Textbook Ch.4 / Syllabus Ch.2)
  function mfTri(x, a, b, c) {
    if (x <= a || x >= c) {
      if (x === b && a === b) return 1;
      if (x === b && b === c) return 1;
      return 0;
    }
    if (x === b) return 1;
    return x < b ? (x - a) / (b - a || 1e-9) : (c - x) / (c - b || 1e-9);
  }

  function mfTrap(x, a, b, c, d) {
    if (x <= a && a < b) return 0;
    if (x >= d && c < d) return 0;
    if (x >= b && x <= c) return 1;
    if (x < b) return clamp((x - a) / (b - a || 1e-9), 0, 1);
    return clamp((d - x) / (d - c || 1e-9), 0, 1);
  }

  function mfGauss(x, c, sigma) {
    const s = Math.max(1e-6, sigma);
    return Math.exp(-0.5 * Math.pow((x - c) / s, 2));
  }

  // Zadeh Linguistic Hedges (Textbook p.128)
  function applyHedge(mu, power = 1) {
    return Math.pow(clamp(mu, 0, 1), power);
  }

  // Fuzzy Relation Max-Min Composition R o S (Textbook Sec 4.5.2)
  function fuzzyCompose(R, S) {
    const m = R.length;
    const n = S[0].length;
    const kLen = S.length;
    const out = Array.from({ length: m }, () => Array(n).fill(0));
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        let best = 0;
        for (let k = 0; k < kLen; k++) {
          best = Math.max(best, Math.min(R[i][k], S[k][j]));
        }
        out[i][j] = Number(best.toFixed(4));
      }
    }
    return out;
  }

  function fuzzyTransitiveClosure(R) {
    let cur = R.map((r) => r.slice());
    for (let step = 0; step < R.length; step++) {
      const next = fuzzyCompose(cur, cur);
      let diff = 0;
      for (let i = 0; i < cur.length; i++) {
        for (let j = 0; j < cur.length; j++) {
          diff += Math.abs(next[i][j] - cur[i][j]);
        }
      }
      cur = next;
      if (diff < 1e-6) break;
    }
    return cur;
  }

  // Neural Activations (Textbook Sec 2.2.3)
  const activations = {
    step: (x) => (x >= 0 ? 1 : -1),
    step01: (x) => (x >= 0 ? 1 : 0),
    sigmoid: (x) => 1 / (1 + Math.exp(-clamp(x, -30, 30))),
    tanh: (x) => Math.tanh(x),
    relu: (x) => Math.max(0, x)
  };

  // Optimization Benchmark Landscapes (x, y in [-5, 5])
  const benchmarks = {
    // Rastrigin (Minimization, global min 0 at (0,0))
    rastrigin: (x, y) => {
      const s = 0.75;
      const X = x * s, Y = y * s;
      return 20 + (X * X - 10 * Math.cos(2 * Math.PI * X)) + (Y * Y - 10 * Math.cos(2 * Math.PI * Y));
    },
    // Ackley (Minimization, global min 0 at (0,0))
    ackley: (x, y) => {
      const r2 = 0.5 * (x * x + y * y);
      const c = 0.5 * (Math.cos(2 * Math.PI * x) + Math.cos(2 * Math.PI * y));
      return -20 * Math.exp(-0.2 * Math.sqrt(r2)) - Math.exp(c) + 20 + Math.E;
    },
    // Double-Well Trap (Local min at (-2.2, -1.8), deeper Global min at (2.1, 1.9))
    doubleWell: (x, y) => {
      const g1 = 4.2 * Math.exp(-0.42 * ((x + 2.1) ** 2 + (y + 1.8) ** 2));
      const g2 = 7.4 * Math.exp(-0.55 * ((x - 2.1) ** 2 + (y - 1.9) ** 2));
      const ripple = 0.45 * Math.cos(2.2 * x) * Math.cos(2.2 * y);
      return 8.5 - g1 - g2 + 0.08 * (x * x + y * y) + ripple;
    },
    // Textbook Sinc Peak (Maximization, Example 3-4 extended to 2D)
    sincPeak: (x, y) => {
      const r = Math.sqrt((x * 1.8) ** 2 + (y * 1.8) ** 2);
      const base = r < 1e-5 ? 1.0 : Math.abs(Math.sin(r) / r);
      return base * 10;
    },
    // Optical Cavity Coupling Efficiency F(d, theta) (Maximization)
    opticalCavity: (x, y) => {
      // x: mirror detuning, y: tilt angle
      const mainMode = 9.6 * Math.exp(-0.45 * ((x - 1.4) ** 2 + (y + 1.1) ** 2));
      const sideModes =
        5.8 * Math.exp(-0.5 * ((x + 2.0) ** 2 + (y - 1.6) ** 2)) +
        4.9 * Math.exp(-0.6 * ((x - 2.2) ** 2 + (y - 2.0) ** 2));
      const fringe = 0.65 * Math.cos(2.6 * x) * Math.cos(2.6 * y);
      return Math.max(0.1, mainMode + sideModes + fringe);
    },
    // GA Deceptive Trap (Broad easy local optimum + narrow high global peak, Textbook p.77)
    deceptiveTrap: (x, y) => {
      const broadTrap = 6.8 * Math.exp(-0.14 * ((x + 1.8) ** 2 + (y + 1.8) ** 2));
      const narrowGlobal = 10.0 * Math.exp(-1.65 * ((x - 2.4) ** 2 + (y - 2.4) ** 2));
      return broadTrap + narrowGlobal;
    }
  };

  // High-DPI 2D Companion Chart Helper
  function setupCanvas2D(canvas) {
    if (!canvas) return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(260, Math.floor(rect.width || 340));
    const h = Math.max(150, Math.floor(rect.height || 205));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  function drawLineChart(canvas, config) {
    const env = setupCanvas2D(canvas);
    if (!env) return;
    const { ctx, w, h } = env;
    const pad = { l: 42, r: 14, t: 24, b: 26 };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;

    // Background
    ctx.fillStyle = "#070e1c";
    ctx.fillRect(0, 0, w, h);

    // Title
    if (config.title) {
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "bold 11.5px sans-serif";
      ctx.fillText(config.title, 10, 15);
    }

    const series = config.series || [];
    let xMin = config.xMin ?? 0;
    let xMax = config.xMax ?? 1;
    let yMin = config.yMin;
    let yMax = config.yMax;

    if (yMin === undefined || yMax === undefined) {
      let lo = Infinity, hi = -Infinity;
      series.forEach((s) => {
        (s.pts || []).forEach((p) => {
          if (Number.isFinite(p[1])) {
            lo = Math.min(lo, p[1]);
            hi = Math.max(hi, p[1]);
          }
        });
      });
      if (!Number.isFinite(lo)) { lo = 0; hi = 1; }
      if (Math.abs(hi - lo) < 1e-6) { hi = lo + 1; }
      const margin = (hi - lo) * 0.08;
      if (yMin === undefined) yMin = lo - margin;
      if (yMax === undefined) yMax = hi + margin;
    }

    const sx = (x) => pad.l + ((x - xMin) / (xMax - xMin || 1)) * pw;
    const sy = (y) => pad.t + ph - ((y - yMin) / (yMax - yMin || 1)) * ph;

    // Grid
    ctx.strokeStyle = "rgba(148, 163, 184, 0.14)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const yy = pad.t + (ph * i) / 4;
      ctx.beginPath();
      ctx.moveTo(pad.l, yy);
      ctx.lineTo(pad.l + pw, yy);
      ctx.stroke();

      const val = lerp(yMax, yMin, i / 4);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      ctx.fillText(val.toFixed(Math.abs(val) >= 10 ? 1 : 2), pad.l - 5, yy + 3);
    }

    // X labels
    ctx.textAlign = "center";
    for (let i = 0; i <= 4; i++) {
      const xx = pad.l + (pw * i) / 4;
      const val = lerp(xMin, xMax, i / 4);
      ctx.fillText(val.toFixed(xMax - xMin >= 10 ? 0 : 1), xx, h - 8);
    }
    ctx.textAlign = "left";

    // Vertical marker line
    if (config.vLine !== undefined) {
      const vx = sx(config.vLine);
      if (vx >= pad.l && vx <= pad.l + pw) {
        ctx.save();
        ctx.strokeStyle = "rgba(245, 158, 11, 0.85)";
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(vx, pad.t);
        ctx.lineTo(vx, pad.t + ph);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Draw series
    series.forEach((s) => {
      const pts = s.pts || [];
      if (!pts.length) return;
      ctx.save();
      ctx.beginPath();
      pts.forEach((p, idx) => {
        const px = sx(p[0]);
        const py = clamp(sy(p[1]), pad.t, pad.t + ph);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      if (s.fillAlpha) {
        ctx.lineTo(sx(pts[pts.length - 1][0]), sy(Math.max(0, yMin)));
        ctx.lineTo(sx(pts[0][0]), sy(Math.max(0, yMin)));
        ctx.closePath();
        ctx.fillStyle = s.fillColor || "rgba(56, 189, 248, 0.18)";
        ctx.fill();
        ctx.beginPath();
        pts.forEach((p, idx) => {
          const px = sx(p[0]);
          const py = clamp(sy(p[1]), pad.t, pad.t + ph);
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
      }
      ctx.strokeStyle = s.color || "#38bdf8";
      ctx.lineWidth = s.width || 2;
      if (s.dashed) ctx.setLineDash([5, 3]);
      ctx.stroke();
      ctx.restore();
    });

    // Legend top-right
    let lx = w - 12;
    series.slice().reverse().forEach((s) => {
      if (!s.label) return;
      ctx.font = "10.5px sans-serif";
      const tw = ctx.measureText(s.label).width;
      lx -= tw + 18;
      ctx.fillStyle = s.color || "#38bdf8";
      ctx.fillRect(lx, 8, 10, 3);
      ctx.fillStyle = "#cbd5e1";
      ctx.fillText(s.label, lx + 13, 13);
    });
  }

  function drawBarChart(canvas, config) {
    const env = setupCanvas2D(canvas);
    if (!env) return;
    const { ctx, w, h } = env;
    const pad = { l: 42, r: 14, t: 26, b: 30 };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;

    ctx.fillStyle = "#070e1c";
    ctx.fillRect(0, 0, w, h);

    if (config.title) {
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "bold 11.5px sans-serif";
      ctx.fillText(config.title, 10, 15);
    }

    const items = config.items || [];
    const maxV = Math.max(config.yMax || 0.001, ...items.map((d) => d.value * 1.15));

    ctx.strokeStyle = "rgba(148, 163, 184, 0.14)";
    for (let i = 0; i <= 4; i++) {
      const yy = pad.t + (ph * i) / 4;
      ctx.beginPath();
      ctx.moveTo(pad.l, yy);
      ctx.lineTo(pad.l + pw, yy);
      ctx.stroke();
      const val = lerp(maxV, 0, i / 4);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      ctx.fillText(val.toFixed(maxV >= 5 ? 1 : 2), pad.l - 5, yy + 3);
    }

    const slot = pw / Math.max(1, items.length);
    const bw = Math.min(42, slot * 0.62);
    items.forEach((it, idx) => {
      const cx = pad.l + slot * (idx + 0.5);
      const bh = clamp((it.value / maxV) * ph, 1, ph);
      const by = pad.t + ph - bh;

      ctx.fillStyle = it.color || "#38bdf8";
      ctx.fillRect(cx - bw / 2, by, bw, bh);

      ctx.fillStyle = "#f1f5f9";
      ctx.font = "10.5px monospace";
      ctx.textAlign = "center";
      ctx.fillText(it.valueText ?? it.value.toFixed(3), cx, by - 4);

      ctx.fillStyle = "#cbd5e1";
      ctx.font = "10.5px sans-serif";
      ctx.fillText(it.label, cx, h - 10);
    });
    ctx.textAlign = "left";
  }

  window.IIP.math = {
    clamp,
    lerp,
    mulberry32,
    randn,
    colormap,
    rgbStr,
    mfTri,
    mfTrap,
    mfGauss,
    applyHedge,
    fuzzyCompose,
    fuzzyTransitiveClosure,
    activations,
    benchmarks
  };

  window.IIP.charts = {
    setupCanvas2D,
    drawLineChart,
    drawBarChart
  };
})();
