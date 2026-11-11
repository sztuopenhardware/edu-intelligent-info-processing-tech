/* ==========================================================================
   第1章（绪论）与 第2章（模糊计算）交互式 3D 仿真实验案例集
   包含 6 个完整交互式 3D 实验案例（按章节归属下拉菜单）
   ========================================================================== */
window.IIP = window.IIP || {};
window.IIP.cases = window.IIP.cases || [];

(function () {
  const { clamp, colormap, mfTri, mfTrap, mfGauss, applyHedge, fuzzyCompose, fuzzyTransitiveClosure } = window.IIP.math;
  const { drawLineChart, drawBarChart } = window.IIP.charts;

  /* -----------------------------------------------------------------------
     1.1 计算智能三维技术谱系立方体与综合集成拓扑（教材1.1–1.3）
     X: 不确定语言表达能力 (Fuzzy)
     Y: 样本自适应学习能力 (Neural)
     Z: 全局无梯度寻优能力 (Evolutionary)
     ----------------------------------------------------------------------- */
  const ciNodes = [
    { id: "fuzzy", name: "Mamdani模糊推理", x: 9.0, y: 2.0, z: 2.2, color: "#38bdf8", cat: "模糊计算", io: "精确测量值 → 规则推理 → 控制量" },
    { id: "bp", name: "多层BP神经网络", x: 2.5, y: 9.2, z: 3.0, color: "#10b981", cat: "神经计算", io: "光电波形特征 → 权重映射 → 信号类别" },
    { id: "rbf", name: "RBF径向基网络", x: 3.6, y: 8.6, z: 3.4, color: "#34d399", cat: "神经计算", io: "实验采样点 → 高斯核叠加 → 拟合曲线" },
    { id: "hop", name: "Hopfield反馈网", x: 2.2, y: 7.4, z: 5.5, color: "#6ee7b7", cat: "神经计算", io: "残缺含噪图案 → 能量极小化 → 恢复图像" },
    { id: "ga", name: "遗传算法 (GA)", x: 2.0, y: 2.8, z: 9.3, color: "#f59e0b", cat: "进化计算", io: "参数编码种群 → 选择交叉变异 → 近似全局最优" },
    { id: "pso", name: "粒子群优化 (PSO)", x: 2.4, y: 4.2, z: 8.8, color: "#fbbf24", cat: "群智能优化", io: "连续候选粒子 → pbest/gbest协同 → 最优光学参数" },
    { id: "aco", name: "蚁群算法 (ACO)", x: 3.0, y: 4.8, z: 8.3, color: "#f97316", cat: "群智能优化", io: "节点距离矩阵 → 信息素正反馈 → 最短路径" },
    { id: "kalman", name: "卡尔曼滤波融合", x: 6.2, y: 6.0, z: 3.2, color: "#c084fc", cat: "数据融合", io: "多传感器含噪观测 → 预测-增益校正 → 动态状态估计" },
    { id: "fnn", name: "模糊神经网络 (FNN)", x: 8.4, y: 8.5, z: 3.8, color: "#818cf8", cat: "综合集成(1.3.1)", io: "样本+专家规则 → 自适应学习隶属函数 → 智能控制" },
    { id: "gann", name: "遗传神经网络 (GANN)", x: 3.0, y: 8.6, z: 8.7, color: "#f43f5e", cat: "综合集成(1.3.2)", io: "网络权值编码 → GA全局寻优+BP精调 → 高泛化模型" },
    { id: "fnga", name: "模糊-神经-遗传三元集成", x: 8.6, y: 8.7, z: 8.9, color: "#ffffff", cat: "综合集成(1.3.3)", io: "多源感知数据 → 结构寻优+权值自学习+语言解释 → 完备软计算系统" }
  ];

  window.IIP.cases.push({
    id: "ch1-case1",
    chapterId: "ch1",
    title: "1.1 计算智能三维技术谱系与软计算综合集成空间（教材1.1–1.3）",
    tag: "绪论全景 · 教材1.3综合集成",
    bounds: { xMin: 0, xMax: 10, yMin: 0, yMax: 10, zMin: 0, zMax: 10, xLabel: "模糊表达力 FC", yLabel: "自学习力 NC", zLabel: "全局寻优力 EC" },
    legend: [
      { color: "#38bdf8", label: "模糊计算" },
      { color: "#10b981", label: "神经计算" },
      { color: "#f59e0b", label: "进化/群智能" },
      { color: "#f43f5e", label: "软计算综合集成" }
    ],
    guideHtml: `
      <strong>实验目标：</strong>在“不确定性语言表达（X）— 样本自学习（Y）— 全局随机寻优（Z）”构成的三维软计算立方体中，观察本课程六大章节核心算法的位置关系及<strong>教材1.3节“模糊-神经-遗传综合集成”</strong>的协同路径。<br>
      <div class="formula-box">综合集成思想：FNN (模糊+神经) ∪ GANN (遗传+神经) ──▶ 互补克服单一方法局限</div>
      切换下方<strong>“工程需求权重偏好”</strong>滑块，系统将自动计算并高亮最契合当前物理/光电任务的推荐算法！
    `,
    controls: [
      { key: "wFuzzy", label: "任务需求：专家语言规则可解释性", type: "range", min: 0, max: 10, step: 0.5, default: 8.0 },
      { key: "wNeural", label: "任务需求：历史样本非线性映射学习", type: "range", min: 0, max: 10, step: 0.5, default: 8.0 },
      { key: "wEvo", label: "任务需求：无梯度多峰全局参数寻优", type: "range", min: 0, max: 10, step: 0.5, default: 3.5 },
      { key: "showLinks", label: "显示综合集成演化连线", type: "select", default: "1", options: [{ value: "1", label: "显示协同连线（教材1.3）" }, { value: "0", label: "仅显示算法节点" }] }
    ],
    init(state) {
      state.bestNode = ciNodes[8];
    },
    render3D(engine, state, time) {
      const target = [state.wFuzzy, state.wNeural, state.wEvo];
      let best = ciNodes[0], bestDist = Infinity;
      ciNodes.forEach((n) => {
        const d = Math.hypot(n.x - target[0], n.y - target[1], n.z - target[2]);
        if (d < bestDist) { bestDist = d; best = n; }
      });
      state.bestNode = best;

      if (state.showLinks === "1") {
        const byId = Object.fromEntries(ciNodes.map((n) => [n.id, n]));
        const links = [
          ["fuzzy", "fnn", "#38bdf8"], ["bp", "fnn", "#10b981"],
          ["bp", "gann", "#10b981"], ["ga", "gann", "#f59e0b"],
          ["fnn", "fnga", "#818cf8"], ["gann", "fnga", "#f43f5e"],
          ["ga", "pso", "#fbbf24"], ["pso", "aco", "#f97316"]
        ];
        links.forEach(([a, b, col]) => {
          engine.addLine({
            from: [byId[a].x, byId[a].y, byId[a].z],
            to: [byId[b].x, byId[b].y, byId[b].z],
            color: col,
            width: 1.8,
            dashed: true
          });
        });
      }

      // User Demand Target Marker
      const pulse = 0.24 + 0.05 * Math.sin(time * 4);
      engine.addSphere({
        x: target[0], y: target[1], z: target[2],
        radius: pulse,
        color: "#facc15",
        glow: true,
        label: "当前工程需求点",
        info: `需求向量 (${target[0]}, ${target[1]}, ${target[2]}) → 最匹配: ${best.name}`
      });
      engine.addArrow({
        from: target,
        to: [best.x, best.y, best.z],
        color: "#facc15",
        width: 2.4,
        dashed: true,
        label: "推荐匹配"
      });

      ciNodes.forEach((n) => {
        const isBest = n.id === best.id;
        engine.addSphere({
          x: n.x, y: n.y, z: n.z,
          radius: isBest ? 0.42 : 0.27,
          color: n.color,
          glow: isBest,
          label: n.name,
          info: `[${n.cat}] ${n.name} | 范式: ${n.io}`
        });
      });
    },
    render2D(canvas, state) {
      const b = state.bestNode || ciNodes[0];
      drawBarChart(canvas, {
        title: `最匹配方法【${b.name}】三维能力画像 (0–10)`,
        yMax: 10,
        items: [
          { label: "模糊可解释", value: b.x, color: "#38bdf8" },
          { label: "样本学习力", value: b.y, color: "#10b981" },
          { label: "全局寻优力", value: b.z, color: "#f59e0b" },
          { label: "综合匹配度", value: clamp(10 - Math.hypot(b.x - state.wFuzzy, b.y - state.wNeural, b.z - state.wEvo) * 0.85, 1, 10), color: "#c084fc" }
        ]
      });
    },
    getMetrics(state) {
      const b = state.bestNode || ciNodes[0];
      return [
        { label: "智能推荐首选方法", value: b.name },
        { label: "所属技术分支", value: b.cat },
        { label: "输入→输出范式", value: b.io.split("→")[1].trim() },
        { label: "三维欧氏偏离度", value: Math.hypot(b.x - state.wFuzzy, b.y - state.wNeural, b.z - state.wEvo).toFixed(2) }
      ];
    }
  });

  /* -----------------------------------------------------------------------
     1.2 光电信号识别与物理实验数据分析全流程 3D 管线（输入→任务→输出识别）
     ----------------------------------------------------------------------- */
  window.IIP.cases.push({
    id: "ch1-case2",
    chapterId: "ch1",
    title: "1.2 光电信号识别与物理实验分析全流程 3D 管线（输入→任务→输出）",
    tag: "大纲专业案例 · I-T-O建模",
    bounds: { xMin: -5, xMax: 5, yMin: -4, yMax: 4, zMin: -1, zMax: 5, xLabel: "处理流水线阶段", yLabel: "通道/波长维", zLabel: "信号幅值 / 置信度" },
    legend: [
      { color: "#f43f5e", label: "阶段1：含噪原始输入 Input" },
      { color: "#38bdf8", label: "阶段2：特征提取与智能模型 Task" },
      { color: "#10b981", label: "阶段3：预期物理决策输出 Output" }
    ],
    guideHtml: `
      <strong>实验目标：</strong>落实大纲第1章掌握目标——识别专业应用案例中的<strong>输入信息（Input）、处理任务（Task）与预期输出（Output）</strong>。<br>
      3D 视口从左至右动态呈现：<strong>原始含噪传感器采样（X∈[-4.5,-1.8]） → 智能特征变换处理核（X∈[-1.2,1.5]） → 结构化物理输出（X∈[2.2,4.5]）</strong>。调节信噪比观察底层数据处理前后的差异！
    `,
    controls: [
      {
        key: "domainCase", label: "切换工程物理学院三大专业案例", type: "select", default: "opto",
        options: [
          { value: "opto", label: "光电信息：光纤布拉格光栅(FBG)双峰波长识别" },
          { value: "phys", label: "应用物理：阻尼谐振子含噪衰减曲线参数反演" },
          { value: "sens", label: "智能感知：温-湿-光三通道环境火情复合预警" }
        ]
      },
      { key: "noiseStd", label: "原始传感器噪声强度 σ", type: "range", min: 0.05, max: 0.85, step: 0.05, default: 0.30 },
      { key: "filterStrength", label: "智能模型特征提纯强度", type: "range", min: 0.2, max: 1.0, step: 0.05, default: 0.85 }
    ],
    init(state) { state.t = 0; },
    step(state, dt) { state.t = (state.t || 0) + dt; },
    render3D(engine, state, time) {
      const mode = state.domainCase;
      const noise = state.noiseStd;
      const clean = state.filterStrength;

      // Stage 1: Raw 3D multi-channel waveform at X in [-4.4, -1.8]
      for (let ch = -2; ch <= 2; ch++) {
        const pts = [];
        for (let i = 0; i <= 26; i++) {
          const u = i / 26;
          const x = -4.4 + u * 2.5;
          let sig = 0;
          if (mode === "opto") {
            sig = 2.8 * Math.exp(-((u - 0.35) ** 2) / 0.018) + 2.1 * Math.exp(-((u - 0.72) ** 2) / 0.02) * (1 - 0.15 * Math.abs(ch));
          } else if (mode === "phys") {
            sig = 2.6 * Math.exp(-2.2 * u) * Math.cos(12 * u + ch * 0.25) + 1.6;
          } else {
            sig = 1.4 + 1.5 * Math.sin(6 * u + ch * 0.7 + time * 1.4);
          }
          const pseudoNoise = noise * (Math.sin(i * 12.7 + ch * 5.3 + time * 3.0) + 0.5 * Math.cos(i * 23.1 - ch * 3.1));
          pts.push([x, ch * 1.35, clamp(sig + pseudoNoise, -0.8, 4.6)]);
        }
        engine.addPolyline({ points: pts, color: "#f43f5e", width: 1.7 });
      }
      engine.addLabel3D({ x: -3.2, y: 0, z: 4.5, text: "① 输入 Input：多通道含噪测量数据", color: "#fda4af" });

      // Stage 2: Intelligent Processing Core (3D Neural/Fusion Nodes around X = 0.1)
      const coreNodes = [
        [-0.8, -2.0, 1.2], [-0.8, 0, 2.2], [-0.8, 2.0, 1.2],
        [0.8, -1.2, 2.6], [0.8, 1.2, 2.6]
      ];
      coreNodes.forEach((p, idx) => {
        engine.addSphere({
          x: p[0], y: p[1], z: p[2] + 0.15 * Math.sin(time * 3 + idx),
          radius: 0.26,
          color: "#38bdf8",
          glow: true,
          info: `智能处理核节点 #${idx + 1}（特征降噪与模式提取）`
        });
      });
      for (let i = 0; i < 3; i++) {
        for (let j = 3; j < 5; j++) {
          engine.addLine({ from: coreNodes[i], to: coreNodes[j], color: "rgba(56, 189, 248, 0.65)", width: 1.8, glow: true });
        }
      }
      engine.addLabel3D({ x: 0.0, y: 0, z: 4.5, text: "② 处理任务 Task：特征识别 / 拟合 / 融合", color: "#7dd3fc" });

      // Stage 3: Clean Structured Output Bars at X = 3.4
      const confBase = clamp(0.98 - noise * (1 - clean) * 0.75, 0.42, 0.99);
      const outItems = mode === "opto"
        ? [{ y: -2.0, h: confBase * 4.0, lbl: "主峰 λ₁" }, { y: 0, h: (1 - confBase * 0.7) * 1.4, lbl: "杂散光" }, { y: 2.0, h: confBase * 3.3, lbl: "次峰 λ₂" }]
        : mode === "phys"
        ? [{ y: -2.0, h: confBase * 3.8, lbl: "阻尼比 ζ" }, { y: 0, h: confBase * 4.1, lbl: "固有频率 ω₀" }, { y: 2.0, h: confBase * 3.5, lbl: "拟合优度 R²" }]
        : [{ y: -2.0, h: 0.9, lbl: "正常态" }, { y: 0, h: 1.5, lbl: "温漂态" }, { y: 2.0, h: confBase * 4.2, lbl: "火情告警P" }];

      outItems.forEach((it, idx) => {
        engine.addBar3D({
          x: 3.4, y: it.y, dx: 0.85, dy: 0.9, z0: 0, z1: it.h,
          color: idx === 1 && mode === "opto" ? [148, 163, 184] : [16, 185, 129],
          topLabel: `${it.lbl}`,
          info: `输出项 [${it.lbl}] 强度/置信度 = ${(it.h / 4.2 * 100).toFixed(1)}%`
        });
        engine.addLine({ from: [0.8, idx === 0 ? -1.2 : 1.2, 2.6], to: [3.0, it.y, it.h * 0.6], color: "rgba(16, 185, 129, 0.5)", width: 1.5, dashed: true });
      });
      engine.addLabel3D({ x: 3.4, y: 0, z: 4.5, text: "③ 预期输出 Output：物理参数 / 类别置信度", color: "#6ee7b7" });
    },
    render2D(canvas, state) {
      const cleanCurve = [], noisyCurve = [];
      for (let i = 0; i <= 50; i++) {
        const u = i / 50;
        const yTrue = state.domainCase === "opto"
          ? Math.exp(-((u - 0.35) ** 2) / 0.012) + 0.78 * Math.exp(-((u - 0.72) ** 2) / 0.015)
          : state.domainCase === "phys"
          ? Math.exp(-2.2 * u) * Math.cos(14 * u)
          : 0.5 + 0.45 * Math.sin(8 * u);
        const n = state.noiseStd * 0.8 * Math.sin(i * 9.3);
        noisyCurve.push([u * 10, yTrue + n]);
        cleanCurve.push([u * 10, yTrue + n * (1 - state.filterStrength)]);
      }
      drawLineChart(canvas, {
        title: "传感器原始输入波形 vs 智能处理后重构信号",
        xMin: 0, xMax: 10,
        series: [
          { label: "含噪输入", pts: noisyCurve, color: "rgba(244, 63, 94, 0.65)", width: 1.4 },
          { label: "智能重构输出", pts: cleanCurve, color: "#10b981", width: 2.3 }
        ]
      });
    },
    getMetrics(state) {
      const snrIn = (10 * Math.log10(1 / (state.noiseStd ** 2))).toFixed(1);
      const effNoise = Math.max(0.03, state.noiseStd * (1 - state.filterStrength * 0.85));
      const snrOut = (10 * Math.log10(1 / (effNoise ** 2))).toFixed(1);
      const taskName = state.domainCase === "opto" ? "双峰波长识别分类" : state.domainCase === "phys" ? "非线性参数反演拟合" : "多源异构状态融合决策";
      return [
        { label: "核心处理任务 Task", value: taskName },
        { label: "输入信噪比 SNR_in", value: `${snrIn} dB` },
        { label: "处理后信噪比 SNR_out", value: `${snrOut} dB` },
        { label: "决策可靠度", value: `${clamp(99 - effNoise * 45, 55, 99.4).toFixed(1)}%` }
      ];
    }
  });

  /* -----------------------------------------------------------------------
     1.3 AI辅助分析结果核验与可靠性边界 3D 评估实验（大纲学习实践 · 学术诚信）
     ----------------------------------------------------------------------- */
  window.IIP.cases.push({
    id: "ch1-case3",
    chapterId: "ch1",
    title: "1.3 AI辅助分析结果核验与算法适用可靠性 3D 评估（学术诚信实践）",
    tag: "大纲核验AI解释 · CO5/CO6",
    bounds: { xMin: 0, xMax: 10, yMin: 0, yMax: 10, zMin: 0, zMax: 100, xLabel: "数据完整度 X", yLabel: "噪声污染度 Y", zLabel: "结论可信度 Z(%)" },
    legend: [
      { color: "#10b981", label: "高可靠区（证据充分）" },
      { color: "#f59e0b", label: "存疑区（需人工复核）" },
      { color: "#f43f5e", label: "高风险幻觉/外推失效区" }
    ],
    guideHtml: `
      <strong>实验目标：</strong>支撑大纲第2周“核验 AI 解释 · 学术诚信”教学实践。3D 曲面刻画智能模型结论可信度随<strong>样本完整度（X）</strong>与<strong>测量噪声污染（Y）</strong>的变化。<br>
      对比下方 <strong>AI 未经核验的盲目自信评分（虚高平面）</strong> 与 <strong>经物理与统计证据核验后的真实可靠度曲面</strong>，观察何时容易出现“AI 幻觉误导”！
    `,
    controls: [
      { key: "sampleScore", label: "当前实验样本覆盖完整度 X", type: "range", min: 0.5, max: 9.8, step: 0.2, default: 3.2 },
      { key: "noiseLevel", label: "传感器异常噪声污染度 Y", type: "range", min: 0.5, max: 9.8, step: 0.2, default: 7.4 },
      { key: "showAiIllusion", label: "叠加未经核验的 AI 盲目自信平面", type: "select", default: "1", options: [{ value: "1", label: "显示 AI 表面自信度对比（揭示幻觉风险）" }, { value: "0", label: "隐藏对比平面" }] }
    ],
    init() {},
    render3D(engine, state) {
      const trueRel = (x, y) => {
        const dataFactor = 1 / (1 + Math.exp(-(x - 4.2) * 0.95));
        const noisePenalty = Math.exp(-0.14 * y * (1.25 - 0.06 * x));
        return clamp(98 * dataFactor * noisePenalty, 3, 98);
      };

      engine.addSurface({
        fn: trueRel,
        nx: 28, ny: 28,
        palette: "viridis",
        alpha: 0.88,
        zMin: 0, zMax: 100,
        pickable: true
      });

      if (state.showAiIllusion === "1") {
        engine.addPlane({
          fn: (x, y) => 91 - 0.6 * y + 0.3 * x,
          nx: 10, ny: 10,
          color: "rgba(244, 63, 94, 0.20)",
          wireColor: "rgba(244, 63, 94, 0.55)"
        });
      }

      const sx = state.sampleScore, sy = state.noiseLevel;
      const zTrue = trueRel(sx, sy);
      const zAi = 91 - 0.6 * sy + 0.3 * sx;

      engine.addSphere({
        x: sx, y: sy, z: zTrue,
        radius: 0.32,
        color: "#10b981",
        glow: true,
        label: `真实可靠度 ${zTrue.toFixed(1)}%`
      });
      if (state.showAiIllusion === "1") {
        engine.addSphere({
          x: sx, y: sy, z: zAi,
          radius: 0.26,
          color: "#f43f5e",
          label: `AI自称 ${zAi.toFixed(1)}%`
        });
        engine.addArrow({
          from: [sx, sy, zAi],
          to: [sx, sy, zTrue],
          color: "#facc15",
          width: 2.5,
          label: `核验纠偏 -${Math.max(0, zAi - zTrue).toFixed(1)}%`
        });
      }
    },
    render2D(canvas, state) {
      const sTrue = [], sAi = [];
      for (let i = 0; i <= 40; i++) {
        const x = (10 * i) / 40;
        const y = state.noiseLevel;
        const zT = clamp(98 * (1 / (1 + Math.exp(-(x - 4.2) * 0.95))) * Math.exp(-0.14 * y * (1.25 - 0.06 * x)), 3, 98);
        const zA = 91 - 0.6 * y + 0.3 * x;
        sTrue.push([x, zT]);
        sAi.push([x, zA]);
      }
      drawLineChart(canvas, {
        title: `固定噪声 Y=${state.noiseLevel} 时：真实可靠度 vs AI表面自信度`,
        xMin: 0, xMax: 10, yMin: 0, yMax: 100,
        vLine: state.sampleScore,
        series: [
          { label: "AI未经核验表述", pts: sAi, color: "#f43f5e", dashed: true },
          { label: "证据核验后可靠度", pts: sTrue, color: "#10b981", width: 2.4 }
        ]
      });
    },
    getMetrics(state) {
      const sx = state.sampleScore, sy = state.noiseLevel;
      const zTrue = clamp(98 * (1 / (1 + Math.exp(-(sx - 4.2) * 0.95))) * Math.exp(-0.14 * sy * (1.25 - 0.06 * sx)), 3, 98);
      const zAi = 91 - 0.6 * sy + 0.3 * sx;
      const gap = Math.max(0, zAi - zTrue);
      return [
        { label: "物理证据核验可信度", value: `${zTrue.toFixed(1)}%` },
        { label: "AI未经核验虚高偏差", value: `+${gap.toFixed(1)}%` },
        { label: "风险等级判定", value: gap > 35 ? "⚠️ 高幻觉风险（必须重验）" : gap > 15 ? "需人工复核边界" : "✅ 证据链稳健" },
        { label: "学术规范要求", value: "标注来源 + 独立验算" }
      ];
    }
  });

  /* =======================================================================
     第二章：模糊计算（对应教材第4章）
     2.1 【代表性演算】精密恒温台温度调节 Mamdani 模糊控制与 3D 输出曲面
     ======================================================================= */
  const ruleLevels = ["弱制冷(VL)", "弱偏中(L)", "中制冷(M)", "强偏中(H)", "强制冷(VH)"];
  const ruleCenters = [10, 30, 50, 72, 92];

  function evalTempFuzzy(T, dT, spread, hedgePow, rules) {
    // T in [15, 35] (偏低, 适中, 偏高), dT in [-5, 5] (降温, 稳定, 升温)
    const wT = 5.0 * spread;
    const mT = [
      applyHedge(mfTrap(T, 15, 15, 20, 20 + wT), hedgePow),
      applyHedge(mfTri(T, 25 - wT, 25, 25 + wT), hedgePow),
      applyHedge(mfTrap(T, 30 - wT, 30, 35, 35), hedgePow)
    ];
    const wd = 2.6 * spread;
    const mdT = [
      applyHedge(mfTrap(dT, -5, -5, -2, -2 + wd), hedgePow),
      applyHedge(mfTri(dT, -wd, 0, wd), hedgePow),
      applyHedge(mfTrap(dT, 2 - wd, 2, 5, 5), hedgePow)
    ];

    // Mamdani min-max-centroid over u in [0, 100]%
    const actLevels = [0, 0, 0, 0, 0];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const firing = Math.min(mT[i], mdT[j]);
        const outIdx = rules[i * 3 + j];
        actLevels[outIdx] = Math.max(actLevels[outIdx], firing);
      }
    }

    let num = 0, den = 0;
    for (let u = 0; u <= 100; u += 2) {
      let agg = 0;
      for (let k = 0; k < 5; k++) {
        if (actLevels[k] <= 0) continue;
        const c = ruleCenters[k];
        const mfOut = mfTri(u, c - 22, c, c + 22);
        agg = Math.max(agg, Math.min(actLevels[k], mfOut));
      }
      num += u * agg;
      den += agg;
    }
    return {
      uStar: den > 1e-5 ? num / den : 50,
      mT,
      mdT,
      actLevels,
      deadZone: den <= 1e-5
    };
  }

  window.IIP.cases.push({
    id: "ch2-case1",
    chapterId: "ch2",
    title: "2.1 【代表性演算】精密恒温台温度调节 Mamdani 模糊控制与 3D 曲面",
    tag: "大纲必做演算 · 教材4.5.5",
    bounds: { xMin: 15, xMax: 35, yMin: -5, yMax: 5, zMin: 0, zMax: 100, xLabel: "温度 T (℃)", yLabel: "温升率 ΔT (℃/min)", zLabel: "制冷功率 u*(%)" },
    legend: [
      { color: "#38bdf8", label: "3D Mamdani 控制曲面 u*(T, ΔT)" },
      { color: "#facc15", label: "当前传感器工作点" }
    ],
    guideHtml: `
      <strong>实验目标：</strong>完整重现大纲第2章代表性演算与教材图4-36 Mamdani 推理。调节输入温度 <code>T</code>、温升率 <code>ΔT</code>、隶属函数重叠宽度与 <strong>Zadeh 语气算子（教材p.128）</strong>，并可<strong>直接点击下方 3×3 模糊规则矩阵单元格修改控制规则</strong>，实时观察 3D 非线性控制曲面变形！
    `,
    controls: [
      { key: "curT", label: "当前输入温度 T (℃)", type: "range", min: 15, max: 35, step: 0.5, default: 27.5 },
      { key: "curDT", label: "当前温升速率 ΔT (℃/min)", type: "range", min: -5, max: 5, step: 0.25, default: 1.5 },
      { key: "spread", label: "隶属函数重叠度因子（过小会出现死区！）", type: "range", min: 0.4, max: 1.5, step: 0.05, default: 1.0 },
      {
        key: "hedge", label: "Zadeh 语言语气算子修饰（教材p.128）", type: "select", default: "1",
        options: [
          { value: "1", label: "标准隶属度 μ¹.⁰（正常）" },
          { value: "2", label: "集中化“很…”算子 μ².⁰（教材式很大）" },
          { value: "0.5", label: "漫散化“略/有点…”算子 μ⁰.⁵" }
        ]
      }
    ],
    init(state) {
      // 3x3 default rule table: rows = T [偏低, 适中, 偏高], cols = dT [降温, 稳定, 升温]
      state.rules = [0, 0, 1, 1, 2, 3, 3, 4, 4];
    },
    customWidget(container, state, refresh) {
      const wrap = document.createElement("div");
      wrap.innerHTML = `<div style="font-size:12px;font-weight:700;margin:6px 0 4px;color:var(--accent-cyan);">交互式 3×3 模糊规则库（点击单元格循环切换输出制冷等级）：</div>`;
      const grid = document.createElement("div");
      grid.className = "rule-grid-3x3";
      const headers = ["T \\ ΔT", "降温", "稳定", "升温"];
      headers.forEach((h) => {
        const d = document.createElement("div");
        d.className = "rule-cell-hdr";
        d.textContent = h;
        grid.appendChild(d);
      });
      const rowNames = ["T偏低", "T适中", "T偏高"];
      for (let i = 0; i < 3; i++) {
        const rh = document.createElement("div");
        rh.className = "rule-cell-hdr";
        rh.textContent = rowNames[i];
        grid.appendChild(rh);
        for (let j = 0; j < 3; j++) {
          const btn = document.createElement("button");
          btn.className = "rule-cell-btn";
          const idx = i * 3 + j;
          btn.textContent = ruleLevels[state.rules[idx]];
          btn.addEventListener("click", () => {
            state.rules[idx] = (state.rules[idx] + 1) % ruleLevels.length;
            btn.textContent = ruleLevels[state.rules[idx]];
            refresh();
          });
          grid.appendChild(btn);
        }
      }
      wrap.appendChild(grid);
      container.appendChild(wrap);
    },
    render3D(engine, state) {
      const hp = parseFloat(state.hedge || "1");
      engine.addSurface({
        fn: (T, dT) => evalTempFuzzy(T, dT, state.spread, hp, state.rules).uStar,
        nx: 26, ny: 24,
        palette: "turbo",
        alpha: 0.9,
        zMin: 0, zMax: 100,
        contourFloor: true,
        pickable: true
      });

      const cur = evalTempFuzzy(state.curT, state.curDT, state.spread, hp, state.rules);
      state.lastEval = cur;

      engine.addLine({
        from: [state.curT, state.curDT, 0],
        to: [state.curT, state.curDT, cur.uStar],
        color: "#facc15",
        width: 2.2,
        dashed: true
      });
      engine.addSphere({
        x: state.curT, y: state.curDT, z: cur.uStar,
        radius: 0.34,
        color: "#facc15",
        glow: true,
        label: `u* = ${cur.uStar.toFixed(1)}%`
      });
    },
    render2D(canvas, state) {
      const hp = parseFloat(state.hedge || "1");
      const wT = 5.0 * state.spread;
      const sLow = [], sMed = [], sHigh = [];
      for (let T = 15; T <= 35; T += 0.4) {
        sLow.push([T, applyHedge(mfTrap(T, 15, 15, 20, 20 + wT), hp)]);
        sMed.push([T, applyHedge(mfTri(T, 25 - wT, 25, 25 + wT), hp)]);
        sHigh.push([T, applyHedge(mfTrap(T, 30 - wT, 30, 35, 35), hp)]);
      }
      drawLineChart(canvas, {
        title: `温度隶属函数 μ(T) 曲线（黄虚线 T=${state.curT}℃）`,
        xMin: 15, xMax: 35, yMin: 0, yMax: 1.05,
        vLine: state.curT,
        series: [
          { label: "偏低", pts: sLow, color: "#38bdf8" },
          { label: "适中", pts: sMed, color: "#10b981" },
          { label: "偏高", pts: sHigh, color: "#f43f5e" }
        ]
      });
    },
    getMetrics(state) {
      const ev = state.lastEval || evalTempFuzzy(state.curT, state.curDT, state.spread, parseFloat(state.hedge || "1"), state.rules);
      return [
        { label: "温度隶属度 [低,中,高]", value: ev.mT.map((v) => v.toFixed(2)).join(", ") },
        { label: "温升率隶属 [降,稳,升]", value: ev.mdT.map((v) => v.toFixed(2)).join(", ") },
        { label: "重心法解模糊输出 u*", value: `${ev.uStar.toFixed(2)} %` },
        { label: "规则覆盖状态", value: ev.deadZone ? "⚠️ 隶属死区失火" : "✅ 平滑连续推理" }
      ];
    }
  });

  /* -----------------------------------------------------------------------
     2.2 【专业实践】智能光电实验室光照度自适应模糊调光系统（大纲第5周实践）
     ----------------------------------------------------------------------- */
  function evalLuxFuzzy(ambLux, personDist, energyBias, mfShape) {
    // ambLux in [0, 1000] lx (昏暗, 适宜, 充足), personDist in [0.5, 5.0] m (近距实验, 中距巡视, 远距无人)
    const mLux = mfShape === "gauss"
      ? [mfGauss(ambLux, 100, 180), mfGauss(ambLux, 500, 180), mfGauss(ambLux, 900, 180)]
      : [mfTrap(ambLux, 0, 0, 220, 480), mfTri(ambLux, 240, 500, 760), mfTrap(ambLux, 520, 780, 1000, 1000)];

    const mDist = mfShape === "gauss"
      ? [mfGauss(personDist, 0.8, 0.9), mfGauss(personDist, 2.6, 0.9), mfGauss(personDist, 4.6, 0.9)]
      : [mfTrap(personDist, 0.5, 0.5, 1.3, 2.5), mfTri(personDist, 1.5, 2.75, 4.0), mfTrap(personDist, 3.0, 4.2, 5.0, 5.0)];

    // LED PWM target centers (%) for 3x3 (lux x dist):
    // Dark+Near->95, Dark+Mid->72, Dark+Far->25(standby)
    // Med+Near->60,  Med+Mid->40,  Med+Far->12
    // Bright+Near->20, Bright+Mid->8, Bright+Far->0
    const baseOut = [
      [96, 70, 24],
      [62, 38, 10],
      [22, 8,  2]
    ];
    let num = 0, den = 0;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const w = Math.min(mLux[i], mDist[j]);
        const targetPwm = clamp(baseOut[i][j] - energyBias * (j * 8), 0, 100);
        num += w * targetPwm;
        den += w;
      }
    }
    const pwm = den > 1e-6 ? num / den : 30;
    const totalDeskLux = ambLux * 0.65 + pwm * 5.2 / (1 + 0.12 * personDist);
    return { pwm, totalDeskLux, mLux, mDist };
  }

  window.IIP.cases.push({
    id: "ch2-case2",
    chapterId: "ch2",
    title: "2.2 【专业实践】智能光电实验室光照度自适应模糊调光系统",
    tag: "大纲光照调节讨论 · 光电专业案例",
    bounds: { xMin: 0, xMax: 1000, yMin: 0.5, yMax: 5.0, zMin: 0, zMax: 100, xLabel: "环境自然光 E (lx)", yLabel: "红外感知人距 D (m)", zLabel: "LED调光占空比 (%)" },
    legend: [
      { color: "#38bdf8", label: "3D 光电调光曲面 PWM(E, D)" },
      { color: "#fde047", label: "当前实验室光电传感状态" }
    ],
    guideHtml: `
      <strong>工程场景：</strong>硅光电二极管实时监测窗边自然光照度 <code>E ∈ [0, 1000] lx</code>，热释电/ToF 红外传感器感知实验人员距离 <code>D ∈ [0.5, 5.0] m</code>，通过模糊推理输出无频闪 LED 恒流源 PWM 占空比，兼顾<strong>光学桌面恒照度阅读舒适性（~500 lx）与无人节能</strong>。对比三角形与高斯型隶属函数对调光曲面光滑度的影响！
    `,
    controls: [
      { key: "ambLux", label: "硅光电管实测环境照度 E (lx)", type: "range", min: 0, max: 1000, step: 20, default: 260 },
      { key: "personDist", label: "红外感知人员距离 D (m)", type: "range", min: 0.5, max: 5.0, step: 0.1, default: 1.2 },
      { key: "energyBias", label: "节能优先权重系数", type: "range", min: 0, max: 2.0, step: 0.1, default: 0.6 },
      {
        key: "mfShape", label: "切换隶属函数几何类型", type: "select", default: "gauss",
        options: [
          { value: "gauss", label: "高斯型隶属函数（无限阶光滑过渡）" },
          { value: "tri", label: "折线三角/梯形隶属函数（分段线性硬件易实现）" }
        ]
      }
    ],
    init() {},
    render3D(engine, state) {
      engine.addSurface({
        fn: (lx, d) => evalLuxFuzzy(lx, d, state.energyBias, state.mfShape).pwm,
        nx: 26, ny: 24,
        palette: "plasma",
        alpha: 0.9,
        zMin: 0, zMax: 100,
        pickable: true
      });
      const res = evalLuxFuzzy(state.ambLux, state.personDist, state.energyBias, state.mfShape);
      state.lastLux = res;
      engine.addSphere({
        x: state.ambLux, y: state.personDist, z: res.pwm,
        radius: 0.34,
        color: "#fde047",
        glow: true,
        label: `LED ${res.pwm.toFixed(1)}%`
      });
    },
    render2D(canvas, state) {
      const ptsPwm = [], ptsDesk = [];
      for (let lx = 0; lx <= 1000; lx += 25) {
        const r = evalLuxFuzzy(lx, state.personDist, state.energyBias, state.mfShape);
        ptsPwm.push([lx, r.pwm]);
        ptsDesk.push([lx, clamp(r.totalDeskLux / 10, 0, 100)]);
      }
      drawLineChart(canvas, {
        title: `人距 D=${state.personDist}m 时：LED占空比(%) 与 桌面合成照度(/10 lx)`,
        xMin: 0, xMax: 1000, yMin: 0, yMax: 100,
        vLine: state.ambLux,
        series: [
          { label: "LED占空比(%)", pts: ptsPwm, color: "#f59e0b", width: 2.3 },
          { label: "桌面照度/10", pts: ptsDesk, color: "#38bdf8", dashed: true }
        ]
      });
    },
    getMetrics(state) {
      const r = state.lastLux || evalLuxFuzzy(state.ambLux, state.personDist, state.energyBias, state.mfShape);
      return [
        { label: "输出 LED 调光占空比", value: `${r.pwm.toFixed(1)} %` },
        { label: "实验台估算总照度", value: `${r.totalDeskLux.toFixed(0)} lx` },
        { label: "相比全亮模式节电率", value: `${(100 - r.pwm).toFixed(1)} %` },
        { label: "隶属函数曲面特性", value: state.mfShape === "gauss" ? "C∞ 光滑曲面" : "分段折面推理" }
      ];
    }
  });

  /* -----------------------------------------------------------------------
     2.3 模糊关系合成 R∘S、传递闭包 R* 与 λ-截集动态聚类 3D 矩阵棱柱（教材4.5–4.6）
     ----------------------------------------------------------------------- */
  const baseSimMatrix = [
    [1.00, 0.85, 0.42, 0.35, 0.80],
    [0.85, 1.00, 0.45, 0.38, 0.88],
    [0.42, 0.45, 1.00, 0.78, 0.40],
    [0.35, 0.38, 0.78, 1.00, 0.32],
    [0.80, 0.88, 0.40, 0.32, 1.00]
  ];
  const sampleNames = ["玻璃A", "石英B", "硅片C", "锗片D", "熔融石英E"];

  window.IIP.cases.push({
    id: "ch2-case3",
    chapterId: "ch2",
    title: "2.3 模糊关系合成 R∘R 与光学材料 λ-截集动态聚类 3D 矩阵（教材4.5–4.6）",
    tag: "教材4.5模糊关系 · 4.6模糊聚类",
    bounds: { xMin: 0.4, xMax: 5.6, yMin: 0.4, yMax: 5.6, zMin: 0, zMax: 1.05, xLabel: "光学样品 i", yLabel: "光学样品 j", zLabel: "模糊相似度 r_ij" },
    legend: [
      { color: "#10b981", label: "r_ij ≥ λ（λ-截矩阵中置 1，归为同类）" },
      { color: "#475569", label: "r_ij < λ（λ-截矩阵中置 0，不同类）" },
      { color: "#38bdf8", label: "水平半透明平面：当前阈值 λ" }
    ],
    guideHtml: `
      <strong>实验目标：</strong>覆盖教材 4.5 节<strong>模糊关系矩阵最大-最小合成 <code>R∘S</code>、<code>λ</code>-截矩阵 <code>R_λ</code></strong> 与 4.6 节<strong>基于模糊等价关系的动态聚类</strong>。<br>
      针对 5 种光学材料的透射率/折射率光谱相似矩阵 <code>R</code>，切换原始相似矩阵与传递闭包等价矩阵 <code>R* = R∘R∘...</code>，上下拖动水平 <strong><code>λ</code> 截割平面</strong>，实时观察样品聚类分群！
    `,
    controls: [
      { key: "lambda", label: "调节 λ-截集阈值水平面 λ ∈ [0.3, 1.0]", type: "range", min: 0.30, max: 1.00, step: 0.02, default: 0.76 },
      {
        key: "matMode", label: "选择矩阵运算阶段（教材4.5–4.6）", type: "select", default: "closure",
        options: [
          { value: "raw", label: "原始模糊相似矩阵 R（自反、对称，未必传递）" },
          { value: "r2", label: "一次最大-最小合成 R² = R ∘ R" },
          { value: "closure", label: "传递闭包模糊等价矩阵 R*（满足传递性，可做λ聚类）" }
        ]
      }
    ],
    init() {},
    render3D(engine, state) {
      const mat = state.matMode === "raw"
        ? baseSimMatrix
        : state.matMode === "r2"
        ? fuzzyCompose(baseSimMatrix, baseSimMatrix)
        : fuzzyTransitiveClosure(baseSimMatrix);
      state.curMat = mat;

      // Draw translucent lambda slicing plane
      engine.addPlane({
        fn: () => state.lambda,
        nx: 8, ny: 8,
        color: "rgba(56, 189, 248, 0.22)",
        wireColor: "rgba(56, 189, 248, 0.65)"
      });

      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          const val = mat[i][j];
          const active = val >= state.lambda - 1e-6;
          engine.addBar3D({
            x: i + 1,
            y: j + 1,
            dx: 0.56,
            dy: 0.56,
            z0: 0,
            z1: val,
            color: active ? [16, 185, 129] : [71, 85, 105],
            alpha: active ? 0.93 : 0.65,
            topLabel: val.toFixed(2),
            info: `(${sampleNames[i]}, ${sampleNames[j]}) 模糊度 = ${val.toFixed(2)} | R_λ = ${active ? 1 : 0}`
          });
        }
      }
    },
    render2D(canvas, state) {
      const mat = state.curMat || fuzzyTransitiveClosure(baseSimMatrix);
      // Compute connected components under >= lambda
      const visited = Array(5).fill(false);
      const clusters = [];
      for (let i = 0; i < 5; i++) {
        if (visited[i]) continue;
        const group = [];
        const q = [i];
        visited[i] = true;
        while (q.length) {
          const u = q.shift();
          group.push(sampleNames[u]);
          for (let v = 0; v < 5; v++) {
            if (!visited[v] && mat[u][v] >= state.lambda - 1e-6) {
              visited[v] = true;
              q.push(v);
            }
          }
        }
        clusters.push(group);
      }
      state.clusters = clusters;

      drawBarChart(canvas, {
        title: `样品1(${sampleNames[0]})与各样品模糊关联度 vs 阈值 λ=${state.lambda.toFixed(2)}`,
        yMax: 1.05,
        items: mat[0].map((v, idx) => ({
          label: sampleNames[idx],
          value: v,
          color: v >= state.lambda - 1e-6 ? "#10b981" : "#64748b"
        }))
      });
    },
    getMetrics(state) {
      const clusters = state.clusters || [[sampleNames[0]]];
      return [
        { label: "当前截割水平阈值 λ", value: state.lambda.toFixed(2) },
        { label: "划分出的等价类簇数", value: `${clusters.length} 类` },
        { label: "聚类分组详情", value: clusters.map((g) => `{${g.map((s) => s.slice(-1)).join(",")}}`).join(" ") },
        { label: "矩阵传递性检验", value: state.matMode === "closure" ? "✅ 满足 R*∘R* = R*" : "合成过渡态" }
      ];
    }
  });
})();
