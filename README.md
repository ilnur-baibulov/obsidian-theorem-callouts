# Theorem Callouts

An Obsidian plugin for mathematical notes. It numbers theorem-like callouts, shows cross-references as bare numbers, numbers labelled equations and renders proof markers. It has no dependencies and no settings.

## Goals

- Numbered statements and references in Obsidian notes that look like a printed mathematical text: «Lemma 3», «by Lemma 3», «(1)», *Proof.* … □.
- Markup that stays readable as plain Markdown and maps one-to-one to LaTeX `\label`/`\ref`, so a note can become a paper without rewriting.
- Notes written for Math Booster keep working unchanged.
- Small, dependency-free and settings-free: one counter per note, no index, nothing to configure.

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

The plugin is not in the community catalogue yet. To install it by hand:

1. Build it (see Development below) or take `main.js`, `manifest.json` and `styles.css` from this repository.
2. Copy the three files into `<vault>/.obsidian/plugins/theorem-callouts/`.
3. Reload Obsidian and enable Theorem Callouts in Settings → Community plugins. If Math Booster is enabled, disable it, otherwise captions are processed twice.

## Works in

Reading view and Live Preview, including references to other notes. Source mode shows the raw markup.

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
