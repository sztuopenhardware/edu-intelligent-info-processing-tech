/* ==========================================================================
   IIP Interactive 3D Scientific Visualization Engine (js/engine3d.js)
   Zero-dependency High-DPI 3D renderer:
   - Spherical Orbit, Zoom, Pan, Camera Presets, Auto-Rotate
   - Blinn-Phong Lit 3D Surfaces + Colormaps + Base Contour Projections
   - 3D Spheres, 3D Arrows/Vectors, 3D Polylines, 3D Matrix Bars, 3D Cones,
     3D Translucent Planes & Interactive Hover Readout
   ========================================================================== */
window.IIP = window.IIP || {};

(function () {
  const { clamp, colormap, rgbStr } = window.IIP.math;

  class Engine3D {
    constructor(canvas, onHover) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.onHover = onHover || null;

      // Camera spherical parameters (world normalized largely in [-5, 5]^3)
      this.azimuth = -0.72;
      this.elevation = 0.56;
      this.distance = 16.5;
      this.fov = 520;
      this.panX = 0;
      this.panY = 12;
      this.autoRotate = false;
      this.showWireframe = true;
      this.showBox = true;

      // World normalization bounds
      this.bounds = {
        xMin: -5, xMax: 5,
        yMin: -5, yMax: 5,
        zMin: 0,  zMax: 10,
        xLabel: "X",
        yLabel: "Y",
        zLabel: "Z"
      };

      this.primitives = [];
      this.pickTargets = [];
      this.mouse = { x: -1, y: -1, down: false, button: 0, lastX: 0, lastY: 0 };
      this.hoveredItem = null;

      this._bindEvents();
      this.resize();
    }

    setBounds(b) {
      Object.assign(this.bounds, b);
    }

    setPreset(preset) {
      this.panX = 0;
      this.panY = 12;
      if (preset === "iso") {
        this.azimuth = -0.72;
        this.elevation = 0.56;
        this.distance = 16.5;
      } else if (preset === "top") {
        this.azimuth = -Math.PI / 2;
        this.elevation = 1.48;
        this.distance = 16.0;
      } else if (preset === "front") {
        this.azimuth = -Math.PI / 2;
        this.elevation = 0.14;
        this.distance = 16.5;
      } else if (preset === "side") {
        this.azimuth = 0.0;
        this.elevation = 0.22;
        this.distance = 16.5;
      }
    }

    resize() {
      if (!this.canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = this.canvas.getBoundingClientRect();
      this.width = Math.max(320, Math.floor(rect.width || 800));
      this.height = Math.max(280, Math.floor(rect.height || 510));
      if (this.canvas.width !== this.width * dpr || this.canvas.height !== this.height * dpr) {
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
      }
      this.dpr = dpr;
      this.fov = Math.min(this.width, this.height) * 1.08;
    }

    _bindEvents() {
      const c = this.canvas;
      c.addEventListener("contextmenu", (e) => e.preventDefault());

      c.addEventListener("pointerdown", (e) => {
        c.setPointerCapture(e.pointerId);
        this.mouse.down = true;
        this.mouse.button = e.button;
        this.mouse.lastX = e.clientX;
        this.mouse.lastY = e.clientY;
      });

      c.addEventListener("pointermove", (e) => {
        const rect = c.getBoundingClientRect();
        this.mouse.x = e.clientX - rect.left;
        this.mouse.y = e.clientY - rect.top;

        if (this.mouse.down) {
          const dx = e.clientX - this.mouse.lastX;
          const dy = e.clientY - this.mouse.lastY;
          this.mouse.lastX = e.clientX;
          this.mouse.lastY = e.clientY;

          if (this.mouse.button === 2 || e.shiftKey) {
            this.panX += dx;
            this.panY += dy;
          } else {
            this.azimuth -= dx * 0.0085;
            this.elevation = clamp(this.elevation + dy * 0.0085, -0.45, 1.52);
          }
        }
      });

      const endDrag = () => {
        this.mouse.down = false;
      };
      c.addEventListener("pointerup", endDrag);
      c.addEventListener("pointercancel", endDrag);
      c.addEventListener("pointerleave", () => {
        this.mouse.x = -1;
        this.mouse.y = -1;
      });

      c.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          const factor = e.deltaY > 0 ? 1.08 : 0.92;
          this.distance = clamp(this.distance * factor, 7.5, 34);
        },
        { passive: false }
      );

      window.addEventListener("resize", () => this.resize());
    }

    // Map arbitrary data coords (x, y, z) -> normalized 3D box [-4.5, 4.5] x [-4.5, 4.5] x [-3.2, 3.2]
    toWorld(x, y, z) {
      const b = this.bounds;
      const nx = ((x - b.xMin) / (b.xMax - b.xMin || 1) - 0.5) * 9.0;
      const ny = ((y - b.yMin) / (b.yMax - b.yMin || 1) - 0.5) * 9.0;
      const nz = ((z - b.zMin) / (b.zMax - b.zMin || 1) - 0.5) * 6.2;
      return [nx, ny, nz];
    }

    _updateCameraBasis() {
      const ca = Math.cos(this.azimuth), sa = Math.sin(this.azimuth);
      const ce = Math.cos(this.elevation), se = Math.sin(this.elevation);

      // Camera eye in normalized world (Z is vertical up!)
      this.camPos = [
        this.distance * ce * ca,
        this.distance * ce * sa,
        this.distance * se
      ];
      // Forward vector from eye to origin (0,0,0)
      const fx = -ce * ca, fy = -ce * sa, fz = -se;
      // Right = normalize(forward x [0,0,1]) = [-sa, ca, 0]
      const rx = -sa, ry = ca, rz = 0;
      // Up = right x forward = [-se*ca, -se*sa, ce]
      const ux = -se * ca, uy = -se * sa, uz = ce;

      this.basis = { fx, fy, fz, rx, ry, rz, ux, uy, uz };
    }

    projectWorld(wx, wy, wz) {
      const { fx, fy, fz, rx, ry, rz, ux, uy, uz } = this.basis;
      const dx = wx - this.camPos[0];
      const dy = wy - this.camPos[1];
      const dz = wz - this.camPos[2];

      const camZ = dx * fx + dy * fy + dz * fz;
      if (camZ <= 0.4) return null;

      const camX = dx * rx + dy * ry + dz * rz;
      const camY = dx * ux + dy * uy + dz * uz;
      const scale = this.fov / camZ;

      return {
        sx: this.width * 0.5 + this.panX + camX * scale,
        sy: this.height * 0.52 + this.panY - camY * scale,
        depth: camZ,
        scale
      };
    }

    project(x, y, z) {
      const [wx, wy, wz] = this.toWorld(x, y, z);
      return this.projectWorld(wx, wy, wz);
    }

    clear() {
      this.primitives.length = 0;
      this.pickTargets.length = 0;
    }

    // Add a shaded 3D height surface z = fn(x, y)
    addSurface(opts) {
      const {
        fn,
        nx = 34,
        ny = 34,
        palette = "turbo",
        alpha = 0.9,
        wireAlpha = 0.2,
        zMin = this.bounds.zMin,
        zMax = this.bounds.zMax,
        contourFloor = false,
        pickable = false
      } = opts;

      const { xMin, xMax, yMin, yMax } = this.bounds;
      const grid = [];
      for (let i = 0; i <= nx; i++) {
        const x = xMin + ((xMax - xMin) * i) / nx;
        const row = [];
        for (let j = 0; j <= ny; j++) {
          const y = yMin + ((yMax - yMin) * j) / ny;
          const z = fn(x, y);
          const w = this.toWorld(x, y, z);
          const p = this.projectWorld(w[0], w[1], w[2]);
          row.push({ x, y, z, w, p });
          if (pickable && p && i % 2 === 0 && j % 2 === 0) {
            this.pickTargets.push({
              sx: p.sx,
              sy: p.sy,
              r: 12,
              depth: p.depth,
              info: `(${x.toFixed(2)}, ${y.toFixed(2)}) → 值 = ${z.toFixed(4)}`
            });
          }
        }
        grid.push(row);
      }

      // Light direction in normalized world
      const lx = -0.45, ly = -0.55, lz = 0.7;

      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < ny; j++) {
          const a = grid[i][j];
          const b = grid[i + 1][j];
          const c = grid[i + 1][j + 1];
          const d = grid[i][j + 1];
          if (!a.p || !b.p || !c.p || !d.p) continue;

          // Compute surface normal via cross product of (b.w - a.w) x (d.w - a.w)
          const ux = b.w[0] - a.w[0], uy = b.w[1] - a.w[1], uz = b.w[2] - a.w[2];
          const vx = d.w[0] - a.w[0], vy = d.w[1] - a.w[1], vz = d.w[2] - a.w[2];
          let nxv = uy * vz - uz * vy;
          let nyv = uz * vx - ux * vz;
          let nzv = ux * vy - uy * vx;
          const nLen = Math.hypot(nxv, nyv, nzv) || 1;
          nxv /= nLen; nyv /= nLen; nzv /= nLen;
          if (nzv < 0) { nxv = -nxv; nyv = -nyv; nzv = -nzv; }

          const lambert = Math.max(0, nxv * lx + nyv * ly + nzv * lz);
          const shade = 0.56 + 0.44 * lambert;

          const zAvg = 0.25 * (a.z + b.z + c.z + d.z);
          const t = clamp((zAvg - zMin) / (zMax - zMin || 1), 0, 1);
          const base = colormap(t, palette);
          const lit = [
            clamp(Math.round(base[0] * shade), 0, 255),
            clamp(Math.round(base[1] * shade), 0, 255),
            clamp(Math.round(base[2] * shade), 0, 255)
          ];

          const depth = 0.25 * (a.p.depth + b.p.depth + c.p.depth + d.p.depth);
          this.primitives.push({
            type: "quad",
            depth,
            pts: [a.p, b.p, c.p, d.p],
            fill: rgbStr(lit, alpha),
            stroke: this.showWireframe && wireAlpha > 0 ? `rgba(255,255,255,${wireAlpha})` : null
          });

          if (contourFloor && i % 2 === 0 && j % 2 === 0) {
            const p0 = this.project(a.x, a.y, this.bounds.zMin);
            const p1 = this.project(c.x, c.y, this.bounds.zMin);
            if (p0 && p1) {
              this.primitives.push({
                type: "dot",
                depth: p0.depth + 0.2,
                sx: p0.sx,
                sy: p0.sy,
                r: 2.0,
                fill: rgbStr(base, 0.35)
              });
            }
          }
        }
      }
    }

    // Translucent horizontal or tilted plane z = a*x + b*y + c
    addPlane(opts) {
      const {
        fn,
        nx = 12,
        ny = 12,
        color = "rgba(56, 189, 248, 0.24)",
        wireColor = "rgba(56, 189, 248, 0.48)"
      } = opts;
      const { xMin, xMax, yMin, yMax, zMin, zMax } = this.bounds;
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < ny; j++) {
          const x0 = xMin + ((xMax - xMin) * i) / nx;
          const x1 = xMin + ((xMax - xMin) * (i + 1)) / nx;
          const y0 = yMin + ((yMax - yMin) * j) / ny;
          const y1 = yMin + ((yMax - yMin) * (j + 1)) / ny;
          const z00 = fn(x0, y0), z10 = fn(x1, y0), z11 = fn(x1, y1), z01 = fn(x0, y1);
          if (
            (z00 < zMin && z10 < zMin && z11 < zMin && z01 < zMin) ||
            (z00 > zMax && z10 > zMax && z11 > zMax && z01 > zMax)
          ) {
            continue;
          }
          const p0 = this.project(x0, y0, clamp(z00, zMin, zMax));
          const p1 = this.project(x1, y0, clamp(z10, zMin, zMax));
          const p2 = this.project(x1, y1, clamp(z11, zMin, zMax));
          const p3 = this.project(x0, y1, clamp(z01, zMin, zMax));
          if (!p0 || !p1 || !p2 || !p3) continue;
          this.primitives.push({
            type: "quad",
            depth: 0.25 * (p0.depth + p1.depth + p2.depth + p3.depth),
            pts: [p0, p1, p2, p3],
            fill: color,
            stroke: wireColor
          });
        }
      }
    }

    // 3D Sphere / Particle / Node
    addSphere(opts) {
      const {
        x, y, z,
        radius = 0.26,
        color = "#38bdf8",
        glow = false,
        label = null,
        info = null,
        outline = "#ffffff"
      } = opts;
      const p = this.project(x, y, z);
      if (!p) return;
      const rPx = Math.max(3, radius * p.scale * 0.9);
      this.primitives.push({
        type: "sphere",
        depth: p.depth - 0.05,
        sx: p.sx,
        sy: p.sy,
        r: rPx,
        color,
        glow,
        label,
        outline
      });
      if (info || label) {
        this.pickTargets.push({
          sx: p.sx,
          sy: p.sy,
          r: Math.max(11, rPx + 4),
          depth: p.depth,
          info: info || `${label}: (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`
        });
      }
    }

    // 3D Line / Edge
    addLine(opts) {
      const {
        from, to,
        color = "rgba(148, 163, 184, 0.6)",
        width = 1.6,
        dashed = false,
        glow = false
      } = opts;
      const p0 = this.project(from[0], from[1], from[2]);
      const p1 = this.project(to[0], to[1], to[2]);
      if (!p0 || !p1) return;
      this.primitives.push({
        type: "line",
        depth: 0.5 * (p0.depth + p1.depth),
        p0,
        p1,
        color,
        width,
        dashed,
        glow
      });
    }

    addPolyline(opts) {
      const { points = [], color = "#38bdf8", width = 2.2, dashed = false, glow = false } = opts;
      for (let i = 0; i < points.length - 1; i++) {
        this.addLine({ from: points[i], to: points[i + 1], color, width, dashed, glow });
      }
    }

    // 3D Vector Arrow with Arrowhead & Optional Label
    addArrow(opts) {
      const {
        from, to,
        color = "#f59e0b",
        width = 2.6,
        label = null,
        dashed = false
      } = opts;
      const p0 = this.project(from[0], from[1], from[2]);
      const p1 = this.project(to[0], to[1], to[2]);
      if (!p0 || !p1) return;
      this.primitives.push({
        type: "arrow",
        depth: Math.min(p0.depth, p1.depth) - 0.08,
        p0,
        p1,
        color,
        width,
        label,
        dashed
      });
    }

    // 3D Shaded Cuboid Bar on Matrix Grid
    addBar3D(opts) {
      const {
        x, y,
        dx = 0.6, dy = 0.6,
        z0 = 0, z1 = 1,
        color = [56, 189, 248],
        alpha = 0.92,
        info = null,
        topLabel = null
      } = opts;
      const hx = dx * 0.5, hy = dy * 0.5;
      const corners = [
        [x - hx, y - hy, z0], [x + hx, y - hy, z0], [x + hx, y + hy, z0], [x - hx, y + hy, z0],
        [x - hx, y - hy, z1], [x + hx, y - hy, z1], [x + hx, y + hy, z1], [x - hx, y + hy, z1]
      ].map((c) => this.project(c[0], c[1], c[2]));
      if (corners.some((c) => !c)) return;

      const faces = [
        { idx: [4, 5, 6, 7], shade: 1.08 }, // top
        { idx: [0, 1, 5, 4], shade: 0.82 },
        { idx: [1, 2, 6, 5], shade: 0.72 },
        { idx: [2, 3, 7, 6], shade: 0.88 },
        { idx: [3, 0, 4, 7], shade: 0.66 }
      ];
      faces.forEach((f) => {
        const pts = f.idx.map((k) => corners[k]);
        const depth = 0.25 * (pts[0].depth + pts[1].depth + pts[2].depth + pts[3].depth);
        const lit = [
          clamp(Math.round(color[0] * f.shade), 0, 255),
          clamp(Math.round(color[1] * f.shade), 0, 255),
          clamp(Math.round(color[2] * f.shade), 0, 255)
        ];
        this.primitives.push({
          type: "quad",
          depth,
          pts,
          fill: rgbStr(lit, alpha),
          stroke: "rgba(255,255,255,0.22)"
        });
      });

      const topCenter = this.project(x, y, z1 + (this.bounds.zMax - this.bounds.zMin) * 0.03);
      if (topCenter && topLabel) {
        this.primitives.push({
          type: "text",
          depth: topCenter.depth - 0.12,
          sx: topCenter.sx,
          sy: topCenter.sy,
          text: topLabel,
          color: "#f8fafc",
          font: "bold 10.5px monospace"
        });
      }
      if (topCenter && info) {
        this.pickTargets.push({
          sx: topCenter.sx,
          sy: topCenter.sy + 12,
          r: 16,
          depth: topCenter.depth,
          info
        });
      }
    }

    // 3D Sensor Coverage Cone / Frustum
    addCone(opts) {
      const {
        apex,
        centerBase,
        radius = 1.4,
        segments = 14,
        color = "rgba(56, 189, 248, 0.18)",
        wireColor = "rgba(56, 189, 248, 0.5)"
      } = opts;
      const pApex = this.project(apex[0], apex[1], apex[2]);
      if (!pApex) return;
      const ring = [];
      for (let i = 0; i <= segments; i++) {
        const ang = (2 * Math.PI * i) / segments;
        const bx = centerBase[0] + radius * Math.cos(ang);
        const by = centerBase[1] + radius * Math.sin(ang);
        const bz = centerBase[2];
        ring.push(this.project(bx, by, bz));
      }
      for (let i = 0; i < segments; i++) {
        const p1 = ring[i], p2 = ring[i + 1];
        if (!p1 || !p2) continue;
        this.primitives.push({
          type: "quad",
          depth: (pApex.depth + p1.depth + p2.depth) / 3,
          pts: [pApex, p1, p2],
          fill: color,
          stroke: i % 2 === 0 ? wireColor : null
        });
      }
    }

    addLabel3D(opts) {
      const { x, y, z, text, color = "#e2e8f0", font = "bold 11.5px sans-serif", bg = true } = opts;
      const p = this.project(x, y, z);
      if (!p) return;
      this.primitives.push({
        type: "text",
        depth: p.depth - 0.15,
        sx: p.sx,
        sy: p.sy,
        text,
        color,
        font,
        bg
      });
    }

    _enqueueAxesAndBox() {
      if (!this.showBox) return;
      const { xMin, xMax, yMin, yMax, zMin, zMax, xLabel, yLabel, zLabel } = this.bounds;

      // Floor Grid at z = zMin
      const steps = 5;
      for (let i = 0; i <= steps; i++) {
        const x = xMin + ((xMax - xMin) * i) / steps;
        const y = yMin + ((yMax - yMin) * i) / steps;
        this.addLine({
          from: [x, yMin, zMin],
          to: [x, yMax, zMin],
          color: i === 0 || i === steps ? "rgba(148,163,184,0.35)" : "rgba(148,163,184,0.13)",
          width: 1
        });
        this.addLine({
          from: [xMin, y, zMin],
          to: [xMax, y, zMin],
          color: i === 0 || i === steps ? "rgba(148,163,184,0.35)" : "rgba(148,163,184,0.13)",
          width: 1
        });
      }

      // Vertical corner pillars
      [
        [xMin, yMin], [xMax, yMin], [xMax, yMax], [xMin, yMax]
      ].forEach(([cx, cy], idx) => {
        this.addLine({
          from: [cx, cy, zMin],
          to: [cx, cy, zMax],
          color: idx === 0 ? "rgba(56, 189, 248, 0.55)" : "rgba(148, 163, 184, 0.18)",
          width: idx === 0 ? 1.6 : 1,
          dashed: idx !== 0
        });
      });

      // Colored Axis Highlights
      this.addArrow({
        from: [xMin, yMin, zMin],
        to: [xMax + (xMax - xMin) * 0.06, yMin, zMin],
        color: "#f43f5e",
        width: 2,
        label: xLabel
      });
      this.addArrow({
        from: [xMin, yMin, zMin],
        to: [xMin, yMax + (yMax - yMin) * 0.06, zMin],
        color: "#10b981",
        width: 2,
        label: yLabel
      });
      this.addArrow({
        from: [xMin, yMin, zMin],
        to: [xMin, yMin, zMax + (zMax - zMin) * 0.07],
        color: "#38bdf8",
        width: 2,
        label: zLabel
      });

      // Axis numeric ticks
      [0, 0.5, 1].forEach((t) => {
        const xv = xMin + (xMax - xMin) * t;
        const yv = yMin + (yMax - yMin) * t;
        const zv = zMin + (zMax - zMin) * t;
        this.addLabel3D({
          x: xv,
          y: yMin - (yMax - yMin) * 0.06,
          z: zMin,
          text: xv.toFixed(Math.abs(xMax - xMin) >= 8 ? 0 : 1),
          color: "#94a3b8",
          font: "10px monospace",
          bg: false
        });
        this.addLabel3D({
          x: xMax + (xMax - xMin) * 0.05,
          y: yv,
          z: zMin,
          text: yv.toFixed(Math.abs(yMax - yMin) >= 8 ? 0 : 1),
          color: "#94a3b8",
          font: "10px monospace",
          bg: false
        });
        this.addLabel3D({
          x: xMin - (xMax - xMin) * 0.06,
          y: yMin,
          z: zv,
          text: zv.toFixed(Math.abs(zMax - zMin) >= 8 ? 1 : 2),
          color: "#94a3b8",
          font: "10px monospace",
          bg: false
        });
      });
    }

    render(buildSceneFn) {
      if (this.autoRotate && !this.mouse.down) {
        this.azimuth += 0.0045;
      }
      this._updateCameraBasis();
      this.clear();
      this._enqueueAxesAndBox();

      if (buildSceneFn) {
        buildSceneFn(this);
      }

      const ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.width, this.height);

      // Painter's sort back-to-front (largest depth first)
      this.primitives.sort((a, b) => b.depth - a.depth);

      for (let i = 0; i < this.primitives.length; i++) {
        const pr = this.primitives[i];
        if (pr.type === "quad") {
          ctx.beginPath();
          ctx.moveTo(pr.pts[0].sx, pr.pts[0].sy);
          for (let k = 1; k < pr.pts.length; k++) {
            ctx.lineTo(pr.pts[k].sx, pr.pts[k].sy);
          }
          ctx.closePath();
          ctx.fillStyle = pr.fill;
          ctx.fill();
          if (pr.stroke) {
            ctx.strokeStyle = pr.stroke;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        } else if (pr.type === "line") {
          ctx.save();
          if (pr.glow) {
            ctx.shadowColor = pr.color;
            ctx.shadowBlur = 8;
          }
          if (pr.dashed) ctx.setLineDash([5, 4]);
          ctx.strokeStyle = pr.color;
          ctx.lineWidth = pr.width;
          ctx.beginPath();
          ctx.moveTo(pr.p0.sx, pr.p0.sy);
          ctx.lineTo(pr.p1.sx, pr.p1.sy);
          ctx.stroke();
          ctx.restore();
        } else if (pr.type === "arrow") {
          ctx.save();
          if (pr.dashed) ctx.setLineDash([4, 3]);
          ctx.strokeStyle = pr.color;
          ctx.fillStyle = pr.color;
          ctx.lineWidth = pr.width;
          ctx.beginPath();
          ctx.moveTo(pr.p0.sx, pr.p0.sy);
          ctx.lineTo(pr.p1.sx, pr.p1.sy);
          ctx.stroke();
          ctx.setLineDash([]);

          const ang = Math.atan2(pr.p1.sy - pr.p0.sy, pr.p1.sx - pr.p0.sx);
          const head = 8 + pr.width;
          ctx.beginPath();
          ctx.moveTo(pr.p1.sx, pr.p1.sy);
          ctx.lineTo(
            pr.p1.sx - head * Math.cos(ang - 0.42),
            pr.p1.sy - head * Math.sin(ang - 0.42)
          );
          ctx.lineTo(
            pr.p1.sx - head * Math.cos(ang + 0.42),
            pr.p1.sy - head * Math.sin(ang + 0.42)
          );
          ctx.closePath();
          ctx.fill();

          if (pr.label) {
            ctx.font = "bold 11.5px sans-serif";
            ctx.fillStyle = pr.color;
            ctx.fillText(pr.label, pr.p1.sx + 6, pr.p1.sy + 4);
          }
          ctx.restore();
        } else if (pr.type === "sphere") {
          ctx.save();
          if (pr.glow) {
            ctx.shadowColor = pr.color;
            ctx.shadowBlur = 12;
          }
          const grad = ctx.createRadialGradient(
            pr.sx - pr.r * 0.32,
            pr.sy - pr.r * 0.32,
            pr.r * 0.1,
            pr.sx,
            pr.sy,
            pr.r
          );
          grad.addColorStop(0, "#ffffff");
          grad.addColorStop(0.35, pr.color);
          grad.addColorStop(1, "rgba(2, 6, 23, 0.92)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(pr.sx, pr.sy, pr.r, 0, Math.PI * 2);
          ctx.fill();
          if (pr.outline) {
            ctx.strokeStyle = pr.outline;
            ctx.lineWidth = 1.1;
            ctx.stroke();
          }
          ctx.restore();

          if (pr.label) {
            ctx.save();
            ctx.font = "bold 11px sans-serif";
            const tw = ctx.measureText(pr.label).width;
            ctx.fillStyle = "rgba(7, 13, 25, 0.78)";
            ctx.fillRect(pr.sx - tw * 0.5 - 4, pr.sy - pr.r - 17, tw + 8, 15);
            ctx.fillStyle = "#f8fafc";
            ctx.fillText(pr.label, pr.sx - tw * 0.5, pr.sy - pr.r - 6);
            ctx.restore();
          }
        } else if (pr.type === "dot") {
          ctx.fillStyle = pr.fill;
          ctx.beginPath();
          ctx.arc(pr.sx, pr.sy, pr.r, 0, Math.PI * 2);
          ctx.fill();
        } else if (pr.type === "text") {
          ctx.save();
          ctx.font = pr.font;
          const tw = ctx.measureText(pr.text).width;
          if (pr.bg) {
            ctx.fillStyle = "rgba(7, 13, 25, 0.76)";
            ctx.fillRect(pr.sx - tw * 0.5 - 5, pr.sy - 11, tw + 10, 16);
          }
          ctx.fillStyle = pr.color;
          ctx.fillText(pr.text, pr.sx - tw * 0.5, pr.sy + 1);
          ctx.restore();
        }
      }

      // Hover picking
      let best = null;
      if (this.mouse.x >= 0 && !this.mouse.down) {
        let bestD2 = Infinity;
        for (let i = 0; i < this.pickTargets.length; i++) {
          const t = this.pickTargets[i];
          const d2 = (t.sx - this.mouse.x) ** 2 + (t.sy - this.mouse.y) ** 2;
          if (d2 <= t.r * t.r && d2 < bestD2) {
            bestD2 = d2;
            best = t;
          }
        }
      }
      if (best) {
        ctx.save();
        ctx.strokeStyle = "#facc15";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(best.sx, best.sy, best.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      if (this.hoveredItem !== (best ? best.info : null)) {
        this.hoveredItem = best ? best.info : null;
        if (this.onHover) this.onHover(this.hoveredItem);
      }
    }
  }

  window.IIP.Engine3D = Engine3D;
})();
