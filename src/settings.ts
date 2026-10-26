import { App, PluginSettingTab, Setting } from "obsidian";
import type TheoremCallouts from "./main";

export interface TheoremSettings {
	language: "auto" | "ru" | "en";  // used when the note has no `lang:` in its frontmatter
	plainStyle: boolean;
}

export const DEFAULT_SETTINGS: TheoremSettings = {
	language: "auto",
	plainStyle: true,
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
	}
}
