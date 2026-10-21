// Smoke test of the reading-view post-processor on Obsidian-like HTML, with a stub obsidian module.
import { JSDOM } from "jsdom";
import esbuild from "esbuild";
import { readFileSync } from "node:fs";
const dom = new JSDOM("<!doctype html><body></body>");
const { window } = dom; globalThis.window = window; globalThis.document = window.document;
const P = window.HTMLElement.prototype, N = window.Node.prototype;
P.empty = function () { this.innerHTML = ""; };
P.addClass = function (...c) { this.classList.add(...c); };
P.setText = function (t) { this.textContent = t; };
P.setAttr = function (k, v) { this.setAttribute(k, v); };
N.appendText = function (t) { this.appendChild(document.createTextNode(t)); };
P.createSpan = function (o = {}) { const s = createSpan(o); this.appendChild(s); return s; };
P.createEl = function (tag, o = {}) { const s = document.createElement(tag); if (o.cls) s.className = o.cls; if (o.text) s.textContent = o.text; this.appendChild(s); return s; };
globalThis.createSpan = (o = {}) => { const s = document.createElement("span"); if (o.cls) s.className = o.cls; if (o.text) s.textContent = o.text; return s; };
const out = await esbuild.build({ entryPoints: ["src/main.ts"], bundle: true, write: false, format: "cjs", platform: "node",
  plugins: [{ name: "stub", setup(b) { b.onResolve({ filter: /^(obsidian|@codemirror\/.*)$/ }, a => ({ path: a.path, namespace: "stub" }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: `
      class Plugin { constructor(app){this.app=app;} registerMarkdownPostProcessor(){} registerEditorExtension(){} registerEvent(){} }
      class TFile {} class MarkdownView {} class Notice {} class WidgetType {}
      module.exports = { Plugin, TFile, MarkdownView, Notice, WidgetType, Keymap:{}, editorInfoField:{}, editorLivePreviewField:{},
        ViewPlugin:{fromClass:()=>({})}, Decoration:{}, RangeSetBuilder:class{}, StateEffect:{define:()=>({})} };` })); } }] });
const mod = { exports: {} }; new Function("module", "exports", "require", out.outputFiles[0].text)(mod, mod.exports, () => ({}));
const Plugin = mod.exports.default;
const text = readFileSync(process.argv[2], "utf8");
const app = { vault: { getAbstractFileByPath: () => null }, metadataCache: { getFirstLinkpathDest: () => null }, workspace: {} };
const plugin = new Plugin(app);
// Lemma section: find the line of the small-trace lemma and build its DOM.
const lines = text.split("\n");
const lemLine = lines.findIndex((l, i) => l.startsWith("> [!lemma]") && lines[i + 4]?.includes("^lem-small-trace") || l.startsWith("> [!lemma]") && lines.slice(i, i + 6).some(x => x === "^lem-small-trace"));
const el = document.createElement("div");
el.innerHTML = `<div class="callout" data-callout="lemma"><div class="callout-title"><div class="callout-icon"></div><div class="callout-title-inner">Lemma</div></div><div class="callout-content"><p>…</p></div></div>`;
const ctx = (ls, le) => ({ sourcePath: "a.md", getSectionInfo: () => ({ text, lineStart: ls, lineEnd: le }) });
plugin.postProcess(el, ctx(lemLine, lemLine + 3));
console.log("caption:", el.querySelector(".callout-title-inner").textContent);
const remLine = lines.findIndex(l => l.startsWith("> [!remark] сравнение"));
const el2 = document.createElement("div");
el2.innerHTML = `<div class="callout" data-callout="remark"><div class="callout-title"><div class="callout-title-inner">сравнение с алгеброй <em>Weaver</em></div></div></div>`;
plugin.postProcess(el2, ctx(remLine, remLine + 6));
console.log("caption:", el2.querySelector(".callout-title-inner").textContent, "| html:", el2.querySelector(".callout-title-inner").innerHTML);
const p = document.createElement("div");
p.innerHTML = `<p><code>\\begin{proof}</code> По лемме <a class="internal-link" data-href="#^lem-small-trace">^lem-small-trace</a> и <a class="internal-link" data-href="#^thm-main">свою подпись</a>. <code>\\end{proof}</code></p>`;
plugin.postProcess(p, ctx(0, 0));
console.log("paragraph:", p.textContent);
