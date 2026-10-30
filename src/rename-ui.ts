import { App, Editor, MarkdownView, Modal, Notice, Setting, TFile, editorInfoField } from "obsidian";
import { ViewPlugin, ViewUpdate } from "@codemirror/view";
import type TheoremCallouts from "./main";
import { HEADING, headingKey } from "./parse";
import { renameLinks } from "./rename";

interface Change { file: TFile; count: number; text: string; rewrite: (text: string) => string }

/** Changes to the note `file` and to the notes that link to it, with the heading `old` renamed to `name`
 *  in links. `self` is the note's current text. */
async function plan(app: App, file: TFile, self: string, old: string, name: string): Promise<Change[]> {
	const dest = (p: string, src: string) => app.metadataCache.getFirstLinkpathDest(p.trim(), src) === file;
	const own = (text: string) => renameLinks(text, old, name, p => p === "" || dest(p, file.path));
	const changes: Change[] = [{ file, ...own(self), rewrite: t => own(t).text }];
	for (const [src, targets] of Object.entries(app.metadataCache.resolvedLinks)) {
		const f = app.vault.getAbstractFileByPath(src);
		if (src === file.path || !targets[file.path] || !(f instanceof TFile)) continue;
		const rewrite = (text: string) => renameLinks(text, old, name, p => p !== "" && dest(p, src));
		const r = rewrite(await app.vault.cachedRead(f));
		if (r.count) changes.push({ file: f, ...r, rewrite: t => rewrite(t).text });
	}
	return changes;
}

/** Writes the changes; the note open in `editor` is changed line by line, so the cursor stays where it is. */
async function apply(app: App, changes: Change[], editor: Editor | null, editorFile: TFile | null) {
	for (const c of changes) {
		if (editor && c.file === editorFile) setText(editor, c.text);
		else if (c.count) await app.vault.process(c.file, c.rewrite);
	}
	new Notice(`Theorem Callouts: updated ${summary(changes)}.`);
}

function summary(changes: Change[]): string {
	const links = changes.reduce((n, c) => n + c.count, 0);
	const notes = changes.filter(c => c.count).length;
	return `${links} ${links === 1 ? "reference" : "references"} in ${notes} ${notes === 1 ? "note" : "notes"}`;
}

function setText(editor: Editor, after: string) {
	const before = editor.getValue();
	if (before === after) return;
	const a = before.split("\n"), b = after.split("\n");
	const changes = a.length === b.length
		? a.flatMap((l, i) => l === b[i] ? [] : [{ from: { line: i, ch: 0 }, to: { line: i, ch: l.length }, text: b[i] }])
		: [{ from: { line: 0, ch: 0 }, to: editor.offsetToPos(before.length), text: after }];
	editor.transaction({ changes });
}

/** «Rename heading»: the cursor is on a heading; asks for the new name and renames it with its references. */
export function renameCommand(plugin: TheoremCallouts) {
	plugin.addCommand({
		id: "rename-heading",
		name: "Rename heading",
		editorCheckCallback: (checking, editor, view) => {
			const line = editor.getCursor().line;
			const h = HEADING.exec(editor.getLine(line));
			if (!h || !view.file) return false;
			if (checking) return true;
			const file = view.file;
			new NameModal(plugin.app, h[2], async name => {
				if (headingKey(name) === headingKey(h[2])) return;
				const lineText = editor.getLine(line);
				const self = editor.getValue().split("\n");
				self[line] = lineText.replace(h[2], name);
				await apply(plugin.app, await plan(plugin.app, file, self.join("\n"), h[2], name), editor, file);
			}).open();
			return true;
		},
	});
}

/** With the setting on: when the cursor leaves a heading the user has edited, offers to update the references
 *  to its old name. */
export function renameWatcher(plugin: TheoremCallouts) {
	return ViewPlugin.fromClass(class {
		private pending: { path: string; pos: number; old: string } | null = null;
		update(u: ViewUpdate) {
			if (!plugin.settings.renameAsk) { this.pending = null; return; }
			const file = u.state.field(editorInfoField, false)?.file;
			if (this.pending && u.docChanged) this.pending.pos = u.changes.mapPos(this.pending.pos, -1);
			// Only typing counts: opening another note in the same editor replaces the text too.
			if (!this.pending && file && u.transactions.some(t => t.isUserEvent("input") || t.isUserEvent("delete"))) {
				u.changes.iterChangedRanges(fromA => {
					if (this.pending) return;
					const line = u.startState.doc.lineAt(fromA);
					const h = HEADING.exec(line.text);
					if (h) this.pending = { path: file.path, pos: u.changes.mapPos(line.from, -1), old: h[2] };
				});
			}
			const p = this.pending;
			if (!p || !(u.docChanged || u.selectionSet || u.focusChanged)) return;
			if (file?.path !== p.path) { this.pending = null; return; }
			const line = u.state.doc.lineAt(Math.min(p.pos, u.state.doc.length));
			const head = u.state.selection.main.head;
			if (u.view.hasFocus && head >= line.from && head <= line.to) return;
			this.pending = null;
			const h = HEADING.exec(line.text);
			if (h && headingKey(h[2]) !== headingKey(p.old)) offer(plugin, file, u.state.doc.toString(), p.old, h[2]);
		}
	});
}

async function offer(plugin: TheoremCallouts, file: TFile, self: string, old: string, name: string) {
	// A heading of the old name is still there: the references point to it.
	if (self.split("\n").some(l => { const h = HEADING.exec(l); return h && headingKey(h[2]) === headingKey(old); })) return;
	const changes = await plan(plugin.app, file, self, old, name);
	if (!changes.some(c => c.count)) return;
	new ConfirmModal(plugin.app, `«${old}» → «${name}». Update ${summary(changes)}?`, async () => {
		const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
		const editor = view?.file === file ? view.editor : null;
		// The note may have changed while the question was open.
		const fresh = editor ? await plan(plugin.app, file, editor.getValue(), old, name) : changes;
		await apply(plugin.app, fresh, editor, file);
	}).open();
}

class NameModal extends Modal {
	constructor(app: App, private value: string, private done: (name: string) => void) { super(app); }
	onOpen() {
		this.setTitle("Rename heading");
		const submit = () => { const v = this.value.trim(); this.close(); if (v) this.done(v); };
		new Setting(this.contentEl).setName("New name").addText(t => {
			t.setValue(this.value).onChange(v => { this.value = v; });
			t.inputEl.style.width = "100%";
			t.inputEl.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
			window.setTimeout(() => t.inputEl.select(), 0);
		});
		new Setting(this.contentEl).addButton(b => b.setButtonText("Rename").setCta().onClick(submit));
	}
	onClose() { this.contentEl.empty(); }
}

class ConfirmModal extends Modal {
	constructor(app: App, private text: string, private yes: () => void) { super(app); }
	onOpen() {
		this.setTitle("Heading renamed");
		this.contentEl.createEl("p", { text: this.text });
		new Setting(this.contentEl)
			.addButton(b => b.setButtonText("Update").setCta().onClick(() => { this.close(); this.yes(); }))
			.addButton(b => b.setButtonText("Leave as is").onClick(() => this.close()));
	}
	onClose() { this.contentEl.empty(); }
}
