/* ==========================================================================
   《智能信息处理技术》(EP00254) 交互式 3D 教学仿真实验平台 — 主控应用逻辑
   ========================================================================== */
(function () {
  const { courseMeta, chapters, cases } = window.IIP;
  const Engine3D = window.IIP.Engine3D;

  const appState = {
    currentChapterId: "ch1",
    currentCaseId: "ch1-case1",
    activeTab: "lab", // lab | walkthrough | theory | quiz
    caseState: {},
    walkStepIdx: 0,
    walkParamVal: 1,
    quizScores: JSON.parse(localStorage.getItem("iip_quiz_scores") || "{}"),
    theme: localStorage.getItem("iip_theme") || "dark"
  };

  let engine3d = null;
  let canvas2d = null;
  let lastFrameTime = performance.now();

  function getChapter(chId) {
    return chapters.find((c) => c.id === chId) || chapters[0];
  }

  function getCase(caseId) {
    return cases.find((c) => c.id === caseId) || cases[0];
  }

  function getCasesByChapter(chId) {
    return cases.filter((c) => c.chapterId === chId);
  }

  /* ==================== Dropdown & Navigation Initialization ==================== */
  function initNavigation() {
    const chSelect = document.getElementById("chapterSelect");
    const globalCaseSelect = document.getElementById("globalCaseSelect");
    const strip = document.getElementById("chapterStrip");

    // 1. Populate Chapter Select Dropdown
    chSelect.innerHTML = "";
    chapters.forEach((ch) => {
      const opt = document.createElement("option");
      opt.value = ch.id;
      opt.textContent = `${ch.shortTitle} ｜ ${ch.textbookRef.replace("对应", "")}（${ch.weeks.split("（")[0]}）`;
      chSelect.appendChild(opt);
    });

    // 2. Populate Global Chapter-Grouped Case Dropdown (<optgroup> per chapter!)
    globalCaseSelect.innerHTML = "";
    chapters.forEach((ch) => {
      const group = document.createElement("optgroup");
      group.label = `${ch.num}：${ch.title.split("：")[1] || ch.title}（${ch.textbookRef}）`;
      getCasesByChapter(ch.id).forEach((cs) => {
        const opt = document.createElement("option");
        opt.value = cs.id;
        opt.textContent = cs.title;
        group.appendChild(opt);
      });
      globalCaseSelect.appendChild(group);
    });

    // 3. Populate Quick Chapter Strip Pills
    strip.innerHTML = "";
    chapters.forEach((ch) => {
      const count = getCasesByChapter(ch.id).length;
      const btn = document.createElement("button");
      btn.className = "chapter-pill";
      btn.dataset.ch = ch.id;
      btn.innerHTML = `
        <div class="chapter-pill-top">
          <span>${ch.shortTitle}</span>
          <span class="tag tag-cyan" style="font-size:10px;padding:1px 6px;">${count}案例</span>
        </div>
        <div class="chapter-pill-sub">${ch.textbookRef}</div>
      `;
      btn.addEventListener("click", () => selectChapter(ch.id));
      strip.appendChild(btn);
    });

    chSelect.addEventListener("change", (e) => {
      selectChapter(e.target.value);
    });

    globalCaseSelect.addEventListener("change", (e) => {
      selectCase(e.target.value, true);
    });

    document.getElementById("chapterCaseSelect").addEventListener("change", (e) => {
      selectCase(e.target.value, true);
    });

    // Mode Tabs
    document.querySelectorAll(".mode-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        switchTab(tab.dataset.tab);
      });
    });
  }

  function switchTab(tabName) {
    appState.activeTab = tabName;
    document.querySelectorAll(".mode-tab").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tabName);
    });
    document.querySelectorAll(".view-panel").forEach((p) => {
      p.classList.toggle("active", p.id === `panel-${tabName}`);
    });
    if (tabName === "lab" && engine3d) {
      setTimeout(() => {
        engine3d.resize();
        refresh2DAndMetrics();
      }, 20);
    }
  }

  function selectChapter(chId, specificCaseId = null) {
    const ch = getChapter(chId);
    appState.currentChapterId = ch.id;

    const chCases = getCasesByChapter(ch.id);
    const targetCase = specificCaseId && chCases.some((c) => c.id === specificCaseId)
      ? specificCaseId
      : chCases[0].id;

    // Update Chapter Hero
    document.getElementById("heroNumBadge").textContent = `${ch.num} · ${ch.weeks}`;
    document.getElementById("heroBookBadge").textContent = ch.textbookRef;
    document.getElementById("heroEthicsBadge").textContent = `课程思政：${ch.ethicsTag}`;
    document.getElementById("heroTitle").textContent = `${ch.num}：${ch.title}`;
    document.getElementById("heroDesc").textContent = ch.summary;

    // Populate Chapter-Scoped Case Dropdown
    const chCaseSelect = document.getElementById("chapterCaseSelect");
    chCaseSelect.innerHTML = "";
    chCases.forEach((cs) => {
      const opt = document.createElement("option");
      opt.value = cs.id;
      opt.textContent = cs.title;
      chCaseSelect.appendChild(opt);
    });

    // Update Pills & Selects
    document.getElementById("chapterSelect").value = ch.id;
    document.querySelectorAll(".chapter-pill").forEach((b) => {
      b.classList.toggle("active", b.dataset.ch === ch.id);
    });

    // Render Chapter Walkthrough, Theory & Quiz
    renderWalkthroughSection(ch);
    renderTheorySection(ch);
    renderQuizSection(ch);

    // Mount Target 3D Case
    mountCase(targetCase);
  }

  function selectCase(caseId, switchToLab = false) {
    const cs = getCase(caseId);
    if (cs.chapterId !== appState.currentChapterId) {
      selectChapter(cs.chapterId, cs.id);
    } else {
      mountCase(cs.id);
    }
    if (switchToLab && appState.activeTab !== "lab") {
      switchTab("lab");
    }
  }

  /* ==================== Mount 3D Case & Controls ==================== */
  function mountCase(caseId) {
    const cs = getCase(caseId);
    appState.currentCaseId = cs.id;
    window.history.replaceState(null, "", `#${cs.chapterId}/${cs.id}`);

    document.getElementById("globalCaseSelect").value = cs.id;
    document.getElementById("chapterCaseSelect").value = cs.id;
    document.getElementById("stageCaseTitle").textContent = cs.title;
    document.getElementById("caseTagBadge").textContent = cs.tag || "3D 交互实验";
    document.getElementById("caseGuideBox").innerHTML = cs.guideHtml || "";

    // Legend HUD
    const legEl = document.getElementById("hudLegend");
    legEl.innerHTML = (cs.legend || [])
      .map((l) => `<span><i class="legend-dot" style="background:${l.color}"></i>${l.label}</span>`)
      .join("");

    // Initialize Case State with Control Defaults
    const st = {};
    (cs.controls || []).forEach((ctrl) => {
      st[ctrl.key] = ctrl.default;
    });
    if (cs.init) cs.init(st);
    appState.caseState = st;

    // Configure 3D Engine Bounds & Reset Camera cleanly
    if (engine3d) {
      engine3d.setBounds(cs.bounds);
      engine3d.setPreset("iso");
    }

    buildCaseControlsUI(cs, st);
    refresh2DAndMetrics();
  }

  function buildCaseControlsUI(cs, st) {
    const container = document.getElementById("caseControlsContainer");
    container.innerHTML = "";
    const valueSpans = {};
    const inputEls = {};

    const syncControlsFromState = () => {
      (cs.controls || []).forEach((ctrl) => {
        if (inputEls[ctrl.key]) inputEls[ctrl.key].value = st[ctrl.key];
        if (valueSpans[ctrl.key]) valueSpans[ctrl.key].textContent = st[ctrl.key];
      });
      refresh2DAndMetrics();
    };

    (cs.controls || []).forEach((ctrl) => {
      const row = document.createElement("div");
      row.className = "ctrl-row";

      const hdr = document.createElement("div");
      hdr.className = "ctrl-header";
      const lbl = document.createElement("span");
      lbl.textContent = ctrl.label;
      hdr.appendChild(lbl);

      if (ctrl.type === "range") {
        const valSpan = document.createElement("span");
        valSpan.className = "ctrl-val";
        valSpan.textContent = st[ctrl.key];
        valueSpans[ctrl.key] = valSpan;
        hdr.appendChild(valSpan);
        row.appendChild(hdr);

        const inp = document.createElement("input");
        inp.type = "range";
        inp.min = ctrl.min;
        inp.max = ctrl.max;
        inp.step = ctrl.step;
        inp.value = st[ctrl.key];
        inp.addEventListener("input", () => {
          st[ctrl.key] = parseFloat(inp.value);
          valSpan.textContent = st[ctrl.key];
          refresh2DAndMetrics();
        });
        inputEls[ctrl.key] = inp;
        row.appendChild(inp);
      } else if (ctrl.type === "select") {
        row.appendChild(hdr);
        const sel = document.createElement("select");
        sel.className = "ctrl-select";
        (ctrl.options || []).forEach((o) => {
          const opt = document.createElement("option");
          opt.value = o.value;
          opt.textContent = o.label;
          sel.appendChild(opt);
        });
        sel.value = String(st[ctrl.key]);
        sel.addEventListener("change", () => {
          st[ctrl.key] = sel.value;
          refresh2DAndMetrics();
        });
        inputEls[ctrl.key] = sel;
        row.appendChild(sel);
      }

      container.appendChild(row);
    });

    if (cs.customWidget) {
      cs.customWidget(container, st, refresh2DAndMetrics);
    }

    if (cs.actions && cs.actions.length) {
      const btnRow = document.createElement("div");
      btnRow.className = "ctrl-btn-row";
      cs.actions.forEach((act) => {
        const b = document.createElement("button");
        b.className = `btn ${act.primary ? "btn-primary" : ""}`;
        b.textContent = act.label;
        b.addEventListener("click", () => {
          act.onClick(st, syncControlsFromState);
          refresh2DAndMetrics();
        });
        btnRow.appendChild(b);
      });
      container.appendChild(btnRow);
    }
  }

  function refresh2DAndMetrics(skipImmediate3D = false) {
    const cs = getCase(appState.currentCaseId);
    const st = appState.caseState;
    if (!skipImmediate3D && engine3d && appState.activeTab === "lab") {
      engine3d.render((eng) => {
        cs.render3D(eng, st, performance.now() / 1000);
      });
    }
    if (cs.render2D && canvas2d) {
      cs.render2D(canvas2d, st);
    }
    if (cs.getMetrics) {
      const metrics = cs.getMetrics(st);
      const strip = document.getElementById("metricsStrip");
      strip.innerHTML = metrics
        .map(
          (m) => `
          <div class="metric-item">
            <div class="metric-label">${m.label}</div>
            <div class="metric-val">${m.value}</div>
          </div>`
        )
        .join("");
    }
  }

  /* ==================== Step-by-Step Walkthrough Renderer ==================== */
  function renderWalkthroughSection(ch) {
    const wt = ch.walkthrough;
    appState.walkStepIdx = 0;
    appState.walkParamVal = wt.paramDefault;

    document.getElementById("walkTitle").textContent = wt.title;
    document.getElementById("walkDesc").textContent = wt.desc;
    document.getElementById("walkParamLabel").textContent = wt.paramLabel;

    const slider = document.getElementById("walkParamSlider");
    slider.min = wt.paramMin;
    slider.max = wt.paramMax;
    slider.step = wt.paramStep;
    slider.value = wt.paramDefault;
    document.getElementById("walkParamVal").textContent = wt.paramDefault;

    const updateWalkUI = () => {
      const steps = wt.computeSteps(appState.walkParamVal);
      appState.walkStepIdx = Math.min(appState.walkStepIdx, steps.length - 1);

      const timeline = document.getElementById("walkTimeline");
      timeline.innerHTML = "";
      steps.forEach((s, idx) => {
        const item = document.createElement("button");
        item.className = `step-nav-item ${idx === appState.walkStepIdx ? "active" : ""}`;
        item.innerHTML = `
          <div class="step-nav-num">STEP 0${idx + 1} / 0${steps.length}</div>
          <div class="step-nav-title">${s.title}</div>
        `;
        item.addEventListener("click", () => {
          appState.walkStepIdx = idx;
          updateWalkUI();
        });
        timeline.appendChild(item);
      });

      const cur = steps[appState.walkStepIdx];
      document.getElementById("walkCurrentStepNum").textContent = `当前步骤：第 ${appState.walkStepIdx + 1} 步（共 ${steps.length} 步）`;
      document.getElementById("walkCurrentStepTitle").textContent = cur.title;
      document.getElementById("walkCurrentFormula").textContent = cur.formula;
      document.getElementById("walkCurrentDetail").innerHTML = cur.detail;

      // Also render full summary table of all steps below for easy classroom projection
      const allBox = document.getElementById("walkAllStepsSummary");
      allBox.innerHTML = steps
        .map(
          (st, i) => `
          <tr>
            <td style="width:76px;font-weight:700;color:var(--accent-cyan);">步骤 ${i + 1}</td>
            <td><strong>${st.title.replace(/^步骤 \d+：/, "")}</strong><br><code style="color:var(--accent-amber);font-size:12px;">${st.formula}</code></td>
          </tr>`
        )
        .join("");
    };

    slider.oninput = () => {
      appState.walkParamVal = parseFloat(slider.value);
      document.getElementById("walkParamVal").textContent = appState.walkParamVal;
      updateWalkUI();
    };

    document.getElementById("btnWalkPrev").onclick = () => {
      if (appState.walkStepIdx > 0) {
        appState.walkStepIdx--;
        updateWalkUI();
      }
    };
    document.getElementById("btnWalkNext").onclick = () => {
      const steps = wt.computeSteps(appState.walkParamVal);
      if (appState.walkStepIdx < steps.length - 1) {
        appState.walkStepIdx++;
        updateWalkUI();
      }
    };

    updateWalkUI();
  }

  /* ==================== Core Theory & OBE Objectives Renderer ==================== */
  function renderTheorySection(ch) {
    const obeBox = document.getElementById("obeObjectivesBox");
    obeBox.innerHTML = `
      <div class="theory-card">
        <h4><span>🎯【掌握 To Master】</span><span class="tag tag-emerald">核心必考</span></h4>
        <ul>${ch.objectives.master.map((t) => `<li>${t}</li>`).join("")}</ul>
      </div>
      <div class="theory-card">
        <h4><span>💡【理解 To Comprehend】</span><span class="tag tag-cyan">原理辨析</span></h4>
        <ul>${ch.objectives.comprehend.map((t) => `<li>${t}</li>`).join("")}</ul>
      </div>
      <div class="theory-card">
        <h4><span>🔭【了解 To Know About】</span><span class="tag tag-indigo">视野拓展</span></h4>
        <ul>${ch.objectives.know.map((t) => `<li>${t}</li>`).join("")}</ul>
      </div>
    `;

    const cardsBox = document.getElementById("theoryCardsBox");
    cardsBox.innerHTML = ch.theoryCards
      .map(
        (c) => `
        <div class="theory-card">
          <h4><span>${c.title}</span><span class="tag tag-amber">${c.badge}</span></h4>
          <div class="formula-box">${c.formula}</div>
          <ul>${c.points.map((p) => `<li>${p}</li>`).join("")}</ul>
        </div>`
      )
      .join("");
  }

  /* ==================== In-Class Quiz Renderer ==================== */
  function renderQuizSection(ch) {
    const container = document.getElementById("quizListContainer");
    container.innerHTML = "";
    const answers = {};

    const updateQuizScoreBanner = () => {
      const answeredCount = Object.keys(answers).length;
      let correctCount = 0;
      Object.entries(answers).forEach(([qIdx, pick]) => {
        if (ch.quiz[qIdx].ans === pick) correctCount++;
      });
      const score = Math.round((correctCount / ch.quiz.length) * 100);
      if (answeredCount === ch.quiz.length) {
        appState.quizScores[ch.id] = score;
        localStorage.setItem("iip_quiz_scores", JSON.stringify(appState.quizScores));
      }
      const saved = appState.quizScores[ch.id];
      document.getElementById("quizScoreReadout").textContent =
        answeredCount === ch.quiz.length
          ? `本章随堂检测得分：${score} / 100 分`
          : `已作答 ${answeredCount} / ${ch.quiz.length} 题${saved !== undefined ? `（历史最高/最近记录：${saved}分）` : ""}`;
    };

    ch.quiz.forEach((item, qIdx) => {
      const card = document.createElement("div");
      card.className = "quiz-q-card";
      card.innerHTML = `<div class="quiz-q-title">${item.q}</div>`;

      const optsDiv = document.createElement("div");
      optsDiv.className = "quiz-options";

      const expDiv = document.createElement("div");
      expDiv.className = "quiz-explain";
      expDiv.style.display = "none";

      item.opts.forEach((optText, oIdx) => {
        const btn = document.createElement("button");
        btn.className = "quiz-opt";
        btn.textContent = optText;
        btn.addEventListener("click", () => {
          if (answers[qIdx] !== undefined) return; // lock once answered
          answers[qIdx] = oIdx;
          Array.from(optsDiv.children).forEach((b, k) => {
            if (k === item.ans) b.classList.add("correct");
            else if (k === oIdx && oIdx !== item.ans) b.classList.add("wrong");
          });
          expDiv.style.display = "block";
          expDiv.innerHTML = `<strong>${oIdx === item.ans ? "✅ 回答正确！" : "❌ 回答有误。"}</strong> 解析：${item.exp}`;
          updateQuizScoreBanner();
        });
        optsDiv.appendChild(btn);
      });

      card.appendChild(optsDiv);
      card.appendChild(expDiv);
      container.appendChild(card);
    });

    document.getElementById("btnResetQuiz").onclick = () => {
      renderQuizSection(ch);
    };

    updateQuizScoreBanner();
  }

  /* ==================== Syllabus & 18-Week Modal ==================== */
  function initSyllabusModal() {
    const modal = document.getElementById("syllabusModal");
    document.getElementById("btnOpenSyllabus").addEventListener("click", () => {
      modal.classList.add("open");
    });
    document.getElementById("btnCloseSyllabus").addEventListener("click", () => {
      modal.classList.remove("open");
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.remove("open");
    });

    const obeRows = courseMeta.obeObjectives
      .map(
        (o) => `
        <tr>
          <td><strong>${o.id}</strong> (${o.type})</td>
          <td><strong>${o.title}</strong>：${o.desc}</td>
          <td><span class="tag tag-cyan">${o.grad}</span></td>
        </tr>`
      )
      .join("");
    document.getElementById("modalObeBody").innerHTML = obeRows;

    const weekRows = courseMeta.weeklySchedule
      .map(
        (w) => `
        <tr>
          <td>第 ${w.week} 周 (${w.hours}学时)</td>
          <td>${w.content}</td>
          <td>${w.method}</td>
          <td><span class="tag tag-emerald">${w.ethics}</span></td>
          <td><button class="btn btn-sm jump-ch-btn" data-ch="${w.ch}">进入章节实验 →</button></td>
        </tr>`
      )
      .join("");
    const wkBody = document.getElementById("modalWeekBody");
    wkBody.innerHTML = weekRows;
    wkBody.querySelectorAll(".jump-ch-btn").forEach((b) => {
      b.addEventListener("click", () => {
        modal.classList.remove("open");
        selectChapter(b.dataset.ch);
        switchTab("lab");
      });
    });
  }

  /* ==================== Theme & 3D Toolbar Controls ==================== */
  function initThemeAndCameraToolbar() {
    const applyTheme = (t) => {
      appState.theme = t;
      document.documentElement.setAttribute("data-theme", t);
      localStorage.setItem("iip_theme", t);
      document.getElementById("btnThemeToggle").textContent = t === "dark" ? "☀️ 浅色模式" : "🌙 深色模式";
    };
    applyTheme(appState.theme);

    document.getElementById("btnThemeToggle").addEventListener("click", () => {
      applyTheme(appState.theme === "dark" ? "light" : "dark");
    });

    document.querySelectorAll("[data-cam]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!engine3d) return;
        engine3d.setPreset(btn.dataset.cam);
      });
    });

    const btnAutoRot = document.getElementById("btnAutoRotate");
    btnAutoRot.addEventListener("click", () => {
      if (!engine3d) return;
      engine3d.autoRotate = !engine3d.autoRotate;
      btnAutoRot.classList.toggle("active", engine3d.autoRotate);
    });

    const btnWire = document.getElementById("btnToggleWire");
    btnWire.addEventListener("click", () => {
      if (!engine3d) return;
      engine3d.showWireframe = !engine3d.showWireframe;
      btnWire.classList.toggle("active", engine3d.showWireframe);
    });
  }

  /* ==================== Main 60-FPS Animation Loop ==================== */
  function startRenderLoop() {
    let metricThrottle = 0;
    function frame(now) {
      const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
      lastFrameTime = now;

      if (appState.activeTab === "lab" && engine3d) {
        const cs = getCase(appState.currentCaseId);
        if (cs.step) {
          cs.step(appState.caseState, dt);
          metricThrottle += dt;
          if (metricThrottle > 0.16) {
            metricThrottle = 0;
            refresh2DAndMetrics(true);
          }
        }
        engine3d.render((eng) => {
          cs.render3D(eng, appState.caseState, now / 1000);
        });
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ==================== Bootstrap ==================== */
  window.addEventListener("DOMContentLoaded", () => {
    const c3d = document.getElementById("canvas3d");
    canvas2d = document.getElementById("canvas2d");
    const hudHover = document.getElementById("hudHoverInfo");

    engine3d = new Engine3D(c3d, (hoverInfo) => {
      hudHover.textContent = hoverInfo
        ? `🔍 拾取数据：${hoverInfo}`
        : "🖱️ 交互提示：左键拖拽旋转 3D 视角 ｜ 滚轮缩放 ｜ 右键或 Shift+拖拽平移 ｜ 悬停节点查看数值";
    });

    initNavigation();
    initSyllabusModal();
    initThemeAndCameraToolbar();

    // Parse URL Hash (#ch2/ch2-case1) if present
    const hash = (window.location.hash || "").replace(/^#/, "");
    const [hCh, hCase] = hash.split("/");
    if (hCh && chapters.some((c) => c.id === hCh)) {
      selectChapter(hCh, hCase);
    } else {
      selectChapter("ch1", "ch1-case1");
    }

    startRenderLoop();
  });
})();
