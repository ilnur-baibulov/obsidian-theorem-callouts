// Pure parsing of a note: theorem callouts, display equations, block labels.
// No Obsidian imports, so it can be tested with plain Node.

/** A language code: "ru", "en", or one added in the settings. */
export type Lang = string;

export const THEOREM_TYPES = [
	"theorem", "lemma", "proposition", "corollary", "definition", "remark",
	"example", "claim", "axiom", "assumption", "exercise", "conjecture", "hypothesis",
] as const;
/** A built-in type or one added in the settings. */
export type TheoremType = string;

/** How a statement is set, as amsthm's theorem styles: italic body, upright body, upright with an italic caption. */
export type Style = "plain" | "definition" | "remark";

export const STYLES: Record<string, Style> = {
	theorem: "plain", lemma: "plain", proposition: "plain", corollary: "plain", claim: "plain",
	conjecture: "plain", hypothesis: "plain", definition: "definition", example: "definition",
	exercise: "definition", axiom: "definition", assumption: "definition", remark: "remark",
};

/** Short names, as Math Booster accepts them: `[!thm]` is `[!theorem]`. */
export const TYPE_ALIASES: Record<string, TheoremType> = {
	axm: "axiom", def: "definition", lem: "lemma", prp: "proposition", thm: "theorem", cor: "corollary",
	clm: "claim", asm: "assumption", exm: "example", exr: "exercise", cnj: "conjecture", hyp: "hypothesis", rmk: "remark",
};

/** Caption words of the built-in languages; `proof` is the word of the proof. */
export const NAMES: Record<string, Record<string, string>> = {
	ru: {
		theorem: "Теорема", lemma: "Лемма", proposition: "Предложение", corollary: "Следствие",
		definition: "Определение", remark: "Замечание", example: "Пример", claim: "Утверждение",
		axiom: "Аксиома", assumption: "Предположение", exercise: "Упражнение",
		conjecture: "Гипотеза", hypothesis: "Гипотеза", proof: "Доказательство",
	},
	en: {
		theorem: "Theorem", lemma: "Lemma", proposition: "Proposition", corollary: "Corollary",
		definition: "Definition", remark: "Remark", example: "Example", claim: "Claim",
		axiom: "Axiom", assumption: "Assumption", exercise: "Exercise",
		conjecture: "Conjecture", hypothesis: "Hypothesis", proof: "Proof",
	},
};

/** What the settings add: words per language, which override and extend NAMES, and types of statements. */
export interface Captions {
	words: Record<Lang, Record<string, string>>;
	types: Record<string, Style>;
}

let captions: Captions = { words: {}, types: {} };

export function setCaptions(c: Captions) { captions = c; }

/** Languages with caption words: the built-in ones and those added in the settings. */
export function languages(): Lang[] {
	return [...new Set([...Object.keys(NAMES), ...Object.keys(captions.words)])];
}

/** Types of statements: the built-in ones, then those added in the settings. */
export function theoremTypes(): TheoremType[] {
	return [...THEOREM_TYPES, ...Object.keys(captions.types).filter(t => !(t in STYLES))];
}

export function styleOf(type: TheoremType): Style {
	return STYLES[type] ?? captions.types[type] ?? "plain";
}

/** Caption word of a type, or `proof`, in a language: the settings, the built-in table, English, the type itself. */
export function word(key: string, lang: Lang): string {
	return captions.words[lang]?.[key] || NAMES[lang]?.[key] || NAMES.en[key] || key[0].toUpperCase() + key.slice(1);
}

/** Theorem type of a callout type, full or short, or null for any other callout. */
export function theoremType(t: string | null | undefined): TheoremType | null {
	const k = t?.toLowerCase() ?? "";
	if (k in STYLES || k in captions.types) return k;
	return TYPE_ALIASES[k] ?? null;
}

export const PROOF_END = "□";

export interface CalloutItem {
	kind: "callout";
	type: TheoremType;
	line: number;      // 0-based line of the header
	endLine: number;   // last line of the callout
	depth: number;     // number of leading '>'
	number: string | null; // null = unnumbered
	title: string;     // raw title text after ']'
	label: string | null;
}

export interface EquationItem {
	kind: "equation";
	line: number;
	endLine: number;
	number: string | null; // only labelled equations without \tag get numbers
	tag: string | null;    // reference text of an equation with \tag{A}: "(A)"; with \tag*{A}: "A"
	label: string | null;
}

export interface HeadingItem {
	kind: "heading";
	line: number;
	level: number;         // number of '#'
	text: string;
	number: string | null; // "2.1" when sections are numbered; "A", "A.1" in the appendix
	label: string | null;  // `^name` on the line below; `^-name` gives the label `name`
	off: boolean;          // `^-` or `^-name` below: no number
}

export type Item = CalloutItem | EquationItem | HeadingItem;

export interface ParsedNote {
	lang: Lang;
	langFromFrontmatter: boolean;
	callouts: CalloutItem[];
	equations: EquationItem[];
	labels: Map<string, Item>;
	headings: HeadingItem[];
	numberSections: boolean;
	codeLines: Set<number>;  // lines inside fenced code blocks and Obsidian's comments `%%…%%`
	labelLines: Set<number>; // lines of labels attached to a block, `^-` included
}

/** How sections are numbered when a note does not say: from the plugin's settings. */
export interface SectionOptions {
	numberSections: boolean; // in notes without `numbersections` in the frontmatter
	appendix: boolean;       // `^app-name` below a top-level heading starts the appendix
	numberWithin: boolean;   // with numbered sections, statements and equations are numbered within sections: 2.3
	titleHeading: boolean; // the heading that opens a note is its title
	unnumbered: string[];  // headings left without a number in every note
}

export const DEFAULT_SECTIONS: SectionOptions = {
	numberSections: false,
	appendix: false,
	numberWithin: false,
	titleHeading: false,
	unnumbered: ["References", "Bibliography", "Литература", "Список литературы"],
};

const HEADER = /^((?:>\s*)+)\[!([A-Za-z]+)(?:\|([^\]]*))?\]([+-]?)[ \t]*(.*)$/;
const LABEL_LINE = /^\s*\^([A-Za-z0-9_-]+)\s*$/;
const TRAILING_LABEL = /\$\$\s*\^([A-Za-z0-9_-]+)\s*$/;
export const HEADING = /^(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;

function quoteDepth(line: string): number {
	const m = /^((?:>\s*)*)/.exec(line);
	return m ? (m[1].match(/>/g) ?? []).length : 0;
}

function stripQuote(line: string): string {
	return line.replace(/^(?:>\s*)+/, "");
}

export function detectLang(text: string, frontmatterLang?: string): Lang {
	if (frontmatterLang) {
		// `de-CH` takes the table of `de`.
		const l = frontmatterLang.trim().toLowerCase();
		const known = languages().find(k => l === k.toLowerCase() || l.startsWith(k.toLowerCase() + "-"));
		if (known) return known;
	}
	const prose = text
		.replace(/^---\n[\s\S]*?\n---\n/, "")
		.replace(/```[\s\S]*?```/g, "")
		.replace(/\$\$[\s\S]*?\$\$/g, "")
		.replace(/\$[^$\n]*\$/g, "")
		.replace(/\[\[[^\]]*\]\]/g, "")
		.replace(/`[^`\n]*`/g, "");
	const cyr = (prose.match(/[А-Яа-яЁё]/g) ?? []).length;
	const lat = (prose.match(/[A-Za-z]/g) ?? []).length;
	return cyr >= lat && cyr > 0 ? "ru" : "en";
}

// Keys of the plugin's own carry the prefix `thm-`; `lang` and `numbersections` are pandoc's and mean the same there.
interface Frontmatter {
	lang?: string;
	numberSections?: boolean;
	titleHeading?: boolean;
	numberWithin?: boolean;
	end: number;
}

export const unquote = (v: string) => v.trim().replace(/^(["'])(.*)\1$/, "$2").trim();

/** Value of a YAML key: a scalar, `[a, b]`, or a block list `- a` on the following lines. */
function yamlValues(body: string[], key: string): string[] {
	const k = body.findIndex(l => l.startsWith(key + ":"));
	if (k < 0) return [];
	// A comment `# …` ends an unquoted value.
	const v = body[k].slice(key.length + 1).trim().replace(/^([^"'].*?)\s+#.*$/, "$1");
	if (v.startsWith("[")) return v.replace(/^\[|\]$/g, "").split(",").map(unquote).filter(Boolean);
	if (v) return [unquote(v)];
	const items: string[] = [];
	for (const l of body.slice(k + 1)) {
		const m = /^\s+-\s+(.*)$/.exec(l);
		if (!m) break;
		items.push(unquote(m[1]));
	}
	return items;
}

function frontmatter(lines: string[]): Frontmatter {
	if (lines[0] !== "---") return { end: 0 };
	for (let i = 1; i < lines.length; i++) {
		if (lines[i] === "---") {
			const body = lines.slice(1, i);
			const flag = (key: string) => {
				const v = yamlValues(body, key)[0]?.toLowerCase();
				return v === "true" ? true : v === "false" ? false : undefined;
			};
			return {
				lang: yamlValues(body, "lang")[0],
				numberSections: flag("numbersections") ?? flag("thm-numbersections"),
				titleHeading: flag("thm-title-heading"),
				numberWithin: flag("thm-numberwithin"),
				end: i + 1,
			};
		}
	}
	return { end: 0 };
}

/** Heading text as links compare it: case and runs of spaces do not matter. */
/** Obsidian finds a heading by a link without its brackets and commas, so ASCII punctuation, `$` included,
 *  does not count. */
export function headingKey(text: string): string {
	return text.replace(/[!-/:-@[-`{-~]/g, " ").trim().replace(/\s+/g, " ").toLowerCase();
}

export function parseNote(text: string, opts: SectionOptions = DEFAULT_SECTIONS): ParsedNote {
	text = text.replace(/\r\n/g, "\n");
	const lines = text.split("\n");
	const fm = frontmatter(lines);
	const lang = detectLang(text, fm.lang);
	const callouts: CalloutItem[] = [];
	const equations: EquationItem[] = [];
	const labels = new Map<string, Item>();
	const headings: HeadingItem[] = [];
	const codeLines = new Set<number>();
	const labelLines = new Set<number>();

	// Fenced code blocks (also inside quotes) are skipped entirely, and so are Obsidian's comments `%%…%%`:
	// a line that starts inside a comment or with `%%`.
	let fence: string | null = null;
	let comment = false;
	for (let i = fm.end; i < lines.length; i++) {
		const body = stripQuote(lines[i]).trimStart();
		const m = /^(```+|~~~+)/.exec(body);
		if (fence) {
			codeLines.add(i);
			if (m && m[1][0] === fence[0] && m[1].length >= fence.length) fence = null;
		} else if (m && !comment) {
			fence = m[1];
			codeLines.add(i);
		} else {
			if (comment || body.startsWith("%%")) codeLines.add(i);
			if ((lines[i].match(/%%/g) ?? []).length % 2) comment = !comment;
		}
	}

	const auto = new Set<number>(); // indices of callouts numbered by the counter
	// Block that a following standalone label line attaches to.
	let lastBlock: Item | null = null;
	let lastBlockEnd = -1;
	// Inside a quote, `> ^label` attaches to a callout one level deeper that has just ended.
	const lastNested = new Map<number, { item: CalloutItem; end: number }>();

	for (let i = fm.end; i < lines.length; i++) {
		if (codeLines.has(i)) { lastBlock = null; continue; }
		const line = lines[i];

		const lab = LABEL_LINE.exec(stripQuote(line));
		const d = quoteDepth(line);
		if (lab && d > 0) {
			const prev = lastNested.get(d + 1);
			const gapOk = prev && lines.slice(prev.end + 1, i).every(l => stripQuote(l).trim() === "") && i - prev.end <= 2;
			if (prev && gapOk && !prev.item.label) {
				prev.item.label = lab[1];
				labels.set(lab[1], prev.item);
				labelLines.add(i);
			}
			lastNested.delete(d + 1);
			continue;
		}
		if (lab && d === 0) {
			// A label on its own line attaches to the previous block,
			// possibly separated by one blank line.
			const gapOk = lastBlock && lines.slice(lastBlockEnd + 1, i).every(l => l.trim() === "") && i - lastBlockEnd <= 2;
			if (lastBlock?.kind === "heading" && gapOk && !lastBlock.label && !lastBlock.off) {
				// `^-` and `^-name` leave the section without a number.
				const off = lab[1].startsWith("-"), name = off ? lab[1].slice(1) : lab[1];
				lastBlock.off = off;
				if (name) { lastBlock.label = name; labels.set(name, lastBlock); }
				labelLines.add(i);
			} else if (lastBlock && gapOk && !lastBlock.label) {
				lastBlock.label = lab[1];
				labels.set(lab[1], lastBlock);
				labelLines.add(i);
			}
			lastBlock = null;
			continue;
		}

		const h = HEADER.exec(line);
		if (h) {
			const type = theoremType(h[2]);
			const depth = (h[1].match(/>/g) ?? []).length;
			// `> [!lemma]` on a line of a quote that has begun above is text of that quote, as Obsidian shows it.
			if (i > fm.end && quoteDepth(lines[i - 1]) >= depth) continue;
			let end = i;
			while (end + 1 < lines.length && quoteDepth(lines[end + 1]) >= depth) end++;
			if (type) {
				const meta = h[3];
				let number: string | null;
				if (meta === undefined || meta.trim() === "") { number = null; auto.add(callouts.length); }
				else if (meta.trim() === "*") number = null;
				else number = meta.trim();
				const item: CalloutItem = {
					kind: "callout", type, line: i, endLine: end, depth,
					number, title: h[5].trim(), label: null,
				};
				callouts.push(item);
				if (depth === 1) { lastBlock = item; lastBlockEnd = end; }
				else lastNested.set(depth, { item, end });
			}
			// Do not skip the body: nested callouts and equations inside are parsed too.
			continue;
		}

		const hd = quoteDepth(line) === 0 ? HEADING.exec(line) : null;
		if (hd) {
			const item: HeadingItem = { kind: "heading", line: i, level: hd[1].length, text: hd[2], number: null, label: null, off: false };
			headings.push(item);
			lastBlock = item; lastBlockEnd = i;
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
			const item: EquationItem = { kind: "equation", line: i, endLine: end, number: null, tag: null, label: null };
			if (trailing) { item.label = trailing[1]; labels.set(trailing[1], item); }
			equations.push(item);
			if (quoteDepth(line) === 0) { lastBlock = item; lastBlockEnd = end; }
			i = end;
			continue;
		}

		if (line.trim() !== "" && quoteDepth(line) === 0) lastBlock = null;
	}

	const numberSections = fm.numberSections ?? opts.numberSections;
	if (numberSections) numberHeadings(headings, lines, fm, opts);

	// Within sections, as LaTeX's \numberwithin: the counters start anew at each numbered top-level section,
	// whose number goes in front; before the first one it is 0.
	const tops = headings.filter(h => h.number && !h.number.includes("."));
	const within = numberSections && (fm.numberWithin ?? opts.numberWithin) && tops.length > 0;
	const counterAt = () => {
		let section = "0", k = 0;
		return (line: number) => {
			const s = within ? [...tops].reverse().find(h => h.line < line)?.number ?? "0" : "";
			if (s !== section) { section = s; k = 0; }
			return within ? `${s}.${++k}` : String(++k);
		};
	};
	const next = counterAt();
	callouts.forEach((c, k) => { if (auto.has(k)) c.number = next(c.line); });

	// Only labelled equations without an explicit \tag are numbered.
	const nextEq = counterAt();
	for (const e of equations) {
		if (!e.label) continue;
		const src = lines.slice(e.line, e.endLine + 1).join("\n");
		const tag = /\\tag(\*?)\{([^}]*)\}/.exec(src);
		if (tag) { e.tag = tag[1] ? tag[2] : `(${tag[2]})`; continue; }
		e.number = nextEq(e.line);
	}

	return { lang, langFromFrontmatter: !!fm.lang, callouts, equations, labels, headings, numberSections, codeLines, labelLines };
}

/** Numbers sections as LaTeX does, three levels deep, from the top heading level used. With `thm-title-heading`
 *  (or the setting) the heading that opens the note is its title and has no number; the PDF export takes it so.
 *  A heading with `^-` below, or listed in the setting and without a label, stays without a number,
 *  with everything under it. With the appendix setting on, `^app-name` below a top-level heading starts the appendix:
 *  from it on sections are lettered A, B, as after `\appendix` in LaTeX. */
function numberHeadings(headings: HeadingItem[], lines: string[], fm: Frontmatter, opts: SectionOptions) {
	let list = headings;
	const first = lines.slice(fm.end).findIndex(l => l.trim() !== "") + fm.end;
	if ((fm.titleHeading ?? opts.titleHeading) && list[0]?.line === first) list = list.slice(1);
	if (!list.length) return;
	const top = Math.min(...list.map(h => h.level));
	const unnumbered = new Set(opts.unnumbered.map(headingKey));
	const counters = [0, 0, 0];
	let skipBelow = 0; // level of an unnumbered heading whose subsections are skipped too, or 0
	let inAppendix = false;
	for (const h of list) {
		if (skipBelow && h.level > skipBelow) continue;
		skipBelow = 0;
		if (h.off || (!h.label && unnumbered.has(headingKey(h.text)))) { skipBelow = h.level; continue; }
		const depth = h.level - top;
		if (opts.appendix && depth === 0 && !inAppendix && h.label?.startsWith("app-")) { inAppendix = true; counters.fill(0); }
		if (depth > 2) continue;
		counters[depth]++;
		counters.fill(0, depth + 1);
		const parts = counters.slice(0, depth + 1).map(String);
		if (inAppendix) parts[0] = String.fromCharCode(64 + counters[0]);
		h.number = parts.join(".");
	}
}

/** Text shown for a reference to `item`, or null if it has no number; a section without a number shows its heading.
 *  A statement shows its number, or with `shows` its name, «Лемма 3», or its name and title, «Лемма 3 (малый след)». */
export function refText(item: Item, lang: Lang = "en", shows: "number" | "name" | "full" = "number"): string | null {
	if (item.kind === "equation") return item.number === null ? item.tag : `(${item.number})`;
	if (item.kind === "heading") return item.number ?? item.text;
	if (item.number === null || shows === "number") return item.number;
	const name = captionHead(item, lang);
	return shows === "full" && item.title ? `${name} (${item.title})` : name;
}

/** Item a link `#^label` points to. A link to a heading by its name stays an ordinary link. */
export function findTarget(p: ParsedNote, lt: { label: string; heading: boolean }): Item | null {
	return lt.heading ? null : p.labels.get(lt.label) ?? null;
}

/** Caption of a theorem callout, e.g. «Лемма 5 (малый след).» — title is passed separately as HTML. */
export function captionHead(item: CalloutItem, lang: Lang): string {
	const name = word(item.type, lang);
	return item.number === null ? name : `${name} ${item.number}`;
}

/** Splits "Note#^label" / "#^label" into path and label, "Note#A#B" into path and the last heading. */
export function parseLinktext(linktext: string): { path: string; label: string; heading: boolean } | null {
	const t = linktext.trim();
	const m = /^([^#|]*)#\^([A-Za-z0-9_-]+)$/.exec(t);
	if (m) return { path: m[1], label: m[2], heading: false };
	const h = /^([^#|^]*)#(?:[^#|]*#)*([^#|]+)$/.exec(t);
	return h ? { path: h[1], label: h[2].trim(), heading: true } : null;
}

/** Text of a proof's custom caption, `\begin{proof}[Proof of Theorem [[#^thm]]]`, or null. */
export function proofTitle(code: string): string | null {
	const m = /^\\begin\{proof\}\[(.*)\]$/s.exec(code.trim());
	return m ? m[1].trim() : null;
}

/** Ends a caption with a period unless it already ends with punctuation, as amsthm does. */
export function withPeriod(text: string): string {
	return /[.!?:]$/.test(text) ? text : text + ".";
}
