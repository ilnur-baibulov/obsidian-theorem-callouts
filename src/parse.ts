// Pure parsing of a note: theorem callouts, display equations, block labels.
// No Obsidian imports, so it can be tested with plain Node.

export type Lang = "ru" | "en";

export const THEOREM_TYPES = [
	"theorem", "lemma", "proposition", "corollary", "definition", "remark",
	"example", "claim", "axiom", "assumption", "exercise", "conjecture", "hypothesis",
] as const;
export type TheoremType = (typeof THEOREM_TYPES)[number];

export const NAMES: Record<Lang, Record<TheoremType, string>> = {
	ru: {
		theorem: "Теорема", lemma: "Лемма", proposition: "Предложение", corollary: "Следствие",
		definition: "Определение", remark: "Замечание", example: "Пример", claim: "Утверждение",
		axiom: "Аксиома", assumption: "Предположение", exercise: "Упражнение",
		conjecture: "Гипотеза", hypothesis: "Гипотеза",
	},
	en: {
		theorem: "Theorem", lemma: "Lemma", proposition: "Proposition", corollary: "Corollary",
		definition: "Definition", remark: "Remark", example: "Example", claim: "Claim",
		axiom: "Axiom", assumption: "Assumption", exercise: "Exercise",
		conjecture: "Conjecture", hypothesis: "Hypothesis",
	},
};

export const PROOF: Record<Lang, { begin: string; end: string }> = {
	ru: { begin: "Доказательство.", end: "□" },
	en: { begin: "Proof.", end: "□" },
};

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

export type Item = CalloutItem | EquationItem;

export interface ParsedNote {
	lang: Lang;
	langFromFrontmatter: boolean;
	callouts: CalloutItem[];
	equations: EquationItem[];
	labels: Map<string, Item>;
	codeLines: Set<number>; // lines inside fenced code blocks
}

const HEADER = /^((?:>\s*)+)\[!([A-Za-z]+)(?:\|([^\]]*))?\]([+-]?)[ \t]*(.*)$/;
const LABEL_LINE = /^\s*\^([A-Za-z0-9_-]+)\s*$/;
const TRAILING_LABEL = /\$\$\s*\^([A-Za-z0-9_-]+)\s*$/;

function quoteDepth(line: string): number {
	const m = /^((?:>\s*)*)/.exec(line);
	return m ? (m[1].match(/>/g) ?? []).length : 0;
}

function stripQuote(line: string): string {
	return line.replace(/^(?:>\s*)+/, "");
}

export function detectLang(text: string, frontmatterLang?: string): Lang {
	if (frontmatterLang) {
		const l = frontmatterLang.trim().toLowerCase();
		if (l.startsWith("ru")) return "ru";
		if (l.startsWith("en")) return "en";
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

function frontmatterLang(lines: string[]): { lang?: string; end: number } {
	if (lines[0] !== "---") return { end: 0 };
	for (let i = 1; i < lines.length; i++) {
		if (lines[i] === "---") {
			const lang = lines.slice(1, i).map(l => /^lang:\s*(.+)$/.exec(l)).find(Boolean)?.[1];
			return { lang, end: i + 1 };
		}
	}
	return { end: 0 };
}

export function parseNote(text: string): ParsedNote {
	const lines = text.split("\n");
	const fm = frontmatterLang(lines);
	const lang = detectLang(text, fm.lang);
	const callouts: CalloutItem[] = [];
	const equations: EquationItem[] = [];
	const labels = new Map<string, Item>();
	const codeLines = new Set<number>();

	// Fenced code blocks (also inside quotes) are skipped entirely.
	let fence: string | null = null;
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
	// Block that a following standalone label line attaches to.
	let lastBlock: Item | null = null;
	let lastBlockEnd = -1;

	for (let i = fm.end; i < lines.length; i++) {
		if (codeLines.has(i)) { lastBlock = null; continue; }
		const line = lines[i];

		const lab = LABEL_LINE.exec(line);
		if (lab && quoteDepth(line) === 0) {
			// A label on its own line attaches to the previous block,
			// possibly separated by one blank line.
			const gapOk = lastBlock && lines.slice(lastBlockEnd + 1, i).every(l => l.trim() === "") && i - lastBlockEnd <= 2;
			if (lastBlock && gapOk && !lastBlock.label) {
				lastBlock.label = lab[1];
				labels.set(lab[1], lastBlock);
			}
			lastBlock = null;
			continue;
		}

		const h = HEADER.exec(line);
		if (h) {
			const type = h[2].toLowerCase() as TheoremType;
			const depth = (h[1].match(/>/g) ?? []).length;
			let end = i;
			while (end + 1 < lines.length && quoteDepth(lines[end + 1]) >= depth) end++;
			if ((THEOREM_TYPES as readonly string[]).includes(type)) {
				const meta = h[3];
				let number: string | null;
				if (meta === undefined || meta.trim() === "") number = String(++counter);
				else if (meta.trim() === "*") number = null;
				else number = meta.trim();
				const item: CalloutItem = {
					kind: "callout", type, line: i, endLine: end, depth,
					number, title: h[5].trim(), label: null,
				};
				callouts.push(item);
				if (depth === 1) { lastBlock = item; lastBlockEnd = end; }
			}
			// Do not skip the body: nested callouts and equations inside are parsed too.
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

	// Only labelled equations without an explicit \tag are numbered.
	for (const e of equations) {
		if (!e.label) continue;
		const src = lines.slice(e.line, e.endLine + 1).join("\n");
		const tag = /\\tag(\*?)\{([^}]*)\}/.exec(src);
		if (tag) { e.tag = tag[1] ? tag[2] : `(${tag[2]})`; continue; }
		e.number = String(++eqCounter);
	}

	return { lang, langFromFrontmatter: !!fm.lang, callouts, equations, labels, codeLines };
}

/** Text shown for a reference to `item`, or null if it has no number. */
export function refText(item: Item): string | null {
	if (item.kind === "equation") return item.number === null ? item.tag : `(${item.number})`;
	return item.number;
}

/** Caption of a theorem callout, e.g. «Лемма 5 (малый след).» — title is passed separately as HTML. */
export function captionHead(item: CalloutItem, lang: Lang): string {
	const name = NAMES[lang][item.type];
	return item.number === null ? name : `${name} ${item.number}`;
}

/** Splits "Note#^label" / "#^label" into path and label. */
export function parseLinktext(linktext: string): { path: string; label: string } | null {
	const m = /^([^#|]*)#\^([A-Za-z0-9_-]+)$/.exec(linktext.trim());
	return m ? { path: m[1], label: m[2] } : null;
}
