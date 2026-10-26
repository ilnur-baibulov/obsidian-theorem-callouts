# Theorem Callouts

An Obsidian plugin for mathematical notes. It numbers theorem-like callouts, shows cross-references as bare numbers, numbers labelled equations and renders proof markers. It has no dependencies and only two settings: caption language and callout style.

## Goals

- Numbered statements and references in Obsidian notes that look like a printed mathematical text: «Lemma 3», «by Lemma 3», «(1)», *Proof.* … □.
- Markup that stays readable as plain Markdown and maps one-to-one to LaTeX `\label`/`\ref`, so a note can become a paper without rewriting.
- Notes written for Math Booster keep working unchanged.
- Small and dependency-free: one counter per note, no index, sensible defaults.

## Markup

```markdown
> [!lemma] small trace
> Let $D\subseteq M$ be weakly dense. Then …

^lem-small-trace

By Lemma [[#^lem-small-trace]] and formula [[#^eq-trace]] …

$$\tau(h)<\varepsilon$$ ^eq-trace

`\begin{proof}` … `\end{proof}`
```

| Source | Rendered |
|---|---|
| `> [!lemma] small trace` | **Lemma 3** (small trace). |
| `> [!theorem\|1.11]` | **Theorem 1.11.** — a fixed number, e.g. from a book |
| `> [!definition\|*]` | **Definition.** — no number |
| `[[#^lem-small-trace]]`, `[[Other note#^thm-main]]` | `3` — the word stays in your text, so cases and plurals are yours |
| `$$…$$ ^eq-trace`, `[[#^eq-trace]]` | equation number `(1)` at the right; reference `(1)` |
| `` `\begin{proof}` ``, `` `\end{proof}` `` | *Proof.* … □ |

Types: `theorem`, `lemma`, `proposition`, `corollary`, `definition`, `remark`, `example`, `claim`, `axiom`, `assumption`, `exercise`, `conjecture`, `hypothesis`. All of them share one counter per note. A label is a block id on its own line after the callout, after one blank line. A link with an alias, `[[#^lem-a|this lemma]]`, keeps the alias.

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

## Works in

Reading view and Live Preview, including references to other notes. Source mode shows the raw markup.

Clicking an equation reference opens the note at the equation, also when it spans several lines or sits inside a callout; Ctrl/Cmd-click opens it in a new tab. Hovering shows Obsidian's page preview of the equation, or of the labelled callout it sits in, or of the note at the equation; as with any link, the editor needs Ctrl/Cmd by default.

## Acknowledgements

This plugin exists because of [LaTeX-like Theorem & Equation Referencer](https://github.com/RyotaUshio/obsidian-latex-theorem-equation-referencer), formerly Math Booster, by [Ryota Ushio](https://github.com/RyotaUshio) (MIT). Almost every idea here is his:

- theorem environments as Obsidian callouts, `> [!theorem]`, `> [!lemma]` and the rest, with automatic numbering;
- numbered display equations and references to them through block ids;
- references that show the number instead of the link text, in the spirit of LaTeX's `cleveref`;
- the proof environment written as `` `\begin{proof}` `` … `` `\end{proof}` ``;
- the plain caption style, «**Theorem 3** (title).», and the `theorem-callout-*` CSS classes.

Theorem Callouts keeps his markup unchanged, so a vault written for Math Booster renders here as it is, and a reader can move back to his plugin at any time. Number-only references in Math Booster are drawn by [MathLinks](https://github.com/zhaoshenzhai/obsidian-mathlinks) by Zhaoshen Zhai, which deserves credit for that idea too.

What is different is the implementation. The TypeScript code is written from scratch and covers only numbering, references and proofs, without the vault-wide index, search, link autocomplete, profiles and settings that make the original powerful. The plain caption style in `styles.css` is adapted from Math Booster's `styles/plain.scss`; its copyright notice is reproduced in `LICENSE`. If you need more than this small subset, use the original.

## Development

```
npm install
npm run build   # main.js
npm test        # parser tests
```

To publish a release, set the version in `manifest.json`, `package.json` and `versions.json`, then push a tag with that version (`git tag 0.2.0 && git push origin 0.2.0`); the Release workflow attaches the build and the zip.
