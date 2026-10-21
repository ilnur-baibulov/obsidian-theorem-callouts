import {
	Plugin, MarkdownPostProcessorContext, MarkdownView, TFile, Notice, Keymap,
	editorInfoField, editorLivePreviewField,
} from "obsidian";
import {
	ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType, EditorView,
} from "@codemirror/view";
import { RangeSetBuilder, StateEffect, Text } from "@codemirror/state";
import {
	parseNote, ParsedNote, CalloutItem, EquationItem, Item, Lang,
	THEOREM_TYPES, PROOF, refText, captionHead, parseLinktext,
} from "./parse";

const refreshEffect = StateEffect.define<null>();
const isTheoremType = (t: string | null) => !!t && (THEOREM_TYPES as readonly string[]).includes(t.toLowerCase());

export default class TheoremCallouts extends Plugin {
	private fileCache = new Map<string, { mtime: number; parsed: ParsedNote }>();
	private loading = new Map<string, Promise<ParsedNote>>();
	private textCache = new Map<string, { text: string; parsed: ParsedNote }>();
	private docCache = new WeakMap<Text, ParsedNote>();
	private signatures = new Map<string, string>();
	private originalTitles = new WeakMap<Element, Node[]>();

	async onload() {
		const plugins = (this.app as any).plugins;
		if (plugins?.enabledPlugins?.has("math-booster")) {
			new Notice("Theorem Callouts: disable Math Booster, otherwise captions are processed twice.", 10000);
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

	private parseText(path: string, text: string): ParsedNote {
		const c = this.textCache.get(path);
		if (c && c.text === text) return c.parsed;
		const parsed = parseNote(text);
		this.textCache.set(path, { text, parsed });
		return parsed;
	}

	parseDoc(doc: Text): ParsedNote {
		let p = this.docCache.get(doc);
		if (!p) { p = parseNote(doc.toString()); this.docCache.set(doc, p); }
		return p;
	}

	/** Parsed note if known and fresh; otherwise starts loading and returns the stale value or null. */
	getParsed(file: TFile): ParsedNote | null {
		const c = this.fileCache.get(file.path);
		if (!c || c.mtime !== file.stat.mtime) {
			this.loadNote(file).then(() => this.refreshAll(false));
		}
		return c?.parsed ?? null;
	}

	loadNote(file: TFile): Promise<ParsedNote> {
		const c = this.fileCache.get(file.path);
		if (c && c.mtime === file.stat.mtime) return Promise.resolve(c.parsed);
		let p = this.loading.get(file.path);
		if (!p) {
			p = this.app.vault.cachedRead(file).then(text => {
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

	resolveTarget(linktext: string, sourcePath: string, current: ParsedNote | null): { item: Item | null; pending: boolean } {
		const lt = parseLinktext(linktext);
		if (!lt) return { item: null, pending: false };
		if (lt.path === "" && current) return { item: current.labels.get(lt.label) ?? null, pending: false };
		const file = this.app.metadataCache.getFirstLinkpathDest(lt.path || sourcePath, sourcePath);
		if (!file) return { item: null, pending: false };
		if (file.path === sourcePath && current) return { item: current.labels.get(lt.label) ?? null, pending: false };
		const parsed = this.getParsed(file);
		return { item: parsed?.labels.get(lt.label) ?? null, pending: !parsed };
	}

	refreshAll(rerenderReading: boolean) {
		this.app.workspace.iterateAllLeaves(leaf => {
			const view = leaf.view;
			if (!(view instanceof MarkdownView)) return;
			const cm = (view.editor as any)?.cm as EditorView | undefined;
			cm?.dispatch({ effects: refreshEffect.of(null) });
			if (rerenderReading && view.getMode() === "preview") view.previewMode.rerender(true);
		});
	}

	// ---------- reading view ----------

	private postProcess(el: HTMLElement, ctx: MarkdownPostProcessorContext) {
		const info = ctx.getSectionInfo(el);
		const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
		let parsed: ParsedNote | null = null;
		if (info) parsed = this.parseText(ctx.sourcePath, info.text);
		else if (file instanceof TFile) parsed = this.getParsed(file);
		const lang: Lang = parsed?.lang ?? "en";

		if (info && parsed) {
			const inRange = <T extends Item>(items: T[]) =>
				items.filter(i => i.line >= info.lineStart && i.line <= info.lineEnd);
			this.pairCallouts(el, inRange(parsed.callouts), lang);
			this.pairEquations(el, inRange(parsed.equations));
		}
		this.processLinks(el, ctx.sourcePath, info ? parsed : null);
		this.processProofs(el, lang);
	}

	private theoremCalloutEls(root: HTMLElement): HTMLElement[] {
		const all = Array.from(root.querySelectorAll<HTMLElement>(".callout"));
		if (root.matches(".callout")) all.unshift(root);
		return all.filter(c => isTheoremType(c.getAttribute("data-callout")));
	}

	pairCallouts(root: HTMLElement, items: CalloutItem[], lang: Lang) {
		const els = this.theoremCalloutEls(root);
		els.forEach((el, k) => { if (items[k] && items[k].type === el.getAttribute("data-callout")?.toLowerCase()) this.applyCaption(el, items[k], lang); });
	}

	pairEquations(root: HTMLElement, items: EquationItem[]) {
		const els = Array.from(root.querySelectorAll<HTMLElement>(".math-block"));
		els.forEach((el, k) => { if (items[k]) applyEquationNumber(el, items[k]); });
	}

	applyCaption(callout: HTMLElement, item: CalloutItem, lang: Lang) {
		const inner = callout.querySelector<HTMLElement>(":scope > .callout-title .callout-title-inner");
		if (!inner) return;
		const head = captionHead(item, lang);
		const key = `${head}|${item.title}`;
		if (inner.dataset.tcKey === key) return;
		if (!this.originalTitles.has(inner)) {
			this.originalTitles.set(inner, item.title ? Array.from(inner.childNodes).map(n => n.cloneNode(true)) : []);
		}
		const original = this.originalTitles.get(inner)!;
		inner.empty();
		inner.createSpan({ cls: "theorem-callout-main-title", text: head });
		if (original.length) {
			const sub = inner.createSpan({ cls: "theorem-callout-subtitle" });
			sub.appendText(" (");
			original.forEach(n => sub.appendChild(n.cloneNode(true)));
			sub.appendText(")");
		}
		inner.appendText(".");
		inner.dataset.tcKey = key;
		callout.addClass("theorem-callout", `theorem-callout-${item.type}`, `theorem-callout-${lang}`);
	}

	private processLinks(el: HTMLElement, sourcePath: string, current: ParsedNote | null) {
		el.querySelectorAll<HTMLAnchorElement>("a.internal-link").forEach(a => {
			const href = a.getAttribute("data-href") ?? "";
			const lt = parseLinktext(href);
			if (!lt) return;
			const text = a.textContent ?? "";
			if (!text.includes(lt.label)) return; // the link has its own alias
			const set = (item: Item | null) => { const t = item && refText(item); if (t) { a.setText(t); a.addClass("theorem-ref"); } };
			const { item, pending } = this.resolveTarget(href, sourcePath, current);
			if (item || !pending) return set(item);
			const file = this.app.metadataCache.getFirstLinkpathDest(lt.path || sourcePath, sourcePath);
			if (file) this.loadNote(file).then(p => set(p.labels.get(lt.label) ?? null));
		});
	}

	private processProofs(el: HTMLElement, lang: Lang) {
		el.querySelectorAll("code").forEach(code => {
			const t = code.textContent?.trim();
			if (t === "\\begin{proof}") code.replaceWith(proofSpan("begin", lang));
			else if (t === "\\end{proof}") code.replaceWith(proofSpan("end", lang));
		});
	}

	// ---------- live preview: rendered callouts and equations ----------

	private domPlugin() {
		const plugin = this;
		return ViewPlugin.fromClass(class {
			private observer: MutationObserver;
			private scheduled = false;
			constructor(private view: EditorView) {
				this.observer = new MutationObserver(() => this.schedule());
				this.observer.observe(view.contentDOM, { childList: true, subtree: true });
				this.schedule();
			}
			update(u: ViewUpdate) {
				if (u.docChanged || u.viewportChanged || u.transactions.some(t => t.effects.some(e => e.is(refreshEffect)))) this.schedule();
			}
			schedule() {
				if (this.scheduled) return;
				this.scheduled = true;
				requestAnimationFrame(() => { this.scheduled = false; this.apply(); });
			}
			apply() {
				const view = this.view;
				if (!view.state.field(editorLivePreviewField, false)) return;
				const parsed = plugin.parseDoc(view.state.doc);
				this.observer.disconnect();
				try {
					view.contentDOM.querySelectorAll<HTMLElement>(".cm-embed-block").forEach(block => {
						let line: number;
						try { line = view.state.doc.lineAt(view.posAtDOM(block)).number - 1; } catch { return; }
						const end = quoteEnd(view.state.doc, line);
						const inBlock = <T extends Item>(items: T[]) => items.filter(i => i.line >= line && i.line <= end);
						if (block.querySelector(".callout")) {
							plugin.pairCallouts(block, inBlock(parsed.callouts), parsed.lang);
							plugin.pairEquations(block, inBlock(parsed.equations));
						} else if (block.matches(".math-block, .math") || block.querySelector("mjx-container")) {
							const eq = parsed.equations.find(e => e.line <= line && line <= e.endLine);
							const target = block.querySelector<HTMLElement>(".math-block") ?? block;
							if (eq) applyEquationNumber(target, eq);
						}
					});
				} finally {
					this.observer.observe(view.contentDOM, { childList: true, subtree: true });
				}
			}
			destroy() { this.observer.disconnect(); }
		});
	}

	// ---------- live preview: references and proof markers in the text ----------

	private refPlugin() {
		const plugin = this;
		return ViewPlugin.fromClass(class {
			decorations: DecorationSet;
			constructor(view: EditorView) { this.decorations = this.build(view); }
			update(u: ViewUpdate) {
				if (u.docChanged || u.viewportChanged || u.selectionSet ||
					u.transactions.some(t => t.effects.some(e => e.is(refreshEffect))) ||
					u.startState.field(editorLivePreviewField, false) !== u.state.field(editorLivePreviewField, false)) {
					this.decorations = this.build(u.view);
				}
			}
			build(view: EditorView): DecorationSet {
				const b = new RangeSetBuilder<Decoration>();
				if (!view.state.field(editorLivePreviewField, false)) return b.finish();
				const sourcePath = view.state.field(editorInfoField, false)?.file?.path ?? "";
				const parsed = plugin.parseDoc(view.state.doc);
				const sel = view.state.selection.ranges;
				const touched = (from: number, to: number) => sel.some(r => r.from <= to && r.to >= from);
				const re = /\[\[([^\]|\n]+?)\]\]|`\\(begin|end)\{proof\}`/g;
				// Visible ranges are split around replaced spans of 20+ characters (rendered inline math),
				// so one line can belong to several ranges; RangeSetBuilder needs each line once, in order.
				let done = 0;
				for (const { from, to } of view.visibleRanges) {
					const start = Math.max(view.state.doc.lineAt(from).number, done + 1), stop = view.state.doc.lineAt(to).number;
					done = Math.max(done, stop);
					for (let n = start; n <= stop; n++) {
						if (parsed.codeLines.has(n - 1)) continue;
						const line = view.state.doc.line(n);
						const lab = /^\^([A-Za-z0-9_-]+)\s*$/.exec(line.text);
						if (lab && parsed.labels.has(lab[1])) {
							b.add(line.from, line.from, Decoration.line({ class: "theorem-label-line" }));
							continue;
						}
						re.lastIndex = 0;
						let m: RegExpExecArray | null;
						while ((m = re.exec(line.text))) {
							const a = line.from + m.index, z = a + m[0].length;
							if (touched(a, z)) continue;
							if (m[2]) {
								b.add(a, z, Decoration.replace({ widget: new ProofWidget(m[2] as "begin" | "end", parsed.lang) }));
								continue;
							}
							const { item } = plugin.resolveTarget(m[1], sourcePath, parsed);
							const text = item && refText(item);
							if (text) b.add(a, z, Decoration.replace({ widget: new RefWidget(plugin, text, m[1], sourcePath) }));
						}
					}
				}
				return b.finish();
			}
		}, { decorations: v => v.decorations });
	}
}

// ---------- helpers ----------

function signature(p: ParsedNote): string {
	return [...p.callouts.map(c => `${c.line}:${c.number}`), ...p.equations.map(e => `${e.line}:${e.number}`), p.lang].join(",");
}

/** Last line of the quote block that starts at `line` (0-based). */
function quoteEnd(doc: Text, line: number): number {
	let end = line;
	while (end + 2 <= doc.lines && /^\s*>/.test(doc.line(end + 2).text)) end++;
	return end;
}

function applyEquationNumber(el: HTMLElement, eq: EquationItem) {
	const existing = el.querySelector<HTMLElement>(":scope > .theorem-eq-number");
	const text = eq.number === null ? null : `(${eq.number})`;
	if (!text) { existing?.remove(); return; }
	if (existing?.textContent === text) return;
	existing?.remove();
	el.addClass("theorem-eq");
	el.createSpan({ cls: "theorem-eq-number", text });
}

function proofSpan(kind: "begin" | "end", lang: Lang): HTMLElement {
	const span = createSpan({ cls: `theorem-proof-${kind} theorem-proof-${lang}`, text: PROOF[lang][kind] });
	return span;
}

class ProofWidget extends WidgetType {
	constructor(private kind: "begin" | "end", private lang: Lang) { super(); }
	eq(o: ProofWidget) { return o.kind === this.kind && o.lang === this.lang; }
	toDOM() { return proofSpan(this.kind, this.lang); }
}

class RefWidget extends WidgetType {
	constructor(private plugin: TheoremCallouts, private text: string, private linktext: string, private sourcePath: string) { super(); }
	eq(o: RefWidget) { return o.text === this.text && o.linktext === this.linktext && o.sourcePath === this.sourcePath; }
	toDOM() {
		const span = createSpan({ cls: "cm-hmd-internal-link theorem-ref" });
		const a = span.createEl("a", { cls: "internal-link", text: this.text });
		a.setAttr("data-href", this.linktext);
		span.addEventListener("mousedown", e => {
			if (e.button !== 0) return;
			e.preventDefault();
			this.plugin.app.workspace.openLinkText(this.linktext, this.sourcePath, Keymap.isModEvent(e));
		});
		span.addEventListener("mouseover", e => {
			this.plugin.app.workspace.trigger("hover-link", {
				event: e, source: "editor", hoverParent: { hoverPopover: null },
				targetEl: span, linktext: this.linktext, sourcePath: this.sourcePath,
			});
		});
		return span;
	}
	ignoreEvent() { return true; }
}
