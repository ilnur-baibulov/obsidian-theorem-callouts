import { headingKey, unquote } from "./parse.ts";

/** A heading as a link writes it: without square brackets, and without `#`, `|`, `^`, which end a part of a link. */
export function linkHeading(text: string): string {
	return text.replace(/[[\]]/g, "").replace(/[#|^]/g, " ").replace(/\s+/g, " ").trim();
}

const LINK = /(!?\[\[)([^[\]|#\n]*)((?:#[^[\]|#\n]+)+)(\|[^\]\n]*)?\]\]/g;

/** Rewrites links to the heading `old`, `[[path#Old]]`, `[[path#Old|alias]]`, `![[path#Old]]`,
 *  for every path that `isTarget` accepts; `[[#Old]]` has the empty path. */
export function renameLinks(text: string, old: string, name: string, isTarget: (path: string) => boolean): { text: string; count: number } {
	const key = headingKey(old);
	let count = 0;
	const out = text.replace(LINK, (all, open: string, path: string, sub: string, alias = "") => {
		if (!isTarget(path)) return all;
		let hit = false;
		const parts = sub.slice(1).split("#").map(p => {
			if (p.startsWith("^") || headingKey(p) !== key) return p;
			hit = true;
			return linkHeading(name);
		});
		if (!hit) return all;
		count++;
		return `${open}${path}#${parts.join("#")}${alias}]]`;
	});
	return { text: out, count };
}

const NAME_KEYS = ["thcl-unnumbered", "thcl-appendix"];

/** A YAML scalar, quoted when it would otherwise be read differently. */
function yamlString(v: string): string {
	return /[:#,[\]{}&*!|>'"%@`]|^[-?\s]|\s$/.test(v) ? `"${v.replace(/"/g, "'")}"` : v;
}

/** Renames the heading `old` in `thcl-unnumbered` and `thcl-appendix`. A flow list `[a, b]` becomes
 *  a block list when the new name has a comma. */
export function renameInFrontmatter(text: string, old: string, name: string): { text: string; count: number } {
	const lines = text.split("\n");
	if (lines[0] !== "---") return { text, count: 0 };
	const key = headingKey(old);
	const hit = (v: string) => headingKey(unquote(v)) === key;
	let count = 0, inKey = false;
	for (let i = 1; i < lines.length && lines[i] !== "---"; i++) {
		const item = /^(\s+-\s+)(.*)$/.exec(lines[i]);
		if (item) {
			if (inKey && hit(item[2])) { lines[i] = item[1] + yamlString(name); count++; }
			continue;
		}
		const m = /^([\w-]+):\s*(.*)$/.exec(lines[i]);
		inKey = !!m && NAME_KEYS.includes(m[1]);
		if (!m || !inKey || !m[2]) continue;
		if (!m[2].startsWith("[")) {
			if (hit(m[2])) { lines[i] = `${m[1]}: ${yamlString(name)}`; count++; }
			continue;
		}
		const items = m[2].replace(/^\[|\]$/g, "").split(",").map(unquote).filter(Boolean);
		if (!items.some(v => hit(v))) continue;
		const renamed = items.map(v => hit(v) ? (count++, name) : v);
		const block = renamed.some(v => v.includes(","));
		const repl = block ? [`${m[1]}:`, ...renamed.map(v => `  - ${yamlString(v)}`)] : [`${m[1]}: [${renamed.map(yamlString).join(", ")}]`];
		lines.splice(i, 1, ...repl);
		i += repl.length - 1;
	}
	return { text: lines.join("\n"), count };
}
