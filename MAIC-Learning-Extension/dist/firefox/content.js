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
  async function request(api, type, data = {}) {
    const response = await api.runtime.sendMessage({ channel: "maic-learning-v1", type, ...data });
    if (!response?.ok) throw new Error(response?.error || "M\u1EA5t k\u1EBFt n\u1ED1i extension. H\xE3y t\u1EA3i l\u1EA1i tab MAIC.");
    return response.result;
  }

  // src/utils/selectors.js
  var normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
  function visible(element) {
    if (!element || element.closest?.('[hidden],[aria-hidden="true"],[data-maic-extension]')) return false;
    for (let node = element; node?.nodeType === 1; node = node.parentElement) {
      const style = node.ownerDocument.defaultView?.getComputedStyle(node);
      if (style?.display === "none" || style?.visibility === "hidden") return false;
    }
    return true;
  }
  function textOf(element) {
    if (!element || !visible(element)) return "";
    const lines = [];
    const walk = (node) => {
      if (node.nodeType === 3) {
        lines.push(node.textContent);
        return;
      }
      if (node.nodeType !== 1 && node.nodeType !== 11) return;
      if (node.nodeType === 1 && (node.matches('script,style,noscript,input,textarea,select,[contenteditable="true"],[data-maic-extension]') || !visible(node))) return;
      const block = node.nodeType === 1 && /^(DIV|P|SECTION|ARTICLE|LI|H[1-6]|TR|BR|ASIDE|HEADER|NAV|MAIN)$/.test(node.tagName);
      if (block) lines.push("\n");
      for (const child of node.childNodes) walk(child);
      if (block) lines.push("\n");
    };
    walk(element);
    return lines.join("").replace(/[ \t]+/g, " ").replace(/\n\s*\n/g, "\n").trim().slice(0, 48e3);
  }
  function rootsFor(doc) {
    const roots = [doc], blocked = [];
    for (let index = 0; index < roots.length && index < 24; index++) {
      for (const element of roots[index].querySelectorAll("*")) {
        if (element.shadowRoot && visible(element)) roots.push(element.shadowRoot);
        if (element.tagName === "IFRAME" && visible(element)) {
          try {
            const child = element.contentDocument;
            if (child?.documentElement) roots.push(child);
            else blocked.push(element);
          } catch {
            blocked.push(element);
          }
        }
      }
    }
    return { roots: [...new Set(roots)].slice(0, 24), blocked };
  }
  function all(roots, selector) {
    return roots.flatMap((root) => [...root.querySelectorAll(selector)]).filter(visible);
  }
  function labelOf(element) {
    if (!element) return "";
    return normalize(element.getAttribute("aria-label") || element.getAttribute("title") || textOf(element));
  }
  function exactControls(roots, labels) {
    const candidates = all(roots, 'button,a,[role="button"],[role="tab"],label,div,span,b,strong,h2,h3');
    return candidates.filter((el) => labels.includes(normalize(el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent)) && labels.includes(labelOf(el)) && ![...el.children].some((child) => labels.includes(labelOf(child))));
  }
  function disabled(element) {
    return element.matches(":disabled") || element.getAttribute("aria-disabled") === "true" || element.hasAttribute("disabled") || element.closest("[inert]") !== null;
  }
  function uniqueControl(roots, labels) {
    const controls = exactControls(roots, labels).map((el) => el.closest('button,[role="button"],a,label') || el);
    const unique = [...new Set(controls)].filter((el) => !disabled(el));
    if (unique.length !== 1) throw new Error(unique.length ? `Nhi\u1EC1u n\xFAt \u201C${labels[0]}\u201D; c\u1EA7n ch\u1ECDn tr\u1EF1c ti\u1EBFp tr\xEAn trang.` : `Kh\xF4ng th\u1EA5y n\xFAt \u201C${labels[0]}\u201D kh\u1EA3 d\u1EE5ng.`);
    const element = unique[0];
    if (element.closest("form") || element.matches('button[type="submit"],input')) throw new Error("Kh\xF4ng thao t\xE1c n\xFAt trong bi\u1EC3u m\u1EABu.");
    return element;
  }
  function waitFor(doc, predicate, { signal, timeout = 6e3 } = {}) {
    return new Promise((resolve, reject) => {
      let observer, timer;
      const cleanup = () => {
        observer?.disconnect();
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        doc.removeEventListener("load", check, true);
      };
      const abort = () => {
        cleanup();
        reject(new Error("Thao t\xE1c \u0111\xE3 h\u1EE7y."));
      };
      const check = () => {
        try {
          const value = predicate();
          if (value) {
            cleanup();
            resolve(value);
            return true;
          }
        } catch (error) {
          cleanup();
          reject(error);
          return true;
        }
        return false;
      };
      if (signal?.aborted) return abort();
      if (check()) return;
      observer = new doc.defaultView.MutationObserver(check);
      for (const root of rootsFor(doc).roots) observer.observe(root.documentElement || root, { subtree: true, childList: true, characterData: true, attributes: true });
      doc.addEventListener("load", check, true);
      timer = setTimeout(() => {
        cleanup();
        reject(new Error("H\u1EBFt th\u1EDDi gian ch\u1EDD giao di\u1EC7n. Kh\xF4ng t\u1EF1 b\u1EA5m l\u1EA1i."));
      }, timeout);
      signal?.addEventListener("abort", abort, { once: true });
    });
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
  function pageType(value) {
    const url = safeUrl(value);
    if (!url) return "unsupported";
    if (/\/(login|signin|forgot-password)(\/|$)/i.test(url.pathname)) return "login";
    if (/\/(exam|assessment|pre-?test|quiz|test)(\/|$)/i.test(url.pathname)) return "assessment";
    if (classroomIds(value)) return "classroom";
    if (url.hostname === "learning-feal.maic.chat" && url.pathname === "/dashboard") return "dashboard";
    if (url.hostname === "maic.chat") {
      if (url.pathname === "/my_study") return "my-learning";
      if (/^\/course_introduction\/[\w-]+\/?$/.test(url.pathname)) return "course-introduction";
      if (url.pathname === "/") return "main";
    }
    return "unknown";
  }
  function authState(doc, roots = [doc], url = doc.URL) {
    if (pageType(url) === "login" || all(roots, 'input[type="password"]').length) return "login-required";
    if (all(roots, '[data-account-id],[data-user-id],[data-testid="account-name"],a[href*="logout"]').length || ["classroom", "dashboard"].includes(pageType(url))) return "appears-authenticated";
    return "unknown";
  }
  function accountMarker(roots) {
    const element = all(roots, '[data-account-id],[data-user-id],[data-testid="account-name"]').at(0);
    return element ? normalize(element.getAttribute("data-account-id") || element.getAttribute("data-user-id") || textOf(element)).slice(0, 256) : null;
  }
  async function accountProfile(marker, cryptoAPI = globalThis.crypto) {
    const bytes = await cryptoAPI.subtle.digest("SHA-256", new TextEncoder().encode(marker));
    return `account:${[...new Uint8Array(bytes)].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
  }
  function moduleContext(roots, url) {
    const ids = classroomIds(url);
    const breadcrumb = all(roots, 'nav[aria-label*="breadcrumb" i],[role="navigation"][aria-label*="breadcrumb" i],[data-testid="breadcrumb"],.ant-breadcrumb').at(0);
    let parts = breadcrumb ? textOf(breadcrumb).split(/\s*[\/›>]\s*|\n/).map(normalize).filter(Boolean) : [];
    if (parts.length < 2) {
      const headings = all(roots, "h1,h2,header [title]");
      const title = headings.map(textOf).find((text) => text.includes(" / ") && text.length < 500);
      if (title) parts = title.split(" / ").map(normalize);
    }
    if (parts.length < 2) {
      const titles = all(roots, "div,span").filter((el) => el.children.length < 4).map(textOf).filter((text) => text.length < 500 && text.split(/\s+\/\s+/).length === 3);
      if (new Set(titles).size === 1) parts = titles[0].split(/\s+\/\s+/).map(normalize);
    }
    return {
      ...ids,
      courseTitle: parts.length >= 2 ? parts[0] : null,
      moduleTitle: parts.length >= 2 ? parts.at(-1) : null,
      url: cleanUrl(url)
    };
  }

  // src/content/slide-reader.js
  function parseCounter(value) {
    const match = normalize(value).match(/^(\d{1,4})\s*\/\s*(\d{1,4})$/);
    if (!match) return null;
    const current = +match[1], total = +match[2];
    return current > 0 && current <= total && total <= 2e3 ? { current, total } : null;
  }
  function slideCounter(roots) {
    const candidates = all(roots, '[data-slide-counter],[aria-label*="slide" i],[role="status"],span,div,p').filter((el) => el.children.length <= 3).map((el) => parseCounter(textOf(el))).filter(Boolean);
    const values = [...new Map(candidates.map((x) => [`${x.current}/${x.total}`, x])).values()];
    return values.length === 1 ? values[0] : null;
  }
  function activityState(roots, url = "") {
    const text = roots.map((root) => textOf(root.body || root)).join("\n");
    if (/\/(exam|assessment|pre-?test|quiz)(\/|$)/i.test(new URL(url || "https://maic.chat/").pathname)) return "assessment";
    if (/(单选题|多选题|判断题|查看解析|提交答案|开始考试|开始前测|Single.choice question|Multiple.choice question)/i.test(text) || all(roots, '[data-quiz],input[type="radio"],input[type="checkbox"][name*="answer" i]').length || exactControls(roots, ["\u5B8C\u6210", "Finish"]).length) return "question";
    return null;
  }
  function readTranscript(roots, slide) {
    const sections = all(roots, '[data-transcript],[role="tabpanel"],[aria-label="\u5206\u9875\u8BB2\u7A3F"],[aria-label="Page Transcript"]');
    for (const header of exactControls(roots, ["\u5206\u9875\u8BB2\u7A3F", "Page Transcript"])) {
      for (let parent = header.parentElement, depth = 0; parent && depth < 5 && !parent.matches("body,main,html"); parent = parent.parentElement, depth++) {
        const text = textOf(parent);
        if (/P\s*\d+\s*页/.test(text) && text.length < 3e4) {
          sections.push(parent);
          break;
        }
      }
    }
    let texts = sections.filter((el) => el.hasAttribute("data-transcript") || /讲稿|transcript/i.test(el.getAttribute("aria-label") || "") || /P\s*\d+\s*页/.test(textOf(el))).map(textOf);
    if (slide) texts = texts.map((text) => {
      const matches = [...text.matchAll(/P\s*(\d+)\s*页/g)];
      if (!matches.length) return text;
      const index = matches.findIndex((match) => +match[1] === slide.current);
      return index < 0 ? "" : text.slice(matches[index].index, matches[index + 1]?.index);
    });
    return [...new Set(texts.filter(Boolean))].join("\n").slice(0, 24e3);
  }
  function readSlide(doc, url = doc.URL) {
    const { roots, blocked } = rootsFor(doc);
    const slide = slideCounter(roots), context = moduleContext(roots, url);
    const elements = all(roots, '[data-slide-content],a2mpage,[role="document"][aria-label*="slide" i],.slide-content');
    for (const root of roots) if (root.nodeType === 9 && root !== doc && root.body) {
      const frame = root.defaultView?.frameElement;
      const label = frame && ["title", "name", "aria-label"].map((name) => frame.getAttribute(name) || "").join(" ");
      if (frame && (/a2mpage|slide|课件/i.test(label) || frame.closest("a2mpage,[data-slide-content]"))) elements.push(root.body);
    }
    const activeSelector = `[aria-current="page"],[aria-current="true"],[data-active="true"],[data-slide-number="${slide?.current}"],[data-page="${slide?.current}"]`;
    const activeElements = elements.filter((element) => element.closest(activeSelector) || element.ownerDocument.defaultView?.frameElement?.matches(activeSelector));
    const texts = [...new Set((activeElements.length ? activeElements : elements).map(textOf).filter(Boolean))];
    const ambiguous = texts.length > 1;
    const content = texts.length === 1 ? texts[0].slice(0, 24e3) : "";
    const transcript = readTranscript(roots, slide);
    const explanations = all(roots, '[data-explanation],[aria-label="AI Teacher"],[aria-label="\u8BFE\u7A0B\u89E3\u6790"]').map(textOf).join("\n").slice(0, 12e3);
    return {
      ...context,
      slideNumber: slide?.current ?? null,
      totalSlides: slide?.total ?? null,
      content,
      transcript,
      explanations,
      activity: activityState(roots, url),
      extractedAt: (/* @__PURE__ */ new Date()).toISOString(),
      diagnostic: ambiguous ? "Nhi\u1EC1u v\xF9ng slide c\xF9ng hi\u1EC3n th\u1ECB, ch\u01B0a x\xE1c \u0111\u1ECBnh trang hi\u1EC7n t\u1EA1i. H\xE3y d\xF9ng \u5206\u9875\u8BB2\u7A3F ho\u1EB7c ch\u1ECDn slide tr\u1EF1c ti\u1EBFp tr\xEAn MAIC." : blocked.length ? "M\u1ED9t s\u1ED1 iframe kh\xE1c origin kh\xF4ng \u0111\u1ECDc \u0111\u01B0\u1EE3c. Ch\u1EC9 l\u01B0u ph\u1EA7n v\u0103n b\u1EA3n truy c\u1EADp \u0111\u01B0\u1EE3c." : !content && !transcript ? "Ch\u01B0a th\u1EA5y v\u0103n b\u1EA3n slide. H\xE3y m\u1EDF \u5206\u9875\u8BB2\u7A3F; n\u1ED9i dung c\xF3 th\u1EC3 l\xE0 \u1EA3nh/canvas ho\u1EB7c khung kh\xF4ng truy c\u1EADp \u0111\u01B0\u1EE3c." : null
    };
  }

  // src/content/progress-reader.js
  function parseProgress(text) {
    const readPair = (regex) => {
      const m = text.match(regex);
      return m && +m[1] <= +m[2] && +m[2] > 0 ? { completed: +m[1], total: +m[2] } : null;
    };
    const modules = readPair(/已完成\s*(\d+)\s*\/\s*共\s*(\d+)\s*个模块/);
    const questionnaires = readPair(/(\d+)\s*\/\s*(\d+)\s*已完成问卷/) || readPair(/(?:Questionnaires?|调查问卷|问卷)\s*[:：]?\s*(\d+)\s*\/\s*(\d+)/i);
    const paper = readPair(/(\d+)\s*\/\s*(\d+)\s*论文提交/) || readPair(/(?:Research Paper|论文|研究论文|Bài luận)\s*[:：]?\s*(\d+)\s*\/\s*(\d+)/i);
    const pretest = /前测尚未开放|学完全部必修模块后即可开始前测|完成全部必修模块后即可参加前测/.test(text) ? "locked" : null;
    const topic = /暂无课题（未解锁）|暂无课题\s*\(未解锁\)/.test(text) ? "locked" : null;
    const finalExam = text.match(/(?:Final Exam|期末考试|最终测评)\s*[:：]?\s*(已完成|未完成|未开放|已锁定|Completed|Not completed|Locked)/i)?.[1] || null;
    return { modules, questionnaires, paper, pretest, topic, finalExam };
  }
  function readProgress(roots, url) {
    const panels = all(roots, '[role="dialog"],[data-progress-panel],section,aside,[role="tabpanel"]');
    const panel = panels.find((el) => /已完成\s*\d+\s*\/\s*共\s*\d+\s*个模块/.test(textOf(el))) || null;
    const bodyText = roots.map((root) => textOf(root.body || root)).join("\n");
    const text = panel ? textOf(panel) : bodyText;
    const values = parseProgress(text);
    const allCourses = /全部课程(?:总览)?|All Courses/i.test(text) && !/当前知识库\s*[:：]?\s*(?!全部课程)[A-Za-z]/.test(text);
    if (!allCourses) values.modules = null;
    const sidebar = parseProgress(bodyText);
    for (const key of ["pretest", "topic", "finalExam"]) if (values[key] === null) values[key] = sidebar[key];
    const details = [];
    for (const element of all(roots, "li,tr,[data-questionnaire]")) {
      const line = normalize(textOf(element));
      if (line.length < 400 && /调查问卷|学习与思维能力调查|后测问卷|Post.test Survey/i.test(line)) {
        details.push({ label: line, status: /未完成|Not completed/i.test(line) ? "not-completed" : /已完成|Completed/i.test(line) ? "completed" : "unknown" });
      }
    }
    return {
      ...values,
      questionnaireDetails: details,
      scope: allCourses ? "all-courses" : "unverified-scope",
      sourceUrl: url,
      observedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }

  // src/core/module-manager.js
  function moduleEntries(roots, pageUrl) {
    const results = [];
    for (const element of all(roots, 'a[href],li,[role="treeitem"],[data-module-id]')) {
      const href = element.getAttribute("href");
      const target = href ? safeUrl(new URL(href, pageUrl).href) : null;
      const ids = target && classroomIds(target.href);
      const courseLink = target?.hostname === "maic.chat" && /^\/course_introduction\/[\w-]+\/?$/.test(target.pathname);
      const row = element.closest('li,article,tr,[role="treeitem"],[data-module-id]') || element;
      const raw = textOf(row);
      if (!ids && !courseLink && !element.matches('[data-module-id],[role="treeitem"]') || raw.length > 1400) continue;
      const title = normalize(textOf(element.querySelector("h2,h3,[data-module-title]") || element)).replace(/(?:已学完|已完成|未开始|未完成|已学习\s*\d+(?:\.\d+)?%)/g, "").trim().slice(0, 350);
      if (!title) continue;
      const percent = raw.match(/(?:已学习\s*)?(\d+(?:\.\d+)?)%/)?.[1];
      results.push({ element, module: {
        id: ids?.moduleId || (target ? target.pathname : `visible:${title}`),
        title,
        kind: courseLink ? "course" : "module",
        url: target ? cleanUrl(target.href) : null,
        officialStatus: /未完成|未开始/.test(raw) ? "not-completed" : /已学完|已完成/.test(raw) ? "completed" : "unknown",
        browsingPercent: percent !== void 0 && +percent <= 100 ? +percent : null,
        sourceUrl: cleanUrl(pageUrl),
        observedAt: (/* @__PURE__ */ new Date()).toISOString()
      } });
    }
    for (const action of exactControls(roots, ["\u5F00\u59CB\u5B66\u4E60", "\u7EE7\u7EED\u5B66\u4E60", "\u53BB\u590D\u4E60"])) {
      for (let row = action.parentElement, depth = 0; row && depth < 6 && !row.matches("body,main,html"); row = row.parentElement, depth++) {
        const raw = textOf(row), percentages = [...raw.matchAll(/已学习\s*(\d+(?:\.\d+)?)%/g)];
        if (percentages.length !== 1 || raw.length > 1200) continue;
        const lines = raw.split("\n").map(normalize).filter(Boolean);
        const index = lines.findIndex((line) => /^已学习\s*\d+(?:\.\d+)?%$/.test(line));
        const title = index >= 2 ? lines[index - 2] : null;
        if (!title || /^(正在学习|已学完|长期有效)$/.test(title)) continue;
        results.push({
          element: action.closest('button,[role="button"]') || action,
          module: {
            id: `course-visible:${title}`,
            title,
            kind: "course",
            url: null,
            officialStatus: "unknown",
            browsingPercent: +percentages[0][1],
            sourceUrl: cleanUrl(pageUrl),
            observedAt: (/* @__PURE__ */ new Date()).toISOString()
          }
        });
        break;
      }
    }
    return results;
  }
  function discoverModules(roots, pageUrl) {
    return [...new Map(moduleEntries(roots, pageUrl).map((item) => [item.module.id, item.module])).values()];
  }
  function allowedLessonUrl(url) {
    return Boolean(classroomIds(url) || safeUrl(url)?.hostname === "maic.chat" && /^\/course_introduction\/[\w-]+\/?$/.test(safeUrl(url).pathname));
  }

  // src/content/learning-assistant.js
  async function revealProgress(doc, state) {
    const roots = rootsFor(doc).roots;
    if (all(roots, '[role="dialog"],[data-progress-panel],section').some((el) => /已完成\s*\d+\s*\/\s*共\s*\d+\s*个模块/.test(textOf(el)))) return;
    const labels = [...new Set(all(roots, 'button,[role="button"],div,span').filter((el) => el.children.length < 3).map(textOf).filter((text) => /^(?:学习进度|Learning Progress|Progress)\s*(?:\d{1,3}%\s*)?$/.test(text)))];
    if (labels.length !== 1) throw new Error("H\xE3y m\u1EDF b\u1EA3ng \u5B66\u4E60\u8FDB\u5EA6 tr\xEAn MAIC v\xE0 ch\u1ECDn \u5168\u90E8\u8BFE\u7A0B r\u1ED3i \u0111\u1ECDc l\u1EA1i.");
    const checkpoint = state.checkpoint();
    uniqueControl(roots, labels).click();
    await waitFor(doc, () => /已完成\s*\d+\s*\/\s*共\s*\d+\s*个模块/.test(textOf(doc.body)), { signal: checkpoint.signal });
  }

  // src/core/state.js
  var StudyState = class {
    constructor() {
      this.mode = "stopped";
      this.reason = "Ch\u01B0a b\u1EADt tr\u1EE3 l\xFD.";
      this.generation = 0;
      this.abort = new AbortController();
    }
    set(mode, reason) {
      if (!["running", "paused", "stopped"].includes(mode)) throw new Error("Tr\u1EA1ng th\xE1i kh\xF4ng h\u1EE3p l\u1EC7.");
      this.abort.abort();
      this.abort = new AbortController();
      this.generation++;
      this.mode = mode;
      this.reason = reason;
    }
    assertRunning() {
      if (this.mode !== "running") throw new Error("Tr\u1EE3 l\xFD ch\u01B0a ch\u1EA1y ho\u1EB7c \u0111ang t\u1EA1m d\u1EEBng.");
    }
    checkpoint() {
      return { generation: this.generation, signal: this.abort.signal };
    }
    valid(checkpoint) {
      return !checkpoint.signal.aborted && checkpoint.generation === this.generation;
    }
  };

  // src/core/navigation.js
  function autoControl(doc) {
    const { roots } = rootsFor(doc);
    const controls = all(roots, 'input[type="checkbox"],[role="checkbox"]').filter((element) => {
      const labels = element.labels ? [...element.labels] : [];
      return [labelOf(element), ...labels.map(labelOf), labelOf(element.closest("label"))].some((text) => /^(自动|Automatic|Auto)$/.test(text));
    });
    return controls.length === 1 ? controls[0] : null;
  }
  function autoState(doc) {
    const control = autoControl(doc);
    if (!control) return null;
    return control.matches("input") ? control.checked : control.getAttribute("aria-checked") === "true";
  }
  function setAuto(doc, enabled) {
    const control = autoControl(doc);
    if (!control || disabled(control)) throw new Error("Kh\xF4ng nh\u1EADn di\u1EC7n ch\u1EAFc ch\u1EAFn \xF4 \u81EA\u52A8. H\xE3y \u0111\u1ED5i tr\u1EF1c ti\u1EBFp tr\xEAn trang.");
    if (autoState(doc) !== enabled) control.click();
  }
  async function moveSlide(doc, direction, state) {
    state.assertRunning();
    const before = readSlide(doc);
    if (before.activity) throw new Error("\u0110ang c\xF3 c\xE2u h\u1ECFi/b\xE0i \u0111\xE1nh gi\xE1. H\xE3y thao t\xE1c tr\u1EF1c ti\u1EBFp tr\xEAn MAIC.");
    if (!before.slideNumber) throw new Error("Ch\u01B0a x\xE1c \u0111\u1ECBnh s\u1ED1 slide hi\u1EC7n t\u1EA1i.");
    if (direction === "next" && before.slideNumber >= before.totalSlides || direction === "previous" && before.slideNumber <= 1) throw new Error("\u0110\xE3 \u1EDF \u0111\u1EA7u/cu\u1ED1i b\xE0i.");
    const { roots } = rootsFor(doc), checkpoint = state.checkpoint(), oldUrl = doc.URL;
    const control = uniqueControl(roots, direction === "next" ? ["\u4E0B\u4E00\u9875", "Next Page"] : ["\u4E0A\u4E00\u9875", "Previous Page"]);
    state.assertRunning();
    control.click();
    return waitFor(doc, () => {
      if (doc.URL !== oldUrl) throw new Error("Trang \u0111\xE3 chuy\u1EC3n ngo\xE0i d\u1EF1 ki\u1EBFn. \u0110\xE3 d\u1EEBng ch\u1EDD.");
      const after = readSlide(doc);
      return after.slideNumber !== before.slideNumber && after.slideNumber !== null ? after : null;
    }, { signal: checkpoint.signal });
  }
  async function revealTranscript(doc, state) {
    state.assertRunning();
    let slide = readSlide(doc);
    if (slide.transcript) return slide;
    const checkpoint = state.checkpoint();
    uniqueControl(rootsFor(doc).roots, ["\u5206\u9875\u8BB2\u7A3F", "Page Transcript"]).click();
    slide = await waitFor(doc, () => {
      const next = readSlide(doc);
      return next.transcript ? next : null;
    }, { signal: checkpoint.signal });
    return slide;
  }

  // src/core/notes.js
  var STOP = new Set("the a an and of to in is are for with this that from by as or be on it at we you can will have has was were".split(" "));
  function keywords(text) {
    const counts = /* @__PURE__ */ new Map();
    for (const word of text.match(/[\p{L}][\p{L}\p{N}-]{2,}/gu) || []) {
      const key = word.toLowerCase();
      if (!STOP.has(key)) counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([word]) => word);
  }
  function makeNotes(slide) {
    const text = [slide.content, slide.transcript].filter(Boolean).join("\n");
    if (!text.trim()) throw new Error("Ch\u01B0a c\xF3 v\u0103n b\u1EA3n \u0111\u1EC3 t\u1EA1o ghi ch\xFA.");
    return {
      ...slide,
      keywords: keywords(text),
      summary: text.split(/(?<=[.!?。！？])\s+|\n+/).map((s) => s.trim()).filter(Boolean).slice(0, 5).join("\n").slice(0, 4e3),
      personalNote: "",
      method: "Tr\xEDch t\u1ED1i \u0111a 5 c\xE2u \u0111\u1EA7u v\xE0 \u0111\u1EBFm t\u1EEB kh\xF3a; kh\xF4ng ph\u1EA3i t\xF3m t\u1EAFt b\u1EB1ng LLM."
    };
  }

  // src/overlay/overlay.css
  var overlay_default = ":host { all: initial; position: fixed; top: 100px; right: 18px; z-index: 2147483646; font: 13px/1.5 system-ui,sans-serif; color: #e8efff; }\n* { box-sizing: border-box; }\n.panel { width: 254px; border: 1px solid #526381; background: #102238; border-radius: 16px; box-shadow: 0 12px 35px #0005; overflow: hidden; }\nheader { display: flex; align-items: center; gap: 8px; padding: 10px 12px; cursor: grab; touch-action: none; background: #192f4a; }\nheader strong { flex: 1; letter-spacing: .06em; font-size: 11px; }\n.body { padding: 12px; }\np { margin: 0 0 8px; }\n.count { font-size: 23px; font-weight: 650; color: #77e3ca; }\n.status { color: #bfcee5; max-height: 68px; overflow: auto; }\n.buttons { display: flex; flex-wrap: wrap; gap: 6px; }\nbutton { cursor: pointer; border: 1px solid #53677f; border-radius: 8px; padding: 6px 9px; background: #243e5b; color: #fff; font: inherit; }\nbutton:hover { background: #36597f; } button:focus-visible { outline: 2px solid #77e3ca; }\n[hidden] { display: none !important; }\n";

  // src/overlay/overlay.js
  var Overlay = class {
    constructor(doc, command) {
      this.doc = doc;
      this.command = command;
    }
    mount() {
      if (this.host?.isConnected) return;
      this.events = new this.doc.defaultView.AbortController();
      this.host = this.doc.createElement("div");
      this.host.dataset.maicExtension = "overlay";
      const shadow = this.host.attachShadow({ mode: "open" });
      const style = this.doc.createElement("style");
      style.textContent = overlay_default;
      shadow.append(style);
      const panel = this.doc.createElement("section");
      panel.className = "panel";
      panel.setAttribute("aria-label", "MAIC Learning Assistant");
      shadow.append(panel);
      const header = this.doc.createElement("header");
      panel.append(header);
      const title = this.doc.createElement("strong");
      title.textContent = "MAIC \xB7 H\u1ED6 TR\u1EE2 H\u1ECCC";
      header.append(title);
      const collapse = this.button("\u2212", () => {
        this.body.hidden = !this.body.hidden;
        collapse.textContent = this.body.hidden ? "+" : "\u2212";
      });
      collapse.setAttribute("aria-label", "Thu g\u1ECDn / m\u1EDF r\u1ED9ng");
      header.append(collapse);
      this.body = this.doc.createElement("div");
      this.body.className = "body";
      panel.append(this.body);
      this.count = this.doc.createElement("p");
      this.count.className = "count";
      this.body.append(this.count);
      this.status = this.doc.createElement("p");
      this.status.className = "status";
      this.status.setAttribute("aria-live", "polite");
      this.body.append(this.status);
      const actions = this.doc.createElement("div");
      actions.className = "buttons";
      this.body.append(actions);
      for (const [label, action] of [["\u2190 Tr\u01B0\u1EDBc", "PREVIOUS"], ["Sau \u2192", "NEXT"], ["Ghi ch\xFA", "NOTES"], ["T\u1EA1m d\u1EEBng", "PAUSE"], ["Ti\u1EBFp t\u1EE5c", "RESUME"], ["D\u1EEBng", "STOP"]]) actions.append(this.button(label, () => this.command(action)));
      let drag;
      const signal = this.events.signal;
      header.addEventListener("pointerdown", (event) => {
        if (event.target.closest("button")) return;
        const rect = this.host.getBoundingClientRect();
        drag = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        header.setPointerCapture(event.pointerId);
      }, { signal });
      header.addEventListener("pointermove", (event) => {
        if (!drag) return;
        this.host.style.right = "auto";
        this.host.style.left = `${Math.max(0, Math.min(this.doc.defaultView.innerWidth - 254, event.clientX - drag.x))}px`;
        this.host.style.top = `${Math.max(0, Math.min(this.doc.defaultView.innerHeight - 50, event.clientY - drag.y))}px`;
      }, { signal });
      for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) header.addEventListener(type, () => {
        drag = null;
      }, { signal });
      this.doc.documentElement.append(this.host);
    }
    button(label, callback) {
      const button = this.doc.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", () => Promise.resolve(callback()).catch((error) => {
        if (this.status) this.status.textContent = error.message;
      }), { signal: this.events.signal });
      return button;
    }
    update(slide, reason) {
      this.count.textContent = `${slide?.slideNumber ?? "?"} / ${slide?.totalSlides ?? "?"}`;
      this.status.textContent = reason;
    }
    remove() {
      this.events?.abort();
      this.host?.remove();
      this.host = null;
    }
  };

  // src/content/maic.js
  var Assistant = class {
    constructor(doc, api) {
      this.doc = doc;
      this.api = api;
      this.state = new StudyState();
      this.profile = "local:default";
      this.preferences = { fastMode: true, autoCapture: true };
      this.lastUrl = doc.URL;
      this.overlay = new Overlay(doc, (action) => this.command(action));
      this.keyHandler = (event) => this.onKey(event);
      this.routeHandler = () => this.schedule();
      this.focusHandler = () => this.schedule();
      this.busy = false;
    }
    async init() {
      const { tab, preferences } = await request(this.api, "HELLO");
      this.preferences = preferences;
      this.profile = tab.profile;
      this.manualProfile = tab.manualProfile || "local:default";
      this.profileOverride = tab.profileOverride;
      if (tab.mode !== "stopped") {
        this.state.set("paused", "Trang v\u1EEBa t\u1EA3i l\u1EA1i. B\u1EA5m Ti\u1EBFp t\u1EE5c \u0111\u1EC3 kh\xF4i ph\u1EE5c.");
        this.watch();
      }
      await this.inspect();
      this.unlisten = listen(this.api.runtime.onMessage, (message, sender) => {
        if (sender.tab || message.type !== "COMMAND") throw new Error("L\u1EC7nh ch\u1EC9 nh\u1EADn t\u1EEB giao di\u1EC7n extension.");
        if (message.expectedUrl && cleanUrl(message.expectedUrl) !== cleanUrl(this.doc.URL)) throw new Error("Tab \u0111\xE3 \u0111\u1ED5i trang. H\xE3y m\u1EDF l\u1EA1i popup.");
        return this.command(message.command, message.args);
      });
    }
    watch() {
      this.unwatch();
      this.observer = new this.doc.defaultView.MutationObserver((records) => {
        if (records.some((record) => !record.target.closest?.("[data-maic-extension]"))) this.schedule();
      });
      this.observer.observe(this.doc.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["hidden", "aria-hidden", "aria-checked", "checked", "disabled", "aria-disabled", "class", "style"]
      });
      this.doc.addEventListener("keydown", this.keyHandler);
      this.doc.defaultView.addEventListener("popstate", this.routeHandler);
      this.doc.defaultView.addEventListener("hashchange", this.routeHandler);
      this.doc.defaultView.addEventListener("focus", this.focusHandler);
      this.doc.defaultView.navigation?.addEventListener("navigate", this.routeHandler);
    }
    unwatch() {
      this.observer?.disconnect();
      clearTimeout(this.timer);
      this.timer = null;
      this.doc.removeEventListener("keydown", this.keyHandler);
      this.doc.defaultView.removeEventListener("popstate", this.routeHandler);
      this.doc.defaultView.removeEventListener("hashchange", this.routeHandler);
      this.doc.defaultView.removeEventListener("focus", this.focusHandler);
      this.doc.defaultView.navigation?.removeEventListener("navigate", this.routeHandler);
    }
    schedule() {
      if (this.timer || this.state.mode === "stopped") return;
      this.timer = setTimeout(() => {
        this.timer = null;
        this.inspect().catch((error) => this.fail(error));
      }, 450);
    }
    async inspect() {
      const checkpoint = this.state.checkpoint();
      const { roots } = rootsFor(this.doc);
      const type = pageType(this.doc.URL), auth = authState(this.doc, roots);
      const marker = accountMarker(roots);
      const profile = !this.profileOverride && marker ? await accountProfile(marker) : this.manualProfile;
      if (!this.state.valid(checkpoint)) return this.status;
      if (profile !== this.profile) {
        this.observationSignature = null;
        this.fingerprint = null;
        if (this.state.mode === "running") this.pause("T\xE0i kho\u1EA3n/h\u1ED3 s\u01A1 \u0111\xE3 \u0111\u1ED5i. Ki\u1EC3m tra h\u1ED3 s\u01A1 r\u1ED3i ti\u1EBFp t\u1EE5c.");
      }
      this.profile = profile;
      if (this.lastUrl !== this.doc.URL) {
        this.lastUrl = this.doc.URL;
        if (this.state.mode === "running") this.pause("Trang \u0111\xE3 \u0111\u1ED5i. Ki\u1EC3m tra module r\u1ED3i b\u1EA5m Ti\u1EBFp t\u1EE5c.");
        this.fingerprint = null;
      }
      if (auth === "login-required" && this.state.mode !== "stopped") this.pause("Phi\xEAn \u0111\u0103ng nh\u1EADp c\u1EA7n ki\u1EC3m tra. H\xE3y \u0111\u0103ng nh\u1EADp th\u1EE7 c\xF4ng.");
      if (type === "assessment" && this.state.mode !== "stopped") this.pause("Trang \u0111\xE1nh gi\xE1: tr\u1EE3 l\xFD t\u1EA1m d\u1EEBng; t\u1EF1 thao t\xE1c tr\xEAn MAIC.");
      this.slide = type === "classroom" && auth !== "login-required" ? this.state.mode === "stopped" ? { ...moduleContext(roots, this.doc.URL), slideNumber: slideCounter(roots)?.current ?? null, totalSlides: slideCounter(roots)?.total ?? null } : readSlide(this.doc) : null;
      if (this.slide?.activity && this.state.mode === "running") this.pause("Ph\xE1t hi\u1EC7n c\xE2u h\u1ECFi. H\xE3y t\u1EF1 tr\u1EA3 l\u1EDDi v\xE0 ho\xE0n th\xE0nh tr\xEAn MAIC.");
      if (this.observer && this.state.mode !== "stopped") {
        for (const root of roots) this.observer.observe(root.documentElement || root, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter: ["hidden", "aria-hidden", "aria-checked", "checked", "disabled", "aria-disabled", "class", "style"]
        });
      }
      if (type === "classroom" && this.state.mode !== "stopped") {
        this.overlay.mount();
        this.overlay.update(this.slide, this.state.reason);
      } else this.overlay.remove();
      await this.report(type, auth);
      if (this.state.mode !== "stopped" && auth !== "login-required" && type !== "assessment") {
        const observation = { modules: discoverModules(roots, this.doc.URL), progress: readProgress(roots, cleanUrl(this.doc.URL)) };
        if (this.slide?.moduleId) observation.modules.push({
          id: this.slide.moduleId,
          title: this.slide.moduleTitle || "Module ch\u01B0a r\xF5 t\xEAn",
          kind: "module",
          url: cleanUrl(this.doc.URL),
          officialStatus: "unknown",
          browsingPercent: null,
          sourceUrl: cleanUrl(this.doc.URL),
          observedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        const signature = JSON.stringify(observation, (key, value) => ["observedAt"].includes(key) ? void 0 : value);
        if (signature !== this.observationSignature) {
          await request(this.api, "SAVE_OBSERVATION", { observation });
          this.observationSignature = signature;
        }
        if (this.preferences.autoCapture && this.state.mode === "running" && this.slide?.slideNumber && !this.slide.activity && (this.slide.content || this.slide.transcript)) {
          const fingerprint = JSON.stringify([this.profile, this.slide.moduleId, this.slide.slideNumber, this.slide.content, this.slide.transcript]);
          if (fingerprint !== this.fingerprint) {
            await request(this.api, "SAVE_SLIDE", { slide: this.slide });
            this.fingerprint = fingerprint;
          }
        }
      }
      return this.status;
    }
    async report(type = pageType(this.doc.URL), auth = authState(this.doc)) {
      this.status = {
        mode: this.state.mode,
        reason: this.state.reason,
        pageType: type,
        auth,
        profile: this.profile,
        manualProfile: this.manualProfile,
        profileOverride: Boolean(this.profileOverride),
        slide: this.slide,
        url: cleanUrl(this.doc.URL),
        auto: type === "classroom" ? autoState(this.doc) : null,
        preferences: this.preferences
      };
      await request(this.api, "TAB_STATUS", { status: this.status });
      if (this.overlay.host) this.overlay.update(this.slide, this.state.reason);
      return this.status;
    }
    pause(reason = "\u0110\xE3 t\u1EA1m d\u1EEBng. Ch\u1EBF \u0111\u1ED9 \u81EA\u52A8 \u0111\xE3 \u0111\u01B0\u1EE3c t\u1EAFt n\u1EBFu nh\u1EADn di\u1EC7n \u0111\u01B0\u1EE3c.") {
      this.state.set("paused", reason);
      if (autoState(this.doc) === true) {
        try {
          setAuto(this.doc, false);
        } catch {
          this.state.reason += " Kh\xF4ng t\u1EAFt \u0111\u01B0\u1EE3c \u81EA\u52A8; h\xE3y t\u1EAFt tr\u1EF1c ti\u1EBFp tr\xEAn trang.";
        }
      }
    }
    fail(error) {
      if (this.state.mode === "stopped") return;
      this.pause(error.message);
      this.report().catch(console.error);
    }
    async command(action, args = {}) {
      if (action === "ROUTE") {
        if (this.state.mode !== "stopped") return this.inspect();
        return this.status;
      }
      if (action === "STATUS") return this.inspect();
      if (action === "STOP") {
        this.pause();
        this.state.set("stopped", "\u0110\xE3 d\u1EEBng tr\u1EE3 l\xFD.");
        this.unwatch();
        this.overlay.remove();
        return this.report();
      }
      if (action === "PAUSE") {
        if (this.state.mode !== "stopped") this.pause();
        return this.report();
      }
      if (this.busy) throw new Error("\u0110ang x\u1EED l\xFD thao t\xE1c tr\u01B0\u1EDBc. Kh\xF4ng b\u1EA5m l\u1EB7p l\u1EA1i.");
      this.busy = true;
      try {
        if (this.lastUrl !== this.doc.URL && !["CONFIGURE", "START", "RESUME"].includes(action)) {
          await this.inspect();
          throw new Error("Trang \u0111\xE3 \u0111\u1ED5i. Ki\u1EC3m tra module r\u1ED3i Ti\u1EBFp t\u1EE5c.");
        }
        if (action === "CONFIGURE") {
          this.pause();
          this.state.set("stopped", "\u0110\xE3 \u0111\u1ED5i h\u1ED3 s\u01A1. B\u1EA5m B\u1EADt tr\u1EE3 l\xFD.");
          this.unwatch();
          this.overlay.remove();
          const { tab, preferences } = await request(this.api, "HELLO");
          this.profile = tab.profile;
          this.manualProfile = tab.manualProfile;
          this.profileOverride = tab.profileOverride;
          this.preferences = preferences;
          this.observationSignature = null;
          this.fingerprint = null;
          return this.inspect();
        }
        if (action === "START" || action === "RESUME") {
          if (authState(this.doc) === "login-required") throw new Error("H\xE3y \u0111\u0103ng nh\u1EADp tr\u1EF1c ti\u1EBFp tr\xEAn trang tr\u01B0\u1EDBc.");
          if (pageType(this.doc.URL) === "assessment") throw new Error("Kh\xF4ng b\u1EADt tr\u1EE3 l\xFD trong b\xE0i \u0111\xE1nh gi\xE1.");
          if (!this.profileOverride && !accountMarker(rootsFor(this.doc).roots) && this.manualProfile === "local:default") throw new Error("Ch\u01B0a nh\u1EADn di\u1EC7n t\xE0i kho\u1EA3n. V\xE0o C\xE0i \u0111\u1EB7t, \u0111\u1EB7t h\u1ED3 s\u01A1 c\u1EE5c b\u1ED9 ri\xEAng cho t\xE0i kho\u1EA3n n\xE0y r\u1ED3i b\u1EADt l\u1EA1i.");
          if (pageType(this.doc.URL) === "classroom" && readSlide(this.doc).activity) throw new Error("\u0110ang c\xF3 c\xE2u h\u1ECFi. Tr\u1EE3 l\xFD gi\u1EEF t\u1EA1m d\u1EEBng cho \u0111\u1EBFn khi b\u1EA1n r\u1EDDi c\xE2u h\u1ECFi.");
          this.state.set("running", "\u0110ang h\u1ED7 tr\u1EE3 \u0111\u1ECDc. \u0110i\u1EC1u h\u01B0\u1EDBng do b\u1EA1n ch\u1ECDn.");
          this.watch();
          return await this.inspect();
        }
        if (action === "REFRESH") {
          if (this.state.mode === "stopped") throw new Error("B\u1EADt tr\u1EE3 l\xFD tr\u01B0\u1EDBc khi \u0111\u1ECDc ti\u1EBFn \u0111\u1ED9.");
          if (pageType(this.doc.URL) === "dashboard") await revealProgress(this.doc, this.state);
          this.observationSignature = null;
          return await this.inspect();
        }
        if (["NEXT", "PREVIOUS", "AUTO", "OPEN_MODULE", "OPEN_VISIBLE", "TRANSCRIPT"].includes(action)) {
          this.state.assertRunning();
          const checkpoint = this.state.checkpoint();
          await this.inspect();
          if (!this.state.valid(checkpoint)) throw new Error("Thao t\xE1c \u0111\xE3 h\u1EE7y do tr\u1EA1ng th\xE1i, trang ho\u1EB7c t\xE0i kho\u1EA3n thay \u0111\u1ED5i.");
          this.state.assertRunning();
        }
        if (["NEXT", "PREVIOUS", "AUTO", "TRANSCRIPT"].includes(action) && pageType(this.doc.URL) !== "classroom") throw new Error("Ch\u1EC9 d\xF9ng thao t\xE1c n\xE0y trong ph\xF2ng h\u1ECDc.");
        if (["NEXT", "PREVIOUS"].includes(action)) await moveSlide(this.doc, action === "NEXT" ? "next" : "previous", this.state);
        else if (action === "AUTO") {
          if (readSlide(this.doc).activity) throw new Error("\u0110ang c\xF3 c\xE2u h\u1ECFi.");
          setAuto(this.doc, Boolean(args.enabled));
        } else if (["READ", "NOTES", "TRANSCRIPT"].includes(action)) {
          if (this.state.mode === "stopped" || pageType(this.doc.URL) !== "classroom") throw new Error("B\u1EADt tr\u1EE3 l\xFD trong ph\xF2ng h\u1ECDc tr\u01B0\u1EDBc.");
          const checkpoint = this.state.checkpoint();
          const slide = action === "TRANSCRIPT" ? await revealTranscript(this.doc, this.state) : readSlide(this.doc);
          if (!this.state.valid(checkpoint)) throw new Error("Thao t\xE1c \u0111\xE3 h\u1EE7y.");
          if (!slide.content && !slide.transcript) throw new Error(slide.diagnostic || "Kh\xF4ng \u0111\u1ECDc \u0111\u01B0\u1EE3c n\u1ED9i dung.");
          await request(this.api, "SAVE_SLIDE", { slide: action === "NOTES" ? makeNotes(slide) : slide, notes: action === "NOTES" });
          this.state.reason = action === "NOTES" ? "\u0110\xE3 l\u01B0u tr\xEDch \u0111o\u1EA1n, t\u1EEB kh\xF3a v\xE0 m\u1EABu ghi ch\xFA c\u1EE5c b\u1ED9." : "\u0110\xE3 l\u01B0u v\u0103n b\u1EA3n trang hi\u1EC7n t\u1EA1i.";
        } else if (action === "OPEN_VISIBLE") {
          if (!["main", "my-learning", "course-introduction", "dashboard"].includes(pageType(this.doc.URL))) throw new Error("Ch\u1EC9 m\u1EDF m\u1EE5c t\u1EEB catalog ho\u1EB7c b\u1EA3n \u0111\u1ED3 module.");
          const candidates = moduleEntries(rootsFor(this.doc).roots, this.doc.URL).filter((entry) => entry.module.id === args.id);
          if (candidates.length !== 1) throw new Error("M\u1EE5c \u0111\xE3 \u0111\u1ED5i ho\u1EB7c kh\xF4ng c\xF2n hi\u1EC7n. H\xE3y ch\u1ECDn tr\u1EF1c ti\u1EBFp tr\xEAn MAIC.");
          const element = candidates[0].element;
          if (disabled(element) || element.closest("form") || /^(?:提交.*|完成|开始考试|开始前测)$/.test(element.textContent.trim())) throw new Error("Kh\xF4ng m\u1EDF m\u1EE5c n\xE0y b\u1EB1ng tr\u1EE3 l\xFD.");
          this.pause("\u0110ang m\u1EDF m\u1EE5c b\u1EA1n ch\u1ECDn; trang c\xF3 th\u1EC3 ghi nh\u1EADn m\u1ED9t phi\xEAn h\u1ECDc.");
          const checkpoint = this.state.checkpoint();
          await this.report();
          if (!this.state.valid(checkpoint)) throw new Error("\u0110\xE3 h\u1EE7y m\u1EDF m\u1EE5c.");
          element.click();
          this.schedule();
          return this.status;
        } else if (action === "OPEN_MODULE") {
          const checkpoint = this.state.checkpoint();
          if (pageType(this.doc.URL) === "assessment" || pageType(this.doc.URL) === "classroom" && readSlide(this.doc).activity) throw new Error("Kh\xF4ng r\u1EDDi trang c\xF3 c\xE2u h\u1ECFi/b\xE0i \u0111\xE1nh gi\xE1 b\u1EB1ng tr\u1EE3 l\xFD.");
          if (!allowedLessonUrl(args.url)) throw new Error("URL module kh\xF4ng h\u1EE3p l\u1EC7.");
          const data = await request(this.api, "HELLO");
          if (data.tab.profile !== this.profile) throw new Error("H\u1ED3 s\u01A1 \u0111\xE3 \u0111\u1ED5i. H\xE3y m\u1EDF l\u1EA1i popup.");
          const stored = await this.api.storage.local.get(null);
          const prefix = `data:${this.profile}:`;
          const known = Object.entries(stored).some(([key, value]) => key.startsWith(prefix) && value.url === args.url);
          if (!known) throw new Error("Module ch\u01B0a \u0111\u01B0\u1EE3c t\xECm th\u1EA5y t\u1EEB giao di\u1EC7n MAIC.");
          if (!this.state.valid(checkpoint)) throw new Error("\u0110\xE3 h\u1EE7y m\u1EDF module.");
          this.pause("\u0110ang m\u1EDF phi\xEAn h\u1ECDc b\u1EA1n \u0111\xE3 ch\u1ECDn; v\u1ECB tr\xED slide do MAIC kh\xF4i ph\u1EE5c.");
          await this.report();
          if (this.state.mode === "stopped") throw new Error("\u0110\xE3 h\u1EE7y m\u1EDF module.");
          this.doc.defaultView.location.assign(args.url);
          return this.status;
        } else if (!["NEXT", "PREVIOUS", "AUTO"].includes(action)) throw new Error("L\u1EC7nh kh\xF4ng \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3.");
        return await this.inspect();
      } catch (error) {
        this.fail(error);
        throw error;
      } finally {
        this.busy = false;
      }
    }
    onKey(event) {
      if (!this.preferences.fastMode || pageType(this.doc.URL) !== "classroom" || !event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat) return;
      if (event.composedPath().some((node) => node?.matches?.('input,textarea,select,[contenteditable=""],[contenteditable="true"],[role="textbox"]'))) return;
      const action = { ArrowRight: "NEXT", ArrowLeft: "PREVIOUS", KeyP: "PAUSE", KeyR: "RESUME" }[event.code];
      if (!action || this.state.mode !== "running" && action !== "RESUME") return;
      event.preventDefault();
      this.command(action).catch((error) => this.fail(error));
    }
    destroy() {
      this.state.set("stopped", "Tab \u0111\xF3ng.");
      this.unwatch();
      this.overlay.remove();
      this.unlisten?.();
    }
  };
  if (typeof document !== "undefined" && !globalThis.__MAIC_LEARNING_EXTENSION__) {
    globalThis.__MAIC_LEARNING_EXTENSION__ = true;
    const assistant = new Assistant(document, extensionAPI());
    assistant.init().catch(console.error);
    window.addEventListener("pagehide", () => assistant.destroy());
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) assistant.init().catch(console.error);
    });
  }
})();
