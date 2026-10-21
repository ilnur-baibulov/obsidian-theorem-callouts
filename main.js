"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => TheoremCallouts
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var import_view = require("@codemirror/view");
var import_state = require("@codemirror/state");

// src/parse.ts
var THEOREM_TYPES = [
  "theorem",
  "lemma",
  "proposition",
  "corollary",
  "definition",
  "remark",
  "example",
  "claim",
  "axiom",
  "assumption",
  "exercise",
  "conjecture",
  "hypothesis"
];
var NAMES = {
  ru: {
    theorem: "\u0422\u0435\u043E\u0440\u0435\u043C\u0430",
    lemma: "\u041B\u0435\u043C\u043C\u0430",
    proposition: "\u041F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0435",
    corollary: "\u0421\u043B\u0435\u0434\u0441\u0442\u0432\u0438\u0435",
    definition: "\u041E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435",
    remark: "\u0417\u0430\u043C\u0435\u0447\u0430\u043D\u0438\u0435",
    example: "\u041F\u0440\u0438\u043C\u0435\u0440",
    claim: "\u0423\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435",
    axiom: "\u0410\u043A\u0441\u0438\u043E\u043C\u0430",
    assumption: "\u041F\u0440\u0435\u0434\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u0435",
    exercise: "\u0423\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u0435",
    conjecture: "\u0413\u0438\u043F\u043E\u0442\u0435\u0437\u0430",
    hypothesis: "\u0413\u0438\u043F\u043E\u0442\u0435\u0437\u0430"
  },
  en: {
    theorem: "Theorem",
    lemma: "Lemma",
    proposition: "Proposition",
    corollary: "Corollary",
    definition: "Definition",
    remark: "Remark",
    example: "Example",
    claim: "Claim",
    axiom: "Axiom",
    assumption: "Assumption",
    exercise: "Exercise",
    conjecture: "Conjecture",
    hypothesis: "Hypothesis"
  }
};
var PROOF = {
  ru: { begin: "\u0414\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u043E.", end: "\u25A1" },
  en: { begin: "Proof.", end: "\u25A1" }
};
var HEADER = /^((?:>\s*)+)\[!([A-Za-z]+)(?:\|([^\]]*))?\]([+-]?)[ \t]*(.*)$/;
var LABEL_LINE = /^\s*\^([A-Za-z0-9_-]+)\s*$/;
var TRAILING_LABEL = /\$\$\s*\^([A-Za-z0-9_-]+)\s*$/;
function quoteDepth(line) {
  const m = /^((?:>\s*)*)/.exec(line);
  return m ? (m[1].match(/>/g) ?? []).length : 0;
}
function stripQuote(line) {
  return line.replace(/^(?:>\s*)+/, "");
}
function detectLang(text, frontmatterLang2) {
  if (frontmatterLang2) {
    const l = frontmatterLang2.trim().toLowerCase();
    if (l.startsWith("ru")) return "ru";
    if (l.startsWith("en")) return "en";
  }
  const prose = text.replace(/^---\n[\s\S]*?\n---\n/, "").replace(/```[\s\S]*?```/g, "").replace(/\$\$[\s\S]*?\$\$/g, "").replace(/\$[^$\n]*\$/g, "").replace(/\[\[[^\]]*\]\]/g, "").replace(/`[^`\n]*`/g, "");
  const cyr = (prose.match(/[А-Яа-яЁё]/g) ?? []).length;
  const lat = (prose.match(/[A-Za-z]/g) ?? []).length;
  return cyr >= lat && cyr > 0 ? "ru" : "en";
}
function frontmatterLang(lines) {
  if (lines[0] !== "---") return { end: 0 };
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "---") {
      const lang = lines.slice(1, i).map((l) => /^lang:\s*(.+)$/.exec(l)).find(Boolean)?.[1];
      return { lang, end: i + 1 };
    }
  }
  return { end: 0 };
}
function parseNote(text) {
  const lines = text.split("\n");
  const fm = frontmatterLang(lines);
  const lang = detectLang(text, fm.lang);
  const callouts = [];
  const equations = [];
  const labels = /* @__PURE__ */ new Map();
  const codeLines = /* @__PURE__ */ new Set();
  let fence = null;
  for (let i = fm.end; i < lines.length; i++) {
    const body = stripQuote(lines[i]).trimStart();
    const m = /^(```+|~~~+)/.exec(body);
    if (fence) {
      codeLines.add(i);
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length) fence = null;
    } else if (m) {
      fence = m[1];
      codeLines.add(i);
    }
  }
  let counter = 0;
  let eqCounter = 0;
  let lastBlock = null;
  let lastBlockEnd = -1;
  for (let i = fm.end; i < lines.length; i++) {
    if (codeLines.has(i)) {
      lastBlock = null;
      continue;
    }
    const line = lines[i];
    const lab = LABEL_LINE.exec(line);
    if (lab && quoteDepth(line) === 0) {
      const gapOk = lastBlock && lines.slice(lastBlockEnd + 1, i).every((l) => l.trim() === "") && i - lastBlockEnd <= 2;
      if (lastBlock && gapOk && !lastBlock.label) {
        lastBlock.label = lab[1];
        labels.set(lab[1], lastBlock);
      }
      lastBlock = null;
      continue;
    }
    const h = HEADER.exec(line);
    if (h) {
      const type = h[2].toLowerCase();
      const depth = (h[1].match(/>/g) ?? []).length;
      let end = i;
      while (end + 1 < lines.length && quoteDepth(lines[end + 1]) >= depth) end++;
      if (THEOREM_TYPES.includes(type)) {
        const meta = h[3];
        let number;
        if (meta === void 0 || meta.trim() === "") number = String(++counter);
        else if (meta.trim() === "*") number = null;
        else number = meta.trim();
        const item = {
          kind: "callout",
          type,
          line: i,
          endLine: end,
          depth,
          number,
          title: h[5].trim(),
          label: null
        };
        callouts.push(item);
        if (depth === 1) {
          lastBlock = item;
          lastBlockEnd = end;
        }
      }
      continue;
    }
    const body = stripQuote(line).trim();
    if (body.startsWith("$$")) {
      let end = i;
      const singleLine = body.length > 2 && body.slice(2).includes("$$");
      if (!singleLine) {
        end = i + 1;
        while (end < lines.length && !stripQuote(lines[end]).includes("$$")) end++;
        if (end >= lines.length) continue;
      }
      const trailing = TRAILING_LABEL.exec(stripQuote(lines[end]).trim());
      const item = { kind: "equation", line: i, endLine: end, number: null, label: null };
      if (trailing) {
        item.label = trailing[1];
        labels.set(trailing[1], item);
      }
      equations.push(item);
      if (quoteDepth(line) === 0) {
        lastBlock = item;
        lastBlockEnd = end;
      }
      i = end;
      continue;
    }
    if (line.trim() !== "" && quoteDepth(line) === 0) lastBlock = null;
  }
  for (const e of equations) {
    if (!e.label) continue;
    const src = lines.slice(e.line, e.endLine + 1).join("\n");
    if (/\\tag\*?\{/.test(src)) continue;
    e.number = String(++eqCounter);
  }
  return { lang, callouts, equations, labels, codeLines };
}
function refText(item) {
  if (item.number === null) return null;
  return item.kind === "equation" ? `(${item.number})` : item.number;
}
function captionHead(item, lang) {
  const name = NAMES[lang][item.type];
  return item.number === null ? name : `${name} ${item.number}`;
}
function parseLinktext(linktext) {
  const m = /^([^#|]*)#\^([A-Za-z0-9_-]+)$/.exec(linktext.trim());
  return m ? { path: m[1], label: m[2] } : null;
}

// src/main.ts
var refreshEffect = import_state.StateEffect.define();
var isTheoremType = (t) => !!t && THEOREM_TYPES.includes(t.toLowerCase());
var TheoremCallouts = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.fileCache = /* @__PURE__ */ new Map();
    this.loading = /* @__PURE__ */ new Map();
    this.textCache = /* @__PURE__ */ new Map();
    this.docCache = /* @__PURE__ */ new WeakMap();
    this.signatures = /* @__PURE__ */ new Map();
    this.originalTitles = /* @__PURE__ */ new WeakMap();
  }
  async onload() {
    const plugins = this.app.plugins;
    if (plugins?.enabledPlugins?.has("math-booster")) {
      new import_obsidian.Notice("Theorem Callouts: disable Math Booster, otherwise captions are processed twice.", 1e4);
    }
    this.registerMarkdownPostProcessor((el, ctx) => this.postProcess(el, ctx), 100);
    this.registerEditorExtension([this.refPlugin(), this.domPlugin()]);
    this.registerEvent(this.app.metadataCache.on("changed", (file, data) => {
      const parsed = parseNote(data);
      this.fileCache.set(file.path, { mtime: file.stat.mtime, parsed });
      const sig = signature(parsed);
      if (this.signatures.get(file.path) !== sig) {
        const first = !this.signatures.has(file.path);
        this.signatures.set(file.path, sig);
        if (!first) this.refreshAll(true);
      }
    }));
  }
  // ---------- note index ----------
  parseText(path, text) {
    const c = this.textCache.get(path);
    if (c && c.text === text) return c.parsed;
    const parsed = parseNote(text);
    this.textCache.set(path, { text, parsed });
    return parsed;
  }
  parseDoc(doc) {
    let p = this.docCache.get(doc);
    if (!p) {
      p = parseNote(doc.toString());
      this.docCache.set(doc, p);
    }
    return p;
  }
  /** Parsed note if known and fresh; otherwise starts loading and returns the stale value or null. */
  getParsed(file) {
    const c = this.fileCache.get(file.path);
    if (!c || c.mtime !== file.stat.mtime) {
      this.loadNote(file).then(() => this.refreshAll(false));
    }
    return c?.parsed ?? null;
  }
  loadNote(file) {
    const c = this.fileCache.get(file.path);
    if (c && c.mtime === file.stat.mtime) return Promise.resolve(c.parsed);
    let p = this.loading.get(file.path);
    if (!p) {
      p = this.app.vault.cachedRead(file).then((text) => {
        const parsed = parseNote(text);
        this.fileCache.set(file.path, { mtime: file.stat.mtime, parsed });
        this.signatures.set(file.path, signature(parsed));
        this.loading.delete(file.path);
        return parsed;
      });
      this.loading.set(file.path, p);
    }
    return p;
  }
  resolveTarget(linktext, sourcePath, current) {
    const lt = parseLinktext(linktext);
    if (!lt) return { item: null, pending: false };
    if (lt.path === "" && current) return { item: current.labels.get(lt.label) ?? null, pending: false };
    const file = this.app.metadataCache.getFirstLinkpathDest(lt.path || sourcePath, sourcePath);
    if (!file) return { item: null, pending: false };
    if (file.path === sourcePath && current) return { item: current.labels.get(lt.label) ?? null, pending: false };
    const parsed = this.getParsed(file);
    return { item: parsed?.labels.get(lt.label) ?? null, pending: !parsed };
  }
  refreshAll(rerenderReading) {
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view;
      if (!(view instanceof import_obsidian.MarkdownView)) return;
      const cm = view.editor?.cm;
      cm?.dispatch({ effects: refreshEffect.of(null) });
      if (rerenderReading && view.getMode() === "preview") view.previewMode.rerender(true);
    });
  }
  // ---------- reading view ----------
  postProcess(el, ctx) {
    const info = ctx.getSectionInfo(el);
    const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
    let parsed = null;
    if (info) parsed = this.parseText(ctx.sourcePath, info.text);
    else if (file instanceof import_obsidian.TFile) parsed = this.getParsed(file);
    const lang = parsed?.lang ?? "en";
    if (info && parsed) {
      const inRange = (items) => items.filter((i) => i.line >= info.lineStart && i.line <= info.lineEnd);
      this.pairCallouts(el, inRange(parsed.callouts), lang);
      this.pairEquations(el, inRange(parsed.equations));
    }
    this.processLinks(el, ctx.sourcePath, info ? parsed : null);
    this.processProofs(el, lang);
  }
  theoremCalloutEls(root) {
    const all = Array.from(root.querySelectorAll(".callout"));
    if (root.matches(".callout")) all.unshift(root);
    return all.filter((c) => isTheoremType(c.getAttribute("data-callout")));
  }
  pairCallouts(root, items, lang) {
    const els = this.theoremCalloutEls(root);
    els.forEach((el, k) => {
      if (items[k] && items[k].type === el.getAttribute("data-callout")?.toLowerCase()) this.applyCaption(el, items[k], lang);
    });
  }
  pairEquations(root, items) {
    const els = Array.from(root.querySelectorAll(".math-block"));
    els.forEach((el, k) => {
      if (items[k]) applyEquationNumber(el, items[k]);
    });
  }
  applyCaption(callout, item, lang) {
    const inner = callout.querySelector(":scope > .callout-title .callout-title-inner");
    if (!inner) return;
    const head = captionHead(item, lang);
    const key = `${head}|${item.title}`;
    if (inner.dataset.tcKey === key) return;
    if (!this.originalTitles.has(inner)) {
      this.originalTitles.set(inner, item.title ? Array.from(inner.childNodes).map((n) => n.cloneNode(true)) : []);
    }
    const original = this.originalTitles.get(inner);
    inner.empty();
    inner.createSpan({ cls: "theorem-callout-main-title", text: head });
    if (original.length) {
      const sub = inner.createSpan({ cls: "theorem-callout-subtitle" });
      sub.appendText(" (");
      original.forEach((n) => sub.appendChild(n.cloneNode(true)));
      sub.appendText(")");
    }
    inner.appendText(".");
    inner.dataset.tcKey = key;
    callout.addClass("theorem-callout", `theorem-callout-${item.type}`, `theorem-callout-${lang}`);
  }
  processLinks(el, sourcePath, current) {
    el.querySelectorAll("a.internal-link").forEach((a) => {
      const href = a.getAttribute("data-href") ?? "";
      const lt = parseLinktext(href);
      if (!lt) return;
      const text = a.textContent ?? "";
      if (!text.includes(lt.label)) return;
      const set = (item2) => {
        const t = item2 && refText(item2);
        if (t) {
          a.setText(t);
          a.addClass("theorem-ref");
        }
      };
      const { item, pending } = this.resolveTarget(href, sourcePath, current);
      if (item || !pending) return set(item);
      const file = this.app.metadataCache.getFirstLinkpathDest(lt.path || sourcePath, sourcePath);
      if (file) this.loadNote(file).then((p) => set(p.labels.get(lt.label) ?? null));
    });
  }
  processProofs(el, lang) {
    el.querySelectorAll("code").forEach((code) => {
      const t = code.textContent?.trim();
      if (t === "\\begin{proof}") code.replaceWith(proofSpan("begin", lang));
      else if (t === "\\end{proof}") code.replaceWith(proofSpan("end", lang));
    });
  }
  // ---------- live preview: rendered callouts and equations ----------
  domPlugin() {
    const plugin = this;
    return import_view.ViewPlugin.fromClass(class {
      constructor(view) {
        this.view = view;
        this.scheduled = false;
        this.observer = new MutationObserver(() => this.schedule());
        this.observer.observe(view.contentDOM, { childList: true, subtree: true });
        this.schedule();
      }
      update(u) {
        if (u.docChanged || u.viewportChanged || u.transactions.some((t) => t.effects.some((e) => e.is(refreshEffect)))) this.schedule();
      }
      schedule() {
        if (this.scheduled) return;
        this.scheduled = true;
        requestAnimationFrame(() => {
          this.scheduled = false;
          this.apply();
        });
      }
      apply() {
        const view = this.view;
        if (!view.state.field(import_obsidian.editorLivePreviewField, false)) return;
        const parsed = plugin.parseDoc(view.state.doc);
        this.observer.disconnect();
        try {
          view.contentDOM.querySelectorAll(".cm-embed-block").forEach((block) => {
            let line;
            try {
              line = view.state.doc.lineAt(view.posAtDOM(block)).number - 1;
            } catch {
              return;
            }
            const end = quoteEnd(view.state.doc, line);
            const inBlock = (items) => items.filter((i) => i.line >= line && i.line <= end);
            if (block.querySelector(".callout")) {
              plugin.pairCallouts(block, inBlock(parsed.callouts), parsed.lang);
              plugin.pairEquations(block, inBlock(parsed.equations));
            } else if (block.matches(".math-block, .math") || block.querySelector("mjx-container")) {
              const eq = parsed.equations.find((e) => e.line <= line && line <= e.endLine);
              const target = block.querySelector(".math-block") ?? block;
              if (eq) applyEquationNumber(target, eq);
            }
          });
        } finally {
          this.observer.observe(view.contentDOM, { childList: true, subtree: true });
        }
      }
      destroy() {
        this.observer.disconnect();
      }
    });
  }
  // ---------- live preview: references and proof markers in the text ----------
  refPlugin() {
    const plugin = this;
    return import_view.ViewPlugin.fromClass(class {
      constructor(view) {
        this.decorations = this.build(view);
      }
      update(u) {
        if (u.docChanged || u.viewportChanged || u.selectionSet || u.transactions.some((t) => t.effects.some((e) => e.is(refreshEffect))) || u.startState.field(import_obsidian.editorLivePreviewField, false) !== u.state.field(import_obsidian.editorLivePreviewField, false)) {
          this.decorations = this.build(u.view);
        }
      }
      build(view) {
        const b = new import_state.RangeSetBuilder();
        if (!view.state.field(import_obsidian.editorLivePreviewField, false)) return b.finish();
        const sourcePath = view.state.field(import_obsidian.editorInfoField, false)?.file?.path ?? "";
        const parsed = plugin.parseDoc(view.state.doc);
        const sel = view.state.selection.ranges;
        const touched = (from, to) => sel.some((r) => r.from <= to && r.to >= from);
        const re = /\[\[([^\]|\n]+?)\]\]|`\\(begin|end)\{proof\}`/g;
        let done = 0;
        for (const { from, to } of view.visibleRanges) {
          const start = Math.max(view.state.doc.lineAt(from).number, done + 1), stop = view.state.doc.lineAt(to).number;
          done = Math.max(done, stop);
          for (let n = start; n <= stop; n++) {
            if (parsed.codeLines.has(n - 1)) continue;
            const line = view.state.doc.line(n);
            const lab = /^\^([A-Za-z0-9_-]+)\s*$/.exec(line.text);
            if (lab && parsed.labels.has(lab[1])) {
              b.add(line.from, line.from, import_view.Decoration.line({ class: "theorem-label-line" }));
              continue;
            }
            re.lastIndex = 0;
            let m;
            while (m = re.exec(line.text)) {
              const a = line.from + m.index, z = a + m[0].length;
              if (touched(a, z)) continue;
              if (m[2]) {
                b.add(a, z, import_view.Decoration.replace({ widget: new ProofWidget(m[2], parsed.lang) }));
                continue;
              }
              const { item } = plugin.resolveTarget(m[1], sourcePath, parsed);
              const text = item && refText(item);
              if (text) b.add(a, z, import_view.Decoration.replace({ widget: new RefWidget(plugin, text, m[1], sourcePath) }));
            }
          }
        }
        return b.finish();
      }
    }, { decorations: (v) => v.decorations });
  }
};
function signature(p) {
  return [...p.callouts.map((c) => `${c.line}:${c.number}`), ...p.equations.map((e) => `${e.line}:${e.number}`), p.lang].join(",");
}
function quoteEnd(doc, line) {
  let end = line;
  while (end + 2 <= doc.lines && /^\s*>/.test(doc.line(end + 2).text)) end++;
  return end;
}
function applyEquationNumber(el, eq) {
  const existing = el.querySelector(":scope > .theorem-eq-number");
  const text = eq.number === null ? null : `(${eq.number})`;
  if (!text) {
    existing?.remove();
    return;
  }
  if (existing?.textContent === text) return;
  existing?.remove();
  el.addClass("theorem-eq");
  el.createSpan({ cls: "theorem-eq-number", text });
}
function proofSpan(kind, lang) {
  const span = createSpan({ cls: `theorem-proof-${kind} theorem-proof-${lang}`, text: PROOF[lang][kind] });
  return span;
}
var ProofWidget = class extends import_view.WidgetType {
  constructor(kind, lang) {
    super();
    this.kind = kind;
    this.lang = lang;
  }
  eq(o) {
    return o.kind === this.kind && o.lang === this.lang;
  }
  toDOM() {
    return proofSpan(this.kind, this.lang);
  }
};
var RefWidget = class extends import_view.WidgetType {
  constructor(plugin, text, linktext, sourcePath) {
    super();
    this.plugin = plugin;
    this.text = text;
    this.linktext = linktext;
    this.sourcePath = sourcePath;
  }
  eq(o) {
    return o.text === this.text && o.linktext === this.linktext && o.sourcePath === this.sourcePath;
  }
  toDOM() {
    const span = createSpan({ cls: "cm-hmd-internal-link theorem-ref" });
    const a = span.createEl("a", { cls: "internal-link", text: this.text });
    a.setAttr("data-href", this.linktext);
    span.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      this.plugin.app.workspace.openLinkText(this.linktext, this.sourcePath, import_obsidian.Keymap.isModEvent(e));
    });
    span.addEventListener("mouseover", (e) => {
      this.plugin.app.workspace.trigger("hover-link", {
        event: e,
        source: "editor",
        hoverParent: { hoverPopover: null },
        targetEl: span,
        linktext: this.linktext,
        sourcePath: this.sourcePath
      });
    });
    return span;
  }
  ignoreEvent() {
    return true;
  }
};
