import { App, PluginSettingTab, Setting } from "obsidian";
import type TheoremCallouts from "./main";
import { DEFAULT_SECTIONS } from "./parse";

export interface TheoremSettings {
	language: "auto" | "ru" | "en";  // used when the note has no `lang:` in its frontmatter
	plainStyle: boolean;
	titleHeading: boolean; // with numbered sections, the heading that opens a note is its title
	unnumbered: string;    // comma-separated headings left without a number
	renameAsk: boolean;    // after a heading is edited, offer to update the references to it
}

export const DEFAULT_SETTINGS: TheoremSettings = {
	language: "auto",
	plainStyle: true,
	titleHeading: DEFAULT_SECTIONS.titleHeading,
	unnumbered: DEFAULT_SECTIONS.unnumbered.join(", "),
	renameAsk: false,
};

export class TheoremSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: TheoremCallouts) { super(app, plugin); }

	display() {
		const { containerEl } = this;
		containerEl.empty();
		const s = this.plugin.settings;
		new Setting(containerEl).setName("Caption language")
			.setDesc("Language of «Theorem», «Proof» and so on. `lang: ru` / `lang: en` in a note's frontmatter always wins.")
			.addDropdown(d => d
				.addOption("auto", "Detect from the note")
				.addOption("en", "English")
				.addOption("ru", "Русский")
				.setValue(s.language)
				.onChange(v => { s.language = v as TheoremSettings["language"]; this.plugin.saveSettings(); }));
		new Setting(containerEl).setName("Plain style")
			.setDesc("Theorem callouts without box and icon, with a bold caption, as in a printed text. Off: Obsidian's usual callout look.")
			.addToggle(t => t
				.setValue(s.plainStyle)
				.onChange(v => { s.plainStyle = v; this.plugin.saveSettings(); }));
		new Setting(containerEl).setName("Sections").setHeading()
			.setDesc("Sections are numbered in notes with `numbersections: true` in the frontmatter.");
		new Setting(containerEl).setName("First heading is the title")
			.setDesc("The heading that opens a note is its title: it gets no number, and the PDF export takes it as the title. `thcl-title-heading: true` / `false` in a note's frontmatter wins.")
			.addToggle(t => t
				.setValue(s.titleHeading)
				.onChange(v => { s.titleHeading = v; this.plugin.saveSettings(); }));
		new Setting(containerEl).setName("Unnumbered headings")
			.setDesc("Headings that never get a number, separated by commas. `thcl-unnumbered` in a note's frontmatter adds to them.")
			.addText(t => t
				.setValue(s.unnumbered)
				.onChange(v => { s.unnumbered = v; this.plugin.saveSettings(); }));
		new Setting(containerEl).setName("Offer to update references after a heading is edited")
			.setDesc("Obsidian leaves links to a heading unchanged when the heading is renamed. With this on, when the cursor leaves an edited heading, the plugin asks whether to update the links to it in the vault and the names in `thcl-unnumbered` and `thcl-appendix`. The command «Rename heading» does the same at any time.")
			.addToggle(t => t
				.setValue(s.renameAsk)
				.onChange(v => { s.renameAsk = v; this.plugin.saveData(s); }));
	}
}
