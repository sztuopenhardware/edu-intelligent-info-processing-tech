/* ==========================================================================
   第3章（神经计算）与 第4章（进化计算）交互式 3D 仿真实验案例集
   包含 6 个完整交互式 3D 实验案例（按章节归属下拉菜单）
   ========================================================================== */
window.IIP = window.IIP || {};
window.IIP.cases = window.IIP.cases || [];

(function () {
  const { clamp, mulberry32, randn, activations, benchmarks } = window.IIP.math;
  const { drawLineChart, drawBarChart } = window.IIP.charts;

  /* =======================================================================
     第三章：神经计算（对应教材第2章）
     3.1 【代表性演算】光电脉冲信号神经元分类：一次前向计算与权重调整 3D 超平面
     ======================================================================= */
  const percSamples = [
    { x1: 2.0, x2: 1.0, d: 1, name: "脉冲#1(演算样本)" },
    { x1: 2.6, x2: 2.2, d: 1, name: "脉冲#2(目标回波)" },
    { x1: 1.4, x2: 2.8, d: 1, name: "脉冲#3(目标回波)" },
    { x1: 3.1, x2: 0.8, d: 1, name: "脉冲#4(目标回波)" },
    { x1: 0.9, x2: 1.9, d: 1, name: "脉冲#5(目标回波)" },
    { x1: -1.8, x2: -1.2, d: -1, name: "暗噪#6(背景干扰)" },
    { x1: -2.5, x2: -0.4, d: -1, name: "暗噪#7(背景干扰)" },
    { x1: -0.9, x2: -2.3, d: -1, name: "暗噪#8(背景干扰)" },
    { x1: -2.2, x2: 0.9, d: -1, name: "暗噪#9(背景干扰)" },
    { x1: 0.3, x2: -2.1, d: -1, name: "暗噪#10(背景干扰)" }
  ];

  window.IIP.cases.push({
    id: "ch3-case1",
    chapterId: "ch3",
    title: "3.1 【代表性演算】光电脉冲感知机分类：前向计算与单步权重更新 3D 超平面",
    tag: "大纲必做演算 · 教材2.2–2.3",
    bounds: { xMin: -4, xMax: 4, yMin: -4, yMax: 4, zMin: -5, zMax: 5, xLabel: "脉冲幅值 x₁", yLabel: "脉宽特征 x₂", zLabel: "净输入 v = w·x+b" },
    legend: [
      { color: "#10b981", label: "真实目标回波样本 (d = +1)" },
      { color: "#f43f5e", label: "背景暗电流噪声 (d = -1)" },
      { color: "#38bdf8", label: "z = 0 分类判别阈值平面" }
    ],
    guideHtml: `
      <strong>实验目标：</strong>直观演示大纲第3章代表性演算——单神经元（M-P / 感知机）前向计算 <code>v = w₁x₁ + w₂x₂ + b</code> 与误差反馈调权 <code>w ← w + η(d - y)x</code>。<br>
      倾斜彩色曲面为净输入平面 <code>v(x₁,x₂)</code>，它与水平半透明平面 <code>z=0</code> 的交线即为<strong>二维线性分类边界</strong>！点击<strong>“单步训练当前样本”</strong>观察分类面如何旋转修正误判样本！
    `,
    controls: [
      { key: "w1", label: "突触权重 w₁", type: "range", min: -2.0, max: 2.0, step: 0.05, default: -0.30 },
      { key: "w2", label: "突触权重 w₂", type: "range", min: -2.0, max: 2.0, step: 0.05, default: 0.20 },
      { key: "bias", label: "神经元偏置 b（负阈值 -θ）", type: "range", min: -2.0, max: 2.0, step: 0.05, default: -0.10 },
      { key: "eta", label: "学习率 η", type: "range", min: 0.05, max: 0.60, step: 0.05, default: 0.25 },
      {
        key: "actType", label: "神经元激活函数 f(v)（教材2.2.3）", type: "select", default: "step",
        options: [
          { value: "step", label: "阶跃符号函数 sgn(v) ∈ {-1, +1}" },
          { value: "tanh", label: "双曲正切函数 tanh(v) ∈ (-1, +1)" }
        ]
      }
    ],
    actions: [
      {
        label: "⚡ 单步权重更新（修正误判样本）",
        primary: true,
        onClick(state, syncControls) {
          // Pick first misclassified sample (starting with sample #0 if misclassified)
          let target = percSamples.find((s) => (state.w1 * s.x1 + state.w2 * s.x2 + state.bias >= 0 ? 1 : -1) !== s.d);
          if (!target) target = percSamples[0];
          const v = state.w1 * target.x1 + state.w2 * target.x2 + state.bias;
          const y = v >= 0 ? 1 : -1;
          const err = target.d - y;
          state.w1 = clamp(Number((state.w1 + state.eta * err * target.x1).toFixed(3)), -2, 2);
          state.w2 = clamp(Number((state.w2 + state.eta * err * target.x2).toFixed(3)), -2, 2);
          state.bias = clamp(Number((state.bias + state.eta * err).toFixed(3)), -2, 2);
          state.stepCount = (state.stepCount || 0) + 1;
          state.hist.push({ step: state.stepCount, acc: state.calcAcc() });
          syncControls();
        }
      },
      {
        label: "↺ 恢复演算初始权重",
        onClick(state, syncControls) {
          state.w1 = -0.30;
          state.w2 = 0.20;
          state.bias = -0.10;
          state.stepCount = 0;
          state.hist = [{ step: 0, acc: state.calcAcc() }];
          syncControls();
        }
      }
    ],
    init(state) {
      state.stepCount = 0;
      state.calcAcc = () => {
        let ok = 0;
        percSamples.forEach((s) => {
          const y = state.w1 * s.x1 + state.w2 * s.x2 + state.bias >= 0 ? 1 : -1;
          if (y === s.d) ok++;
        });
        return (ok / percSamples.length) * 100;
      };
      state.hist = [{ step: 0, acc: state.calcAcc() }];
    },
    render3D(engine, state) {
      // Net-input / activated surface
      engine.addSurface({
        fn: (x, y) => {
          const v = state.w1 * x + state.w2 * y + state.bias;
          return state.actType === "tanh" ? Math.tanh(v) * 4.0 : clamp(v, -4.8, 4.8);
        },
        nx: 22, ny: 22,
        palette: "coolwarm",
        alpha: 0.78,
        zMin: -5, zMax: 5
      });

      // Threshold Plane z = 0
      engine.addPlane({
        fn: () => 0,
        nx: 10, ny: 10,
        color: "rgba(56, 189, 248, 0.16)",
        wireColor: "rgba(56, 189, 248, 0.45)"
      });

      // Weight normal vector arrow from origin
      engine.addArrow({
        from: [0, 0, 0],
        to: [state.w1 * 2.2, state.w2 * 2.2, 2.2],
        color: "#facc15",
        width: 2.8,
        label: "法向量 w"
      });

      percSamples.forEach((s, idx) => {
        const v = state.w1 * s.x1 + state.w2 * s.x2 + state.bias;
        const y = v >= 0 ? 1 : -1;
        const ok = y === s.d;
        const zVal = state.actType === "tanh" ? Math.tanh(v) * 4.0 : clamp(v, -4.8, 4.8);
        engine.addLine({ from: [s.x1, s.x2, 0], to: [s.x1, s.x2, zVal], color: ok ? "rgba(255,255,255,0.35)" : "#facc15", width: ok ? 1.2 : 2.2, dashed: !ok });
        engine.addSphere({
          x: s.x1, y: s.x2, z: zVal,
          radius: idx === 0 ? 0.34 : 0.24,
          color: s.d > 0 ? "#10b981" : "#f43f5e",
          outline: ok ? "#ffffff" : "#facc15",
          glow: idx === 0 || !ok,
          label: idx === 0 ? `演算样本(${ok ? "✓" : "误判"})` : null,
          info: `${s.name}: x=(${s.x1}, ${s.x2}), v=${v.toFixed(2)}, 预测=${y}, 真值=${s.d}`
        });
      });
    },
    render2D(canvas, state) {
      const s0 = percSamples[0];
      const v0 = state.w1 * s0.x1 + state.w2 * s0.x2 + state.bias;
      const actCurve = [];
      for (let v = -4; v <= 4; v += 0.2) {
        actCurve.push([v, state.actType === "tanh" ? Math.tanh(v) : v >= 0 ? 1 : -1]);
      }
      drawLineChart(canvas, {
        title: `激活函数 y=f(v) 与 演算样本#1 当前净输入 v=${v0.toFixed(2)}`,
        xMin: -4, xMax: 4, yMin: -1.25, yMax: 1.25,
        vLine: clamp(v0, -4, 4),
        series: [{ label: state.actType === "tanh" ? "tanh(v)" : "sgn(v)", pts: actCurve, color: "#38bdf8", width: 2.4 }]
      });
    },
    getMetrics(state) {
      const s0 = percSamples[0];
      const v0 = state.w1 * s0.x1 + state.w2 * s0.x2 + state.bias;
      const acc = state.calcAcc ? state.calcAcc() : 50;
      return [
        { label: "演算样本#1 净输入 v", value: v0.toFixed(3) },
        { label: "演算样本#1 预测输出", value: v0 >= 0 ? "+1 (正确)" : "-1 (误判)" },
        { label: "全部10样本分类准确率", value: `${acc.toFixed(0)}%` },
        { label: "累计权重更新步数", value: `${state.stepCount || 0} 步` }
      ];
    }
  });

  /* -----------------------------------------------------------------------
     3.2 【专业实践】多层 BP 神经网络光电信号分类与 3D 决策概率曲面（含过拟合实验）
     ----------------------------------------------------------------------- */
  function buildMlpDataset(kind, noiseStd, seed = 42) {
    const rng = mulberry32(seed);
    const train = [], val = [];
    const genPoint = (i, isVal) => {
      let x1, x2, label;
      if (kind === "xor") {
        const q = i % 4;
        const cx = q === 0 || q === 3 ? 1.8 : -1.8;
        const cy = q < 2 ? 1.8 : -1.8;
        label = q === 0 || q === 2 ? 1 : 0; // XOR quadrants
        x1 = cx + randn(rng) * (0.45 + noiseStd);
        x2 = cy + randn(rng) * (0.45 + noiseStd);
      } else if (kind === "ring") {
        label = i % 2;
        const r = label === 1 ? 0.85 + randn(rng) * (0.25 + noiseStd * 0.7) : 2.85 + randn(rng) * (0.32 + noiseStd * 0.7);
        const ang = rng() * Math.PI * 2;
        x1 = r * Math.cos(ang);
        x2 = r * Math.sin(ang);
      } else {
        // moons / curved光电簇
        label = i % 2;
        const t = rng() * Math.PI;
        if (label === 1) {
          x1 = 1.8 * Math.cos(t) - 0.6 + randn(rng) * (0.22 + noiseStd * 0.7);
          x2 = 1.8 * Math.sin(t) - 0.3 + randn(rng) * (0.22 + noiseStd * 0.7);
        } else {
          x1 = 1.8 * (1 - Math.cos(t)) - 1.1 + randn(rng) * (0.22 + noiseStd * 0.7);
          x2 = -1.8 * Math.sin(t) + 0.6 + randn(rng) * (0.22 + noiseStd * 0.7);
        }
      }
      // Inject 15% label corruption when noiseStd is high to demonstrate overfitting!
      if (!isVal && noiseStd >= 0.45 && i % 6 === 0) {
        label = 1 - label;
      }
      return { x1: clamp(x1, -3.8, 3.8), x2: clamp(x2, -3.8, 3.8), y: label };
    };
    for (let i = 0; i < 36; i++) train.push(genPoint(i, false));
    for (let i = 0; i < 28; i++) val.push(genPoint(i + 100, true));
    return { train, val };
  }

  function createMLP(nHidden, seed = 7) {
    const rng = mulberry32(seed);
    const W1 = Array.from({ length: nHidden }, () => [(rng() - 0.5) * 1.8, (rng() - 0.5) * 1.8]);
    const b1 = Array.from({ length: nHidden }, () => (rng() - 0.5) * 0.8);
    const W2 = Array.from({ length: nHidden }, () => (rng() - 0.5) * 1.6);
    const b2 = (rng() - 0.5) * 0.4;
    return { nHidden, W1, b1, W2, b2 };
  }

  function mlpForward(net, x1, x2) {
    const h = new Array(net.nHidden);
    for (let i = 0; i < net.nHidden; i++) {
      h[i] = Math.tanh(net.W1[i][0] * x1 + net.W1[i][1] * x2 + net.b1[i]);
    }
    let z2 = net.b2;
    for (let i = 0; i < net.nHidden; i++) z2 += net.W2[i] * h[i];
    const out = activations.sigmoid(z2);
    return { h, out };
  }

  function mlpTrainEpochs(net, data, lr, l2Reg, epochs = 10) {
    const n = data.length;
    for (let ep = 0; ep < epochs; ep++) {
      for (let k = 0; k < n; k++) {
        const s = data[k];
        const { h, out } = mlpForward(net, s.x1, s.x2);
        const dz2 = out - s.y; // binary cross-entropy + sigmoid derivative = (y_hat - y)
        for (let i = 0; i < net.nHidden; i++) {
          const dh = net.W2[i] * dz2 * (1 - h[i] * h[i]);
          net.W2[i] -= lr * (dz2 * h[i] + l2Reg * net.W2[i]);
          net.W1[i][0] -= lr * (dh * s.x1 + l2Reg * net.W1[i][0]);
          net.W1[i][1] -= lr * (dh * s.x2 + l2Reg * net.W1[i][1]);
          net.b1[i] -= lr * dh;
        }
        net.b2 -= lr * dz2;
      }
    }
  }

  function mlpEvalLossAcc(net, list) {
    let loss = 0, ok = 0;
    list.forEach((s) => {
      const p = clamp(mlpForward(net, s.x1, s.x2).out, 1e-5, 1 - 1e-5);
      loss += -(s.y * Math.log(p) + (1 - s.y) * Math.log(1 - p));
      if ((p >= 0.5 ? 1 : 0) === s.y) ok++;
    });
    return { loss: loss / list.length, acc: (ok / list.length) * 100 };
  }

  window.IIP.cases.push({
    id: "ch3-case2",
    chapterId: "ch3",
    title: "3.2 【专业实践】多层 BP 神经网络非线性分类与 3D 决策概率曲面",
    tag: "大纲可视化分类 · 过拟合实验",
    bounds: { xMin: -4, xMax: 4, yMin: -4, yMax: 4, zMin: 0, zMax: 1, xLabel: "特征 x₁", yLabel: "特征 x₂", zLabel: "预测概率 P(y=1)" },
    legend: [
      { color: "#10b981", label: "类别 1 光电信号样本 (z=1)" },
      { color: "#f43f5e", label: "类别 0 背景散斑样本 (z=0)" },
      { color: "#38bdf8", label: "P = 0.5 非线性决策等高面" }
    ],
    guideHtml: `
      <strong>实验目标：</strong>浏览器内实时运行误差反向传播（BP）算法训练多层前馈神经网络（教材2.3.2 图2-11~2-13）！<br>
      克服单层感知机无法分类<strong>异或（XOR）与同心圆衍射环</strong>的局限。尝试调高<strong>噪声与隐层神经元数</strong>并关闭正则化，观察右侧训练误差下降而验证误差反弹的<strong>过拟合现象</strong>！
    `,
    controls: [
      {
        key: "dataset", label: "选择非线性光电信号分布（教材图2-12）", type: "select", default: "xor",
        options: [
          { value: "xor", label: "相位正交异或分布（XOR，单层线性不可分）" },
          { value: "ring", label: "激光同心衍射环分布（内外环分类）" },
          { value: "moons", label: "双月牙交错脉冲簇分布" }
        ]
      },
      { key: "nHidden", label: "隐藏层神经元个数 H", type: "range", min: 2, max: 14, step: 1, default: 6 },
      { key: "lr", label: "BP 学习率 η", type: "range", min: 0.01, max: 0.25, step: 0.01, default: 0.06 },
      { key: "noise", label: "样本测量噪声与异常标签干扰", type: "range", min: 0.05, max: 0.65, step: 0.05, default: 0.15 },
      { key: "l2", label: "L2 正则化系数 λ（抑制过拟合）", type: "range", min: 0.0, max: 0.03, step: 0.002, default: 0.002 }
    ],
    actions: [
      {
        label: "▶ 播放 / 暂停实时 BP 训练",
        primary: true,
        onClick(state) { state.running = !state.running; }
      },
      {
        label: "+ 训练 50 轮 (Epochs)",
        onClick(state) {
          mlpTrainEpochs(state.net, state.data.train, state.lr, state.l2, 50);
          state.epoch += 50;
          const tr = mlpEvalLossAcc(state.net, state.data.train);
          const va = mlpEvalLossAcc(state.net, state.data.val);
          state.lossHist.push({ ep: state.epoch, tr: tr.loss, va: va.loss });
        }
      },
      {
        label: "↺ 重新初始化网络与样本",
        onClick(state) { state.rebuild(state); }
      }
    ],
    init(state) {
      state.rebuild = (st) => {
        st.data = buildMlpDataset(st.dataset, st.noise, 42);
        st.net = createMLP(Math.round(st.nHidden), 19);
        st.epoch = 0;
        st.running = true;
        const tr = mlpEvalLossAcc(st.net, st.data.train);
        const va = mlpEvalLossAcc(st.net, st.data.val);
        st.lossHist = [{ ep: 0, tr: tr.loss, va: va.loss }];
        st._lastCfg = `${st.dataset}_${st.nHidden}_${st.noise}`;
      };
      state.rebuild(state);
    },
    step(state) {
      const cfg = `${state.dataset}_${state.nHidden}_${state.noise}`;
      if (cfg !== state._lastCfg) {
        state.rebuild(state);
      }
      if (!state.running || state.epoch >= 1200) return;
      mlpTrainEpochs(state.net, state.data.train, state.lr, state.l2, 6);
      state.epoch += 6;
      const tr = mlpEvalLossAcc(state.net, state.data.train);
      const va = mlpEvalLossAcc(state.net, state.data.val);
      state.lossHist.push({ ep: state.epoch, tr: tr.loss, va: va.loss });
      if (state.lossHist.length > 90) state.lossHist.shift();
    },
    render3D(engine, state) {
      engine.addSurface({
        fn: (x, y) => mlpForward(state.net, x, y).out,
        nx: 26, ny: 26,
        palette: "coolwarm",
        alpha: 0.86,
        zMin: 0, zMax: 1,
        pickable: true
      });
      engine.addPlane({
        fn: () => 0.5,
        nx: 8, ny: 8,
        color: "rgba(56, 189, 248, 0.14)",
        wireColor: "rgba(56, 189, 248, 0.45)"
      });

      state.data.train.forEach((s, idx) => {
        engine.addSphere({
          x: s.x1, y: s.x2, z: s.y === 1 ? 0.96 : 0.04,
          radius: 0.19,
          color: s.y === 1 ? "#10b981" : "#f43f5e",
          info: `训练样本#${idx + 1} (${s.x1.toFixed(2)}, ${s.x2.toFixed(2)}) 真值=${s.y}, 预测P=${mlpForward(state.net, s.x1, s.x2).out.toFixed(3)}`
        });
      });
    },
    render2D(canvas, state) {
      const trPts = state.lossHist.map((d) => [d.ep, d.tr]);
      const vaPts = state.lossHist.map((d) => [d.ep, d.va]);
      const maxEp = Math.max(50, state.epoch);
      drawLineChart(canvas, {
        title: "BP 训练损失 (Train Loss) vs 独立测试损失 (Test Loss)",
        xMin: state.lossHist[0]?.ep || 0,
        xMax: maxEp,
        series: [
          { label: "训练损失", pts: trPts, color: "#38bdf8", width: 2.2 },
          { label: "测试泛化损失", pts: vaPts, color: "#f59e0b", width: 2.0, dashed: true }
        ]
      });
    },
    getMetrics(state) {
      const tr = mlpEvalLossAcc(state.net, state.data.train);
      const va = mlpEvalLossAcc(state.net, state.data.val);
      return [
        { label: "当前训练迭代轮数", value: `${state.epoch} Epochs` },
        { label: "训练集分类准确率", value: `${tr.acc.toFixed(1)}%` },
        { label: "测试集泛化准确率", value: `${va.acc.toFixed(1)}%` },
        { label: "模型拟合诊断", value: va.loss > tr.loss * 1.45 ? "⚠️ 出现过拟合趋势" : tr.acc < 68 ? "学习收敛中..." : "✅ 泛化边界良好" }
      ];
    }
  });

  /* -----------------------------------------------------------------------
     3.3 典型网络家族 3D 机理演示：RBF 光谱拟合 / Hopfield 能量吸引子 / SOM 自组织网
     ----------------------------------------------------------------------- */
  window.IIP.cases.push({
    id: "ch3-case3",
    chapterId: "ch3",
    title: "3.3 代表性网络 3D 机理：RBF 径向基拟合 / Hopfield 能量面 / SOM 竞争网",
    tag: "教材2.4–2.6 典型网络全覆盖",
    bounds: { xMin: -4, xMax: 4, yMin: -4, yMax: 4, zMin: -3, zMax: 5, xLabel: "状态/特征 s₁", yLabel: "状态/特征 s₂", zLabel: "能量 E / 响应输出" },
    legend: [
      { color: "#38bdf8", label: "3D 网络响应曲面 / Hopfield 能量面" },
      { color: "#facc15", label: "吸引子 / 径向基中心 / SOM 神经元节点" }
    ],
    guideHtml: `
      <strong>实验目标：</strong>全面覆盖大纲了解目标与教材 2.4–2.6 节三大典型网络：<br>
      ① <strong>Hopfield 反馈网络（2.4）</strong>：含噪初始状态球沿 3D Lyapunov 能量曲面滑向记忆吸引子极小点；<br>
      ② <strong>RBF 径向基网络（2.5）</strong>：多个局部高斯核叠加拟合双峰拉曼光谱表面；<br>
      ③ <strong>SOM 自组织特征映射（2.6）</strong>：二维弹性神经元网格无监督竞争保持光电点云拓扑结构。
    `,
    controls: [
      {
        key: "netFamily", label: "切换代表性神经网络类型（教材2.4–2.6）", type: "select", default: "hopfield",
        options: [
          { value: "hopfield", label: "2.4 Hopfield 反馈网络：双吸引子 3D 能量演化" },
          { value: "rbf", label: "2.5 RBF 径向基网络：局部高斯核叠加实验拟合" },
          { value: "som", label: "2.6 SOM 自组织竞争网络：3D 拓扑特征映射网格" }
        ]
      },
      { key: "spreadParam", label: "网络核心参数（温度增益 / RBF核宽σ / SOM邻域半径）", type: "range", min: 0.4, max: 2.4, step: 0.1, default: 1.2 },
      { key: "initAngle", label: "含噪测试状态初始方位角", type: "range", min: 0, max: 6.28, step: 0.2, default: 2.1 }
    ],
    init(state) { state.phase = 0; },
    step(state, dt) { state.phase = ((state.phase || 0) + dt * 0.65) % 1; },
    render3D(engine, state) {
      if (state.netFamily === "hopfield") {
        // Hopfield continuous energy surface with two memory attractors at (2,2) and (-2,-2)
        const energyFn = (x, y) => {
          const g = state.spreadParam;
          return -2.8 * Math.exp(-0.35 * g * ((x - 2) ** 2 + (y - 2) ** 2))
                 - 2.8 * Math.exp(-0.35 * g * ((x + 2) ** 2 + (y + 2) ** 2))
                 + 0.16 * (x * x + y * y);
        };
        engine.addSurface({ fn: energyFn, nx: 26, ny: 26, palette: "viridis", alpha: 0.86, zMin: -3, zMax: 5, pickable: true });

        // Animate noisy initial state rolling into nearest attractor
        const sx0 = 3.2 * Math.cos(state.initAngle);
        const sy0 = 3.2 * Math.sin(state.initAngle);
        const target = sx0 + sy0 >= 0 ? [2, 2] : [-2, -2];
        const t = state.phase;
        const cx = sx0 + (target[0] - sx0) * (1 - Math.pow(1 - t, 2.5));
        const cy = sy0 + (target[1] - sy0) * (1 - Math.pow(1 - t, 2.5));

        const trail = [];
        for (let k = 0; k <= 16; k++) {
          const u = (k / 16) * t;
          const tx = sx0 + (target[0] - sx0) * (1 - Math.pow(1 - u, 2.5));
          const ty = sy0 + (target[1] - sy0) * (1 - Math.pow(1 - u, 2.5));
          trail.push([tx, ty, energyFn(tx, ty) + 0.12]);
        }
        engine.addPolyline({ points: trail, color: "#facc15", width: 2.6, glow: true });
        engine.addSphere({ x: 2, y: 2, z: energyFn(2, 2), radius: 0.28, color: "#10b981", label: "记忆吸引子 A (+1,+1)" });
        engine.addSphere({ x: -2, y: -2, z: energyFn(-2, -2), radius: 0.28, color: "#10b981", label: "记忆吸引子 B (-1,-1)" });
        engine.addSphere({ x: cx, y: cy, z: energyFn(cx, cy) + 0.18, radius: 0.32, color: "#facc15", glow: true, label: "状态演化 s(t)" });
      } else if (state.netFamily === "rbf") {
        const centers = [[-1.8, -1.2, 3.8], [1.6, 1.5, 4.4], [1.8, -1.8, 2.6]];
        const sig = state.spreadParam;
        const rbfFn = (x, y) => {
          let sum = -1.5;
          centers.forEach(([cx, cy, w]) => {
            sum += w * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * sig * sig));
          });
          return clamp(sum, -2.5, 4.8);
        };
        engine.addSurface({ fn: rbfFn, nx: 28, ny: 28, palette: "turbo", alpha: 0.88, zMin: -3, zMax: 5, pickable: true });
        centers.forEach(([cx, cy, w], i) => {
          engine.addSphere({ x: cx, y: cy, z: rbfFn(cx, cy), radius: 0.3, color: "#facc15", glow: true, label: `RBF核 c_${i + 1}` });
        });
      } else {
        // SOM 4x4 topological grid adapting onto a 3D saddle manifold
        const adapt = clamp(state.spreadParam / 2.4, 0.2, 1.0);
        const grid = [];
        for (let i = 0; i < 5; i++) {
          const row = [];
          for (let j = 0; j < 5; j++) {
            const u = (i / 4 - 0.5) * 6.2;
            const v = (j / 4 - 0.5) * 6.2;
            const zManifold = adapt * (1.8 * Math.sin(u * 0.65) * Math.cos(v * 0.65) + 1.2);
            row.push([u, v, zManifold]);
          }
          grid.push(row);
        }
        for (let i = 0; i < 5; i++) {
          for (let j = 0; j < 5; j++) {
            if (i < 4) engine.addLine({ from: grid[i][j], to: grid[i + 1][j], color: "#38bdf8", width: 2.0 });
            if (j < 4) engine.addLine({ from: grid[i][j], to: grid[i][j + 1], color: "#818cf8", width: 2.0 });
            const isBMU = i === 2 && j === 2;
            engine.addSphere({
              x: grid[i][j][0], y: grid[i][j][1], z: grid[i][j][2],
              radius: isBMU ? 0.32 : 0.2,
              color: isBMU ? "#facc15" : "#38bdf8",
              glow: isBMU,
              label: isBMU ? "获胜神经元 BMU" : null
            });
          }
        }
      }
    },
    render2D(canvas, state) {
      const pts = [];
      for (let i = 0; i <= 40; i++) {
        const x = -4 + (8 * i) / 40;
        if (state.netFamily === "hopfield") {
          pts.push([x, -2.8 * Math.exp(-0.35 * state.spreadParam * (x - 2) ** 2) - 2.8 * Math.exp(-0.35 * state.spreadParam * (x + 2) ** 2) + 0.16 * x * x]);
        } else if (state.netFamily === "rbf") {
          pts.push([x, 3.8 * Math.exp(-((x + 1.8) ** 2) / (2 * state.spreadParam ** 2)) + 4.4 * Math.exp(-((x - 1.6) ** 2) / (2 * state.spreadParam ** 2))]);
        } else {
          pts.push([x, Math.exp(-(x * x) / (2 * state.spreadParam ** 2))]);
        }
      }
      const titles = {
        hopfield: "Hopfield 对角截面能量函数 E(s)（双势阱记忆谷底）",
        rbf: "RBF 高斯径向基局部响应叠加截面（核宽 σ=" + state.spreadParam.toFixed(1) + "）",
        som: "SOM 获胜神经元优胜邻域函数 h(d) = exp(-d²/2σ²)"
      };
      drawLineChart(canvas, { title: titles[state.netFamily], xMin: -4, xMax: 4, series: [{ label: "响应曲线", pts, color: "#38bdf8", width: 2.4 }] });
    },
    getMetrics(state) {
      const map = {
        hopfield: ["反馈联想记忆网络", "能量函数单调下降", "2 个稳定记忆极小点", "图像去噪/组合优化"],
        rbf: ["局部逼近前馈网络", "高斯径向基核叠加", `核宽 σ = ${state.spreadParam.toFixed(1)}`, "光谱峰与实验数据拟合"],
        som: ["无监督自组织竞争网", "胜者为王+邻域协同", `邻域尺度 = ${state.spreadParam.toFixed(1)}`, "高维传感特征聚类降维"]
      }[state.netFamily];
      return [
        { label: "网络结构类别", value: map[0] },
        { label: "核心数学机制", value: map[1] },
        { label: "当前关键参数", value: map[2] },
        { label: "典型专业应用", value: map[3] }
      ];
    }
  });

  /* =======================================================================
     第四章：进化计算（对应教材第3章）
     4.1 【代表性演算】一轮二进制遗传算法演示（选择→交叉→变异与 3D 适应度映射）
     ======================================================================= */
  function decode8BitPair(bits8) {
    // First 4 bits -> x1 in [-4, 4], Last 4 bits -> x2 in [-4, 4]
    const b1 = parseInt(bits8.slice(0, 4), 2);
    const b2 = parseInt(bits8.slice(4, 8), 2);
    const x1 = -4 + (b1 / 15) * 8;
    const x2 = -4 + (b2 / 15) * 8;
    // Fitness peak near (2.4, 2.4): F = 10 * exp(-0.18*((x1-2.4)^2 + (x2-2.4)^2)) + 1.2
    const fit = 10 * Math.exp(-0.14 * ((x1 - 2.1) ** 2 + (x2 - 2.1) ** 2)) + 0.8;
    return { x1, x2, fit };
  }

  window.IIP.cases.push({
    id: "ch4-case1",
    chapterId: "ch4",
    title: "4.1 【代表性演算】二进制遗传算法一轮操作演示（选择→交叉→变异 3D 映射）",
    tag: "大纲必做演算 · 教材3.2–3.3",
    bounds: { xMin: -4, xMax: 4, yMin: -4, yMax: 4, zMin: 0, zMax: 11, xLabel: "解码参数 x₁", yLabel: "解码参数 x₂", zLabel: "个体适应度 F(x)" },
    legend: [
      { color: "#94a3b8", label: "上一代父本位置" },
      { color: "#facc15", label: "当前种群 6 个二进制编码个体" },
      { color: "#10b981", label: "当代最高适应度精英个体" }
    ],
    guideHtml: `
      <strong>实验目标：</strong>将 8 位二进制染色体串（前4位编码 <code>x₁</code>，后4位编码 <code>x₂</code>）映射为 3D 适应度山峰上的具象个体！<br>
      依次点击<strong>“① 轮盘赌选择”、“② 单点交叉”、“③ 基本位变异”</strong>按钮，逐步观察少量个体如何在一轮遗传操作中向山顶全局最优攀登！
    `,
    controls: [
      { key: "cutBit", label: "单点交叉切分基因位 k ∈ [1, 7]", type: "range", min: 1, max: 7, step: 1, default: 4 },
      { key: "mutProb", label: "每位基因变异概率 P_m", type: "range", min: 0.02, max: 0.25, step: 0.02, default: 0.08 }
    ],
    actions: [
      {
        label: "① 执行轮盘赌选择",
        onClick(state) {
          state.prevPop = state.pop.slice();
          const decoded = state.pop.map(decode8BitPair);
          const sumF = decoded.reduce((s, d) => s + d.fit, 0);
          // Keep elite #0 + 5 roulette draws
          let bestIdx = 0;
          decoded.forEach((d, i) => { if (d.fit > decoded[bestIdx].fit) bestIdx = i; });
          const next = [state.pop[bestIdx]];
          while (next.length < 6) {
            let r = Math.random() * sumF;
            let pick = 0;
            for (let i = 0; i < 6; i++) {
              r -= decoded[i].fit;
              if (r <= 0) { pick = i; break; }
            }
            next.push(state.pop[pick]);
          }
          state.pop = next;
          state.stageName = "已完成：轮盘赌选择（劣解淘汰，优解复制）";
        }
      },
      {
        label: "② 执行配对单点交叉",
        onClick(state) {
          state.prevPop = state.pop.slice();
          const k = Math.round(state.cutBit);
          const next = [state.pop[0]]; // keep elite
          for (let i = 1; i < 5; i += 2) {
            const a = state.pop[i], b = state.pop[i + 1];
            next.push(a.slice(0, k) + b.slice(k));
            next.push(b.slice(0, k) + a.slice(k));
          }
          next.push(state.pop[5].slice(0, k) + state.pop[0].slice(k));
          state.pop = next.slice(0, 6);
          state.stageName = `已完成：第 ${k} 位单点交叉重组`;
        }
      },
      {
        label: "③ 执行位变异并进入下一代",
        primary: true,
        onClick(state) {
          state.prevPop = state.pop.slice();
          const next = [state.pop[0]]; // elite immune
          for (let i = 1; i < 6; i++) {
            let s = "";
            for (let b = 0; b < 8; b++) {
              const ch = state.pop[i][b];
              s += Math.random() < state.mutProb ? (ch === "0" ? "1" : "0") : ch;
            }
            next.push(s);
          }
          state.pop = next;
          state.gen += 1;
          state.stageName = `第 ${state.gen} 代：完成位变异更新`;
        }
      },
      {
        label: "↺ 重置初始 6 个体",
        onClick(state) { state.resetPop(state); }
      }
    ],
    init(state) {
      state.resetPop = (st) => {
        st.pop = ["00100011", "01011001", "10110100", "00111010", "01100101", "10010010"];
        st.prevPop = st.pop.slice();
        st.gen = 1;
        st.stageName = "初始种群（等待选择→交叉→变异）";
      };
      state.resetPop(state);
    },
    render3D(engine, state) {
      engine.addSurface({
        fn: (x, y) => 10 * Math.exp(-0.14 * ((x - 2.1) ** 2 + (y - 2.1) ** 2)) + 0.8,
        nx: 24, ny: 24,
        palette: "viridis",
        alpha: 0.84,
        zMin: 0, zMax: 11,
        pickable: true
      });

      const curDec = state.pop.map(decode8BitPair);
      const prevDec = (state.prevPop || state.pop).map(decode8BitPair);
      let bestIdx = 0;
      curDec.forEach((d, i) => { if (d.fit > curDec[bestIdx].fit) bestIdx = i; });

      curDec.forEach((d, i) => {
        const pv = prevDec[i];
        if (pv && (Math.abs(pv.x1 - d.x1) > 0.05 || Math.abs(pv.x2 - d.x2) > 0.05)) {
          engine.addArrow({
            from: [pv.x1, pv.x2, pv.fit + 0.25],
            to: [d.x1, d.x2, d.fit + 0.25],
            color: "#facc15",
            width: 2.0,
            dashed: true
          });
        }
        const isBest = i === bestIdx;
        engine.addSphere({
          x: d.x1, y: d.x2, z: d.fit + 0.25,
          radius: isBest ? 0.36 : 0.26,
          color: isBest ? "#10b981" : "#facc15",
          glow: true,
          label: `${state.pop[i]}`,
          info: `个体#${i + 1} 染色体=${state.pop[i]} → (${d.x1.toFixed(2)}, ${d.x2.toFixed(2)}) 适应度=${d.fit.toFixed(2)}`
        });
      });
    },
    render2D(canvas, state) {
      const items = state.pop.map((bits, idx) => {
        const d = decode8BitPair(bits);
        return {
          label: `#${idx + 1}:${bits.slice(0, 4)}`,
          value: d.fit,
          color: idx === 0 ? "#10b981" : "#38bdf8"
        };
      });
      drawBarChart(canvas, {
        title: `${state.stageName} — 各染色体适应度分布`,
        yMax: 11,
        items
      });
    },
    getMetrics(state) {
      const dec = state.pop.map(decode8BitPair);
      const maxF = Math.max(...dec.map((d) => d.fit));
      const avgF = dec.reduce((s, d) => s + d.fit, 0) / dec.length;
      const bestIdx = dec.findIndex((d) => d.fit === maxF);
      return [
        { label: "当前演化阶段", value: `第 ${state.gen} 代` },
        { label: "当代最优染色体", value: state.pop[bestIdx] },
        { label: "种群最高适应度 F_max", value: maxF.toFixed(3) },
        { label: "种群平均适应度 F_avg", value: avgF.toFixed(3) }
      ];
    }
  });

  /* -----------------------------------------------------------------------
     4.2 【专业实践】光学谐振腔实验参数寻优 3D 适应度地形进化实验（含欺骗问题）
     ----------------------------------------------------------------------- */
  window.IIP.cases.push({
    id: "ch4-case2",
    chapterId: "ch4",
    title: "4.2 【专业实践】光学谐振腔实验参数寻优与遗传欺骗地形 3D 演化",
    tag: "大纲学习实践 · 教材例3-4 & p.77",
    bounds: { xMin: -4.5, xMax: 4.5, yMin: -4.5, yMax: 4.5, zMin: 0, zMax: 11, xLabel: "腔镜微调量 d (μm)", yLabel: "倾角偏置 θ (mrad)", zLabel: "耦合效率适应度 F" },
    legend: [
      { color: "#facc15", label: "当代候选解种群个体" },
      { color: "#10b981", label: "历史最优实验参数组合" }
    ],
    guideHtml: `
      <strong>实验目标：</strong>调节<strong>种群规模 <code>N</code>、交叉率 <code>P_c</code> 与变异率 <code>P_m</code></strong>，观察群体在三维多峰光学实验参数空间的寻优效率与多样性演化！<br>
      可切换至<strong>教材 p.77“遗传算法欺骗问题（Deceptive Trap）”</strong>地形：观察当种群太小或变异率过低时，群体如何被左下方宽阔平坦的次优峰“欺骗”而错失右上方狭窄尖锐的全局最高峰！
    `,
    controls: [
      {
        key: "landscape", label: "选择三维实验参数适应度地形", type: "select", default: "opticalCavity",
        options: [
          { value: "opticalCavity", label: "激光谐振腔多模干涉耦合效率 F(d, θ)" },
          { value: "sincPeak", label: "教材例3-4 推广：二维 |sin(r)/r| 衍射主峰寻优" },
          { value: "deceptiveTrap", label: "教材p.77 遗传欺骗函数（宽次优陷阱 vs 窄全局尖峰）" }
        ]
      },
      { key: "popSize", label: "种群规模 N", type: "range", min: 8, max: 60, step: 4, default: 24 },
      { key: "pc", label: "算术/BLX交叉概率 P_c", type: "range", min: 0.1, max: 1.0, step: 0.05, default: 0.80 },
      { key: "pm", label: "高斯变异率 P_m", type: "range", min: 0.0, max: 0.50, step: 0.02, default: 0.10 }
    ],
    actions: [
      { label: "▶ 运行 / 暂停进化迭代", primary: true, onClick(state) { state.running = !state.running; } },
      { label: "↺ 重新随机撒播初始种群", onClick(state) { state.resetGA(state); } }
    ],
    init(state) {
      state.resetGA = (st) => {
        const fn = benchmarks[st.landscape] || benchmarks.opticalCavity;
        const N = Math.round(st.popSize);
        st.pop = Array.from({ length: N }, () => {
          const x = (Math.random() - 0.5) * 8.6;
          const y = (Math.random() - 0.5) * 8.6;
          return { x, y, f: fn(x, y) };
        });
        st.gen = 0;
        st.running = true;
        st.hist = [];
        st._cfg = `${st.landscape}_${st.popSize}`;
      };
      state.resetGA(state);
    },
    step(state, dt) {
      const cfg = `${state.landscape}_${state.popSize}`;
      if (cfg !== state._cfg) state.resetGA(state);
      if (!state.running || state.gen >= 120) return;

      state._acc = (state._acc || 0) + dt;
      if (state._acc < 0.14) return;
      state._acc = 0;

      const fn = benchmarks[state.landscape] || benchmarks.opticalCavity;
      const pop = state.pop.slice().sort((a, b) => b.f - a.f);
      const N = pop.length;
      const next = [{ ...pop[0] }, { ...pop[1] }]; // Elitism top 2

      const sumF = pop.reduce((s, p) => s + Math.max(0.01, p.f), 0);
      const pickParent = () => {
        let r = Math.random() * sumF;
        for (let i = 0; i < N; i++) {
          r -= Math.max(0.01, pop[i].f);
          if (r <= 0) return pop[i];
        }
        return pop[0];
      };

      while (next.length < N) {
        const p1 = pickParent();
        const p2 = pickParent();
        let cx = p1.x, cy = p1.y;
        if (Math.random() < state.pc) {
          const alpha = Math.random() * 1.2 - 0.1; // BLX-0.1 crossover
          cx = p1.x + alpha * (p2.x - p1.x);
          cy = p1.y + alpha * (p2.y - p1.y);
        }
        if (Math.random() < state.pm) {
          cx += (Math.random() - 0.5) * 2.4;
          cy += (Math.random() - 0.5) * 2.4;
        }
        cx = clamp(cx, -4.4, 4.4);
        cy = clamp(cy, -4.4, 4.4);
        next.push({ x: cx, y: cy, f: fn(cx, cy) });
      }
      state.pop = next;
      state.gen += 1;

      const bestF = Math.max(...next.map((p) => p.f));
      const avgF = next.reduce((s, p) => s + p.f, 0) / N;
      state.hist.push({ gen: state.gen, best: bestF, avg: avgF });
    },
    render3D(engine, state) {
      const fn = benchmarks[state.landscape] || benchmarks.opticalCavity;
      engine.addSurface({ fn, nx: 28, ny: 28, palette: "turbo", alpha: 0.85, zMin: 0, zMax: 11, contourFloor: true, pickable: true });

      let best = state.pop[0];
      state.pop.forEach((p) => { if (p.f > best.f) best = p; });

      state.pop.forEach((p) => {
        const isBest = p === best;
        engine.addSphere({
          x: p.x, y: p.y, z: p.f + 0.22,
          radius: isBest ? 0.34 : 0.19,
          color: isBest ? "#10b981" : "#facc15",
          glow: isBest,
          label: isBest ? `最优 F=${p.f.toFixed(2)}` : null
        });
      });
    },
    render2D(canvas, state) {
      drawLineChart(canvas, {
        title: "种群进化收敛曲线：当代最高适应度 vs 平均适应度",
        xMin: 0, xMax: Math.max(20, state.gen), yMin: 0, yMax: 11,
        series: [
          { label: "最高 F_max", pts: state.hist.map((h) => [h.gen, h.best]), color: "#10b981", width: 2.3 },
          { label: "平均 F_avg", pts: state.hist.map((h) => [h.gen, h.avg]), color: "#38bdf8", dashed: true }
        ]
      });
    },
    getMetrics(state) {
      const N = state.pop.length;
      const best = state.pop.reduce((a, b) => (b.f > a.f ? b : a), state.pop[0]);
      const mx = state.pop.reduce((s, p) => s + p.x, 0) / N;
      const my = state.pop.reduce((s, p) => s + p.y, 0) / N;
      const div = Math.sqrt(state.pop.reduce((s, p) => s + (p.x - mx) ** 2 + (p.y - my) ** 2, 0) / N);
      return [
        { label: "进化代数 Generation", value: `${state.gen} / 120` },
        { label: "最优参数 (d*, θ*)", value: `(${best.x.toFixed(2)}, ${best.y.toFixed(2)})` },
        { label: "最高耦合适应度 F*", value: best.f.toFixed(3) },
        { label: "种群空间多样性指数", value: div.toFixed(2) }
      ];
    }
  });

  /* -----------------------------------------------------------------------
     4.3 激光加工晶圆微孔扫描 TSP 路径进化寻优（教材3.4 节 TSP 遗传算法设计）
     ----------------------------------------------------------------------- */
  function buildLaserPoints(n) {
    const rng = mulberry32(2026);
    const pts = [];
    for (let i = 0; i < n; i++) {
      const ang = (2 * Math.PI * i) / n + (rng() - 0.5) * 0.45;
      const rad = 2.0 + rng() * 2.1;
      const x = rad * Math.cos(ang);
      const y = rad * Math.sin(ang);
      const z = 0.6 + 1.4 * Math.sin(x * 0.6) * Math.cos(y * 0.6) + 1.2;
      pts.push({ id: i, x, y, z });
    }
    return pts;
  }

  function tourLength(tour, pts) {
    let len = 0;
    for (let i = 0; i < tour.length; i++) {
      const a = pts[tour[i]];
      const b = pts[tour[(i + 1) % tour.length]];
      len += Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    }
    return len;
  }

  function orderCrossover(p1, p2) {
    const n = p1.length;
    let a = Math.floor(Math.random() * n);
    let b = Math.floor(Math.random() * n);
    if (a > b) [a, b] = [b, a];
    const child = Array(n).fill(-1);
    const used = new Set();
    for (let i = a; i <= b; i++) {
      child[i] = p1[i];
      used.add(p1[i]);
    }
    let idx = (b + 1) % n;
    for (let k = 0; k < n; k++) {
      const cand = p2[(b + 1 + k) % n];
      if (!used.has(cand)) {
        child[idx] = cand;
        idx = (idx + 1) % n;
      }
    }
    return child;
  }

  window.IIP.cases.push({
    id: "ch4-case3",
    chapterId: "ch4",
    title: "4.3 激光微加工三维扫描路径 TSP 遗传寻优（教材3.4 排列编码与顺序交叉）",
    tag: "教材3.4 TSP应用 · 光学制造",
    bounds: { xMin: -4.5, xMax: 4.5, yMin: -4.5, yMax: 4.5, zMin: 0, zMax: 4.5, xLabel: "工作台 X (mm)", yLabel: "工作台 Y (mm)", zLabel: "曲面焦深 Z (mm)" },
    legend: [
      { color: "#38bdf8", label: "曲面晶圆待加工微孔靶点" },
      { color: "#10b981", label: "当前最优激光振镜扫描闭合回路" }
    ],
    guideHtml: `
      <strong>实验目标：</strong>对应教材 3.4 节<strong>旅行商问题（TSP）的遗传算法设计</strong>。针对三维曲面晶圆上的 <code>M</code> 个激光打孔工位，采用<strong>序号排列编码 + 顺序交叉（OX）+ 逆转变异</strong>极小化振镜空程移动总路径长度！
    `,
    controls: [
      { key: "nCities", label: "待激光加工微孔工位数 M", type: "range", min: 8, max: 18, step: 2, default: 12 },
      { key: "invMut", label: "路径片段逆转变异率 P_m", type: "range", min: 0.05, max: 0.50, step: 0.05, default: 0.25 }
    ],
    actions: [
      { label: "▶ 运行 / 暂停路径进化", primary: true, onClick(state) { state.running = !state.running; } },
      { label: "↺ 随机打乱初始扫描顺序", onClick(state) { state.resetTsp(state); } }
    ],
    init(state) {
      state.resetTsp = (st) => {
        const M = Math.round(st.nCities);
        st.pts = buildLaserPoints(M);
        const base = Array.from({ length: M }, (_, i) => i);
        st.pop = Array.from({ length: 32 }, () => {
          const arr = base.slice();
          for (let i = M - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
          }
          return arr;
        });
        st.initLen = tourLength(st.pop[0], st.pts);
        st.bestTour = st.pop[0].slice();
        st.bestLen = st.initLen;
        st.gen = 0;
        st.running = true;
        st.hist = [{ gen: 0, len: st.bestLen }];
        st._m = M;
      };
      state.resetTsp(state);
    },
    step(state, dt) {
      if (Math.round(state.nCities) !== state._m) state.resetTsp(state);
      if (!state.running || state.gen >= 180) return;
      state._acc = (state._acc || 0) + dt;
      if (state._acc < 0.08) return;
      state._acc = 0;

      const scored = state.pop.map((t) => ({ t, len: tourLength(t, state.pts) })).sort((a, b) => a.len - b.len);
      if (scored[0].len < state.bestLen) {
        state.bestLen = scored[0].len;
        state.bestTour = scored[0].t.slice();
      }
      const next = [state.bestTour.slice(), scored[1].t.slice()];
      while (next.length < 32) {
        const p1 = scored[Math.floor(Math.random() * 12)].t;
        const p2 = scored[Math.floor(Math.random() * 12)].t;
        const child = orderCrossover(p1, p2);
        if (Math.random() < state.invMut) {
          let i = Math.floor(Math.random() * child.length);
          let j = Math.floor(Math.random() * child.length);
          if (i > j) [i, j] = [j, i];
          while (i < j) { [child[i], child[j]] = [child[j], child[i]]; i++; j--; }
        }
        next.push(child);
      }
      state.pop = next;
      state.gen += 1;
      state.hist.push({ gen: state.gen, len: state.bestLen });
    },
    render3D(engine, state) {
      engine.addSurface({
        fn: (x, y) => 0.6 + 1.4 * Math.sin(x * 0.6) * Math.cos(y * 0.6) + 1.2,
        nx: 20, ny: 20,
        palette: "viridis",
        alpha: 0.42,
        zMin: 0, zMax: 4.5
      });

      const tour = state.bestTour;
      const poly = tour.map((idx) => [state.pts[idx].x, state.pts[idx].y, state.pts[idx].z + 0.12]);
      poly.push(poly[0]);
      engine.addPolyline({ points: poly, color: "#10b981", width: 2.8, glow: true });

      state.pts.forEach((p, idx) => {
        engine.addSphere({
          x: p.x, y: p.y, z: p.z + 0.12,
          radius: idx === tour[0] ? 0.30 : 0.22,
          color: idx === tour[0] ? "#facc15" : "#38bdf8",
          glow: idx === tour[0],
          label: `#${idx + 1}`
        });
      });
    },
    render2D(canvas, state) {
      drawLineChart(canvas, {
        title: "激光振镜扫描总行程长度收敛曲线 L(mm)",
        xMin: 0, xMax: Math.max(30, state.gen),
        series: [{ label: "最短回路行程", pts: state.hist.map((h) => [h.gen, h.len]), color: "#10b981", width: 2.3 }]
      });
    },
    getMetrics(state) {
      const saved = ((1 - state.bestLen / (state.initLen || state.bestLen)) * 100).toFixed(1);
      return [
        { label: "进化迭代代数", value: `${state.gen} 代` },
        { label: "初始随机路径长度", value: `${state.initLen.toFixed(2)} mm` },
        { label: "进化优化后最短行程", value: `${state.bestLen.toFixed(2)} mm` },
        { label: "振镜空程缩短率", value: `${saved}%` }
      ];
    }
  });
})();
