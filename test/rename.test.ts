import { test } from "node:test";
import assert from "node:assert/strict";
import { renameLinks, linkHeading } from "../src/rename.ts";

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
