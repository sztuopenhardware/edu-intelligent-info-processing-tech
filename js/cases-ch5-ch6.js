/* ==========================================================================
   第5章（数据融合）与 第6章（常见的智能优化算法）交互式 3D 仿真实验案例集
   包含 7 个完整交互式 3D 实验案例（按章节归属下拉菜单）
   ========================================================================== */
window.IIP = window.IIP || {};
window.IIP.cases = window.IIP.cases || [];

(function () {
  const { clamp, mulberry32, randn, benchmarks } = window.IIP.math;
  const { drawLineChart, drawBarChart } = window.IIP.charts;

  /* =======================================================================
     第五章：数据融合（对应教材第5章）
     5.1 【代表性演算】多传感器测量同一物理量加权融合与 3D 概率密度峰
     ======================================================================= */
  window.IIP.cases.push({
    id: "ch5-case1",
    chapterId: "ch5",
    title: "5.1 【代表性演算】多传感器加权融合与 3D 高斯似然概率密度峰对比",
    tag: "大纲必做演算 · 最小方差融合",
    bounds: { xMin: -4, xMax: 4, yMin: -4, yMax: 4, zMin: 0, zMax: 3.2, xLabel: "光斑位置 X (mm)", yLabel: "光斑位置 Y (mm)", zLabel: "概率密度 / 置信峰值" },
    legend: [
      { color: "#f43f5e", label: "传感器1 (低精度宽峰)" },
      { color: "#f59e0b", label: "传感器2 (中精度)" },
      { color: "#38bdf8", label: "传感器3 (高精度/可注坏点)" },
      { color: "#10b981", label: "逆方差最优加权融合峰 (最高最锐利)" }
    ],
    guideHtml: `
      <strong>实验目标：</strong>三台光电位置传感器同时测量激光靶心真值 <code>(0, 0)</code>。3D 曲面展示融合后的二维高斯后验概率密度峰，线框标记各单传感器观测中心。<br>
      <div class="formula-box">w_i = (1/σ_i²) / ∑(1/σ_j²),   σ_fused² = 1 / ∑(1/σ_j²) &lt; min(σ_i²)</div>
      尝试调大<strong>“传感器3异常坏点偏移”</strong>并开启<strong>“3σ 一致性坏点剔除”</strong>，体验数据质量与预处理对融合可靠性的决定性作用！
    `,
    controls: [
      { key: "s1", label: "传感器1 噪声标准差 σ₁ (mm)", type: "range", min: 0.5, max: 2.5, step: 0.1, default: 1.6 },
      { key: "s2", label: "传感器2 噪声标准差 σ₂ (mm)", type: "range", min: 0.4, max: 2.0, step: 0.1, default: 1.0 },
      { key: "s3", label: "传感器3 噪声标准差 σ₃ (mm)", type: "range", min: 0.3, max: 1.8, step: 0.1, default: 0.6 },
      { key: "outlier", label: "注入传感器3 故障离群偏差 Δz₃ (mm)", type: "range", min: 0.0, max: 3.5, step: 0.25, default: 0.0 },
      {
        key: "rejectOutlier", label: "数据一致性预处理（抗异常数据）", type: "select", default: "0",
        options: [
          { value: "0", label: "关闭异常检验（直接固定权重融合）" },
          { value: "1", label: "开启 3σ 一致性检验（自动隔离故障传感器）" }
        ]
      }
    ],
    init() {},
    render3D(engine, state) {
      // Deterministic noisy observations around true (0,0)
      const z1 = [-1.1, 0.85];
      const z2 = [0.65, -0.55];
      const z3 = [0.22 + state.outlier, 0.18 + state.outlier * 0.7];

      const p1 = 1 / (state.s1 ** 2);
      const p2 = 1 / (state.s2 ** 2);
      let p3 = 1 / (state.s3 ** 2);

      // Consistency check: compare z3 distance to weighted median/pair of z1,z2
      const refX = (p1 * z1[0] + p2 * z2[0]) / (p1 + p2);
      const refY = (p1 * z1[1] + p2 * z2[1]) / (p1 + p2);
      const dist3 = Math.hypot(z3[0] - refX, z3[1] - refY);
      const rejected = state.rejectOutlier === "1" && dist3 > 2.4 * Math.hypot(state.s2, state.s3);
      if (rejected) p3 = 0;

      const pSum = p1 + p2 + p3;
      const w1 = p1 / pSum, w2 = p2 / pSum, w3 = p3 / pSum;
      const fx = w1 * z1[0] + w2 * z2[0] + w3 * z3[0];
      const fy = w1 * z1[1] + w2 * z2[1] + w3 * z3[1];
      const sigF = Math.sqrt(1 / pSum);

      state.fusionStats = { z1, z2, z3, w1, w2, w3, fx, fy, sigF, rejected };

      // 3D Surface: superposition of subtle individual likelihoods + prominent fused posterior peak
      const pdfFn = (x, y) => {
        const g1 = 0.75 * Math.exp(-((x - z1[0]) ** 2 + (y - z1[1]) ** 2) / (2 * state.s1 ** 2));
        const g2 = 1.05 * Math.exp(-((x - z2[0]) ** 2 + (y - z2[1]) ** 2) / (2 * state.s2 ** 2));
        const g3 = (rejected ? 0.35 : 1.35) * Math.exp(-((x - z3[0]) ** 2 + (y - z3[1]) ** 2) / (2 * state.s3 ** 2));
        const gFused = 2.65 * Math.exp(-((x - fx) ** 2 + (y - fy) ** 2) / (2 * sigF ** 2));
        return Math.max(g1, g2, g3, gFused);
      };

      engine.addSurface({ fn: pdfFn, nx: 30, ny: 30, palette: "viridis", alpha: 0.88, zMin: 0, zMax: 3.2, contourFloor: true, pickable: true });

      // True target vertical axis at (0,0)
      engine.addLine({ from: [0, 0, 0], to: [0, 0, 3.05], color: "#ffffff", width: 2.0, dashed: true });
      engine.addLabel3D({ x: 0, y: 0, z: 3.12, text: "物理真值 (0,0)", color: "#ffffff" });

      engine.addSphere({ x: z1[0], y: z1[1], z: 0.82, radius: 0.23, color: "#f43f5e", label: `S1(w=${(w1*100).toFixed(0)}%)` });
      engine.addSphere({ x: z2[0], y: z2[1], z: 1.12, radius: 0.23, color: "#f59e0b", label: `S2(w=${(w2*100).toFixed(0)}%)` });
      engine.addSphere({ x: z3[0], y: z3[1], z: rejected ? 0.42 : 1.42, radius: 0.25, color: rejected ? "#64748b" : "#38bdf8", label: rejected ? "S3(已隔离!)" : `S3(w=${(w3*100).toFixed(0)}%)` });
      engine.addSphere({ x: fx, y: fy, z: 2.75, radius: 0.34, color: "#10b981", glow: true, label: `融合估计 (${fx.toFixed(2)},${fy.toFixed(2)})` });
    },
    render2D(canvas, state) {
      const st = state.fusionStats || { sigF: 0.45, fx: 0, fy: 0 };
      const eqX = (-1.1 + 0.65 + 0.22 + state.outlier) / 3;
      const eqY = (0.85 - 0.55 + 0.18 + state.outlier * 0.7) / 3;
      drawBarChart(canvas, {
        title: "各单传感器标准差 σ_i 与 融合后标准差 / 实际定位误差对比 (mm)",
        items: [
          { label: "σ₁(S1)", value: state.s1, color: "#f43f5e" },
          { label: "σ₂(S2)", value: state.s2, color: "#f59e0b" },
          { label: "σ₃(S3)", value: state.s3, color: "#38bdf8" },
          { label: "σ_融合", value: st.sigF, color: "#10b981" },
          { label: "等权误差", value: Math.hypot(eqX, eqY), color: "#94a3b8" },
          { label: "加权误差", value: Math.hypot(st.fx, st.fy), color: "#c084fc" }
        ]
      });
    },
    getMetrics(state) {
      const st = state.fusionStats || { w1: 0.1, w2: 0.3, w3: 0.6, fx: 0, fy: 0, sigF: 0.45, rejected: false };
      return [
        { label: "最优权重 [w₁, w₂, w₃]", value: `[${st.w1.toFixed(2)}, ${st.w2.toFixed(2)}, ${st.w3.toFixed(2)}]` },
        { label: "融合理论标准差 σ_fused", value: `${st.sigF.toFixed(3)} mm` },
        { label: "融合定位绝对误差", value: `${Math.hypot(st.fx, st.fy).toFixed(3)} mm` },
        { label: "一致性监控状态", value: st.rejected ? "🛡️ 已自动剔除 S3 坏点" : state.outlier > 1.0 ? "⚠️ 坏点拉偏中(请开启检验)" : "✅ 多源一致性正常" }
      ];
    }
  });

  /* -----------------------------------------------------------------------
     5.2 【专业实践】智能感知三维机动目标多传感器卡尔曼滤波跟踪（教材5.7）
     ----------------------------------------------------------------------- */
  function buildKalmanTrack(qStd, r1Std, r2Std) {
    const rng = mulberry32(888);
    const N = 65;
    const truth = [], meas1 = [], meas2 = [], kf = [], errHist = [];

    // 1D independent scalar Kalman per axis (position + velocity coupling approx)
    let est = [-3.5, 0.0, 0.2];
    let P = [1.5, 1.5, 1.5];
    let lastGain = 0.5;

    for (let k = 0; k < N; k++) {
      const t = k / (N - 1);
      const ang = t * Math.PI * 2.6;
      const tx = 3.3 * Math.cos(ang);
      const ty = 3.3 * Math.sin(ang);
      const tz = 0.5 + 3.8 * t;
      truth.push([tx, ty, tz]);

      // Two complementary noisy sensors (Laser ToF + Stereo Vision)
      const z1 = [tx + randn(rng) * r1Std, ty + randn(rng) * r1Std, tz + randn(rng) * r1Std];
      const z2 = [tx + randn(rng) * r2Std, ty + randn(rng) * r2Std, tz + randn(rng) * r2Std];
      meas1.push(z1);
      meas2.push(z2);

      // Inverse-variance fused observation z_fused with effective R_eff
      const invR1 = 1 / (r1Std * r1Std), invR2 = 1 / (r2Std * r2Std);
      const Reff = 1 / (invR1 + invR2);
      const zF = [
        (invR1 * z1[0] + invR2 * z2[0]) * Reff,
        (invR1 * z1[1] + invR2 * z2[1]) * Reff,
        (invR1 * z1[2] + invR2 * z2[2]) * Reff
      ];

      if (k === 0) {
        est = zF.slice();
      } else {
        // Constant-velocity extrapolate from previous step + process noise Q
        const prev = kf[k - 1];
        const prev2 = k >= 2 ? kf[k - 2] : prev;
        for (let d = 0; d < 3; d++) {
          const xPred = prev[d] + 0.72 * (prev[d] - prev2[d]);
          const pPred = P[d] + qStd * qStd;
          const K = pPred / (pPred + Reff);
          est[d] = xPred + K * (zF[d] - xPred);
          P[d] = (1 - K) * pPred;
          lastGain = K;
        }
      }
      kf.push(est.slice());
      const rawErr = Math.hypot(z1[0] - tx, z1[1] - ty, z1[2] - tz);
      const kfErr = Math.hypot(est[0] - tx, est[1] - ty, est[2] - tz);
      errHist.push({ k, rawErr, kfErr });
    }
    return { truth, meas1, meas2, kf, errHist, lastGain };
  }

  window.IIP.cases.push({
    id: "ch5-case2",
    chapterId: "ch5",
    title: "5.2 【专业实践】智能感知三维空间目标多源卡尔曼滤波动态跟踪（教材5.7）",
    tag: "教材5.7 卡尔曼滤波 · 智能感知",
    bounds: { xMin: -4.5, xMax: 4.5, yMin: -4.5, yMax: 4.5, zMin: 0, zMax: 5, xLabel: "空间 X (m)", yLabel: "空间 Y (m)", zLabel: "高度 Z (m)" },
    legend: [
      { color: "#ffffff", label: "真实三维螺旋机动轨迹" },
      { color: "#f43f5e", label: "传感器1 原始含噪点云" },
      { color: "#10b981", label: "多源融合卡尔曼滤波估计轨迹" }
    ],
    guideHtml: `
      <strong>实验目标：</strong>复现教材 5.7 节标量/向量卡尔曼滤波递归估计器（式 5-74~5-80）。无人机/光学信标沿三维螺旋上升，两台不同噪声水平的智能感知传感器实时观测，观察卡尔曼滤波如何平滑滤除三维测量杂波！
    `,
    controls: [
      { key: "r1", label: "主传感器(视觉)观测噪声标准差 σ_R1 (m)", type: "range", min: 0.15, max: 1.40, step: 0.05, default: 0.65 },
      { key: "r2", label: "辅传感器(毫米波/ToF)噪声标准差 σ_R2 (m)", type: "range", min: 0.15, max: 1.40, step: 0.05, default: 0.45 },
      { key: "qStd", label: "状态转移模型过程噪声 σ_Q", type: "range", min: 0.05, max: 0.80, step: 0.05, default: 0.22 }
    ],
    init(state) { state.cursor = 20; },
    step(state, dt) {
      state.cursor = ((state.cursor || 10) + dt * 16) % 65;
    },
    render3D(engine, state) {
      const sim = buildKalmanTrack(state.qStd, state.r1, state.r2);
      state.sim = sim;
      const upto = Math.max(4, Math.floor(state.cursor));

      engine.addPolyline({ points: sim.truth.slice(0, upto), color: "rgba(255,255,255,0.6)", width: 1.8, dashed: true });
      engine.addPolyline({ points: sim.kf.slice(0, upto), color: "#10b981", width: 3.0, glow: true });

      for (let i = 0; i < upto; i += 2) {
        engine.addSphere({ x: sim.meas1[i][0], y: sim.meas1[i][1], z: sim.meas1[i][2], radius: 0.13, color: "#f43f5e", outline: null });
      }
      const head = sim.kf[upto - 1];
      engine.addSphere({ x: head[0], y: head[1], z: head[2], radius: 0.32, color: "#10b981", glow: true, label: "KF状态估计 x̂_k" });
    },
    render2D(canvas, state) {
      const sim = state.sim || buildKalmanTrack(state.qStd, state.r1, state.r2);
      drawLineChart(canvas, {
        title: "逐时刻三维位置跟踪误差对比：原始单传感器误差 vs 融合卡尔曼误差 (m)",
        xMin: 0, xMax: 64,
        vLine: Math.floor(state.cursor || 20),
        series: [
          { label: "原始观测误差", pts: sim.errHist.map((e) => [e.k, e.rawErr]), color: "rgba(244,63,94,0.7)", width: 1.5 },
          { label: "融合KF估计误差", pts: sim.errHist.map((e) => [e.k, e.kfErr]), color: "#10b981", width: 2.4 }
        ]
      });
    },
    getMetrics(state) {
      const sim = state.sim || buildKalmanTrack(state.qStd, state.r1, state.r2);
      const meanRaw = sim.errHist.reduce((s, d) => s + d.rawErr, 0) / sim.errHist.length;
      const meanKf = sim.errHist.reduce((s, d) => s + d.kfErr, 0) / sim.errHist.length;
      return [
        { label: "稳态卡尔曼增益 K_k", value: sim.lastGain.toFixed(3) },
        { label: "单传感器平均三维误差", value: `${meanRaw.toFixed(3)} m` },
        { label: "融合卡尔曼平均误差", value: `${meanKf.toFixed(3)} m` },
        { label: "跟踪误差降低幅度", value: `${((1 - meanKf / meanRaw) * 100).toFixed(1)}%` }
      ];
    }
  });

  /* -----------------------------------------------------------------------
     5.3 贝叶斯估计与 D-S 证据理论决策级融合 3D 信任空间（教材5.3–5.4）
     ----------------------------------------------------------------------- */
  function dsCombine(m1, m2) {
    // Frame Theta = {A1, A2}, indices: [m(A1), m(A2), m(Theta)]
    const K = m1[0] * m2[1] + m1[1] * m2[0];
    const norm = Math.max(1e-6, 1 - K);
    const mA1 = (m1[0] * m2[0] + m1[0] * m2[2] + m1[2] * m2[0]) / norm;
    const mA2 = (m1[1] * m2[1] + m1[1] * m2[2] + m1[2] * m2[1]) / norm;
    const mTh = (m1[2] * m2[2]) / norm;
    return { m: [mA1, mA2, mTh], K };
  }

  window.IIP.cases.push({
    id: "ch5-case3",
    chapterId: "ch5",
    title: "5.3 贝叶斯与 D-S 证据理论决策级融合 3D 信任空间（教材5.3 Dempster合成）",
    tag: "教材5.3.1–5.3.2 · 决策级融合",
    bounds: { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 1, xLabel: "目标信任度 m(A₁)", yLabel: "干扰信任度 m(A₂)", zLabel: "未知不确定度 m(Θ)" },
    legend: [
      { color: "#38bdf8", label: "红外传感器 BPA 证据点 m₁" },
      { color: "#f59e0b", label: "激光光谱传感器 BPA 证据点 m₂" },
      { color: "#10b981", label: "D-S 合成后融合决策点 m₁⊕m₂" }
    ],
    guideHtml: `
      <strong>实验目标：</strong>可视化教材 5.3.2 节 <strong>Dempster-Shafer（D-S）证据理论</strong>！在满足 <code>m(A₁)+m(A₂)+m(Θ)=1</code> 的三维概率单纯形斜面上，观察两台异构传感器合成后如何压缩未知度 <code>m(Θ)</code>，以及当两传感器证据严重冲突（<code>K→1</code>）时的行为特征！
    `,
    controls: [
      { key: "m1A", label: "红外传感器支持“目标A₁”基本概率 m₁(A₁)", type: "range", min: 0.05, max: 0.90, step: 0.05, default: 0.65 },
      { key: "m1U", label: "红外传感器保留未知度 m₁(Θ)", type: "range", min: 0.05, max: 0.50, step: 0.05, default: 0.25 },
      { key: "m2A", label: "光谱传感器支持“目标A₁”基本概率 m₂(A₁)", type: "range", min: 0.05, max: 0.90, step: 0.05, default: 0.70 },
      { key: "m2U", label: "光谱传感器保留未知度 m₂(Θ)", type: "range", min: 0.05, max: 0.50, step: 0.05, default: 0.20 }
    ],
    init() {},
    render3D(engine, state) {
      const a1 = clamp(state.m1A, 0, 0.95);
      const u1 = clamp(Math.min(state.m1U, 1 - a1), 0, 1);
      const m1 = [a1, Math.max(0, 1 - a1 - u1), u1];

      const a2 = clamp(state.m2A, 0, 0.95);
      const u2 = clamp(Math.min(state.m2U, 1 - a2), 0, 1);
      const m2 = [a2, Math.max(0, 1 - a2 - u2), u2];

      const comb = dsCombine(m1, m2);
      state.ds = { m1, m2, comb };

      // Draw simplex plane x + y + z = 1 (z = 1 - x - y for x+y <= 1)
      engine.addSurface({
        fn: (x, y) => Math.max(0, 1 - x - y),
        nx: 18, ny: 18,
        palette: "coolwarm",
        alpha: 0.42,
        zMin: 0, zMax: 1
      });

      engine.addSphere({ x: m1[0], y: m1[1], z: m1[2], radius: 0.30, color: "#38bdf8", label: `红外 m₁` });
      engine.addSphere({ x: m2[0], y: m2[1], z: m2[2], radius: 0.30, color: "#f59e0b", label: `光谱 m₂` });
      engine.addSphere({ x: comb.m[0], y: comb.m[1], z: comb.m[2], radius: 0.38, color: "#10b981", glow: true, label: `融合 m(A₁)=${comb.m[0].toFixed(2)}` });

      engine.addArrow({ from: m1, to: comb.m, color: "#38bdf8", width: 2.0, dashed: true });
      engine.addArrow({ from: m2, to: comb.m, color: "#f59e0b", width: 2.0, dashed: true });
    },
    render2D(canvas, state) {
      const { comb } = state.ds || { comb: { m: [0.8, 0.1, 0.1], K: 0.1 } };
      drawBarChart(canvas, {
        title: `D-S 合成后信任函数 Bel(A₁)=${comb.m[0].toFixed(3)}, 似然函数 Pl(A₁)=${(comb.m[0] + comb.m[2]).toFixed(3)}`,
        yMax: 1.05,
        items: [
          { label: "m(目标A₁)", value: comb.m[0], color: "#10b981" },
          { label: "m(干扰A₂)", value: comb.m[1], color: "#f43f5e" },
          { label: "m(未知Θ)", value: comb.m[2], color: "#94a3b8" },
          { label: "冲突因子 K", value: comb.K, color: "#f59e0b" }
        ]
      });
    },
    getMetrics(state) {
      const { comb } = state.ds || { comb: { m: [0.8, 0.1, 0.1], K: 0.1 } };
      return [
        { label: "融合目标信任度 Bel(A₁)", value: `${(comb.m[0] * 100).toFixed(1)}%` },
        { label: "融合目标似然度 Pl(A₁)", value: `${((comb.m[0] + comb.m[2]) * 100).toFixed(1)}%` },
        { label: "剩余未知度 m(Θ)", value: `${(comb.m[2] * 100).toFixed(1)}%` },
        { label: "证据冲突因子 K", value: comb.K > 0.55 ? `⚠️ 高冲突 (${comb.K.toFixed(2)})` : `${comb.K.toFixed(3)} (协同)` }
      ];
    }
  });

  /* =======================================================================
     第六章：常见的智能优化算法（对应教材第6章）
     6.1 【代表性演算】粒子群算法（PSO）单步三维速度矢量分解与协同寻优（教材6.5）
     ======================================================================= */
  window.IIP.cases.push({
    id: "ch6-case1",
    chapterId: "ch6",
    title: "6.1 【代表性演算】粒子群算法（PSO）速度三矢量分解与多峰曲面寻优",
    tag: "大纲必做演算 · 教材6.5 p.246–247",
    bounds: { xMin: -4.5, xMax: 4.5, yMin: -4.5, yMax: 4.5, zMin: 0, zMax: 32, xLabel: "参数 x₁", yLabel: "参数 x₂", zLabel: "目标函数 f(x)" },
    legend: [
      { color: "#38bdf8", label: "惯性项 w·v^k" },
      { color: "#f59e0b", label: "认知项 c₁r₁(pbest-x)" },
      { color: "#c084fc", label: "社会项 c₂r₂(gbest-x)" },
      { color: "#10b981", label: "合成新速度 v^{k+1} & 全局最优 gbest" }
    ],
    guideHtml: `
      <strong>实验目标：</strong>完整演示大纲第6章代表性演算与教材 6.5 节粒子群速度更新！针对高亮<strong>1号代表性粒子</strong>，在三维空间中实时分解绘制<strong>惯性矢量、认知牵引矢量、社会牵引矢量与合成新位移矢量</strong>！<br>
      可切换<strong>教材 p.247 Kennedy 四种 PSO 模型</strong>，对比纯认知（<code>c₂=0</code>）与纯社会（<code>c₁=0</code>）的收敛行为差异。
    `,
    controls: [
      {
        key: "psoModel", label: "切换教材 p.247 Kennedy 粒子群模型", type: "select", default: "full",
        options: [
          { value: "full", label: "① 全模型 (Full Model: c₁>0, c₂>0 标准协同)" },
          { value: "cog", label: "② 纯认知模型 (Cognition-Only: c₂=0 各自独立搜索)" },
          { value: "soc", label: "③ 纯社会模型 (Social-Only: c₁=0 迅速聚集易早熟)" }
        ]
      },
      { key: "w", label: "惯性权重 w", type: "range", min: 0.2, max: 0.95, step: 0.05, default: 0.70 },
      { key: "c1", label: "个体认知学习因子 c₁", type: "range", min: 0.5, max: 2.8, step: 0.1, default: 1.8 },
      { key: "c2", label: "群体社会学习因子 c₂", type: "range", min: 0.5, max: 2.8, step: 0.1, default: 1.8 }
    ],
    actions: [
      { label: "⚡ 单步迭代（观察速度矢量合成）", primary: true, onClick(state) { state.stepPso(state); } },
      { label: "▶ 自动连续飞行 / 暂停", onClick(state) { state.running = !state.running; } },
      { label: "↺ 重置粒子群", onClick(state) { state.resetPso(state); } }
    ],
    init(state) {
      const fn = benchmarks.rastrigin;
      state.resetPso = (st) => {
        const rng = mulberry32(314);
        st.particles = Array.from({ length: 16 }, (_, idx) => {
          const x = idx === 0 ? 3.5 : (rng() - 0.5) * 8.2;
          const y = idx === 0 ? 2.8 : (rng() - 0.5) * 8.2;
          const f = fn(x, y);
          return {
            x, y,
            vx: idx === 0 ? -0.9 : (rng() - 0.5) * 1.2,
            vy: idx === 0 ? 0.6 : (rng() - 0.5) * 1.2,
            px: x, py: y, pf: f, f,
            vec: { ix: -0.6, iy: 0.4, cx: -0.5, cy: -0.5, sx: -1.2, sy: -1.0 }
          };
        });
        // Seed particle #0 pbest slightly offset so cognitive arrow is immediately visible!
        st.particles[0].px = 2.1;
        st.particles[0].py = 1.6;
        st.particles[0].pf = fn(2.1, 1.6);

        st.gbest = { x: 0.8, y: -0.7, f: fn(0.8, -0.7) };
        st.particles.forEach((p) => {
          if (p.pf < st.gbest.f) st.gbest = { x: p.px, y: p.py, f: p.pf };
        });
        st.iter = 0;
        st.running = false;
        st.hist = [{ iter: 0, gbest: st.gbest.f }];
      };

      state.stepPso = (st) => {
        const effC1 = st.psoModel === "soc" ? 0 : st.c1;
        const effC2 = st.psoModel === "cog" ? 0 : st.c2;
        st.particles.forEach((p) => {
          const r1 = 0.55 + Math.random() * 0.35;
          const r2 = 0.55 + Math.random() * 0.35;
          const ix = st.w * p.vx, iy = st.w * p.vy;
          const cx = effC1 * r1 * (p.px - p.x), cy = effC1 * r1 * (p.py - p.y);
          const sx = effC2 * r2 * (st.gbest.x - p.x), sy = effC2 * r2 * (st.gbest.y - p.y);
          p.vec = { ix, iy, cx, cy, sx, sy };

          p.vx = clamp(ix + cx + sx, -1.6, 1.6);
          p.vy = clamp(iy + cy + sy, -1.6, 1.6);
          p.x = clamp(p.x + p.vx, -4.4, 4.4);
          p.y = clamp(p.y + p.vy, -4.4, 4.4);
          p.f = fn(p.x, p.y);
          if (p.f < p.pf) { p.px = p.x; p.py = p.y; p.pf = p.f; }
          if (p.f < st.gbest.f) { st.gbest = { x: p.x, y: p.y, f: p.f }; }
        });
        st.iter += 1;
        st.hist.push({ iter: st.iter, gbest: st.gbest.f });
      };

      state.resetPso(state);
    },
    step(state, dt) {
      if (!state.running || state.iter >= 100) return;
      state._acc = (state._acc || 0) + dt;
      if (state._acc < 0.18) return;
      state._acc = 0;
      state.stepPso(state);
    },
    render3D(engine, state) {
      const fn = benchmarks.rastrigin;
      engine.addSurface({ fn, nx: 30, ny: 30, palette: "viridis", alpha: 0.80, zMin: 0, zMax: 32, pickable: true });

      const p0 = state.particles[0];
      const zLift = fn(p0.x, p0.y) + 1.5;

      // Draw 3D Velocity Decomposition Vectors on Particle #0
      engine.addArrow({
        from: [p0.x, p0.y, zLift],
        to: [p0.x + p0.vec.ix, p0.y + p0.vec.iy, zLift + 2.0],
        color: "#38bdf8", width: 2.6, label: "w·v"
      });
      engine.addArrow({
        from: [p0.x, p0.y, zLift],
        to: [p0.x + p0.vec.cx, p0.y + p0.vec.cy, zLift + 2.0],
        color: "#f59e0b", width: 2.6, label: "认知项"
      });
      engine.addArrow({
        from: [p0.x, p0.y, zLift],
        to: [p0.x + p0.vec.sx, p0.y + p0.vec.sy, zLift + 2.0],
        color: "#c084fc", width: 2.6, label: "社会项"
      });
      engine.addArrow({
        from: [p0.x, p0.y, zLift],
        to: [clamp(p0.x + p0.vx, -4.4, 4.4), clamp(p0.y + p0.vy, -4.4, 4.4), zLift + 0.5],
        color: "#10b981", width: 3.2, label: "v^{k+1}"
      });

      state.particles.forEach((p, idx) => {
        engine.addSphere({
          x: p.x, y: p.y, z: p.f + 0.6,
          radius: idx === 0 ? 0.35 : 0.20,
          color: idx === 0 ? "#facc15" : "#e2e8f0",
          glow: idx === 0,
          label: idx === 0 ? "演示粒子#1" : null
        });
      });

      engine.addSphere({
        x: state.gbest.x, y: state.gbest.y, z: state.gbest.f + 0.8,
        radius: 0.36, color: "#10b981", glow: true,
        label: `gbest=${state.gbest.f.toFixed(2)}`
      });
    },
    render2D(canvas, state) {
      drawLineChart(canvas, {
        title: "PSO 全局最优目标值 f(gbest) 收敛曲线（Rastrigin 多峰函数，理论最小 0）",
        xMin: 0, xMax: Math.max(20, state.iter),
        series: [{ label: "f(gbest)", pts: state.hist.map((h) => [h.iter, h.gbest]), color: "#10b981", width: 2.4 }]
      });
    },
    getMetrics(state) {
      const p0 = state.particles[0];
      return [
        { label: "当前迭代步数 k", value: `${state.iter}` },
        { label: "1号粒子速度 ||v||", value: Math.hypot(p0.vx, p0.vy).toFixed(3) },
        { label: "全局最优位置 gbest", value: `(${state.gbest.x.toFixed(2)}, ${state.gbest.y.toFixed(2)})` },
        { label: "全局最小函数值 f*", value: state.gbest.f.toFixed(4) }
      ];
    }
  });

  /* -----------------------------------------------------------------------
     6.2 【代表性演算】蚁群算法（ACO）三维地形路径选择与信息素机制（教材6.4）
     ----------------------------------------------------------------------- */
  const acoNodes = [
    { id: 0, name: "光源S", x: -3.8, y: 0.0, z: 1.0 },
    { id: 1, name: "中继A", x: -1.4, y: 2.4, z: 1.3 },
    { id: 2, name: "山脊B", x: -1.2, y: -2.3, z: 3.1 },
    { id: 3, name: "峡谷C", x: 1.3, y: 1.8, z: 1.1 },
    { id: 4, name: "高坡D", x: 1.4, y: -1.9, z: 2.7 },
    { id: 5, name: "接收器T", x: 3.8, y: 0.0, z: 1.0 }
  ];
  const acoEdges = [
    [0, 1], [0, 2],
    [1, 3], [1, 4], [1, 2],
    [2, 3], [2, 4],
    [3, 5], [4, 5], [3, 4]
  ];

  window.IIP.cases.push({
    id: "ch6-case2",
    chapterId: "ch6",
    title: "6.2 【代表性演算】蚁群算法（ACO）3D 路径选择体验与信息素正反馈机制",
    tag: "大纲必做演示 · 教材6.4 p.235",
    bounds: { xMin: -4.5, xMax: 4.5, yMin: -3.8, yMax: 3.8, zMin: 0, zMax: 4.2, xLabel: "地形 X", yLabel: "地形 Y", zLabel: "海拔高度 Z" },
    legend: [
      { color: "#10b981", label: "高浓度信息素 τ_ij 最优路径" },
      { color: "#64748b", label: "信息素挥发衰减次优路径" },
      { color: "#facc15", label: "人工蚂蚁群体状态转移" }
    ],
    guideHtml: `
      <strong>实验目标：</strong>生动再现大纲第16周“蚁群算法路径选择体验”与教材 6.4.2 节转移概率公式：<br>
      <div class="formula-box">p_ij = [τ_ij]^α · [1/d_ij]^β / ∑ [τ_is]^α · [1/d_is]^β ,   τ_ij ← (1-ρ)τ_ij + ∑(Q / L_k)</div>
      起点 <code>S(0)</code> 到终点 <code>T(5)</code> 的上侧峡谷通路 <code>S→A→C→T</code> 三维总长最短（<strong>8.59</strong>），观察发光绿色信息素管道如何在正反馈下不断增粗！
    `,
    controls: [
      { key: "alpha", label: "信息素重要度因子 α", type: "range", min: 0.2, max: 3.0, step: 0.2, default: 1.2 },
      { key: "beta", label: "启发式距离可见度因子 β", type: "range", min: 0.0, max: 4.0, step: 0.2, default: 2.0 },
      { key: "rho", label: "信息素挥发系数 ρ", type: "range", min: 0.02, max: 0.65, step: 0.03, default: 0.20 }
    ],
    actions: [
      { label: "🐜 释放一轮蚁群（12只蚂蚁寻路并更新信息素）", primary: true, onClick(state) { state.stepAco(state); } },
      { label: "▶ 自动连续迭代 / 暂停", onClick(state) { state.running = !state.running; } },
      { label: "↺ 重置均匀初始信息素", onClick(state) { state.resetAco(state); } }
    ],
    init(state) {
      const dist = (i, j) => {
        const a = acoNodes[i], b = acoNodes[j];
        return Math.hypot(a.x - b.x, a.y - b.y, (a.z - b.z) * 1.4);
      };
      state.dist = dist;

      state.resetAco = (st) => {
        st.tau = {};
        acoEdges.forEach(([u, v]) => {
          st.tau[`${u}_${v}`] = 1.0;
          st.tau[`${v}_${u}`] = 1.0;
        });
        st.round = 0;
        st.bestPath = [0, 1, 3, 5];
        st.bestLen = Infinity;
        st.lastProbs = [0.5, 0.5];
        st.running = false;
      };

      state.stepAco = (st) => {
        // Compute S->A vs S->B exact transition probabilities for readout
        const w01 = Math.pow(st.tau["0_1"], st.alpha) * Math.pow(1 / dist(0, 1), st.beta);
        const w02 = Math.pow(st.tau["0_2"], st.alpha) * Math.pow(1 / dist(0, 2), st.beta);
        st.lastProbs = [w01 / (w01 + w02), w02 / (w01 + w02)];

        const ants = [];
        for (let k = 0; k < 12; k++) {
          let cur = 0;
          const visited = new Set([0]);
          const path = [0];
          let L = 0;
          while (cur !== 5) {
            const nbrs = [];
            acoEdges.forEach(([u, v]) => {
              if (u === cur && !visited.has(v)) nbrs.push(v);
              else if (v === cur && !visited.has(u)) nbrs.push(u);
            });
            if (!nbrs.length) break;
            const weights = nbrs.map(( nxt ) =>
              Math.pow(st.tau[`${cur}_${nxt}`], st.alpha) * Math.pow(1 / dist(cur, nxt), st.beta)
            );
            const sumW = weights.reduce((a, b) => a + b, 0);
            let r = Math.random() * sumW, pick = nbrs[0];
            for (let i = 0; i < nbrs.length; i++) {
              r -= weights[i];
              if (r <= 0) { pick = nbrs[i]; break; }
            }
            L += dist(cur, pick);
            cur = pick;
            visited.add(cur);
            path.push(cur);
          }
          if (cur === 5) {
            ants.push({ path, L });
            if (L < st.bestLen) { st.bestLen = L; st.bestPath = path.slice(); }
          }
        }

        // Evaporate & Deposit
        Object.keys(st.tau).forEach((key) => {
          st.tau[key] = Math.max(0.08, (1 - st.rho) * st.tau[key]);
        });
        ants.forEach(({ path, L }) => {
          const dep = 2.2 / L;
          for (let i = 0; i < path.length - 1; i++) {
            const u = path[i], v = path[i + 1];
            st.tau[`${u}_${v}`] = Math.min(8.0, st.tau[`${u}_${v}`] + dep);
            st.tau[`${v}_${u}`] = st.tau[`${u}_${v}`];
          }
        });
        st.round += 1;
      };

      state.resetAco(state);
    },
    step(state, dt) {
      if (!state.running || state.round >= 60) return;
      state._acc = (state._acc || 0) + dt;
      if (state._acc < 0.25) return;
      state._acc = 0;
      state.stepAco(state);
    },
    render3D(engine, state, time) {
      // Subtle 3D terrain ridge on negative Y side
      engine.addSurface({
        fn: (x, y) => clamp(0.6 + 2.2 * Math.exp(-0.22 * (x * x + (y + 2.1) ** 2)), 0, 4.0),
        nx: 20, ny: 18,
        palette: "viridis",
        alpha: 0.45,
        zMin: 0, zMax: 4.2
      });

      acoEdges.forEach(([u, v]) => {
        const a = acoNodes[u], b = acoNodes[v];
        const tVal = state.tau[`${u}_${v}`] || 1.0;
        const strong = tVal > 1.35;
        engine.addLine({
          from: [a.x, a.y, a.z + 0.15],
          to: [b.x, b.y, b.z + 0.15],
          color: strong ? "#10b981" : "rgba(148, 163, 184, 0.55)",
          width: clamp(1.0 + tVal * 1.15, 1.0, 7.5),
          glow: strong
        });
      });

      // Animated ant moving along current dominant path
      const bp = state.bestPath || [0, 1, 3, 5];
      const segF = ((time * 1.2) % (bp.length - 1));
      const si = Math.floor(segF), sf = segF - si;
      const nA = acoNodes[bp[si]], nB = acoNodes[bp[si + 1]];
      engine.addSphere({
        x: nA.x + (nB.x - nA.x) * sf,
        y: nA.y + (nB.y - nA.y) * sf,
        z: nA.z + (nB.z - nA.z) * sf + 0.22,
        radius: 0.24, color: "#facc15", glow: true
      });

      acoNodes.forEach((n) => {
        engine.addSphere({
          x: n.x, y: n.y, z: n.z + 0.15,
          radius: n.id === 0 || n.id === 5 ? 0.34 : 0.26,
          color: n.id === 0 ? "#38bdf8" : n.id === 5 ? "#10b981" : "#f8fafc",
          label: n.name
        });
      });
    },
    render2D(canvas, state) {
      const keyEdges = [
        { k: "0_1", lbl: "S→A(短)" },
        { k: "0_2", lbl: "S→B(陡)" },
        { k: "1_3", lbl: "A→C(短)" },
        { k: "2_4", lbl: "B→D(长)" },
        { k: "3_5", lbl: "C→T(短)" },
        { k: "4_5", lbl: "D→T" }
      ];
      drawBarChart(canvas, {
        title: "各关键路段当前信息素浓度 τ_ij 对比",
        items: keyEdges.map((e) => ({
          label: e.lbl,
          value: state.tau[e.k] || 1.0,
          color: e.lbl.includes("短") ? "#10b981" : "#64748b"
        }))
      });
    },
    getMetrics(state) {
      const w01 = Math.pow(state.tau["0_1"], state.alpha) * Math.pow(1 / state.dist(0, 1), state.beta);
      const w02 = Math.pow(state.tau["0_2"], state.alpha) * Math.pow(1 / state.dist(0, 2), state.beta);
      const p01 = (w01 / (w01 + w02)) * 100;
      return [
        { label: "已释放蚁群轮数", value: `${state.round} 轮` },
        { label: "起点选最优支路 P(S→A)", value: `${p01.toFixed(1)}%` },
        { label: "当前发现最短三维路长", value: Number.isFinite(state.bestLen) ? state.bestLen.toFixed(2) : "待探索" },
        { label: "最优路径节点序列", value: state.bestPath.map((i) => acoNodes[i].name.slice(-1)).join("→") }
      ];
    }
  });

  /* -----------------------------------------------------------------------
     6.3 禁忌搜索（TS）与模拟退火（SA）跳出局部极小对比 + 四算法多次运行统计评价
     ----------------------------------------------------------------------- */
  function runMonteCarloBenchmark(maxIter) {
    // Compare Greedy, TS, SA, PSO across 15 independent runs on Double-Well Trap
    const fn = benchmarks.doubleWell;
    const algos = ["贪心爬山", "禁忌搜索TS", "模拟退火SA", "粒子群PSO"];
    const summary = algos.map((name) => {
      const finals = [];
      for (let run = 0; run < 15; run++) {
        if (name === "粒子群PSO") {
          let gb = Infinity;
          const pop = Array.from({ length: 10 }, () => ({
            x: -2.2 + (Math.random() - 0.5) * 2.5,
            y: -1.8 + (Math.random() - 0.5) * 2.5,
            vx: 0, vy: 0, px: 0, py: 0, pf: Infinity
          }));
          pop.forEach((p) => { p.px = p.x; p.py = p.y; p.pf = fn(p.x, p.y); gb = Math.min(gb, p.pf); });
          let gx = pop[0].x, gy = pop[0].y;
          for (let it = 0; it < Math.max(8, Math.floor(maxIter / 4)); it++) {
            pop.forEach((p) => {
              p.vx = 0.68 * p.vx + 1.6 * Math.random() * (p.px - p.x) + 1.6 * Math.random() * (gx - p.x);
              p.vy = 0.68 * p.vy + 1.6 * Math.random() * (p.py - p.y) + 1.6 * Math.random() * (gy - p.y);
              p.x = clamp(p.x + p.vx, -4, 4);
              p.y = clamp(p.y + p.vy, -4, 4);
              const f = fn(p.x, p.y);
              if (f < p.pf) { p.px = p.x; p.py = p.y; p.pf = f; }
              if (f < gb) { gb = f; gx = p.x; gy = p.y; }
            });
          }
          finals.push(gb);
        } else {
          // Start near the local trap (-2.2, -1.8)!
          let x = -2.3 + (Math.random() - 0.5) * 0.8;
          let y = -1.9 + (Math.random() - 0.5) * 0.8;
          let best = fn(x, y);
          const tabu = [];
          let T = 4.5;
          for (let it = 0; it < maxIter; it++) {
            if (name === "贪心爬山") {
              const nx = clamp(x + (Math.random() - 0.5) * 0.8, -4, 4);
              const ny = clamp(y + (Math.random() - 0.5) * 0.8, -4, 4);
              const nf = fn(nx, ny);
              if (nf < fn(x, y)) { x = nx; y = ny; best = Math.min(best, nf); }
            } else if (name === "模拟退火SA") {
              const nx = clamp(x + (Math.random() - 0.5) * 1.9, -4, 4);
              const ny = clamp(y + (Math.random() - 0.5) * 1.9, -4, 4);
              const nf = fn(nx, ny), cf = fn(x, y);
              if (nf < cf || Math.random() < Math.exp(-(nf - cf) / T)) {
                x = nx; y = ny; best = Math.min(best, nf);
              }
              T *= 0.94;
            } else {
              // Tabu Search: evaluate 8 neighborhood candidates, avoid tabu cells unless aspiration
              let pick = null;
              for (let c = 0; c < 10; c++) {
                const nx = clamp(x + (Math.random() - 0.5) * 2.1, -4, 4);
                const ny = clamp(y + (Math.random() - 0.5) * 2.1, -4, 4);
                const nf = fn(nx, ny);
                const isTabu = tabu.some((tb) => Math.hypot(tb[0] - nx, tb[1] - ny) < 0.85);
                if ((!isTabu || nf < best) && (!pick || nf < pick.f)) {
                  pick = { x: nx, y: ny, f: nf };
                }
              }
              if (pick) {
                x = pick.x; y = pick.y;
                best = Math.min(best, pick.f);
                tabu.push([x, y]);
                if (tabu.length > 9) tabu.shift();
              }
            }
          }
          finals.push(best);
        }
      }
      const mean = finals.reduce((a, b) => a + b, 0) / finals.length;
      const minV = Math.min(...finals);
      const std = Math.sqrt(finals.reduce((s, v) => s + (v - mean) ** 2, 0) / finals.length);
      return { name, mean, minV, std };
    });
    return summary;
  }

  window.IIP.cases.push({
    id: "ch6-case3",
    chapterId: "ch6",
    title: "6.3 禁忌搜索（TS）与模拟退火（SA）跳出局部最优 3D 轨迹及多次运行统计",
    tag: "教材6.2–6.3 · 多次运行统计评价",
    bounds: { xMin: -4, xMax: 4, yMin: -4, yMax: 4, zMin: 0, zMax: 11, xLabel: "变量 x₁", yLabel: "变量 x₂", zLabel: "能量/目标函数 E(x)" },
    legend: [
      { color: "#94a3b8", label: "贪心爬山（困于左前浅势阱）" },
      { color: "#38bdf8", label: "禁忌搜索 TS（凭禁忌记忆跳出）" },
      { color: "#f59e0b", label: "模拟退火 SA（Metropolis热跃迁跳出）" }
    ],
    guideHtml: `
      <strong>实验目标：</strong>覆盖大纲第15周（比较 TS 与 SA 搜索过程）与第18周（多次独立运行客观评价随机算法）。<br>
      三维双势阱地形中，左前方 <code>(-2.1, -1.8)</code> 为<strong>局部极小陷阱</strong>，右后方 <code>(2.1, 1.9)</code> 为<strong>更深的全局最小值</strong>。观察三条轨迹均从局部势阱出发时的截然不同命运！
    `,
    controls: [
      { key: "t0", label: "模拟退火初始温度 T₀（控制越垒概率 exp(-ΔE/T)）", type: "range", min: 0.5, max: 8.0, step: 0.5, default: 4.5 },
      { key: "tabuLen", label: "禁忌搜索禁忌表长度 L_tabu", type: "range", min: 2, max: 16, step: 1, default: 9 },
      { key: "maxSteps", label: "最大搜索迭代步数（终止条件）", type: "range", min: 15, max: 70, step: 5, default: 45 }
    ],
    actions: [
      { label: "🔄 重新生成单次 3D 搜索轨迹 + 15次统计对比", primary: true, onClick(state) { state.reRun(state); } }
    ],
    init(state) {
      state.reRun = (st) => {
        const fn = benchmarks.doubleWell;
        const N = Math.round(st.maxSteps);
        const trGreedy = [[-2.6, -2.4, fn(-2.6, -2.4)]];
        const trTS = [[-2.6, -2.4, fn(-2.6, -2.4)]];
        const trSA = [[-2.6, -2.4, fn(-2.6, -2.4)]];
        const tabu = [];
        let T = st.t0;
        let bestTS = trTS[0][2], bestSA = trSA[0][2];

        for (let i = 0; i < N; i++) {
          // Greedy
          const g = trGreedy[trGreedy.length - 1];
          const gx = clamp(g[0] + (Math.random() - 0.5) * 0.9, -3.8, 3.8);
          const gy = clamp(g[1] + (Math.random() - 0.5) * 0.9, -3.8, 3.8);
          const gf = fn(gx, gy);
          trGreedy.push(gf < g[2] ? [gx, gy, gf] : [g[0], g[1], g[2]]);

          // TS
          const tCur = trTS[trTS.length - 1];
          let bestCand = null;
          for (let c = 0; c < 12; c++) {
            const cx = clamp(tCur[0] + (Math.random() - 0.5) * 2.2, -3.8, 3.8);
            const cy = clamp(tCur[1] + (Math.random() - 0.5) * 2.2, -3.8, 3.8);
            const cf = fn(cx, cy);
            const inTabu = tabu.some((tb) => Math.hypot(tb[0] - cx, tb[1] - cy) < 0.9);
            if ((!inTabu || cf < bestTS) && (!bestCand || cf < bestCand[2])) {
              bestCand = [cx, cy, cf];
            }
          }
          if (bestCand) {
            trTS.push(bestCand);
            bestTS = Math.min(bestTS, bestCand[2]);
            tabu.push([bestCand[0], bestCand[1]]);
            if (tabu.length > Math.round(st.tabuLen)) tabu.shift();
          }

          // SA
          const sCur = trSA[trSA.length - 1];
          const sx = clamp(sCur[0] + (Math.random() - 0.5) * 2.1, -3.8, 3.8);
          const sy = clamp(sCur[1] + (Math.random() - 0.5) * 2.1, -3.8, 3.8);
          const sf = fn(sx, sy);
          const dE = sf - sCur[2];
          if (dE <= 0 || Math.random() < Math.exp(-dE / Math.max(0.05, T))) {
            trSA.push([sx, sy, sf]);
            bestSA = Math.min(bestSA, sf);
          } else {
            trSA.push([sCur[0], sCur[1], sCur[2]]);
          }
          T *= 0.93;
        }
        st.trGreedy = trGreedy;
        st.trTS = trTS;
        st.trSA = trSA;
        st.bestGreedy = Math.min(...trGreedy.map((p) => p[2]));
        st.bestTS = bestTS;
        st.bestSA = bestSA;
        st.mcStats = runMonteCarloBenchmark(N);
      };
      state.reRun(state);
    },
    render3D(engine, state) {
      const fn = benchmarks.doubleWell;
      engine.addSurface({ fn, nx: 30, ny: 30, palette: "plasma", alpha: 0.78, zMin: 0, zMax: 11, pickable: true });

      const lift = (arr) => arr.map((p) => [p[0], p[1], p[2] + 0.25]);
      engine.addPolyline({ points: lift(state.trGreedy), color: "#94a3b8", width: 2.0 });
      engine.addPolyline({ points: lift(state.trTS), color: "#38bdf8", width: 2.6, glow: true });
      engine.addPolyline({ points: lift(state.trSA), color: "#f59e0b", width: 2.6, glow: true });

      engine.addLabel3D({ x: -2.1, y: -1.8, z: fn(-2.1, -1.8) + 1.2, text: "局部极小陷阱", color: "#fda4af" });
      engine.addLabel3D({ x: 2.1, y: 1.9, z: fn(2.1, 1.9) + 1.2, text: "全局最小谷底", color: "#6ee7b7" });
    },
    render2D(canvas, state) {
      const stats = state.mcStats || [];
      drawBarChart(canvas, {
        title: "15次独立重复运行平均最终目标值 Mean(f) 对比（越低越优）",
        items: stats.map((s, idx) => ({
          label: s.name.replace("搜索", "").replace("算法", ""),
          value: s.mean,
          valueText: `${s.mean.toFixed(2)}±${s.std.toFixed(1)}`,
          color: ["#64748b", "#38bdf8", "#f59e0b", "#10b981"][idx]
        }))
      });
    },
    getMetrics(state) {
      return [
        { label: "贪心法最终值(困于局部)", value: state.bestGreedy.toFixed(3) },
        { label: "禁忌搜索 TS 寻优值", value: state.bestTS.toFixed(3) },
        { label: "模拟退火 SA 寻优值", value: state.bestSA.toFixed(3) },
        { label: "理论全局最小值参考", value: "~1.48 (右后深谷)" }
      ];
    }
  });

  /* -----------------------------------------------------------------------
     6.4 【专业实践】智能感知三维实验室多传感器空间覆盖布置优化（大纲第18周综合讨论）
     ----------------------------------------------------------------------- */
  function evalSensorCoverage(sensors, fovRad) {
    // Evaluate coverage over 9x9 floor & workbench target grid
    let covered = 0, total = 0;
    for (let gx = -3.6; gx <= 3.61; gx += 0.9) {
      for (let gy = -3.6; gy <= 3.61; gy += 0.9) {
        total++;
        const hit = sensors.some((s) => Math.hypot(gx - s.x, gy - s.y) <= fovRad);
        if (hit) covered++;
      }
    }
    return (covered / total) * 100;
  }

  window.IIP.cases.push({
    id: "ch6-case4",
    chapterId: "ch6",
    title: "6.4 【专业实践】智能感知三维空间多光电传感器覆盖布置优化实验",
    tag: "大纲传感器布置优化 · 综合实践",
    bounds: { xMin: -4.5, xMax: 4.5, yMin: -4.5, yMax: 4.5, zMin: 0, zMax: 4.2, xLabel: "实验室长 X (m)", yLabel: "实验室宽 Y (m)", zLabel: "吊装高度 Z (m)" },
    legend: [
      { color: "#38bdf8", label: "顶装智能光电/红外感知视场锥 (3D FOV)" },
      { color: "#10b981", label: "已被有效感知覆盖的目标网格点" },
      { color: "#f43f5e", label: "感知盲区网格点" }
    ],
    guideHtml: `
      <strong>综合工程实践：</strong>落实大纲第6章学习实践“传感器布置优化的应用讨论”：<br>
      <ul>
        <li><strong>优化目标</strong>：最大化实验室重点区域三维地面网格点有效感知覆盖率 <code>C(X)</code>，消除重叠浪费与角落盲区；</li>
        <li><strong>待调整决策参数</strong>：<code>K</code> 台顶装光电传感器的二维安装坐标 <code>(x_i, y_i)</code>；</li>
        <li><strong>物理约束条件</strong>：传感器坐标须位于实验室顶棚导轨边界 <code>[-3.6, 3.6] m</code> 内，单台有效视场半径受光学孔径角限制。</li>
      </ul>
    `,
    controls: [
      { key: "nSens", label: "部署光电传感器数量 K", type: "range", min: 3, max: 6, step: 1, default: 4 },
      { key: "fovR", label: "单传感器光学孔径地面覆盖半径 R (m)", type: "range", min: 1.4, max: 2.9, step: 0.1, default: 2.1 }
    ],
    actions: [
      { label: "▶ 启动智能群体协同寻优布置 / 暂停", primary: true, onClick(state) { state.running = !state.running; } },
      { label: "↺ 恢复角落拥挤初始布置（高重叠低覆盖）", onClick(state) { state.resetSens(state); } }
    ],
    init(state) {
      state.resetSens = (st) => {
        const K = Math.round(st.nSens);
        // Start poorly clustered in one corner to clearly show optimization spreading them out!
        st.sensors = Array.from({ length: K }, (_, i) => ({
          x: -2.5 + (i % 2) * 0.7,
          y: -2.5 + Math.floor(i / 2) * 0.7
        }));
        st.initCov = evalSensorCoverage(st.sensors, st.fovR);
        st.bestCov = st.initCov;
        st.iter = 0;
        st.running = true;
        st.hist = [{ iter: 0, cov: st.bestCov }];
        st._k = K;
      };
      state.resetSens(state);
    },
    step(state, dt) {
      if (Math.round(state.nSens) !== state._k) state.resetSens(state);
      if (!state.running || state.iter >= 120) return;
      state._acc = (state._acc || 0) + dt;
      if (state._acc < 0.10) return;
      state._acc = 0;

      // Stochastic hill-climbing / SA-PSO hybrid step optimizing joint sensor layout
      const curCov = evalSensorCoverage(state.sensors, state.fovR);
      let bestCand = state.sensors;
      let bestVal = curCov;

      for (let trial = 0; trial < 14; trial++) {
        const cand = state.sensors.map((s) => ({
          x: clamp(s.x + (Math.random() - 0.5) * 1.1, -3.5, 3.5),
          y: clamp(s.y + (Math.random() - 0.5) * 1.1, -3.5, 3.5)
        }));
        // Add mild repulsion penalty so sensors spread evenly even when coverage ties
        let repulse = 0;
        for (let i = 0; i < cand.length; i++) {
          for (let j = i + 1; j < cand.length; j++) {
            const d = Math.hypot(cand[i].x - cand[j].x, cand[i].y - cand[j].y);
            if (d < state.fovR * 1.35) repulse += (state.fovR * 1.35 - d) * 1.5;
          }
        }
        const score = evalSensorCoverage(cand, state.fovR) - repulse * 0.15;
        if (score > bestVal - 0.01) {
          bestVal = score;
          bestCand = cand;
        }
      }
      state.sensors = bestCand;
      state.bestCov = evalSensorCoverage(state.sensors, state.fovR);
      state.iter += 1;
      state.hist.push({ iter: state.iter, cov: state.bestCov });
    },
    render3D(engine, state) {
      // Draw 9x9 floor sensing grid
      for (let gx = -3.6; gx <= 3.61; gx += 0.9) {
        for (let gy = -3.6; gy <= 3.61; gy += 0.9) {
          const hit = state.sensors.some((s) => Math.hypot(gx - s.x, gy - s.y) <= state.fovR);
          engine.addSphere({
            x: gx, y: gy, z: 0.06,
            radius: 0.13,
            color: hit ? "#10b981" : "#f43f5e",
            outline: null
          });
        }
      }

      // Draw ceiling-mounted 3D sensor cones
      state.sensors.forEach((s, idx) => {
        engine.addCone({
          apex: [s.x, s.y, 3.6],
          centerBase: [s.x, s.y, 0.05],
          radius: state.fovR,
          segments: 14,
          color: "rgba(56, 189, 248, 0.18)",
          wireColor: "rgba(56, 189, 248, 0.55)"
        });
        engine.addSphere({
          x: s.x, y: s.y, z: 3.6,
          radius: 0.28,
          color: "#facc15",
          glow: true,
          label: `传感器#${idx + 1}`
        });
      });
    },
    render2D(canvas, state) {
      drawLineChart(canvas, {
        title: "智能优化传感器空间覆盖率 C(%) 收敛过程",
        xMin: 0, xMax: Math.max(25, state.iter), yMin: 0, yMax: 105,
        series: [{ label: "有效覆盖率(%)", pts: state.hist.map((h) => [h.iter, h.cov]), color: "#10b981", width: 2.4, fillAlpha: true }]
      });
    },
    getMetrics(state) {
      const cov = evalSensorCoverage(state.sensors, state.fovR);
      return [
        { label: "寻优迭代步数", value: `${state.iter}` },
        { label: "初始扎堆覆盖率", value: `${state.initCov.toFixed(1)}%` },
        { label: "优化后有效覆盖率", value: `${cov.toFixed(1)}%` },
        { label: "盲区网格占比", value: `${(100 - cov).toFixed(1)}%` }
      ];
    }
  });
})();
