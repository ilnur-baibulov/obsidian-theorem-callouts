import { test } from "node:test";
import assert from "node:assert/strict";
import { renameLinks, renameInFrontmatter, linkHeading } from "../src/rename.ts";

test("links to the heading are renamed, others stay", () => {
	const text = "см. [[#Оценки]], [[#оценки|там]], ![[#Оценки]], [[Note#Оценки#Шаг 1]], [[#^lem-a]], [[#Оценки снизу]], [[Other#Оценки]]";
	const r = renameLinks(text, "Оценки", "Оценки сверху", p => p === "" || p === "Note");
	assert.equal(r.count, 4);
	assert.equal(r.text, "см. [[#Оценки сверху]], [[#Оценки сверху|там]], ![[#Оценки сверху]], [[Note#Оценки сверху#Шаг 1]], [[#^lem-a]], [[#Оценки снизу]], [[Other#Оценки]]");
});

test("punctuation and brackets in headings", () => {
	assert.equal(linkHeading("Пример из [PBK, §6.5]"), "Пример из PBK, §6.5");
	const r = renameLinks("[[#Пример из PBK, §6.5]]", "Пример из [PBK, §6.5]", "Пример #2 из [PBK]", p => p === "");
	assert.equal(r.text, "[[#Пример 2 из PBK]]");
});

test("frontmatter names", () => {
	const fm = "---\nthcl-appendix: Доказательства\nthcl-unnumbered: [Благодарности, Источники]\ntags:\n  - Источники\n---\n# Источники";
	const r = renameInFrontmatter(fm, "Источники", "Литература");
	assert.equal(r.count, 1);
	assert.equal(r.text, "---\nthcl-appendix: Доказательства\nthcl-unnumbered: [Благодарности, Литература]\ntags:\n  - Источники\n---\n# Источники");
	const c = renameInFrontmatter(fm, "Благодарности", "Спасибо, коллеги");
	assert.equal(c.text, "---\nthcl-appendix: Доказательства\nthcl-unnumbered:\n  - \"Спасибо, коллеги\"\n  - Источники\ntags:\n  - Источники\n---\n# Источники");
	const b = renameInFrontmatter("---\nthcl-unnumbered:\n  - \"A, b\"\nthcl-appendix: Доказательства\n---", "A, b", "C");
	assert.equal(b.text, "---\nthcl-unnumbered:\n  - C\nthcl-appendix: Доказательства\n---");
	assert.equal(renameInFrontmatter("---\nthcl-appendix: Доказательства\n---", "доказательства", "Proofs: all").text, "---\nthcl-appendix: \"Proofs: all\"\n---");
});
