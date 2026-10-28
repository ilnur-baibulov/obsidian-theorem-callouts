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
var import_obsidian2 = require("obsidian");
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
var TYPE_ALIASES = {
  axm: "axiom",
  def: "definition",
  lem: "lemma",
  prp: "proposition",
  thm: "theorem",
  cor: "corollary",
  clm: "claim",
  asm: "assumption",
  exm: "example",
  exr: "exercise",
  cnj: "conjecture",
  hyp: "hypothesis",
  rmk: "remark"
};
function theoremType(t) {
  const k = t?.toLowerCase() ?? "";
  return THEOREM_TYPES.includes(k) ? k : TYPE_ALIASES[k] ?? null;
}
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
var APPENDIX = { ru: "\u041F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435", en: "Appendix" };
function headingCaption(h, lang) {
  if (h.number === null) return null;
  return h.appendix && !h.number.includes(".") ? `${APPENDIX[lang]} ${h.number}.` : h.number;
}
var PROOF = {
  ru: { begin: "\u0414\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u043E.", end: "\u25A1" },
  en: { begin: "Proof.", end: "\u25A1" }
};
var HEADER = /^((?:>\s*)+)\[!([A-Za-z]+)(?:\|([^\]]*))?\]([+-]?)[ \t]*(.*)$/;
var LABEL_LINE = /^\s*\^([A-Za-z0-9_-]+)\s*$/;
var TRAILING_LABEL = /\$\$\s*\^([A-Za-z0-9_-]+)\s*$/;
var HEADING = /^(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;
function quoteDepth(line) {
  const m = /^((?:>\s*)*)/.exec(line);
  return m ? (m[1].match(/>/g) ?? []).length : 0;
}
function stripQuote(line) {
  return line.replace(/^(?:>\s*)+/, "");
}
function detectLang(text, frontmatterLang) {
  if (frontmatterLang) {
    const l = frontmatterLang.trim().toLowerCase();
    if (l.startsWith("ru")) return "ru";
    if (l.startsWith("en")) return "en";
  }
  const prose = text.replace(/^---\n[\s\S]*?\n---\n/, "").replace(/```[\s\S]*?```/g, "").replace(/\$\$[\s\S]*?\$\$/g, "").replace(/\$[^$\n]*\$/g, "").replace(/\[\[[^\]]*\]\]/g, "").replace(/`[^`\n]*`/g, "");
  const cyr = (prose.match(/[А-Яа-яЁё]/g) ?? []).length;
  const lat = (prose.match(/[A-Za-z]/g) ?? []).length;
  return cyr >= lat && cyr > 0 ? "ru" : "en";
}
var unquote = (v) => v.trim().replace(/^(["'])(.*)\1$/, "$2").trim();
function yamlValues(body, key) {
  const k = body.findIndex((l) => l.startsWith(key + ":"));
  if (k < 0) return [];
  const v = body[k].slice(key.length + 1).trim();
  if (v.startsWith("[")) return v.replace(/^\[|\]$/g, "").split(",").map(unquote).filter(Boolean);
  if (v) return [unquote(v)];
  const items = [];
  for (const l of body.slice(k + 1)) {
    const m = /^\s+-\s+(.*)$/.exec(l);
    if (!m) break;
    items.push(unquote(m[1]));
  }
  return items;
}
function frontmatter(lines) {
  if (lines[0] !== "---") return { numberSections: false, unnumbered: [], end: 0 };
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "---") {
      const body = lines.slice(1, i);
      return {
        lang: yamlValues(body, "lang")[0],
        numberSections: /^true$/i.test(yamlValues(body, "numbersections")[0] ?? ""),
        unnumbered: yamlValues(body, "unnumbered"),
        appendix: yamlValues(body, "appendix")[0],
        end: i + 1
      };
    }
  }
  return { numberSections: false, unnumbered: [], end: 0 };
}
function headingKey(text) {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}
function parseNote(text) {
  const lines = text.split("\n");
  const fm = frontmatter(lines);
  const lang = detectLang(text, fm.lang);
  const callouts = [];
  const equations = [];
  const labels = /* @__PURE__ */ new Map();
  const headings = [];
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
      const type = theoremType(h[2]);
      const depth = (h[1].match(/>/g) ?? []).length;
      let end = i;
      while (end + 1 < lines.length && quoteDepth(lines[end + 1]) >= depth) end++;
      if (type) {
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
    const hd = quoteDepth(line) === 0 ? HEADING.exec(line) : null;
    if (hd) {
      headings.push({ kind: "heading", line: i, level: hd[1].length, text: hd[2], number: null, appendix: false });
      lastBlock = null;
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
      const item = { kind: "equation", line: i, endLine: end, number: null, tag: null, label: null };
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
    const tag = /\\tag(\*?)\{([^}]*)\}/.exec(src);
    if (tag) {
      e.tag = tag[1] ? tag[2] : `(${tag[2]})`;
      continue;
    }
    e.number = String(++eqCounter);
  }
  if (fm.numberSections) numberHeadings(headings, lines, fm);
  return { lang, langFromFrontmatter: !!fm.lang, callouts, equations, labels, headings, codeLines };
}
function numberHeadings(headings, lines, fm) {
  let list = headings;
  const first = lines.slice(fm.end).findIndex((l) => l.trim() !== "") + fm.end;
  if (list[0]?.level === 1 && list[0].line === first && !list.slice(1).some((h) => h.level === 1)) list = list.slice(1);
  if (!list.length) return;
  const top = Math.min(...list.map((h) => h.level));
  const unnumbered = new Set(fm.unnumbered.map(headingKey));
  const appendix = fm.appendix === void 0 ? null : headingKey(fm.appendix);
  const counters = [0, 0, 0];
  let inAppendix = false;
  let skipBelow = 0;
  for (const h of list) {
    if (skipBelow && h.level > skipBelow) continue;
    skipBelow = 0;
    const key = headingKey(h.text);
    if (unnumbered.has(key)) {
      skipBelow = h.level;
      continue;
    }
    const depth = h.level - top;
    if (depth === 0 && key === appendix && !inAppendix) {
      inAppendix = true;
      counters.fill(0);
    }
    if (depth > 2) continue;
    counters[depth]++;
    counters.fill(0, depth + 1);
    const parts = counters.slice(0, depth + 1).map(String);
    if (inAppendix) parts[0] = String.fromCharCode(64 + counters[0]);
    h.number = parts.join(".");
    h.appendix = inAppendix;
  }
}
function refText(item) {
  if (item.kind === "equation") return item.number === null ? item.tag : `(${item.number})`;
  return item.number;
}
function findTarget(p, lt) {
  if (!lt.heading) return p.labels.get(lt.label) ?? null;
  const key = headingKey(lt.label);
  return p.headings.find((h) => headingKey(h.text) === key) ?? null;
}
function captionHead(item, lang) {
  const name = NAMES[lang][item.type];
  return item.number === null ? name : `${name} ${item.number}`;
}
function parseLinktext(linktext) {
  const t = linktext.trim();
  const m = /^([^#|]*)#\^([A-Za-z0-9_-]+)$/.exec(t);
  if (m) return { path: m[1], label: m[2], heading: false };
  const h = /^([^#|^]*)#(?:[^#|]*#)*([^#|]+)$/.exec(t);
  return h ? { path: h[1], label: h[2].trim(), heading: true } : null;
}
function proofTitle(code) {
  const m = /^\\begin\{proof\}\[(.*)\]$/s.exec(code.trim());
  return m ? m[1].trim() : null;
}
function withPeriod(text) {
  return /[.!?:]$/.test(text) ? text : text + ".";
}

// src/settings.ts
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  language: "auto",
  plainStyle: true
};
var TheoremSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    const s = this.plugin.settings;
    new import_obsidian.Setting(containerEl).setName("Caption language").setDesc("Language of \xABTheorem\xBB, \xABProof\xBB and so on. `lang: ru` / `lang: en` in a note's frontmatter always wins.").addDropdown((d) => d.addOption("auto", "Detect from the note").addOption("en", "English").addOption("ru", "\u0420\u0443\u0441\u0441\u043A\u0438\u0439").setValue(s.language).onChange((v) => {
      s.language = v;
      this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Plain style").setDesc("Theorem callouts without box and icon, with a bold caption, as in a printed text. Off: Obsidian's usual callout look.").addToggle((t) => t.setValue(s.plainStyle).onChange((v) => {
      s.plainStyle = v;
      this.plugin.saveSettings();
    }));
  }
};

// src/main.ts
var refreshEffect = import_state.StateEffect.define();
var TheoremCallouts = class extends import_obsidian2.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULT_SETTINGS };
    this.fileCache = /* @__PURE__ */ new Map();
    this.loading = /* @__PURE__ */ new Map();
    this.textCache = /* @__PURE__ */ new Map();
    this.docCache = /* @__PURE__ */ new WeakMap();
    this.signatures = /* @__PURE__ */ new Map();
    this.originalTitles = /* @__PURE__ */ new WeakMap();
  }
  async onload() {
    this.settings = { ...DEFAULT_SETTINGS, ...await this.loadData() };
    this.addSettingTab(new TheoremSettingTab(this.app, this));
    this.applyBodyClass();
    this.register(() => document.body.removeClass("theorem-callouts-plain"));
    const plugins = this.app.plugins;
    if (plugins?.enabledPlugins?.has("math-booster")) {
      new import_obsidian2.Notice("Theorem Callouts: disable Math Booster, otherwise captions are processed twice.", 1e4);
    }
    this.registerMarkdownPostProcessor((el, ctx) => this.postProcess(el, ctx), 100);
    this.registerEditorExtension([this.refPlugin(), this.domPlugin()]);
    this.registerEvent(this.app.metadataCache.on("changed", (file, data) => {
      const parsed = parseNote(data);
      this.fileCache.set(file.path, { mtime: file.stat.mtime, text: data, parsed });
      const sig = signature(parsed);
      if (this.signatures.get(file.path) !== sig) {
        const first = !this.signatures.has(file.path);
        this.signatures.set(file.path, sig);
        if (!first) this.refreshAll(true);
      }
    }));
  }
  async saveSettings() {
    await this.saveData(this.settings);
    this.applyBodyClass();
    this.refreshAll(true);
  }
  applyBodyClass() {
    document.body.toggleClass("theorem-callouts-plain", this.settings.plainStyle);
  }
  /** Caption language: frontmatter, then the setting, then detection. */
  langOf(p) {
    if (!p) return this.settings.language === "auto" ? "en" : this.settings.language;
    return p.langFromFrontmatter || this.settings.language === "auto" ? p.lang : this.settings.language;
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
        this.fileCache.set(file.path, { mtime: file.stat.mtime, text, parsed });
        this.signatures.set(file.path, signature(parsed));
        this.loading.delete(file.path);
        return parsed;
      });
      this.loading.set(file.path, p);
    }
    return p;
  }
  /** Note a link points to; `#^label` points to the note it is written in. */
  linkFile(path, sourcePath) {
    if (path === "") {
      const f = this.app.vault.getAbstractFileByPath(sourcePath);
      return f instanceof import_obsidian2.TFile ? f : null;
    }
    return this.app.metadataCache.getFirstLinkpathDest(path, sourcePath);
  }
  resolveTarget(linktext, sourcePath, current) {
    const lt = parseLinktext(linktext);
    if (!lt) return { item: null, pending: false };
    if (lt.path === "" && current) return { item: findTarget(current, lt), pending: false };
    const file = this.linkFile(lt.path, sourcePath);
    if (!file) return { item: null, pending: false };
    if (file.path === sourcePath && current) return { item: findTarget(current, lt), pending: false };
    const parsed = this.getParsed(file);
    return { item: parsed && findTarget(parsed, lt), pending: !parsed };
  }
  /** File and item a reference points to, loading the target note if needed. */
  async locate(linktext, sourcePath, current) {
    const lt = parseLinktext(linktext);
    const file = lt && this.linkFile(lt.path, sourcePath);
    if (!lt || !file) return null;
    const parsed = file.path === sourcePath && current ? current : await this.loadNote(file);
    const item = findTarget(parsed, lt);
    return item ? { file, item, parsed } : null;
  }
  // ---------- navigation and hover ----------
  // Equations are opened at the line found by the parser rather than through Obsidian's block ids,
  // so a reference works wherever the equation is: multi-line, inside a callout, in another note.
  async openRef(e, linktext, sourcePath, current) {
    const newLeaf = import_obsidian2.Keymap.isModEvent(e);
    const target = await this.locate(linktext, sourcePath, current);
    if (target?.item.kind !== "equation") return this.app.workspace.openLinkText(linktext, sourcePath, newLeaf);
    await this.app.workspace.getLeaf(newLeaf).openFile(target.file, { eState: { line: target.item.line } });
  }
  /** Shows Obsidian's page preview for a reference. Obsidian finds block ids only at the end of a top-level
   *  block, so an equation it cannot find is previewed as its labelled callout or as the note at its line. */
  async hoverRef(e, targetEl, parent, source, linktext, sourcePath, current) {
    const target = await this.locate(linktext, sourcePath, current);
    let state;
    if (target?.item.kind === "equation" && !this.app.metadataCache.getFileCache(target.file)?.blocks?.[target.item.label.toLowerCase()]) {
      const eq = target.item;
      const callout = target.parsed.callouts.find((c) => c.depth === 1 && c.line <= eq.line && eq.line <= c.endLine);
      if (callout?.label) linktext = `${target.file.path}#^${callout.label}`;
      else {
        linktext = target.file.path;
        state = { scroll: eq.line };
      }
    }
    if (state) holdUntilScrolled(targetEl.doc);
    this.app.workspace.trigger("hover-link", { event: e, source, hoverParent: parent, targetEl, linktext, sourcePath, state });
  }
  /** Reading view: Obsidian handles internal links itself, so equation links are taken over before it sees the events. */
  bindEquationLink(a, linktext, sourcePath, current) {
    if (a.dataset.tcEq) return;
    a.dataset.tcEq = "1";
    const parent = { hoverPopover: null };
    a.addEventListener("click", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      this.openRef(e, linktext, sourcePath, current);
    });
    a.addEventListener("mouseover", (e) => {
      e.stopPropagation();
      this.hoverRef(e, a, parent, "preview", linktext, sourcePath, current);
    });
  }
  /** A reference drawn by the plugin, not as an Obsidian link: Obsidian previews and follows those itself,
   *  by block id, which fails for an equation inside a callout ("Unable to find"). Events stop here. */
  refEl(text, linktext, sourcePath, current, source) {
    const span = createSpan({ cls: "theorem-ref theorem-ref-link", text });
    const parent = { hoverPopover: null };
    span.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      if (e.button !== 0) return;
      e.preventDefault();
      this.openRef(e, linktext, sourcePath, current());
    });
    span.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
    });
    span.addEventListener("mouseover", (e) => {
      e.stopPropagation();
      this.hoverRef(e, span, parent, source, linktext, sourcePath, current());
    });
    return span;
  }
  /** Caption of a proof with its own text: references show numbers, `$…$` is rendered. */
  proofCaption(title, lang, sourcePath, current, source) {
    const span = createSpan({ cls: `theorem-proof-begin theorem-proof-${lang}` });
    const text = withPeriod(title);
    const re = /\[\[([^\]|]+)(?:\|([^\]]*))?\]\]|\$([^$]+)\$/g;
    let pos = 0, m;
    while (m = re.exec(text)) {
      span.appendText(text.slice(pos, m.index));
      pos = re.lastIndex;
      if (m[3] !== void 0) span.appendChild((0, import_obsidian2.renderMath)(m[3], false));
      else if (m[2] !== void 0) span.appendText(m[2]);
      else {
        const linktext = m[1];
        const { item } = this.resolveTarget(linktext, sourcePath, current());
        const shown = item && refText(item);
        const ref = span.appendChild(this.refEl(shown ?? "\u2026", linktext, sourcePath, current, source));
        if (!shown) this.locate(linktext, sourcePath, current()).then((t) => ref.setText((t && refText(t.item)) ?? "??"));
      }
    }
    span.appendText(text.slice(pos));
    (0, import_obsidian2.finishRenderMath)();
    return span;
  }
  refreshAll(rerenderReading) {
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view;
      if (!(view instanceof import_obsidian2.MarkdownView)) return;
      const cm = view.editor?.cm;
      cm?.dispatch({ effects: refreshEffect.of(null) });
      if (rerenderReading && view.getMode() === "preview") view.previewMode.rerender(true);
    });
  }
  // ---------- reading view ----------
  async postProcess(el, ctx) {
    const info = ctx.getSectionInfo(el);
    const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
    let parsed = null;
    let offset = 0;
    if (info) {
      parsed = this.parseText(ctx.sourcePath, info.text);
      if (file instanceof import_obsidian2.TFile) {
        const whole = await this.loadNote(file).then(() => this.fileCache.get(file.path));
        const k = whole.text === info.text ? -1 : whole.text.indexOf(info.text);
        if (k >= 0) {
          parsed = whole.parsed;
          offset = whole.text.slice(0, k).split("\n").length - 1;
        }
      }
    } else if (file instanceof import_obsidian2.TFile) parsed = this.getParsed(file);
    const lang = this.langOf(parsed);
    if (info && parsed) {
      const inRange = (items) => items.filter((i) => i.line >= info.lineStart + offset && i.line <= info.lineEnd + offset);
      this.pairCallouts(el, inRange(parsed.callouts), lang);
      this.pairEquations(el, inRange(parsed.equations));
      pairHeadings(el, inRange(parsed.headings), lang);
      hideEquationLabels(el, parsed);
    }
    const current = info ? parsed : null;
    this.processLinks(el, ctx.sourcePath, current);
    this.processProofs(el, lang, ctx.sourcePath, current);
  }
  theoremCalloutEls(root) {
    const all = Array.from(root.querySelectorAll(".callout"));
    if (root.matches(".callout")) all.unshift(root);
    return all.filter((c) => theoremType(c.getAttribute("data-callout")));
  }
  pairCallouts(root, items, lang) {
    const els = this.theoremCalloutEls(root);
    els.forEach((el, k) => {
      if (items[k] && items[k].type === theoremType(el.getAttribute("data-callout"))) this.applyCaption(el, items[k], lang);
    });
  }
  pairEquations(root, items) {
    const els = displayMathEls(root);
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
      const aliased = !(a.textContent ?? "").includes(lt.label);
      const set = (item2) => {
        if (item2?.kind === "equation") this.bindEquationLink(a, href, sourcePath, current);
        const t = item2 && refText(item2);
        if (t && !aliased) {
          a.setText(t);
          a.addClass("theorem-ref");
        }
      };
      const { item, pending } = this.resolveTarget(href, sourcePath, current);
      if (item || !pending) return set(item);
      const file = this.linkFile(lt.path, sourcePath);
      if (file) this.loadNote(file).then((p) => set(p.labels.get(lt.label) ?? null));
    });
  }
  processProofs(el, lang, sourcePath, current) {
    el.querySelectorAll("code").forEach((code) => {
      const t = code.textContent?.trim() ?? "";
      const title = proofTitle(t);
      if (t === "\\begin{proof}") code.replaceWith(proofSpan("begin", lang));
      else if (t === "\\end{proof}") code.replaceWith(proofSpan("end", lang));
      else if (title !== null) code.replaceWith(this.proofCaption(title, lang, sourcePath, () => current, "preview"));
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
        if (!view.state.field(import_obsidian2.editorLivePreviewField, false)) return;
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
              plugin.pairCallouts(block, inBlock(parsed.callouts), plugin.langOf(parsed));
              plugin.pairEquations(block, inBlock(parsed.equations));
            } else if (block.matches(".math-block, .math") || block.querySelector("mjx-container")) {
              const eq = parsed.equations.find((e) => e.line <= line && line <= e.endLine);
              const target = block.querySelector(".math-block") ?? block;
              if (eq) applyEquationNumber(target, eq);
            }
          });
          displayMathEls(view.contentDOM).forEach((math) => {
            if (math.closest(".cm-embed-block")) return;
            let line;
            try {
              line = view.state.doc.lineAt(view.posAtDOM(math)).number - 1;
            } catch {
              return;
            }
            const eq = parsed.equations.find((e) => e.line <= line && line <= e.endLine);
            if (eq) applyEquationNumber(math, eq);
          });
          view.contentDOM.querySelectorAll(".callout .theorem-eq").forEach(applyEquationLabel);
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
        if (u.docChanged || u.viewportChanged || u.selectionSet || u.transactions.some((t) => t.effects.some((e) => e.is(refreshEffect))) || u.startState.field(import_obsidian2.editorLivePreviewField, false) !== u.state.field(import_obsidian2.editorLivePreviewField, false)) {
          this.decorations = this.build(u.view);
        }
      }
      build(view) {
        const b = new import_state.RangeSetBuilder();
        if (!view.state.field(import_obsidian2.editorLivePreviewField, false)) return b.finish();
        const sourcePath = view.state.field(import_obsidian2.editorInfoField, false)?.file?.path ?? "";
        const parsed = plugin.parseDoc(view.state.doc);
        const sel = view.state.selection.ranges;
        const touched = (from, to) => sel.some((r) => r.from <= to && r.to >= from);
        const re = /\[\[([^\]|\n]+?)\]\]|`\\(begin|end)\{proof\}(?:\[([^`]*)\])?`/g;
        const headings = new Map(parsed.headings.filter((h) => h.number).map((h) => [h.line, h]));
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
            const heading = headings.get(n - 1);
            if (heading) {
              const at = line.from + /^#+\s*/.exec(line.text)[0].length;
              const caption = headingCaption(heading, plugin.langOf(parsed));
              b.add(at, at, import_view.Decoration.widget({ widget: new HeadingNumberWidget(caption), side: -1 }));
            }
            re.lastIndex = 0;
            let m;
            while (m = re.exec(line.text)) {
              const a = line.from + m.index, z = a + m[0].length;
              if (touched(a, z)) continue;
              if (m[2] === "end" && m[3] !== void 0) continue;
              if (m[2]) {
                const title = m[3] === void 0 ? null : m[3];
                const key = title && title.replace(/\[\[([^\]|]+)\]\]/g, (_, lt) => {
                  const { item: item2 } = plugin.resolveTarget(lt, sourcePath, parsed);
                  return `[[${(item2 && refText(item2)) ?? lt}]]`;
                });
                b.add(a, z, import_view.Decoration.replace({ widget: new ProofWidget(plugin, m[2], plugin.langOf(parsed), title, key, sourcePath) }));
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
  return [...p.callouts, ...p.equations, ...p.headings].map((i) => `${i.line}:${i.number}`).concat(p.lang).join(",");
}
function quoteEnd(doc, line) {
  let end = line;
  while (end + 2 <= doc.lines && /^\s*>/.test(doc.line(end + 2).text)) end++;
  return end;
}
function displayMathEls(root) {
  const found = Array.from(root.querySelectorAll(".math-block, mjx-container[display='true']")).map((el) => el.closest(".math") ?? el);
  return [...new Set(found)];
}
function hideEquationLabels(root, parsed) {
  displayMathEls(root).forEach((math) => {
    const t = math.nextSibling;
    if (!t || t.nodeType !== Node.TEXT_NODE) return;
    const m = /^\s*\^([A-Za-z0-9_-]+)\s*/.exec(t.textContent ?? "");
    if (!m || parsed.labels.get(m[1])?.kind !== "equation") return;
    t.textContent = t.textContent.slice(m[0].length);
    if (t.textContent === "" && t.nextSibling?.nodeName === "BR") t.nextSibling.remove();
  });
}
function applyEquationLabel(el) {
  const label = el.dataset.tcLabel;
  if (!label) return;
  const next = el.nextSibling;
  if (next instanceof HTMLElement && next.matches(".theorem-eq-label")) return;
  const span = createSpan({ cls: "theorem-eq-label", text: `^${label}` });
  const m = next?.nodeType === Node.TEXT_NODE ? new RegExp(`^\\s*\\^${label}(?![\\w-])\\s*`).exec(next.textContent) : null;
  if (m) {
    next.textContent = next.textContent.slice(m[0].length);
    span.addClass("theorem-eq-label-inline");
  }
  el.after(span);
}
function pairHeadings(root, items, lang) {
  const els = Array.from(root.querySelectorAll("h1, h2, h3, h4, h5, h6"));
  if (root.matches("h1, h2, h3, h4, h5, h6")) els.unshift(root);
  els.filter((h) => !h.closest("blockquote, .callout")).forEach((h, k) => {
    const number = items[k] && headingCaption(items[k], lang);
    let span = h.querySelector(":scope > .theorem-heading-number");
    if (!number) return span?.remove();
    span ?? (span = createSpan({ cls: "theorem-heading-number" }));
    span.setText(number);
    if (span.parentElement !== h) h.insertBefore(span, h.querySelector(":scope > .heading-collapse-indicator")?.nextSibling ?? h.firstChild);
  });
}
function holdUntilScrolled(doc) {
  const observer = new MutationObserver((records) => {
    const el = records.flatMap((r) => Array.from(r.addedNodes)).find((n) => n instanceof HTMLElement && n.matches(".popover.hover-popover"));
    if (!el) return;
    observer.disconnect();
    el.addClass("theorem-hover-pending");
    const show = () => {
      window.clearTimeout(timer);
      el.removeClass("theorem-hover-pending");
    };
    const timer = window.setTimeout(show, 1e3);
    const poll = () => {
      if (!el.hasClass("theorem-hover-pending")) return;
      if (el.querySelector(".is-flashing")) show();
      else requestAnimationFrame(poll);
    };
    poll();
  });
  observer.observe(doc.body, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), 1e3);
}
function applyEquationNumber(el, eq) {
  const existing = el.querySelector(":scope > .theorem-eq-number");
  const text = eq.number === null ? null : `(${eq.number})`;
  if (eq.label) el.dataset.tcLabel = eq.label;
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
  constructor(plugin, kind, lang, title, key, sourcePath) {
    super();
    this.plugin = plugin;
    this.kind = kind;
    this.lang = lang;
    this.title = title;
    this.key = key;
    this.sourcePath = sourcePath;
  }
  eq(o) {
    return o.kind === this.kind && o.lang === this.lang && o.key === this.key && o.sourcePath === this.sourcePath;
  }
  toDOM(view) {
    if (this.title === null) return proofSpan(this.kind, this.lang);
    return this.plugin.proofCaption(this.title, this.lang, this.sourcePath, () => this.plugin.parseDoc(view.state.doc), "editor");
  }
};
var HeadingNumberWidget = class extends import_view.WidgetType {
  constructor(number) {
    super();
    this.number = number;
  }
  eq(o) {
    return o.number === this.number;
  }
  toDOM() {
    return createSpan({ cls: "theorem-heading-number", text: this.number });
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
  toDOM(view) {
    return this.plugin.refEl(this.text, this.linktext, this.sourcePath, () => this.plugin.parseDoc(view.state.doc), "editor");
  }
  ignoreEvent() {
    return true;
  }
};
