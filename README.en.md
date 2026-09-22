# dsh-edit-diff

English | [中文](README.md)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/banner-dark.png">
    <img src="assets/banner.png" alt="DSH Edit Diff — line dedupe, inline word-level emphasis, PTC sub-calls, per-turn summary" width="100%">
  </picture>
</p>

[![license](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
![DSH](https://img.shields.io/badge/DSH-0.1.5--rc.2-4c6ef5?style=flat-square&labelColor=454a54)
[![stars](https://img.shields.io/github/stars/senyayume/dsh-edit-diff?style=flat-square)](https://github.com/senyayume/dsh-edit-diff/stargazers)

A DeepSeek Harness client plugin that redraws line-level diffs on file-mutation tool cards: unchanged
context lines render once, changed lines carry a **full-width red/green background** rather than coloured
text, and the characters that actually changed take a darker shade of that same background. The code
itself is **syntax-highlighted** by a tokenizer shipped inside this plugin, using the same
`--shiki-token-*` theme variables the built-in code and read blocks colour their tokens with — so the
palette matches, both themes are followed, and no DSH core file is touched. It takes over the `edit` /
`write` / `insert` / `str_replace_editor` rows and the `edit` /
`write` sub-calls that `run_code` (PTC) makes — the two shapes the built-in `diffCardModel` refuses
outright. A long hunk is not folded: it lives in a `max-height: 320px` scroll container with every row in
the DOM, while the copy button and the footer stay outside the scroll area. A zero half of `+N -M` is
dropped on the header and on each per-file row (`+87`, not `+87 -0`). At the end of a turn it adds a
changed-files card for that turn (per-file `+N -M`, collapse, review, open).

Right-clicking a row — on the turn card or on a tool row — offers **reveal in file manager**, **copy file
path** and **copy folder path**. Reveal runs through a host route the plugin serves itself
(`explorer.exe /n,/select,…` on Windows, `open -R` on macOS, `xdg-open` on Linux), with the official
`session/openWorkspacePath` opener as a fallback that reports why it was used.

> This page is a summary. The Chinese README ([README.md](README.md)) is the canonical document: it
> carries the measured numbers, the data contracts that were checked against the shipped bundles, and
> the reasons behind what we do not do. Where the two disagree, the Chinese one wins.

## Screenshots

![Diff body on a tool row](assets/tool-row-diff.png)

![Turn change card expanded in place for review](assets/turn-card-review.png)

![Turn change card with its context menu](assets/turn-card-menu.png)

![The same context menu on a tool row](assets/tool-row-menu.png)

All four are **real screenshots** taken on this machine (light theme, the harness bundled with
DSH Desktop). The line numbers shown in the two diff bodies are **window-relative** — the fallback
used when the host half is not loaded in the running process — not the file's own lines. The
anchored form is described under 已知限制 in the Chinese README.

## Install

```bash
dsh plugin add github:senyayume/dsh-edit-diff --profile desktop
```

The package declares `dsh.bundle` → `cordis.patch.yml`, so it mounts itself as a profile layer — no
manual entry to write.

**Two halves, two reload rules.** `lib/client.js` is read from disk on every page load, so a window
refresh is enough. `lib/index.js` is loaded when the harness process starts, and DSH Desktop only hides
to the tray when its window is closed — restart it from the tray. Reloading only the window leaves the
reveal route unregistered, and the client's POST comes back as **405** from the static frontend.

## Requirements

- Tested on the DSH Desktop harness `0.1.5-rc.2` (`@deepseek-ai/dsh-client-ui-primitives` 0.1.5-rc.2);
  route registration was also checked on CLI harness `0.1.1`. On a harness without
  `uiConversation.events` and the `conversation.chat.turnTail` slot the plugin degrades quietly to
  taking over the tool rows only.
- Node ≥ 18 and React 18 to run this repository's tests.
- Reveal is verified on Windows 11. The macOS and Linux commands exist in the code but are **untested on
  real machines**.

## Verify

```bash
npm test                    # = node test/smoke.mjs && node test/host.mjs
node --check lib/client.js
```

## Limits

No undo/redo. Real file line numbers **are** shown: the host half stamps `oldStart`/`newStart` into the
settled hunks, and a hunk whose result block carries no `meta` (a PTC sub-call, pre-install history) is
located in the current file through a fenced read route instead. Only a row neither path can anchor
falls back to a window-relative number, told apart by a dimmer colour alone. **Do not** add a marker
glyph: `~` is a low-profile squiggle that smears into the CSS-drawn `- `/`+ ` row marker at 10px, and
`?` read worse still — both were tried and both were worse than no marker. The cost (a colour-only
distinction is invisible to a colourblind reader) is accepted, not overlooked. Each
remaining omission is recorded in the Chinese README's 已知限制 section, including why a DSH core patch
is not an option here.

Syntax highlighting uses a **local tokenizer shipped with this plugin**, because
`@deepseek-ai/dsh-client-ui-primitives@0.1.5-rc.2` does **not export** its highlighter:
`highlightLines`, `subscribeGrammarLoaded` and `grammarLoadCount` are **defined but not exported** — they
are visible inside the module and used by the package's own `CodeBlock`, yet absent from its `export {}`
list. So the plugin cannot reuse the built-in highlighter, and patching the shipped primitives is not an
option either (that is an official file).

The **palette is still shared** with the built-in blocks: `CodeBlock` tokenizes through shiki's
`createCssVariablesTheme` (`variablePrefix: "--shiki-"`), so every token colour is a `--shiki-token-*`
custom property that the theme package defines in `:root` for light and `body[data-ds-dark-theme]` for
dark. The local tokenizer maps its own token classes onto those same variables, so a token in a diff and
the same token in a code block render the same colour, in both themes. **No colour literal is hard-coded
in the plugin.** Note those variable names belong to the theme package: renaming them there means
updating `TOKEN_COLOR` here.

The tokenizer is an **approximation, coarser than shiki**: it recognizes comments, strings, keywords,
numbers, call names and punctuation from small literal tables rather than a grammar, so nested
interpolation, regex-versus-division and heredocs are not understood. An unrecognized word simply keeps
the default foreground — it is never mis-coloured. Multi-line strings (Python docstrings, JS template
literals) are threaded across lines as scanner state, and all offsets are code-point based so an astral
glyph cannot shift a token boundary.

Bundling shiki instead is the other option and it was **decided against** (see the Chinese README's
路线选择): it buys a real grammar, at the cost of a build step and roughly a 3.5 MB client artifact on
this machine. Every colouring complaint that actually reached us turned out to be in the **mark** layer,
not the tokenizer, so shiki would have fixed none of them.

**Prose is not tokenized, and data is coloured lexically only** — added after a user screenshot showed
the first cut colouring English at random. A code tokenizer reading prose highlights `in`, `as`, `with`,
`this`, `for`, `is`, `not`, `and`, `or` and `package` (all keywords), lets an apostrophe in `shiki's`
open a string that swallows the rest of the line, and paints `MIT` / `WASM` / `TODO` as constants. So:

- **plain** (`md`, `mdx`): markdown is prose and is not tokenized at all; the red/green wash and the
  inline change marks still apply. The built-in `CodeBlock` handles markdown because shiki's markdown
  grammar separates prose from fenced code — an approximation cannot, so it colours nothing rather than
  colouring wrongly.
- **lexical only** (`yaml`, `toml`, `ini`): comments, strings and numbers are coloured, but words are
  never classified, so `description: install in the for as is not` is not speckled with keyword colours.
- **full** (every other code language): comments, strings, keywords, numbers, call names, punctuation.

Two more rules keep prose readable everywhere: a single-character quote only opens a string when the
preceding code point is not a word character (`shiki's`, `don't`, `12" wide` no longer swallow a line,
while `'abc'` in real code still works), and SCREAMING_CASE must be longer than one character (a lone
`A` is no longer painted as a constant).

A file whose extension is not in the allowlist — `Makefile`, `.gitignore`, no extension at all —
renders as plain text rather than guessing a language. Nothing is lazily loaded, so there is no
first-frame plain render and no grammar subscription.

## License

MIT — see [LICENSE](LICENSE).
