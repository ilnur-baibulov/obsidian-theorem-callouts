# Theorem Callouts

An Obsidian plugin for mathematical notes. It numbers theorem-like callouts, labelled equations and, on request, sections; shows cross-references as bare numbers; and renders proof markers. It has no dependencies and few settings. A pandoc filter in `export/` makes a PDF with the same numbers.

## Goals

- Numbered statements and references in Obsidian notes that look like a printed mathematical text: «Lemma 3», «by Lemma 3», «(1)», *Proof.* … □.
- Markup that stays readable as plain Markdown and maps one-to-one to LaTeX `\label`/`\ref`, so a note can become a paper without rewriting.
- Math Booster's markup is read as it is, so notes written for it open without conversion; what renders differently is listed under [Differences from Math Booster](#differences-from-math-booster).
- Small and dependency-free: one counter per note, no index, sensible defaults.

## Markup

```markdown
> [!lemma] small trace
> Let $D\subseteq M$ be weakly dense. Then …

^lem-small-trace

By Lemma [[#^lem-small-trace]] and formula [[#^eq-trace]] …

$$\tau(h)<\varepsilon$$ ^eq-trace

`\begin{proof}` … `\end{proof}`

`\begin{proof}[Proof of Lemma [[#^lem-small-trace]]]` … `\end{proof}`
```

| Source | Rendered |
|---|---|
| `> [!lemma] small trace` | **Lemma 3** (small trace). |
| `> [!theorem\|1.11]` | **Theorem 1.11.** — a fixed number, e.g. from a book |
| `> [!definition\|*]` | **Definition.** — no number |
| `[[#^lem-small-trace]]`, `[[Other note#^thm-main]]` | `3` — the word stays in your text, so cases and plurals are yours |
| `$$…$$ ^eq-trace`, `[[#^eq-trace]]` | equation number `(1)` at the right; reference `(1)` |
| `$$…\tag{A}$$ ^eq-a`, `[[#^eq-a]]` | the tag stays; reference `(A)` |
| `` `\begin{proof}` ``, `` `\end{proof}` `` | *Proof.* … □ |
| `` `\begin{proof}[Proof of Lemma [[#^lem-a]]]` `` | *Proof of Lemma 3.* — your own caption; references show numbers, `$…$` is rendered, a period is added if missing |
| `numbersections: true` in the frontmatter | headings numbered `1`, `2.1`, `2.1.1`; `[[#Heading]]` shows `2.1`, and `??` if the note has no such heading |
| `thcl-title-heading: true` | the heading that opens the note is its title and gets no number |
| `thcl-unnumbered: [Acknowledgements]` | these headings, and those under them, stay without a number, in addition to those in the settings |
| `thcl-appendix: Proofs` | from this heading on, sections are **Appendix A.**, **Appendix B.**, subsections `A.1`; `[[#Proofs]]` shows `A` |

Types: `theorem`, `lemma`, `proposition`, `corollary`, `definition`, `remark`, `example`, `claim`, `axiom`, `assumption`, `exercise`, `conjecture`, `hypothesis`, or Math Booster's short names `thm`, `lem`, `prp`, `cor`, `def`, `rmk`, `exm`, `clm`, `axm`, `asm`, `exr`, `cnj`, `hyp`. All of them share one counter per note. A label is a block id on its own line right after the callout, with or without a blank line between them; for a callout nested in another one, such as a folded `> [!note]-`, the label goes inside the outer callout, `> ^lem-a`. A link with an alias, `[[#^lem-a|this lemma]]`, keeps the alias. A labelled equation is written on one line, `$$…$$ ^eq-trace`, because Obsidian closes a multi-line `$$` block only on a line that holds `$$` alone, so a label there breaks the rendering.

Sections are numbered three levels deep, from the top heading level used in the note. The keys of the plugin's own start with `thcl-`, so that they do not mix with other keys in the frontmatter; `numbersections` and `lang` are pandoc's and mean the same there, so the PDF numbers the same sections (`thcl-numbersections` works too). A heading in `thcl-unnumbered` or `thcl-appendix` is written as it stands, without `#`; a name with a comma goes on its own line, `- "Notes, remarks"`, since `[…]` splits at commas. A name that matches no heading, for example after the heading was renamed, is shown in red in the note's properties. Obsidian does not update links to a heading when the heading is renamed, so such a link then shows `??`; the command **Rename heading**, run with the cursor on a heading, renames it and updates the links to it in the vault and its name in `thcl-unnumbered` and `thcl-appendix`. A link to a heading with square brackets omits them: `[[#Example from PBK, §6.5]]` finds «Example from [PBK, §6.5]». The appendix is set in the PDF with the LaTeX package `appendix`.

Captions are in Russian or English. The language is taken from `lang: ru` / `lang: en` in the frontmatter, otherwise detected from the note's prose (math and links are ignored).

Without the plugin the markup degrades gracefully: callouts are ordinary callouts and links still jump to the labelled block. The same markup maps directly to LaTeX `\label`/`\ref`.

## Installation

The plugin is not in the community catalogue yet. Install it in one of two ways.

**From a release.**

1. Download `theorem-callouts.zip` from the latest [release](https://github.com/ilnur-baibulov/obsidian-theorem-callouts/releases).
2. Unpack it into `<vault>/.obsidian/plugins/`, so that you get `<vault>/.obsidian/plugins/theorem-callouts/main.js`, `manifest.json` and `styles.css`.
3. Reload Obsidian and enable Theorem Callouts in Settings → Community plugins.

**With [BRAT](https://github.com/TfTHacker/obsidian42-brat)**, which also keeps the plugin updated: install BRAT, run «BRAT: Add a beta plugin for testing» and enter `ilnur-baibulov/obsidian-theorem-callouts`.

If Math Booster is enabled, disable it, otherwise captions are processed twice.

## Settings

- **Caption language**: language of «Theorem», «Proof» for notes without `lang:` in the frontmatter. By default it is detected from the note's prose.
- **Plain style** (on by default): theorem callouts without box and icon, with a bold caption. Turn it off to keep Obsidian's usual callout look.
- **First heading is the title** (off by default): in a note with numbered sections, the heading that opens the note is its title and gets no number. `thcl-title-heading` in a note wins.
- **Unnumbered headings** (by default `References, Bibliography, Литература, Список литературы`): headings that never get a number.
- **Offer to update references after a heading is edited** (off by default): when the cursor leaves a heading you have edited, the plugin asks whether to update the links to its old name, as the command **Rename heading** does.

## Works in

Reading view and Live Preview, including references to other notes. Source mode shows the raw markup.

Clicking an equation reference opens the note at the equation, also when it sits inside a callout; Ctrl/Cmd-click opens it in a new tab. Hovering shows Obsidian's page preview of the equation, or of the labelled callout it sits in, or of the note at the equation; as with any link, the editor needs Ctrl/Cmd by default.

## PDF export

The folder [`export/`](export) has a pandoc filter, a defaults file and a LaTeX header. They turn a note into LaTeX with the numbers the plugin shows: theorem environments with `\label` and `\ref`, numbered equations, sections, proofs, and references to other notes, which the filter looks up in the vault (the nearest folder above the note that contains `.obsidian`, or `$OBSIDIAN_VAULT`). The filter reads the plugin's settings from the vault, so the title and the unnumbered headings are the same as in Obsidian.

```
pandoc note.md -o note.pdf --defaults export/defaults.yaml
```

It needs xelatex and the fonts named in `defaults.yaml`. With the Pandoc plugin for Obsidian, make the paths in `defaults.yaml` absolute and add `--defaults=/path/to/defaults.yaml` to the plugin's extra arguments. Images in webp are converted to png with macOS `sips`; elsewhere convert them yourself.

## Acknowledgements

This plugin exists because of [LaTeX-like Theorem & Equation Referencer](https://github.com/RyotaUshio/obsidian-latex-theorem-equation-referencer), formerly Math Booster, by [Ryota Ushio](https://github.com/RyotaUshio) (MIT). Almost every idea here is his:

- theorem environments as Obsidian callouts, `> [!theorem]`, `> [!lemma]` and the rest, with automatic numbering, and their short names `[!thm]`, `[!lem]`;
- numbered display equations and references to them through block ids;
- references that show the number instead of the link text, in the spirit of LaTeX's `cleveref`;
- the proof environment written as `` `\begin{proof}` `` … `` `\end{proof}` ``, and its own caption, `` `\begin{proof}[…]` ``;
- the plain caption style, «**Theorem 3** (title).», and the `theorem-callout-*` CSS classes.

Theorem Callouts reads his markup, so a vault written for Math Booster opens here without conversion. In Math Booster, links show the statement's name instead of the link text through [MathLinks](https://github.com/zhaoshenzhai/obsidian-mathlinks) by Zhaoshen Zhai, which deserves credit for that idea too.

What is different is the implementation. The TypeScript code is written from scratch and covers numbering, references and proofs; the original also has a vault-wide index, search, link autocomplete and profiles. The plain caption style in `styles.css` is adapted from Math Booster's `styles/plain.scss`; its copyright notice is reproduced in `LICENSE`. The original's last release, 2.2.0, came out in December 2023, and users report that it fails to load in recent versions of Obsidian ([#258](https://github.com/RyotaUshio/obsidian-latex-theorem-equation-referencer/issues/258), [#260](https://github.com/RyotaUshio/obsidian-latex-theorem-equation-referencer/issues/260)).

## Differences from Math Booster

A note written for Math Booster with its default settings renders here differently in these respects:

- A reference shows the number only, «3», where Math Booster shows «Theorem 3 (title)», and «Note > Theorem 3» for another note. Write the word in the text: «by Lemma [[#^lem-a]]».
- Numbers have no prefix taken from the note's name: in a note «3.2 Compact operators» Math Booster numbers «Theorem 3.2.1», here «Theorem 1».
- Every labelled equation is numbered, whether or not something refers to it; a multi-line `align` gets one number, not one per line.
- Not supported: the linked proof `` `\begin{proof}`@[[…]] ``, `%% display: … %%` comments, the version 1 header `[!math|{…}]`, profiles and per-note settings.

## Roadmap

- Autocomplete: typing `\ref` lists the numbered statements and equations of the note and of the vault, and inserts the link, adding a label where there is none; a command to search them.
- Numbering statements within sections: «Theorem 2.3».
- A setting for what a reference shows: the number only, as now, or «Theorem 3», «Theorem 3 (title)», as in Math Booster.
- Caption words in the settings, one table per language («Theorem», «Proof», «Appendix»), so that a note in any language gets its own captions.

## Development

```
npm install
npm run build   # main.js
npm test        # parser tests
```

To publish a release, set the version in `manifest.json`, `package.json` and `versions.json`, then push a tag with that version (`git tag 0.2.0 && git push origin 0.2.0`); the Release workflow attaches the build and the zip.
