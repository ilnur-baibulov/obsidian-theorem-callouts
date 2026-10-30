import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type TheoremCallouts from "./main";
import { DEFAULT_SECTIONS, NAMES, STYLES, TYPE_ALIASES, Style, languages, theoremTypes, word } from "./parse";

export interface TheoremSettings {
	language: string;      // "auto" or a language code; used when the note has no `lang:` in its frontmatter
	plainStyle: boolean;
	refShows: "number" | "name" | "full"; // a reference to a statement: «3», «Лемма 3», «Лемма 3 (малый след)»
	numberWithin: boolean; // statements and equations numbered within sections: «Теорема 2.3», «(2.1)»
	numberSections: boolean; // in notes without `numbersections` in the frontmatter
	appendix: boolean;       // `^app-name` below a top-level heading starts the appendix
	titleHeading: boolean; // with numbered sections, the heading that opens a note is its title
	unnumbered: string;    // comma-separated headings left without a number
	renameAsk: boolean;    // after a heading is edited, offer to update the references to it
	words: Record<string, Record<string, string>>; // caption words per language, over the built-in ones
	types: Record<string, Style>;                  // types of statements added by the user
}

export const DEFAULT_SETTINGS: TheoremSettings = {
	language: "auto",
	plainStyle: true,
	refShows: "number",
	numberWithin: false,
	numberSections: DEFAULT_SECTIONS.numberSections,
	appendix: DEFAULT_SECTIONS.appendix,
	titleHeading: DEFAULT_SECTIONS.titleHeading,
	unnumbered: DEFAULT_SECTIONS.unnumbered.join(", "),
	renameAsk: false,
	words: {},
	types: {},
};

// Obsidian's own callout types: a statement type of the same name would take over these callouts.
const OBSIDIAN_CALLOUTS = ["note", "abstract", "summary", "tldr", "info", "todo", "tip", "hint", "important", "success",
	"check", "done", "question", "help", "faq", "warning", "caution", "attention", "failure", "fail", "missing", "danger",
	"error", "bug", "quote", "cite", "math"];

const STYLE_NAMES: Record<Style, string> = {
	plain: "as a theorem: italic text",
	definition: "as a definition: upright text",
	remark: "as a remark: upright text",
};

export class TheoremSettingTab extends PluginSettingTab {
	private lang = "ru";        // language whose words are shown
	private newLang = "";
	private newType = "";
	private newStyle: Style = "plain";

	constructor(app: App, private plugin: TheoremCallouts) { super(app, plugin); }

	display() {
		const { containerEl } = this;
		containerEl.empty();
		const s = this.plugin.settings;
		const save = () => this.plugin.saveSettings();
		const redraw = async () => { await save(); this.display(); };

		new Setting(containerEl).setName("Caption language")
			.setDesc("Language of «Theorem», «Proof» and so on. `lang: ru` / `lang: en` in a note's frontmatter always wins.")
			.addDropdown(d => {
				d.addOption("auto", "Detect from the note: Russian or English");
				for (const l of languages()) d.addOption(l, l);
				d.setValue(s.language).onChange(v => { s.language = v; save(); });
			});
		new Setting(containerEl).setName("Plain style")
			.setDesc("Theorem callouts without box and icon, with a bold caption, as in a printed text. Off: Obsidian's usual callout look.")
			.addToggle(t => t.setValue(s.plainStyle).onChange(v => { s.plainStyle = v; save(); }));
		new Setting(containerEl).setName("References show")
			.setDesc("What `[[#^lem-a]]` shows for a statement. With the number only, the word stays in your text and takes its case: «по лемме 3».")
			.addDropdown(d => d
				.addOption("number", "The number: 3")
				.addOption("name", "The name: Lemma 3")
				.addOption("full", "The name and the title: Lemma 3 (small trace)")
				.setValue(s.refShows)
				.onChange(v => { s.refShows = v as TheoremSettings["refShows"]; save(); }));

		new Setting(containerEl).setName("Sections").setHeading();
		new Setting(containerEl).setName("Number sections")
			.setDesc("Number the headings of every note: «1», «2.1». `numbersections: true` / `false` in a note's frontmatter wins. `^-` on the line below a heading leaves it without a number; a label `^name` there lets `[[#^name]]` show the number.")
			.addToggle(t => t.setValue(s.numberSections).onChange(v => { s.numberSections = v; save(); }));
		new Setting(containerEl).setName("Number statements within sections")
			.setDesc("In a note with numbered sections, statements and equations are numbered anew in each section: «Theorem 2.3», «(2.1)».")
			.addToggle(t => t.setValue(s.numberWithin).onChange(v => { s.numberWithin = v; save(); }));
		new Setting(containerEl).setName("Appendix")
			.setDesc("A label `^app-name` on the line below a top-level heading starts the appendix: from that heading on, sections are lettered A, B, subsections A.1, and `[[#^app-name]]` shows «A». The word «Appendix» is not added; write it in the heading if you want it. Off: `^app-name` is an ordinary label.")
			.addToggle(t => t.setValue(s.appendix).onChange(v => { s.appendix = v; save(); }));
		new Setting(containerEl).setName("First heading is the title")
			.setDesc("The heading that opens a note is its title: it gets no number, and the PDF export takes it as the title. `thcl-title-heading: true` / `false` in a note's frontmatter wins.")
			.addToggle(t => t.setValue(s.titleHeading).onChange(v => { s.titleHeading = v; save(); }));
		new Setting(containerEl).setName("Unnumbered headings")
			.setDesc("Headings that get no number, separated by commas, unless a label `^name` stands below them.")
			.addText(t => t.setValue(s.unnumbered).onChange(v => { s.unnumbered = v; save(); }));
		new Setting(containerEl).setName("Offer to update references after a heading is edited")
			.setDesc("Obsidian leaves links to a heading unchanged when the heading is renamed. With this on, when the cursor leaves an edited heading, the plugin asks whether to update the links to it in the vault. Links to a label `[[#^name]]` need no update. The command «Rename heading» does the same at any time.")
			.addToggle(t => t.setValue(s.renameAsk).onChange(v => { s.renameAsk = v; this.plugin.saveData(s); }));

		new Setting(containerEl).setName("Caption words").setHeading()
			.setDesc("The words of the captions in each language. An empty field keeps the word shown in grey. A note takes the words of its language: `lang: de` in the frontmatter, or the caption language above.");
		if (!languages().includes(this.lang)) this.lang = "ru";
		const builtin = this.lang in NAMES;
		new Setting(containerEl).setName("Language")
			.addDropdown(d => {
				for (const l of languages()) d.addOption(l, l);
				d.setValue(this.lang).onChange(v => { this.lang = v; this.display(); });
			})
			.addExtraButton(b => b.setIcon("trash").setTooltip(builtin ? "Built-in languages stay" : `Remove ${this.lang}`)
				.setDisabled(builtin)
				.onClick(() => { if (builtin) return; delete s.words[this.lang]; this.lang = "ru"; redraw(); }));
		new Setting(containerEl).setName("Add a language")
			.setDesc("Its code, as in `lang:`: de, fr, uk. Words left empty are taken from English.")
			.addText(t => t.setPlaceholder("de").setValue(this.newLang).onChange(v => { this.newLang = v.trim().toLowerCase(); }))
			.addButton(b => b.setButtonText("Add").onClick(() => {
				const l = this.newLang;
				if (!/^[a-z]{2,3}(-[a-z0-9]+)?$/.test(l)) return new Notice("A language code is two or three letters: de, fr, uk.");
				if (languages().includes(l)) return new Notice(`${l} is already there.`);
				s.words[l] = {};
				this.lang = l;
				this.newLang = "";
				redraw();
			}));
		const table = s.words[this.lang] ?? {};
		for (const key of [...theoremTypes(), "proof"]) {
			const fallback = NAMES[this.lang]?.[key] || NAMES.en[key] || key[0].toUpperCase() + key.slice(1);
			new Setting(containerEl).setName(key).setClass("theorem-settings-word")
				.addText(t => t.setPlaceholder(fallback).setValue(table[key] ?? "").onChange(v => {
					const w = s.words[this.lang] ??= {};
					if (v.trim()) w[key] = v.trim(); else delete w[key];
					save();
				}));
		}

		new Setting(containerEl).setName("Types of statements").setHeading()
			.setDesc("Types of your own, such as `problem`: `> [!problem]` is then numbered with the other statements. Give it words above.");
		for (const [type, style] of Object.entries(s.types)) {
			new Setting(containerEl).setName(type).setDesc(`${word(type, this.lang)}`)
				.addDropdown(d => {
					for (const [k, v] of Object.entries(STYLE_NAMES)) d.addOption(k, v);
					d.setValue(style).onChange(v => { s.types[type] = v as Style; save(); });
				})
				.addExtraButton(b => b.setIcon("trash").setTooltip(`Remove ${type}`).onClick(() => { delete s.types[type]; redraw(); }));
		}
		new Setting(containerEl).setName("Add a type")
			.setDesc("Latin letters, as written in `> [!problem]`.")
			.addText(t => t.setPlaceholder("problem").setValue(this.newType).onChange(v => { this.newType = v.trim().toLowerCase(); }))
			.addDropdown(d => {
				for (const [k, v] of Object.entries(STYLE_NAMES)) d.addOption(k, v);
				d.setValue(this.newStyle).onChange(v => { this.newStyle = v as Style; });
			})
			.addButton(b => b.setButtonText("Add").onClick(() => {
				const t = this.newType;
				if (!/^[a-z]+$/.test(t)) return new Notice("A type is written in Latin letters: problem.");
				if (t in STYLES || t in TYPE_ALIASES || t in s.types) return new Notice(`${t} is already a type.`);
				if (OBSIDIAN_CALLOUTS.includes(t)) return new Notice(`${t} is one of Obsidian's own callouts.`);
				s.types[t] = this.newStyle;
				this.newType = "";
				redraw();
			}));
	}
}
