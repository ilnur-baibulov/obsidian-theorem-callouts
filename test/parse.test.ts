import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseNote, DEFAULT_SECTIONS, setCaptions, styleOf, word, refText, captionHead, parseLinktext, findTarget, proofTitle, withPeriod } from "../src/parse.ts";

const note = `---
created: 2026-10-19
---
# Заметка

Пусть дано пространство.

> [!lemma] малый след
> Текст леммы.
> $$x=1$$

^lem-a

> [!definition|*]
> Определение без номера.

> [!theorem|1.11] из книги
> Книжная теорема.

> [!remark]
> Замечание.
>> [!example]
>> Вложенный пример.

^rem-b

$$
a+b
$$ ^eq-sum

$$c \\tag{7}$$ ^eq-tagged

\`\`\`
> [!lemma] в коде
\`\`\`

По лемме [[#^lem-a]] и формуле [[#^eq-sum]].
`;

test("numbering, labels, explicit and starred numbers", () => {
	const p = parseNote(note);
	assert.equal(p.lang, "ru");
	const nums = p.callouts.map(c => `${c.type}:${c.number}`);
	assert.deepEqual(nums, ["lemma:1", "definition:null", "theorem:1.11", "remark:2", "example:3"]);
	assert.equal(p.labels.get("lem-a")?.line, 7);
	assert.equal((p.labels.get("rem-b") as any).type, "remark");
	assert.equal(refText(p.labels.get("lem-a")!), "1");
	assert.equal(refText(p.labels.get("eq-sum")!), "(1)");
	assert.equal(p.labels.get("eq-tagged")!.number, null);
	assert.equal(refText(p.labels.get("eq-tagged")!), "(7)");
	assert.equal(p.callouts.find(c => c.type === "lemma")!.title, "малый след");
	assert.equal(captionHead(p.callouts[0], "ru"), "Лемма 1");
	assert.equal(captionHead(p.callouts[1], "en"), "Definition");
});

test("multi-line equation inside a callout", () => {
	const p = parseNote("> [!theorem]\n> Then\n> $$\n> x^2\n> $$ ^eq-in\n");
	const eq = p.labels.get("eq-in") as any;
	assert.equal(eq.kind, "equation");
	assert.equal(eq.endLine, 4);
	assert.equal(eq.line, 2);
});

test("language detection ignores math and links", () => {
	assert.equal(parseNote("Let $x\\in\\mathbb R$. Then [[Заметка]] holds.").lang, "en");
	assert.equal(parseNote("---\nlang: en\n---\nПусть $x$.").lang, "en");
});

test("linktext", () => {
	assert.deepEqual(parseLinktext("#^lem-a"), { path: "", label: "lem-a", heading: false });
	assert.deepEqual(parseLinktext("Note name#^thm-main"), { path: "Note name", label: "thm-main", heading: false });
	assert.deepEqual(parseLinktext("Note#Heading"), { path: "Note", label: "Heading", heading: true });
	assert.equal(parseLinktext("Note"), null);
});

test("real article: every link target exists and numbers are sequential", () => {
	const path = process.env.ARTICLE;
	if (!path) return;
	const text = readFileSync(path, "utf8");
	const p = parseNote(text);
	const auto = p.callouts.filter(c => c.number !== null).map(c => Number(c.number));
	assert.deepEqual(auto, auto.map((_, i) => i + 1));
	const links = [...text.matchAll(/\[\[#\^([\w-]+)\]\]/g)].map(m => m[1]);
	for (const l of links) assert.ok(p.labels.has(l), `missing label ${l}`);
	console.log(`callouts=${p.callouts.length} labels=${p.labels.size} links=${links.length} lang=${p.lang}`);
});

test("section numbers and links to headings", () => {
	const src = `---
numbersections: true
---
# Заголовок заметки

## Введение
## Оценки
### Малый  след
#### Слишком глубоко
## Итог
> ## в цитате
\`\`\`
## в коде
\`\`\`
`;
	const p = parseNote(src, { ...DEFAULT_SECTIONS, titleHeading: true });
	assert.deepEqual(p.headings.map(h => `${h.text}:${h.number}`),
		["Заголовок заметки:null", "Введение:1", "Оценки:2", "Малый  след:2.1", "Слишком глубоко:2.1.1", "Итог:3"]);
	// The note's own key overrides the setting.
	const own = parseNote(src.replace("---\n#", "thcl-title-heading: false\n---\n#"), { ...DEFAULT_SECTIONS, titleHeading: true });
	assert.deepEqual(own.headings.slice(0, 3).map(h => h.number), ["1", "1.1", "1.2"]);
	assert.equal(parseNote(src).headings[0].number, "1");
	// A link to a heading by name stays an ordinary link.
	const lt = parseLinktext("#Оценки#малый след")!;
	assert.deepEqual(lt, { path: "", label: "малый след", heading: true });
	assert.equal(findTarget(p, lt), null);
	assert.equal(parseNote(src.replace("numbersections: true", "lang: ru")).headings[1].number, null);
	assert.equal(parseNote("# A\n# B\n## C").headings.map(h => h.number).join(), ",,");
	// The setting numbers every note; the frontmatter wins.
	assert.equal(parseNote("# A\n# B", { ...DEFAULT_SECTIONS, numberSections: true }).headings[1].number, "2");
	assert.equal(parseNote("---\nnumbersections: false\n---\n# A", { ...DEFAULT_SECTIONS, numberSections: true }).headings[0].number, null);
});

test("labels below headings", () => {
	const p = parseNote(`---
numbersections: true
---
## Введение
^sec-intro
### Обозначения

^-
## Оценки $K_1$
^-sec-est
### Внутри
## Итог
## Литература
## References
^refs
`);
	assert.deepEqual(p.headings.map(h => h.number), ["1", null, null, null, "2", null, "3"]);
	assert.equal(refText(p.labels.get("sec-intro")!), "1");
	assert.equal(refText(p.labels.get("sec-est")!), "Оценки $K_1$");
	assert.equal(refText(p.labels.get("refs")!), "3");
	assert.equal(refText(parseNote("## Введение\n^sec-a").labels.get("sec-a")!), "Введение");
});

test("proof captions", () => {
	assert.equal(proofTitle("\\begin{proof}[Доказательство теоремы [[#^thm]]]"), "Доказательство теоремы [[#^thm]]");
	assert.equal(proofTitle("\\begin{proof}"), null);
	assert.equal(withPeriod("Решение"), "Решение.");
	assert.equal(withPeriod("Решение."), "Решение.");
});

test("short type names", () => {
	const p = parseNote("> [!thm] главная\n> Текст.\n^thm-a\n\n> [!lem]\n> Текст.\n\n> [!note]\n> Не теорема.");
	assert.deepEqual(p.callouts.map(c => `${c.type}:${c.number}`), ["theorem:1", "lemma:2"]);
	assert.equal(refText(p.labels.get("thm-a")!), "1");
});

test("appendix", () => {
	const src = `---
numbersections: true
---
## Введение
### Обозначения
## Приложение. Доказательства
^app-proofs
### Лемма о следе
## Таблицы
## Литература
`;
	const p = parseNote(src, { ...DEFAULT_SECTIONS, appendix: true });
	assert.deepEqual(p.headings.map(h => h.number), ["1", "1.1", "A", "A.1", "B", null]);
	assert.equal(refText(p.labels.get("app-proofs")!), "A");
	assert.deepEqual(parseNote(src).headings.map(h => h.number), ["1", "1.1", "2", "2.1", "3", null]);
});

test("a label inside a quote attaches to the callout nested there", () => {
	const p = parseNote("> [!note]- Дополнения\n> Текст.\n>\n> > [!lemma]\n> > Утверждение.\n>\n> ^lem-x\n\n> [!theorem]\n> Т.\n^thm-y\n");
	assert.equal(refText(p.labels.get("lem-x")!), "1");
	assert.equal(refText(p.labels.get("thm-y")!), "2");
});

test("caption words, types of one's own, what a reference shows", () => {
	setCaptions({ words: { de: { theorem: "Satz", problem: "Aufgabe" }, ru: { problem: "Задача" } }, types: { problem: "definition" } });
	const p = parseNote("---\nlang: de-CH\n---\n> [!theorem] Haupt\n> Text.\n^thm-a\n\n> [!problem]\n> Text.\n^pr-b\n\n> [!lemma]\n> Text.");
	assert.equal(p.lang, "de");
	assert.deepEqual(p.callouts.map(c => captionHead(c, p.lang)), ["Satz 1", "Aufgabe 2", "Lemma 3"]);
	assert.equal(styleOf("problem"), "definition");
	assert.equal(word("proof", "de"), "Proof");
	assert.equal(refText(p.labels.get("thm-a")!, "de", "number"), "1");
	assert.equal(refText(p.labels.get("thm-a")!, "de", "name"), "Satz 1");
	assert.equal(refText(p.labels.get("thm-a")!, "de", "full"), "Satz 1 (Haupt)");
	assert.equal(refText(p.labels.get("pr-b")!, "ru", "full"), "Задача 2");
	setCaptions({ words: {}, types: {} });
	assert.equal(parseNote("> [!problem]\n> Текст.").callouts.length, 0);
});

test("numbering within sections", () => {
	const src = `---
numbersections: true
---
> [!lemma]
> До разделов.

## Первый
> [!theorem]
> А.

$$x$$ ^eq-a

## Без номера
^-

> [!lemma]
> Б.

## Второй
> [!lemma]
> В.
^lem-c

$$y$$ ^eq-b
`;
	const p = parseNote(src, { ...DEFAULT_SECTIONS, numberWithin: true });
	assert.deepEqual(p.callouts.map(c => c.number), ["0.1", "1.1", "1.2", "2.1"]);
	assert.equal(refText(p.labels.get("eq-b")!), "(2.1)");
	assert.equal(refText(p.labels.get("eq-a")!), "(1.1)");
	assert.deepEqual(parseNote(src).callouts.map(c => c.number), ["1", "2", "3", "4"]);
	// The note's own key overrides the setting.
	assert.equal(parseNote(src.replace("---\n>", "thcl-number-within: true\n---\n>")).callouts[1].number, "1.1");
	assert.equal(parseNote(src.replace("---\n>", "thcl-number-within: false\n---\n>"), { ...DEFAULT_SECTIONS, numberWithin: true }).callouts[1].number, "2");
});
