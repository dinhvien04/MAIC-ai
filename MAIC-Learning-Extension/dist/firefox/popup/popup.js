(() => {
  // src/core/messaging.js
  function extensionAPI(scope = globalThis) {
    if (scope.browser?.runtime) return scope.browser;
    const chrome = scope.chrome;
    if (!chrome?.runtime) throw new Error("Kh\xF4ng t\xECm th\u1EA5y WebExtensions API.");
    const wrap = (owner, name) => (...args) => new Promise((resolve, reject) => {
      owner[name](...args, (result) => {
        const error2 = chrome.runtime.lastError;
        if (error2) reject(new Error(error2.message));
        else resolve(result);
      });
    });
    return {
      runtime: {
        sendMessage: wrap(chrome.runtime, "sendMessage"),
        onMessage: chrome.runtime.onMessage,
        onStartup: chrome.runtime.onStartup,
        getURL: chrome.runtime.getURL.bind(chrome.runtime)
      },
      storage: { onChanged: chrome.storage.onChanged, local: { get: wrap(chrome.storage.local, "get"), set: wrap(chrome.storage.local, "set"), remove: wrap(chrome.storage.local, "remove") } },
      tabs: chrome.tabs && { query: wrap(chrome.tabs, "query"), sendMessage: wrap(chrome.tabs, "sendMessage"), onRemoved: chrome.tabs.onRemoved, onUpdated: chrome.tabs.onUpdated }
    };
  }
  async function request(api2, type, data2 = {}) {
    const response = await api2.runtime.sendMessage({ channel: "maic-learning-v1", type, ...data2 });
    if (!response?.ok) throw new Error(response?.error || "M\u1EA5t k\u1EBFt n\u1ED1i extension. H\xE3y t\u1EA3i l\u1EA1i tab MAIC.");
    return response.result;
  }
  async function tabRequest(api2, tabId, command2, args = {}, expectedUrl) {
    const response = await api2.tabs.sendMessage(tabId, { channel: "maic-learning-v1", type: "COMMAND", command: command2, args, expectedUrl });
    if (!response?.ok) throw new Error(response?.error || "Tab ch\u01B0a k\u1EBFt n\u1ED1i. H\xE3y t\u1EA3i l\u1EA1i trang MAIC.");
    return response.result;
  }

  // src/core/context.js
  var HOSTS = /* @__PURE__ */ new Set(["maic.chat", "learning-feal.maic.chat"]);
  function safeUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && HOSTS.has(url.hostname) && !url.username && !url.password && !url.port ? url : null;
    } catch {
      return null;
    }
  }

  // src/core/notes.js
  var STOP = new Set("the a an and of to in is are for with this that from by as or be on it at we you can will have has was were".split(" "));
  function exportMarkdown(slides) {
    const lines = ["# Ghi ch\xFA h\u1ECDc MAIC", "", "Ghi ch\xFA c\u1EE5c b\u1ED9. Trang \u0111\xE3 \u0111\u1ECDc kh\xF4ng x\xE1c nh\u1EADn ho\xE0n th\xE0nh module.", ""];
    for (const slide of slides) {
      lines.push(
        `## ${slide.moduleTitle || "Module ch\u01B0a r\xF5"} \u2014 ${slide.slideNumber || "?"} / ${slide.totalSlides || "?"}`,
        "",
        `Th\u1EDDi \u0111i\u1EC3m \u0111\u1ECDc: ${slide.extractedAt}`,
        "",
        "### N\u1ED9i dung",
        "",
        slide.content || "(Kh\xF4ng \u0111\u1ECDc \u0111\u01B0\u1EE3c)",
        "",
        "### L\u1EDDi gi\u1EA3ng",
        "",
        slide.transcript || "(Ch\u01B0a \u0111\u1ECDc \u0111\u01B0\u1EE3c)",
        "",
        "### Tr\xEDch \u0111o\u1EA1n",
        "",
        slide.summary || "",
        "",
        "### T\u1EEB kh\xF3a",
        "",
        (slide.keywords || []).join(", "),
        "",
        "### Ghi ch\xFA c\u1EE7a t\xF4i",
        "",
        slide.personalNote || "",
        ""
      );
    }
    return lines.join("\n");
  }

  // src/ui/review-panel.css
  var review_panel_default = '.review-panel { padding: 12px; margin: 12px 0; border: 1px solid #7391a7; border-radius: 11px; background: #edf5f5; color: #17394a; font: 12px/1.5 system-ui,sans-serif; }\n.review-panel .review-title { margin: 0 0 5px; font-size: 12px; letter-spacing: .06em; color: inherit; }\n.review-panel .review-hint { font-size: 11px; margin: 5px 0; color: inherit; opacity: .85; }\n.review-panel .review-module { width: 100%; margin: 6px 0; padding: 6px; color: #17394a; background: #fff; border: 1px solid #a6bbca; border-radius: 6px; font: inherit; }\n.review-panel .review-intervals,.review-panel .review-controls { display: flex; flex-wrap: wrap; gap: 5px; margin: 7px 0; }\n.review-panel button { font: inherit; padding: 5px 7px; color: #17394a; background: #fff; border: 1px solid #9db7c4; border-radius: 6px; cursor: pointer; }\n.review-panel button[aria-pressed="true"] { background: #176b60; color: #fff; border-color: #176b60; }\n.review-panel button:disabled { opacity: .45; cursor: default; }\n.review-panel .review-custom { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; }\n.review-panel .review-custom input { width: 58px; padding: 4px; margin: 0; border: 1px solid #9db7c4; border-radius: 5px; color: #17394a; background: #fff; font: inherit; }\n.review-panel .review-position,.review-panel .review-countdown,.review-panel .review-status { margin: 3px 0; font-weight: 600; }\n.review-panel .review-content { max-height: 240px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; background: #fff; color: #20334c; padding: 9px; border-radius: 7px; font: 12px/1.6 system-ui,sans-serif; margin: 8px 0 0; }\n';

  // src/ui/review-panel.js
  function savedReviewModules(slides, current) {
    const modules = new Map(slides.map((slide) => [slide.moduleId, { id: slide.moduleId, title: slide.moduleTitle || slide.moduleId }]));
    if (current?.moduleId && !modules.has(current.moduleId)) modules.set(current.moduleId, { id: current.moduleId, title: current.moduleTitle || current.moduleId });
    return [...modules.values()];
  }
  var ReviewPanel = class {
    constructor(parent, command2) {
      this.doc = parent.ownerDocument;
      this.command = command2;
      this.events = new this.doc.defaultView.AbortController();
      const el = (tag, className, text) => {
        const node = this.doc.createElement(tag);
        if (className) node.className = className;
        if (text) node.textContent = text;
        return node;
      };
      this.host = el("section", "review-panel");
      this.host.setAttribute("aria-label", "AUTO SLIDE REVIEW");
      parent.append(this.host);
      const style = el("style");
      style.textContent = review_panel_default;
      this.host.append(style);
      this.host.append(el("h2", "review-title", "AUTO SLIDE REVIEW"), el("p", "review-hint", "Xem b\u1EA3n \u0111\xE3 l\u01B0u \xB7 Kh\xF4ng chuy\u1EC3n trang h\u1ECDc MAIC"));
      this.modules = el("select", "review-module");
      this.modules.setAttribute("aria-label", "Module \u0111\u1EC3 xem nhanh");
      this.host.append(this.modules);
      const intervals = el("div", "review-intervals");
      intervals.setAttribute("aria-label", "Interval");
      this.host.append(intervals);
      this.presets = [];
      for (const seconds of [1, 2, 3, 5]) {
        const button = this.button(`${seconds}s`, () => this.run("REVIEW_INTERVAL", { intervalMs: seconds * 1e3 }));
        button.dataset.interval = String(seconds * 1e3);
        this.presets.push(button);
        intervals.append(button);
      }
      const label = el("label", "review-custom", "Custom (s)");
      this.custom = el("input");
      this.custom.type = "number";
      this.custom.min = "0.1";
      this.custom.max = "3600";
      this.custom.step = "0.1";
      this.custom.value = "3";
      this.custom.setAttribute("aria-label", "Custom interval, gi\xE2y");
      label.append(this.custom);
      intervals.append(label);
      this.custom.addEventListener("change", () => this.run("REVIEW_INTERVAL", { intervalMs: Number(this.custom.value) * 1e3 }), { signal: this.events.signal });
      const controls = el("div", "review-controls");
      this.host.append(controls);
      this.controls = {};
      for (const [label2, action] of [["\u25B6 START", "REVIEW_START"], ["\u23F8 PAUSE", "REVIEW_PAUSE"], ["\u25B6 RESUME", "REVIEW_RESUME"], ["\u23F9 STOP", "REVIEW_STOP"]]) {
        const button = this.button(label2, () => this.run(action, { moduleId: this.modules.value }));
        button.dataset.action = action;
        controls.append(button);
        this.controls[action] = button;
      }
      this.position = el("p", "review-position", "Current Slide: ? / ?");
      this.countdown = el("p", "review-countdown", "Next Slide In: \u2014");
      this.status = el("p", "review-status", "Status: Stopped");
      this.status.setAttribute("aria-live", "polite");
      this.reason = el("p", "review-hint");
      this.content = el("pre", "review-content", "B\u1EA5m START \u0111\u1EC3 xem n\u1ED9i dung \u0111\xE3 tr\xEDch xu\u1EA5t.");
      this.host.append(this.position, this.countdown, this.status, this.reason, this.content);
      this.update(null);
    }
    button(label, operation) {
      const button = this.doc.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", operation, { signal: this.events.signal });
      return button;
    }
    async run(action, args) {
      try {
        await this.command(action, args);
      } catch (error2) {
        this.reason.textContent = error2.message;
      }
    }
    update(review, { modules } = {}) {
      this.review = review;
      if (modules) {
        const selected = this.modules.value;
        this.modules.replaceChildren();
        for (const module of modules) {
          const option = this.doc.createElement("option");
          option.value = module.id;
          option.textContent = module.title;
          this.modules.append(option);
        }
        if (modules.some((module) => module.id === selected)) this.modules.value = selected;
        else if (modules.some((module) => module.id === review?.moduleId)) this.modules.value = review.moduleId;
        this.modules.disabled = review?.mode === "reviewing";
      }
      const interval = review?.intervalMs || 3e3;
      for (const button of this.presets) button.setAttribute("aria-pressed", String(+button.dataset.interval === interval));
      if (this.doc.activeElement !== this.custom && this.custom.getRootNode().activeElement !== this.custom) this.custom.value = String(interval / 1e3);
      const labels = { reviewing: "Reviewing", paused: "Paused", blocked: "Stopped \xB7 Missing content", completed: "Stopped \xB7 Last slide", stopped: "Stopped" };
      this.status.textContent = `Status: ${labels[review?.mode] || "Stopped"}`;
      this.position.textContent = `Current Slide: ${review?.currentSlide ?? "?"} / ${review?.totalSlides ?? "?"}`;
      this.reason.textContent = review?.reason || "\u0110\u1ECDc slide hi\u1EC7n t\u1EA1i ho\u1EB7c ch\u1ECDn module c\xF3 n\u1ED9i dung \u0111\xE3 l\u01B0u.";
      const item = review?.item;
      this.content.textContent = item ? [item.moduleTitle, item.content, item.transcript && `\u5206\u9875\u8BB2\u7A3F
${item.transcript}`, item.explanations].filter(Boolean).join("\n\n") : "Ch\u01B0a c\xF3 n\u1ED9i dung trong tr\xECnh xem nhanh.";
      this.controls.REVIEW_PAUSE.disabled = review?.mode !== "reviewing";
      this.controls.REVIEW_RESUME.disabled = !["paused", "blocked"].includes(review?.mode);
      this.controls.REVIEW_START.disabled = review?.mode === "reviewing";
      this.controls.REVIEW_STOP.disabled = !review?.moduleId || review.mode === "stopped";
      this.tick();
    }
    tick(now = Date.now()) {
      const review = this.review;
      const remaining = review?.mode === "reviewing" ? Math.max(0, (review.deadline || now) - now) : review?.remainingMs;
      this.countdown.textContent = `Next Slide In: ${["reviewing", "paused"].includes(review?.mode) ? `${((remaining || 0) / 1e3).toFixed(1)}s` : "\u2014"}`;
    }
    destroy() {
      this.events.abort();
      this.host.remove();
    }
  };

  // src/popup/popup.js
  var api = extensionAPI();
  var $ = (id) => document.getElementById(id);
  var tab;
  var status;
  var data;
  var pending = false;
  var storageTimer;
  var reviewPanel = new ReviewPanel($("review-container"), (action, args) => command(action, args));
  var countdownTimer = setInterval(() => reviewPanel.tick(), 100);
  var MODE = { running: "\u0110ang h\u1ED7 tr\u1EE3", paused: "T\u1EA1m d\u1EEBng", stopped: "\u0110\xE3 d\u1EEBng" };
  var pair = (value) => value ? `${value.completed} / ${value.total}` : "Ch\u01B0a x\xE1c minh";
  function error(message) {
    $("error").hidden = !message;
    $("error").textContent = message || "";
  }
  function bind(id, operation) {
    $(id).addEventListener("click", () => safely(operation));
  }
  async function safely(operation) {
    if (pending) return;
    pending = true;
    error("");
    try {
      await operation();
    } catch (err) {
      error(err.message);
    } finally {
      pending = false;
    }
  }
  async function command(action, args = {}) {
    if (!tab?.id || !safeUrl(tab.url)) throw new Error("H\xE3y m\u1EDF tab https://maic.chat ho\u1EB7c https://learning-feal.maic.chat.");
    status = await tabRequest(api, tab.id, action, args, tab.url);
    await refreshData();
    render();
  }
  async function refreshData() {
    data = await request(api, "GET_DATA", { tabId: tab.id });
  }
  function latestProgress() {
    const values = {};
    for (const { value } of [...data?.progress || []].sort((a, b) => a.value.observedAt.localeCompare(b.value.observedAt))) {
      for (const key of ["modules", "questionnaires", "paper", "pretest", "topic", "finalExam"]) if (value[key] !== null) values[key] = { value: value[key], at: value.observedAt, source: value.sourceUrl };
    }
    return values;
  }
  function render() {
    $("badge").textContent = MODE[status.mode] || "Ch\u01B0a k\u1EBFt n\u1ED1i";
    $("website").textContent = `${new URL(status.url).hostname} \xB7 ${status.pageType}`;
    $("course").textContent = status.slide?.courseTitle || "T\xEAn kh\xF3a ch\u01B0a x\xE1c \u0111\u1ECBnh";
    $("module").textContent = status.slide?.moduleTitle || "M\u1EDF module \u0111\u1EC3 \u0111\u1ECDc n\u1ED9i dung";
    $("slide").textContent = `${status.slide?.slideNumber ?? "?"} / ${status.slide?.totalSlides ?? "?"}`;
    $("reason").textContent = status.reason;
    $("auth").textContent = { "login-required": "C\u1EA7n \u0111\u0103ng nh\u1EADp th\u1EE7 c\xF4ng tr\xEAn website.", "appears-authenticated": "C\xF3 d\u1EA5u hi\u1EC7u \u0111\xE3 \u0111\u0103ng nh\u1EADp; ch\u01B0a x\xE1c minh ph\xEDa m\xE1y ch\u1EE7.", unknown: "Ch\u01B0a x\xE1c \u0111\u1ECBnh tr\u1EA1ng th\xE1i \u0111\u0103ng nh\u1EADp." }[status.auth];
    const classroom = status.pageType === "classroom", running = status.mode === "running";
    for (const id of ["next", "previous", "transcript"]) $(id).disabled = !classroom || !running;
    for (const id of ["read", "notes"]) $(id).disabled = !classroom || status.mode === "stopped";
    $("start").disabled = running || status.auth === "login-required" || status.pageType === "assessment";
    $("pause").disabled = !running;
    $("resume").disabled = status.mode !== "paused";
    $("stop").disabled = status.mode === "stopped";
    $("auto").checked = status.auto === true;
    $("auto").disabled = !running || status.auto === null;
    $("auto-hint").textContent = status.auto === null ? "Ch\u01B0a nh\u1EADn di\u1EC7n \u0111\u01B0\u1EE3c \xF4 \u81EA\u52A8; c\xF3 th\u1EC3 b\u1EADt tr\u1EF1c ti\u1EBFp tr\xEAn MAIC." : "\u81EA\u52A8 d\xF9ng t\xEDn hi\u1EC7u audio c\u1EE7a MAIC; kh\xF4ng tua hay gi\u1EA3 th\u1EDDi gian nghe.";
    $("fast-mode").checked = status.preferences.fastMode;
    $("auto-capture").checked = status.preferences.autoCapture;
    $("profile").textContent = data.profile.startsWith("account:") ? "\u0110\xE3 nh\u1EADn di\u1EC7n t\xE0i kho\u1EA3n qua d\u1EA5u hi\u1EC7u UI; ch\u1EC9 l\u01B0u m\xE3 b\u0103m c\u1EE5c b\u1ED9." : `H\u1ED3 s\u01A1: ${data.profile.replace(/^local:/, "")}`;
    $("profile-notice").hidden = data.profile !== "local:default";
    $("profile-notice").textContent = "Ghi ch\xFA \u0111ang l\u01B0u trong h\u1ED3 s\u01A1 c\u1EE5c b\u1ED9 m\u1EB7c \u0111\u1ECBnh. \u0110\xE2y kh\xF4ng ph\u1EA3i y\xEAu c\u1EA7u \u0111\u0103ng nh\u1EADp. \u0110\u1ED5i h\u1ED3 s\u01A1 trong C\xE0i \u0111\u1EB7t khi \u0111\u1ED5i t\xE0i kho\u1EA3n MAIC.";
    reviewPanel.update(status.review || data.review, { modules: savedReviewModules(data.slides, status.slide) });
    const progress = latestProgress();
    $("official").textContent = pair(progress.modules?.value);
    $("progress-list").replaceChildren();
    for (const [key, label] of [["modules", "Module (to\xE0n b\u1ED9 kh\xF3a)"], ["questionnaires", "Questionnaire"], ["paper", "B\xE0i lu\u1EADn"], ["pretest", "Pre-test"], ["topic", "\u0110\u1EC1 t\xE0i"], ["finalExam", "Final Exam"]]) {
      const item = document.createElement("div");
      item.className = "row";
      const value = progress[key];
      item.textContent = `${label}: ${!value ? "Ch\u01B0a x\xE1c minh" : typeof value.value === "object" ? pair(value.value) : value.value === "locked" ? "\u0110ang kh\xF3a" : value.value}`;
      if (value) {
        const source = document.createElement("small");
        source.textContent = `\u0110\u1ECDc ${new Date(value.at).toLocaleString("vi-VN")} \xB7 ${new URL(value.source).hostname}`;
        item.append(source);
      }
      $("progress-list").append(item);
    }
    $("observed").textContent = "C\xE1c gi\xE1 tr\u1ECB l\xE0 l\u1EA7n quan s\xE1t \u0111\xE3 l\u01B0u, c\xF3 th\u1EC3 ch\u01B0a \u0111\u1ED3ng b\u1ED9. M\u1EDF b\u1EA3ng \u5B66\u4E60\u8FDB\u5EA6, ch\u1ECDn \u5168\u90E8\u8BFE\u7A0B r\u1ED3i b\u1EA5m \u0110\u1ECDc l\u1EA1i ti\u1EBFn \u0111\u1ED9.";
    $("module-list").replaceChildren();
    for (const module of data.modules) {
      const item = document.createElement("div");
      item.className = "row";
      item.textContent = module.title;
      const detail = document.createElement("small");
      detail.textContent = `${module.kind === "course" ? "Kh\xF3a" : "Module"} \xB7 ${module.officialStatus} \xB7 Duy\u1EC7t b\xE0i: ${module.browsingPercent ?? "?"}%`;
      item.append(detail);
      if (module.url || module.sourceUrl === status.url) {
        const open = document.createElement("button");
        open.textContent = "M\u1EDF m\u1EE5c n\xE0y (phi\xEAn h\u1ECDc)";
        open.disabled = !running;
        open.addEventListener("click", () => safely(() => command(module.url ? "OPEN_MODULE" : "OPEN_VISIBLE", module.url ? { url: module.url } : { id: module.id })));
        item.append(open);
      }
      $("module-list").append(item);
    }
    if (!data.modules.length) $("module-list").textContent = "Ch\u01B0a t\xECm th\u1EA5y module c\xF3 c\u1EA5u tr\xFAc \u0111\u1ECDc \u0111\u01B0\u1EE3c tr\xEAn trang hi\u1EC7n t\u1EA1i.";
    $("last-module").disabled = !data.lastModule || !running;
    const selected = $("slide-select").value;
    $("slide-select").replaceChildren();
    for (const [index, slide] of data.slides.entries()) {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${slide.moduleTitle || slide.moduleId} \xB7 ${slide.slideNumber}/${slide.totalSlides || "?"}`;
      $("slide-select").append(option);
    }
    if (selected && data.slides[+selected]) $("slide-select").value = selected;
    else if (status.slide) {
      const current = data.slides.findIndex((slide) => slide.moduleId === status.slide.moduleId && slide.slideNumber === status.slide.slideNumber);
      if (current >= 0) $("slide-select").value = String(current);
    }
    showNote();
  }
  function selectedSlide() {
    return data?.slides[$("slide-select").value];
  }
  function showNote() {
    const slide = selectedSlide();
    $("keywords").replaceChildren();
    for (const word of slide?.keywords || []) {
      const mark = document.createElement("mark");
      mark.textContent = word;
      $("keywords").append(mark);
    }
    $("note-method").textContent = slide?.method || "";
    $("preview").textContent = slide ? [slide.summary, slide.content, slide.transcript, slide.explanations].filter(Boolean).join("\n\n") : "Ch\u01B0a l\u01B0u trang n\xE0o.";
    $("personal").value = slide?.personalNote || "";
    $("save-note").disabled = !slide;
  }
  for (const [id, action] of [["start", "START"], ["next", "NEXT"], ["previous", "PREVIOUS"], ["read", "READ"], ["transcript", "TRANSCRIPT"], ["notes", "NOTES"], ["refresh", "REFRESH"], ["pause", "PAUSE"], ["resume", "RESUME"], ["stop", "STOP"]]) {
    if (["STOP", "PAUSE"].includes(action)) $(id).addEventListener("click", () => command(action).catch((err) => error(err.message)));
    else bind(id, () => command(action));
  }
  $("auto").addEventListener("change", () => safely(() => command("AUTO", { enabled: $("auto").checked })));
  $("slide-select").addEventListener("change", showNote);
  for (const button of document.querySelectorAll("[data-panel]")) button.addEventListener("click", () => {
    for (const other of document.querySelectorAll("[data-panel]")) other.setAttribute("aria-selected", String(other === button));
    for (const panel of document.querySelectorAll(".tab-panel")) panel.hidden = panel.id !== button.dataset.panel;
  });
  bind("last-module", () => command("OPEN_MODULE", { url: data.lastModule.url }));
  bind("set-profile", async () => {
    await command("STOP");
    await request(api, "SET_PROFILE", { tabId: tab.id, name: $("profile-name").value });
    await command("CONFIGURE");
  });
  bind("save-settings", async () => {
    await request(api, "SET_PREFERENCES", { preferences: { fastMode: $("fast-mode").checked, autoCapture: $("auto-capture").checked } });
    await command("CONFIGURE");
  });
  bind("save-note", async () => {
    const slide = selectedSlide();
    if (!slide) return;
    await request(api, "PERSONAL_NOTE", { tabId: tab.id, moduleId: slide.moduleId, slideNumber: slide.slideNumber, text: $("personal").value });
    await refreshData();
  });
  bind("export", () => {
    if (!data?.slides.length) throw new Error("Ch\u01B0a c\xF3 ghi ch\xFA \u0111\u1EC3 xu\u1EA5t.");
    const url = URL.createObjectURL(new Blob([exportMarkdown(data.slides)], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "maic-study-notes.md";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15e3);
  });
  bind("delete-data", () => {
    $("delete-confirm").hidden = false;
  });
  bind("cancel-delete", () => {
    $("delete-confirm").hidden = true;
  });
  bind("confirm-delete", async () => {
    await command("STOP");
    await request(api, "DELETE_PROFILE", { tabId: tab.id });
    $("delete-confirm").hidden = true;
    await refreshData();
    render();
  });
  async function init() {
    [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (!safeUrl(tab?.url)) throw new Error("M\u1EDF tab MAIC r\u1ED3i b\u1EA5m l\u1EA1i extension. Sau khi c\xE0i extension l\u1EA7n \u0111\u1EA7u, t\u1EA3i l\u1EA1i tab MAIC.");
    await command("STATUS");
  }
  init().catch((err) => {
    error(err.message);
    for (const button of document.querySelectorAll(".actions button")) button.disabled = true;
  });
  api.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !tab || !status) return;
    const update = changes[`tab:${tab.id}`]?.newValue;
    if (update) status = update;
    if (storageTimer || !update && !Object.keys(changes).some((key) => key.startsWith(`data:${data?.profile}:`))) return;
    storageTimer = setTimeout(async () => {
      storageTimer = null;
      reviewPanel.update(status.review || data?.review);
      if (document.activeElement?.matches("input,textarea,select")) return;
      try {
        await refreshData();
        render();
      } catch (err) {
        error(err.message);
      }
    }, 150);
  });
  window.addEventListener("unload", () => {
    clearTimeout(storageTimer);
    clearInterval(countdownTimer);
    reviewPanel.destroy();
  });
})();
