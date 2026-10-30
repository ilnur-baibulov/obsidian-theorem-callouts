import { headingKey } from "./parse.ts";

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
