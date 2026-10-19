(() => {
  // src/core/messaging.js
  function extensionAPI(scope = globalThis) {
    if (scope.browser?.runtime) return scope.browser;
    const chrome = scope.chrome;
    if (!chrome?.runtime) throw new Error("Kh\xF4ng t\xECm th\u1EA5y WebExtensions API.");
    const wrap = (owner, name) => (...args) => new Promise((resolve, reject) => {
      owner[name](...args, (result) => {
        const error = chrome.runtime.lastError;
        if (error) reject(new Error(error.message));
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
  function listen(event, handler) {
    const listener = (message, sender, respond) => {
      if (message?.channel !== "maic-learning-v1") return false;
      Promise.resolve().then(() => handler(message, sender)).then(
        (result) => respond({ ok: true, result }),
        (error) => respond({ ok: false, error: error.message })
      );
      return true;
    };
    event.addListener(listener);
    return () => event.removeListener(listener);
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
  function cleanUrl(value) {
    const url = safeUrl(value);
    return url ? `${url.origin}${url.pathname}` : null;
  }
  function classroomIds(value) {
    const url = safeUrl(value);
    const match = url?.hostname === "maic.chat" && url.pathname.match(/^\/classroom\/([\w-]+)\/([\w-]+)\/([\w-]+)\/?$/);
    return match ? { courseId: match[1], chapterId: match[2], moduleId: match.slice(1).join("/") } : null;
  }

  // src/core/storage.js
  var DEFAULT_PROFILE = "local:default";
  var Store = class {
    constructor(local) {
      this.local = local;
      this.queue = Promise.resolve();
    }
    transact(operation) {
      const result = this.queue.then(operation);
      this.queue = result.catch(() => {
      });
      return result;
    }
    async get(key, fallback = null) {
      return (await this.local.get(key))[key] ?? fallback;
    }
    async put(key, value) {
      await this.local.set({ [key]: value });
      return value;
    }
    async patchTab(id, patch) {
      return this.put(`tab:${id}`, { ...await this.get(`tab:${id}`, { mode: "stopped", profile: DEFAULT_PROFILE }), ...patch });
    }
    async data(profile) {
      const all2 = await this.local.get(null), prefix = `data:${profile}:`;
      const rows = Object.entries(all2).filter(([key]) => key.startsWith(prefix)).map(([, value]) => value);
      return {
        slides: rows.filter((x) => x.recordType === "slide").sort((a, b) => a.moduleId.localeCompare(b.moduleId) || a.slideNumber - b.slideNumber),
        modules: rows.filter((x) => x.recordType === "module"),
        progress: rows.filter((x) => x.recordType === "progress"),
        lastModule: await this.get(`last:${profile}`)
      };
    }
    async saveSlide(profile, slide, { notes = false } = {}) {
      if (!slide.moduleId || !slide.slideNumber || !safeUrl(slide.url)) throw new Error("Ch\u01B0a x\xE1c \u0111\u1ECBnh module/trang; kh\xF4ng l\u01B0u v\xE0o nh\u1EA7m b\xE0i.");
      const key = `data:${profile}:slide:${encodeURIComponent(slide.moduleId)}:${slide.slideNumber}`;
      const previous = await this.get(key, {});
      const { slides } = await this.data(profile);
      if (!previous.moduleId && slides.length >= 600) throw new Error("\u0110\xE3 l\u01B0u 600 trang trong h\u1ED3 s\u01A1 n\xE0y. Xu\u1EA5t v\xE0 x\xF3a d\u1EEF li\u1EC7u tr\u01B0\u1EDBc khi \u0111\u1ECDc th\xEAm.");
      const value = {
        recordType: "slide",
        moduleId: String(slide.moduleId).slice(0, 300),
        moduleTitle: slide.moduleTitle?.slice(0, 350) || previous.moduleTitle || null,
        courseTitle: slide.courseTitle?.slice(0, 350) || previous.courseTitle || null,
        slideNumber: slide.slideNumber,
        totalSlides: slide.totalSlides,
        url: cleanUrl(slide.url),
        content: slide.content?.slice(0, 24e3) || previous.content || "",
        transcript: slide.transcript?.slice(0, 24e3) || previous.transcript || "",
        explanations: slide.explanations?.slice(0, 12e3) || previous.explanations || "",
        extractedAt: slide.extractedAt,
        summary: notes ? slide.summary : previous.summary || "",
        keywords: notes ? slide.keywords : previous.keywords || [],
        method: notes ? slide.method : previous.method || "",
        personalNote: previous.personalNote || ""
      };
      await this.put(key, value);
      await this.put(`last:${profile}`, { moduleId: value.moduleId, moduleTitle: value.moduleTitle, url: value.url, slideNumber: value.slideNumber, visitedAt: value.extractedAt });
      return value;
    }
    async personalNote(profile, moduleId, slideNumber, text) {
      const key = `data:${profile}:slide:${encodeURIComponent(moduleId)}:${slideNumber}`;
      const previous = await this.get(key);
      if (!previous) throw new Error("H\xE3y \u0111\u1ECDc trang tr\u01B0\u1EDBc khi l\u01B0u ghi ch\xFA.");
      return this.put(key, { ...previous, personalNote: String(text).slice(0, 12e3) });
    }
    async saveObservation(profile, { modules = [], progress = null }) {
      for (const module of modules.slice(0, 150)) {
        await this.put(`data:${profile}:module:${encodeURIComponent(module.id)}`, { ...module, recordType: "module" });
        if (module.sourceUrl === module.url && classroomIds(module.url)) await this.put(`last:${profile}`, {
          moduleId: module.id,
          moduleTitle: module.title,
          url: module.url,
          visitedAt: module.observedAt
        });
      }
      if (progress && Object.entries(progress).some(([key, value]) => ["modules", "questionnaires", "paper", "pretest", "topic", "finalExam"].includes(key) && value !== null)) {
        const key = `data:${profile}:progress:${encodeURIComponent(progress.sourceUrl)}:${progress.scope}`;
        const previous = await this.get(key);
        const comparable = ({ observedAt, ...value }) => JSON.stringify(value);
        if (!previous || comparable(previous.value) !== comparable(progress)) await this.put(key, { recordType: "progress", value: progress });
      }
    }
    async deleteProfile(profile) {
      const values = await this.local.get(null);
      const keys = Object.keys(values).filter((key) => key.startsWith(`data:${profile}:`) || key === `last:${profile}`);
      if (keys.length) await this.local.remove(keys);
    }
  };

  // src/core/sender.js
  function classifySender(sender, extensionId, extensionRoot) {
    if (sender.id !== extensionId) throw new Error("Ngu\u1ED3n g\u1EEDi kh\xF4ng h\u1EE3p l\u1EC7.");
    if (sender.url?.startsWith(extensionRoot) && new URL(sender.url).pathname === "/popup/popup.html") return "ui";
    if (Number.isInteger(sender.tab?.id) && safeUrl(sender.url || sender.tab.url) && (sender.frameId ?? 0) === 0) return "content";
    throw new Error("Ngu\u1ED3n g\u1EEDi kh\xF4ng ph\u1EA3i tab MAIC ch\xEDnh ho\u1EB7c giao di\u1EC7n extension.");
  }

  // src/background/background.js
  var api = extensionAPI();
  var store = new Store(api.storage.local);
  listen(api.runtime.onMessage, (message, sender) => store.transact(async () => {
    const runtime = (globalThis.browser || globalThis.chrome).runtime;
    const fromTab = classifySender(sender, runtime.id, runtime.getURL("")) === "content";
    const tabId = fromTab ? sender.tab.id : message.tabId;
    const tab = Number.isInteger(tabId) ? await store.get(`tab:${tabId}`, { mode: "stopped", profile: DEFAULT_PROFILE, manualProfile: DEFAULT_PROFILE }) : null;
    switch (message.type) {
      case "HELLO":
        if (!fromTab) throw new Error("HELLO ch\u1EC9 d\xE0nh cho content script.");
        return { tab, preferences: await store.get("preferences", { fastMode: true, autoCapture: true }) };
      case "TAB_STATUS":
        if (!fromTab) throw new Error("Kh\xF4ng c\xF3 tab.");
        return store.patchTab(tabId, { ...message.status, url: cleanUrl(sender.url || sender.tab.url) });
      case "SAVE_SLIDE":
        if (!fromTab || !["running", "paused"].includes(tab.mode)) throw new Error("Tr\u1EE3 l\xFD \u0111ang d\u1EEBng.");
        return store.saveSlide(tab.profile, message.slide, { notes: Boolean(message.notes) });
      case "SAVE_OBSERVATION":
        if (!fromTab || tab.mode === "stopped") throw new Error("Tr\u1EE3 l\xFD \u0111ang d\u1EEBng.");
        await store.saveObservation(tab.profile, message.observation);
        return true;
      case "GET_DATA":
        if (fromTab || !tab) throw new Error("H\xE3y ch\u1ECDn m\u1ED9t tab MAIC.");
        return { ...await store.data(tab.profile), profile: tab.profile, tab };
      case "PERSONAL_NOTE":
        if (fromTab || !tab) throw new Error("Ngu\u1ED3n g\u1EEDi kh\xF4ng h\u1EE3p l\u1EC7.");
        return store.personalNote(tab.profile, message.moduleId, message.slideNumber, message.text);
      case "SET_PROFILE": {
        if (fromTab || !tab) throw new Error("Ngu\u1ED3n g\u1EEDi kh\xF4ng h\u1EE3p l\u1EC7.");
        const name = String(message.name || "").trim();
        if (!/^[\p{L}\p{N} _-]{1,40}$/u.test(name)) throw new Error("T\xEAn h\u1ED3 s\u01A1 c\u1EA7n 1\u201340 ch\u1EEF/s\u1ED1, d\u1EA5u c\xE1ch, _ ho\u1EB7c -.");
        const profile = `local:${name}`;
        await store.patchTab(tabId, { mode: "stopped", profile, manualProfile: profile, profileOverride: true });
        return profile;
      }
      case "SET_PREFERENCES":
        if (fromTab) throw new Error("Ch\u1EC9 s\u1EEDa c\xE0i \u0111\u1EB7t t\u1EEB popup.");
        return store.put("preferences", { fastMode: Boolean(message.preferences.fastMode), autoCapture: Boolean(message.preferences.autoCapture) });
      case "DELETE_PROFILE":
        if (fromTab || !tab || tab.mode !== "stopped") throw new Error("D\u1EEBng tr\u1EE3 l\xFD tr\u01B0\u1EDBc khi x\xF3a d\u1EEF li\u1EC7u.");
        await store.deleteProfile(tab.profile);
        return true;
      default:
        throw new Error("Th\xF4ng \u0111i\u1EC7p kh\xF4ng \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3.");
    }
  }));
  api.tabs.onRemoved.addListener((tabId) => {
    store.transact(() => api.storage.local.remove(`tab:${tabId}`)).catch(console.error);
  });
  api.tabs.onUpdated.addListener((tabId, change, tab) => {
    if (change.url && safeUrl(tab.url)) api.tabs.sendMessage(tabId, { channel: "maic-learning-v1", type: "COMMAND", command: "ROUTE" }).catch(() => {
    });
  });
  api.runtime.onStartup.addListener(() => {
    store.transact(async () => {
      const all2 = await api.storage.local.get(null);
      const keys = Object.keys(all2).filter((key) => key.startsWith("tab:"));
      if (keys.length) await api.storage.local.remove(keys);
    }).catch(console.error);
  });
})();
