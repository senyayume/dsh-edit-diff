window.__ModuleLoader__.load({
	id: "dsh-edit-diff",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const React = require("react");
		const primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		const { DisclosureRow, FileTypeIcon, IconChevronRightOutline14, IconEditOutline16, Menu, StateDot, writeClipboard } = primitives;
		/**
		 * Syntax colouring is this plugin's own, and deliberately so.
		 *
		 * `@deepseek-ai/dsh-client-ui-primitives` does **not** export its tokenizer: its
		 * single `export {...}` list carries the components but not `highlightLines`, not
		 * `subscribeGrammarLoaded`, and not `grammarLoadCount` — those are declared and used
		 * only inside the package's own `CodeBlock`. Reading them off the module namespace
		 * therefore yields `undefined`, which is exactly how an earlier revision silently
		 * degraded every diff to plain text (the `typeof ... === "function"` guard never
		 * fired, so nothing threw and nothing coloured).
		 *
		 * The colours themselves are still shared with the built-in `CodeBlock`: that package
		 * tokenizes through shiki's `createCssVariablesTheme` (`variablePrefix: "--shiki-"`),
		 * so every token colour is a `--shiki-token-*` custom property the theme package
		 * defines in `:root` for light and `body[data-ds-dark-theme]` for dark. A local
		 * tokenizer that maps its own token classes onto those very properties renders the
		 * same palette as the built-in blocks, and follows both themes for free.
		 */
		const h = React.createElement;
		const Fragment = React.Fragment;
		//#region styles
		const STYLE_TAG_ID = "dsh-edit-diff/card.module.css";
		const CSS = ".dsh-edit-diff-root{--dsh-edit-diff-add-bg:color-mix(in srgb,var(--dsw-alias-state-success-primary) 16%,transparent);--dsh-edit-diff-del-bg:color-mix(in srgb,var(--dsw-alias-state-error-primary) 16%,transparent);--dsh-edit-diff-add-bg-hit:color-mix(in srgb,var(--dsw-alias-state-success-primary) 34%,transparent);--dsh-edit-diff-del-bg-hit:color-mix(in srgb,var(--dsw-alias-state-error-primary) 34%,transparent);flex-direction:column;display:flex}.dsh-edit-diff-row{position:relative;overflow:hidden;align-items:center;min-width:0;height:calc(24px + var(--dsh-content-font-delta,0px));display:flex}.dsh-edit-diff-leading{flex-shrink:0;color:var(--dsw-alias-label-tertiary)}.dsh-edit-diff-title{font-weight:400;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));color:var(--dsw-alias-label-secondary);flex:none}.dsh-edit-diff-sep{background:var(--dsw-alias-label-caption);border-radius:1px;flex:none;width:2px;height:2px;margin:0 8px}.dsh-edit-diff-summary{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));color:var(--dsw-alias-label-tertiary);flex:auto;overflow:hidden}.dsh-edit-diff-failure{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));color:var(--dsw-alias-state-error-primary);flex:auto;overflow:hidden}.dsh-edit-diff-file{text-overflow:ellipsis;white-space:nowrap;min-width:0;font:inherit;text-align:left;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));color:var(--dsw-alias-label-secondary);text-decoration:underline dotted;text-decoration-color:var(--dsw-alias-label-tertiary);text-underline-offset:3px;cursor:pointer;background:0 0;border:none;flex:0 auto;margin:0;padding:0;text-decoration-thickness:1px;overflow:hidden}.dsh-edit-diff-file:hover{color:var(--dsw-alias-label-primary);text-decoration-color:currentColor}.dsh-edit-diff-stat{font-family:var(--ds-font-family-code);font-size:calc(var(--dsh-content-font-size-secondary,13px) - 2px);color:var(--dsw-alias-label-secondary);margin-left:10px;transform:translateY(.5px);flex:none;border-radius:4px;padding:0 4px}.dsh-edit-diff-added{background:var(--dsh-edit-diff-add-bg);color:var(--dsw-alias-state-success-primary)}.dsh-edit-diff-removed{background:var(--dsh-edit-diff-del-bg);color:var(--dsw-alias-state-error-primary)}.dsh-edit-diff-stat-zero{color:var(--dsw-alias-label-caption)}.dsh-edit-diff-bodyWrap{flex-direction:column;display:flex}.dsh-edit-diff-body{position:relative;margin:4px 0 4px 4px;background:var(--dsw-alias-markdown-code-block);border-radius:12px;font:var(--dsw-font-markdown-code-block);padding:12px 14px;overflow-x:auto}.dsh-edit-diff-scroll{max-height:320px;overflow-y:auto;overflow-x:auto;display:flex;flex-direction:column}.dsh-edit-diff-line{min-height:22px;white-space:pre;min-width:max-content;padding:0 6px;box-sizing:border-box;tab-size:4}.dsh-edit-diff-line::before{content:'';user-select:none}.dsh-edit-diff-gutter{display:inline-block;min-width:3ch;margin-right:10px;text-align:right;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;user-select:none}.dsh-edit-diff-gutterRelative{color:var(--dsw-alias-label-caption)}.dsh-edit-diff-ctx{background:var(--dsw-alias-markdown-code-block)}.dsh-edit-diff-ctx::before{content:'  '}.dsh-edit-diff-del{background:var(--dsh-edit-diff-del-bg)}.dsh-edit-diff-del::before{content:'- ';color:var(--dsw-alias-label-tertiary)}.dsh-edit-diff-add{background:var(--dsh-edit-diff-add-bg)}.dsh-edit-diff-add::before{content:'+ ';color:var(--dsw-alias-label-tertiary)}.dsh-edit-diff-path{color:var(--dsw-alias-label-primary);font-weight:600;padding-right:56px}.dsh-edit-diff-gap{color:var(--dsw-alias-label-caption)}.dsh-edit-diff-mark{border-radius:2px}.dsh-edit-diff-del .dsh-edit-diff-mark{background:var(--dsh-edit-diff-del-bg-hit)}.dsh-edit-diff-add .dsh-edit-diff-mark{background:var(--dsh-edit-diff-add-bg-hit)}.dsh-edit-diff-token{font:inherit}.dsh-edit-diff-copy{position:absolute;top:8px;right:12px;background:0 0;border:none;padding:0;margin:0;color:var(--dsw-alias-label-secondary);cursor:pointer;font:var(--dsw-font-xs-13)}.dsh-edit-diff-copy:hover{color:var(--dsw-alias-label-primary)}.dsh-edit-diff-footer{padding-top:8px;color:var(--dsw-alias-label-tertiary)}.dsh-edit-diff-turn{--dsh-edit-diff-add-bg:color-mix(in srgb,var(--dsw-alias-state-success-primary) 16%,transparent);--dsh-edit-diff-del-bg:color-mix(in srgb,var(--dsw-alias-state-error-primary) 16%,transparent);--dsh-edit-diff-add-bg-hit:color-mix(in srgb,var(--dsw-alias-state-success-primary) 34%,transparent);--dsh-edit-diff-del-bg-hit:color-mix(in srgb,var(--dsw-alias-state-error-primary) 34%,transparent);margin:4px 0;border:.5px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-base);overflow:hidden;display:flex;flex-direction:column}.dsh-edit-diff-turn-head{align-items:center;gap:12px;min-height:40px;display:flex;padding:0 8px}.dsh-edit-diff-turn-toggle{align-items:center;gap:8px;min-width:0;flex:1 1 auto;border:none;border-radius:8px;background:0 0;margin:0;padding:9px 4px;text-align:left;cursor:pointer;color:var(--dsw-alias-label-primary);font:inherit;overflow:hidden;display:flex}.dsh-edit-diff-turn-caret{color:var(--dsw-alias-label-caption);transition:transform .12s;flex:none;display:inline-flex}.dsh-edit-diff-turn-caret-open{transform:rotate(90deg)}.dsh-edit-diff-turn-title{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:var(--dsh-content-font-size-secondary,13px);font-weight:500;color:var(--dsw-alias-label-primary);overflow:hidden}.dsh-edit-diff-turn-total{font-family:var(--ds-font-family-code);font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px);font-variant-numeric:tabular-nums;flex:none}.dsh-edit-diff-turn-body{flex-direction:column;border-top:.5px solid var(--dsw-alias-border-l1);display:flex}.dsh-edit-diff-turn-item{flex-direction:column;display:flex}.dsh-edit-diff-turn-row{align-items:center;gap:8px;transition:background .1s;display:flex;padding:6px 8px}.dsh-edit-diff-turn-row:hover{background:var(--dsw-alias-interactive-bg-hover-solid)}.dsh-edit-diff-turn-main{align-items:center;gap:8px;min-width:0;flex:1 1 auto;border:none;background:0 0;margin:0;padding:0;font:inherit;text-align:left;cursor:pointer;color:inherit;overflow:hidden;display:flex}.dsh-edit-diff-turn-icon{flex:none;display:inline-flex}.dsh-edit-diff-turn-name{flex:none;min-width:0;max-width:100%;text-overflow:ellipsis;white-space:nowrap;font-size:var(--dsh-content-font-size-secondary,13px);font-weight:500;color:var(--dsw-alias-label-primary);overflow:hidden}.dsh-edit-diff-turn-dir{flex:1 1 auto;min-width:0;text-overflow:ellipsis;white-space:nowrap;font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px);color:var(--dsw-alias-label-caption);overflow:hidden}.dsh-edit-diff-turn-count{align-items:center;gap:8px;font-family:var(--ds-font-family-code);font-size:calc(var(--dsh-content-font-size-secondary,13px) - 2px);font-variant-numeric:tabular-nums;flex:none;display:flex}.dsh-edit-diff-turn-actions{align-items:center;gap:6px;flex:none;display:flex}.dsh-edit-diff-turn-action{flex:none;border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;height:24px;background:var(--dsw-alias-interactive-bg-hover-solid);color:var(--dsw-alias-label-secondary);cursor:pointer;padding:0 8px;font-size:12px;line-height:22px}.dsh-edit-diff-turn-action:hover{border-color:var(--dsw-alias-border-l3);color:var(--dsw-alias-label-primary)}.dsh-edit-diff-turn-more{border:none;border-top:.5px solid var(--dsw-alias-border-l1);background:0 0;margin:0;text-align:left;color:var(--dsw-alias-label-tertiary);cursor:pointer;font:inherit;padding:6px 12px}.dsh-edit-diff-turn-more:hover{background:var(--dsw-alias-interactive-bg-hover-solid);color:var(--dsw-alias-label-secondary)}.dsh-edit-diff-turn-menu{position:absolute;width:0;height:0}.dsh-edit-diff-note{color:var(--dsw-alias-state-error-primary);padding:0 10px 8px;font-size:12px;line-height:18px}.dsh-edit-diff-note-info{color:var(--dsw-alias-label-tertiary)}.dsh-edit-diff-output{white-space:pre-wrap;word-break:break-word;font:var(--dsw-font-markdown-code-block-small);color:var(--dsw-alias-label-secondary);border:.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-markdown-code-block);border-radius:12px;max-height:260px;margin:0;padding:12px 16px;overflow-y:auto}.dsh-edit-diff-inspectButton{border:.5px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);cursor:pointer;opacity:0;border-radius:999px;align-self:flex-start;align-items:center;gap:4px;margin:4px 0 2px 4px;padding:2px 8px;font-size:11px;line-height:16px;transition:opacity .1s;display:inline-flex}.dsh-edit-diff-root:hover .dsh-edit-diff-inspectButton,.dsh-edit-diff-inspectButton:focus-visible{opacity:1}.dsh-edit-diff-inspectButton:hover{background:var(--dsw-alias-interactive-bg-hover-solid);color:var(--dsw-alias-label-primary)}.dsh-edit-diff-retry{border:.5px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:999px;flex:none;margin-left:8px;padding:2px 8px;font-size:11px;line-height:16px}.dsh-edit-diff-retry:hover{background:var(--dsw-alias-interactive-bg-hover-solid);color:var(--dsw-alias-label-primary)}";
		function installStyles() {
			if (typeof document === "undefined") return;
			if (document.querySelector("style[data-plugin-css=" + JSON.stringify(STYLE_TAG_ID) + "]") !== null) return;
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-edit-diff";
			tag.dataset.pluginCss = STYLE_TAG_ID;
			tag.textContent = CSS;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region dictionaries
		const DICT = {
			zh: {
				edit: "编辑",
				write: "写入",
				read: "读取",
				inspect: "检查",
				copy: "复制",
				copied: "已复制",
				collapseAria: "折叠差异",
				expandAria: (count) => `展开其余 ${count} 行`,
				collapse: "折叠",
				expand: (count) => `展开其余 ${count} 行`,
				files: (count) => `${count} 个文件`,
				filesChanged: (count) => `${count} 个文件已更改`,
				open: "打开",
				review: "审查",
				revealInExplorer: "在资源管理器中打开",
				copyFilePath: "复制文件路径",
				copyFolderPath: "复制文件夹路径",
				revealUnavailable: "当前界面没有原生打开通道",
				revealRequested: "已请求在资源管理器中显示（官方 host 已确认）",
				revealOpened: "已请本插件宿主打开资源管理器",
				showMore: (count) => `再显示 ${count} 个文件`,
				showLess: "收起",
				renderFailed: "差异卡渲染失败",
				retry: "重试"
			},
			en: {
				edit: "Edit",
				write: "Write",
				read: "Read",
				inspect: "Inspect",
				copy: "Copy",
				copied: "Copied",
				collapseAria: "Collapse diff",
				expandAria: (count) => `Expand ${count} more lines`,
				collapse: "Collapse",
				expand: (count) => `Expand ${count} more lines`,
				files: (count) => (count === 1 ? "1 file" : `${count} files`),
				filesChanged: (count) => (count === 1 ? "1 file changed" : `${count} files changed`),
				open: "Open",
				review: "Review",
				revealInExplorer: "Show in File Explorer",
				copyFilePath: "Copy file path",
				copyFolderPath: "Copy folder path",
				revealUnavailable: "No native open channel in this surface",
				revealRequested: "Requested reveal in File Explorer (official Host confirmed)",
				revealOpened: "Asked this plugin host half to open the file manager",
				showMore: (count) => (count === 1 ? "Show 1 more file" : `Show ${count} more files`),
				showLess: "Show less",
				renderFailed: "Diff card failed to render",
				retry: "Retry"
			}
		};
		function activeLanguage(locale) {
			try {
				const snapshot = typeof locale?.getSnapshot === "function" ? locale.getSnapshot() : void 0;
				const active = typeof snapshot === "string" ? snapshot : snapshot?.active;
				if (typeof active === "string" && active.toLowerCase().startsWith("en")) return "en";
				if (typeof active === "string" && active !== "") return "zh";
			} catch {}
			return typeof navigator !== "undefined" && typeof navigator.language === "string" && navigator.language.toLowerCase().startsWith("en") ? "en" : "zh";
		}
		function useLanguage(locale) {
			const [language, setLanguage] = React.useState(() => activeLanguage(locale));
			React.useEffect(() => {
				if (typeof locale?.subscribe !== "function") return;
				setLanguage(activeLanguage(locale));
				return locale.subscribe(() => setLanguage(activeLanguage(locale)));
			}, [locale]);
			return language;
		}
		//#endregion
		//#region call model
		function parseArgs(raw) {
			if (typeof raw !== "string" || raw === "") return null;
			try {
				const value = JSON.parse(raw);
				return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
			} catch {
				return null;
			}
		}
		function argsRawOf(block) {
			return ("kind" in block ? block.call?.argsRaw : block.argsRaw) ?? "";
		}
		function settled(block) {
			return "kind" in block;
		}
		function stateOf(block) {
			if (!settled(block)) return "running";
			if (block.error?.code === "interrupted") return "stopped";
			return block.isError ? "error" : "ok";
		}
		function resultText(block) {
			if (!settled(block)) return null;
			const parts = [];
			for (const content of block.content ?? []) parts.push(content?.type === "text" ? content.text : JSON.stringify(content, null, 2));
			if (parts.length === 0 && block.error !== void 0 && block.error !== null) parts.push(`${block.error.name}: ${block.error.code}`);
			const text = parts.join("\n");
			return text === "" ? null : text;
		}
		function firstLine(text) {
			const index = text.indexOf("\n");
			return index === -1 ? text : text.slice(0, index);
		}
		function normalizeSeparators(value) {
			return value.replace(/\\/g, "/");
		}
		function stripTrailingSeparators(value) {
			return value.replace(/\/+$/, "");
		}
		/**
		 * Display one call path the way the built-in rows do: relative to the
		 * session workspace root when it is inside it, `~`-abbreviated when it is
		 * inside the host home, otherwise as authored.
		 */
		function relativizePath(path, cwd, home) {
			if (typeof path !== "string" || path === "") return path ?? "";
			const value = normalizeSeparators(path);
			for (const [root, prefix, offset] of [[cwd, "", 1], [home, "~", 0]]) {
				if (typeof root !== "string" || root === "") continue;
				const base = stripTrailingSeparators(normalizeSeparators(root));
				if (base === "" || base === "~") continue;
				if (value.toLowerCase().startsWith(`${base.toLowerCase()}/`)) return `${prefix}${value.slice(base.length + offset)}`;
			}
			return value;
		}
		function callPath(args) {
			if (args === null) return null;
			for (const key of ["path", "file_path"]) if (typeof args[key] === "string" && args[key] !== "") return args[key];
			return null;
		}
		/**
		 * One 1-based line anchor out of untrusted metadata, or null when it is not
		 * one. The host half stamps `oldStart`/`newStart` into each settled hunk; a hunk
		 * from an older host, or one derived from the arguments, simply has none — and
		 * then the gutter numbers the window instead of claiming a file line.
		 */
		function anchorOf(value) {
			return typeof value === "number" && Number.isInteger(value) && value >= 1 ? value : null;
		}
		/**
		 * The diff hunks a settled result persisted in its metadata, or null when
		 * the payload is absent or malformed (then the arguments are used instead).
		 */
		function metaDiffs(block) {
			if (!settled(block)) return null;
			const meta = block.meta;
			if (typeof meta !== "object" || meta === null || Array.isArray(meta)) return null;
			const diffs = meta.diffs;
			if (!Array.isArray(diffs) || diffs.length === 0) return null;
			const out = [];
			for (const diff of diffs) {
				if (typeof diff !== "object" || diff === null || Array.isArray(diff)) return null;
				if (typeof diff.path !== "string") return null;
				if (diff.oldText !== null && typeof diff.oldText !== "string") return null;
				if (typeof diff.newText !== "string") return null;
				out.push({
					path: diff.path,
					oldText: diff.oldText,
					newText: diff.newText,
					oldStart: anchorOf(diff.oldStart),
					newStart: anchorOf(diff.newStart)
				});
			}
			return out;
		}
		/**
		 * Derive hunks from the model-facing arguments of one file-mutation call.
		 *
		 * Root `write`/`edit`/`insert` and `str_replace_editor`'s `create`,
		 * `str_replace`, and `insert` commands all carry the changed text, so a
		 * run_code sub-call and a replayed turn render the same diff a settled
		 * result metadata would have carried. `replace_all` cannot be expanded
		 * from the arguments alone: that shape is only exact when metadata exists.
		 */
		function deriveDiffs(toolName, args) {
			if (args === null) return [];
			if (toolName === "write") {
				if (typeof args.file_path !== "string" || typeof args.content !== "string") return [];
				return [{
					path: args.file_path,
					oldText: null,
					newText: args.content
				}];
			}
			if (toolName === "edit") {
				if (typeof args.file_path !== "string" || typeof args.old_string !== "string" || typeof args.new_string !== "string") return [];
				return [{
					path: args.file_path,
					oldText: args.old_string === "" ? null : args.old_string,
					newText: args.new_string
				}];
			}
			if (toolName === "insert") {
				if (typeof args.file_path !== "string" || typeof args.new_str !== "string") return [];
				return [{
					path: args.file_path,
					oldText: null,
					newText: args.new_str
				}];
			}
			if (toolName !== "str_replace_editor") return [];
			if (typeof args.path !== "string" || args.path === "") return [];
			if (args.command === "create") {
				if (args.file_text !== void 0 && typeof args.file_text !== "string") return [];
				return [{
					path: args.path,
					oldText: null,
					newText: args.file_text ?? ""
				}];
			}
			if (args.command === "str_replace") {
				if (args.old_str !== void 0 && typeof args.old_str !== "string") return [];
				if (args.new_str !== void 0 && typeof args.new_str !== "string") return [];
				return [{
					path: args.path,
					oldText: args.old_str ?? null,
					newText: args.new_str ?? ""
				}];
			}
			if (args.command === "insert") {
				if (typeof args.new_str !== "string") return [];
				return [{
					path: args.path,
					oldText: null,
					newText: args.new_str
				}];
			}
			return [];
		}
		/**
		 * The hunks a call displays: the applied hunks its result persisted, otherwise the
		 * arguments' own text. A failed call has no applied hunks, and its arguments describe
		 * a change that never landed (a stale-version or string-not-found edit) — nothing is
		 * derived for it, so a red row cannot claim `+N -M` of an edit that did not happen.
		 *
		 * Each hunk is tagged with where it came from, because the two sources differ in more
		 * than accuracy: a metadata hunk is a `structuredPatch` with its own three lines of
		 * context, while an argument-derived one is the bare replaced text and nothing else.
		 * Only the second kind needs the body to fetch context from the file.
		 */
		function resolveDiffs(toolName, block, args) {
			const applied = metaDiffs(block);
			if (applied !== null) return applied.map((diff) => ({
				...diff,
				source: "meta"
			}));
			if (block.isError === true) return [];
			return deriveDiffs(toolName, args).map((diff) => ({
				...diff,
				source: "args"
			}));
		}

		//#endregion
		//#region line dedupe
		/**
		 * Edit distance the middle-band line diff resolves before giving up. Myers
		 * keeps one furthest-reaching-x snapshot per step, so cost grows with the
		 * square of the distance: past this bound a hunk keeps its original text,
		 * which is exactly the built-in rendering, instead of stalling the card.
		 */
		const MAX_EDIT_DISTANCE = 400;
		//#region syntax highlighting
		/**
		 * Lowercased file extension -> language id, mirrored from the read tool's own
		 * `langFromPath` table (`dsh-tool-fs`). The highlighter resolves these ids
		 * through the shared allowlist (ts/tsx/js/json/py/rb/rs/sh/yaml/md/html/css/...),
		 * so a diff of a file the read card highlights highlights here too, and an
		 * extension this table does not list renders plain rather than guessing.
		 */
		const LANG_BY_EXTENSION = {
			ts: "ts",
			tsx: "tsx",
			mts: "ts",
			cts: "ts",
			js: "js",
			jsx: "jsx",
			mjs: "js",
			cjs: "js",
			json: "json",
			jsonc: "json",
			py: "py",
			rb: "rb",
			go: "go",
			rs: "rs",
			java: "java",
			c: "c",
			h: "c",
			cc: "cpp",
			cpp: "cpp",
			hpp: "cpp",
			cxx: "cpp",
			cs: "cs",
			kt: "kotlin",
			swift: "swift",
			php: "php",
			sh: "sh",
			bash: "sh",
			zsh: "sh",
			yaml: "yaml",
			yml: "yaml",
			toml: "toml",
			ini: "ini",
			md: "md",
			markdown: "md",
			mdx: "mdx",
			html: "html",
			htm: "html",
			css: "css",
			scss: "scss",
			less: "less",
			sql: "sql",
			xml: "xml",
			lua: "lua"
		};
		/**
		 * The syntax-highlighting language for one diff path, or undefined when the
		 * path has no extension or one this table does not know.
		 *
		 * Extension-only, so a pathless lookup stays a pure string operation: the
		 * renderer never reads the file system for a hint. A dotfile such as
		 * `.gitignore` (dot at position 0) yields undefined, exactly as the read
		 * tool's `langFromPath` does.
		 */
		function langOfPath(path) {
			if (typeof path !== "string" || path === "") return void 0;
			const base = path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);
			const dot = base.lastIndexOf(".");
			if (dot <= 0) return void 0;
			const ext = base.slice(dot + 1).toLowerCase();
			return Object.hasOwn(LANG_BY_EXTENSION, ext) ? LANG_BY_EXTENSION[ext] : void 0;
		}
		/**
		 * Append one piece of a line to its run list, merging it into the previous run when
		 * the colour matches — so a line renders a handful of spans rather than one per token.
		 */
		function appendRun(runs, text, color) {
			if (text === "") return;
			const last = runs[runs.length - 1];
			if (last !== void 0 && last.color === color) last.text += text;
			else runs.push({
				text,
				color
			});
		}
		//#region tokenizer
		/**
		 * Token class -> the `--shiki-token-*` custom property the theme package colours it
		 * with. These are the exact variables shiki's `createCssVariablesTheme` emits for the
		 * built-in `CodeBlock` (`ui-theme/lib/client.js`, the `shiki.css` sheet), so a diff
		 * token and a code-block token of the same class render the same colour in both
		 * themes. A class absent from this map renders in the inherited foreground, exactly
		 * as an unclassified token does in shiki.
		 */
		const TOKEN_COLOR = {
			comment: "var(--shiki-token-comment)",
			string: "var(--shiki-token-string)",
			keyword: "var(--shiki-token-keyword)",
			constant: "var(--shiki-token-constant)",
			function: "var(--shiki-token-function)",
			parameter: "var(--shiki-token-parameter)",
			punctuation: "var(--shiki-token-punctuation)",
			link: "var(--shiki-token-link)"
		};
		/**
		 * The keyword sets the tokenizer colours as `keyword`. Deliberately small and
		 * literal: this is an approximation of a grammar, not a parser, and a word that is
		 * missing here only renders in the default foreground — never wrongly.
		 */
		const KEYWORDS = {
			common: ["true", "false", "null", "undefined", "this", "new", "delete", "typeof", "instanceof", "in", "of", "void", "yield", "await", "async", "static", "public", "private", "protected", "readonly", "abstract", "final", "override", "extends", "implements", "interface", "enum", "namespace", "declare", "package", "import", "export", "from", "as", "default", "throw", "catch", "try", "finally", "switch", "case", "break", "continue", "do", "while", "for", "if", "else", "return", "class", "function", "const", "let", "var", "super", "with", "debugger"],
			py: ["def", "elif", "except", "raise", "pass", "lambda", "global", "nonlocal", "assert", "del", "not", "and", "or", "is", "None", "True", "False", "self", "cls", "print", "match"],
			rb: ["def", "end", "module", "require", "include", "attr_accessor", "attr_reader", "attr_writer", "nil", "then", "unless", "until", "begin", "rescue", "ensure", "raise", "do", "yield", "self", "puts"],
			go: ["func", "defer", "go", "chan", "select", "map", "range", "struct", "type", "nil", "make", "len", "cap", "append", "panic", "recover", "goroutine"],
			rs: ["fn", "let", "mut", "impl", "trait", "struct", "enum", "match", "mod", "use", "pub", "crate", "self", "Self", "loop", "move", "ref", "where", "dyn", "unsafe", "Some", "None", "Ok", "Err"],
			sh: ["if", "then", "fi", "else", "elif", "for", "do", "done", "while", "case", "esac", "function", "export", "local", "return", "exit", "echo", "set", "unset", "source", "readonly", "shift", "trap", "test"],
			sql: ["select", "from", "where", "insert", "into", "values", "update", "set", "delete", "create", "table", "drop", "alter", "join", "left", "right", "inner", "outer", "on", "group", "by", "order", "having", "limit", "offset", "union", "distinct", "as", "and", "or", "not", "null", "index", "primary", "key", "foreign", "references", "default"],
			css: ["important", "media", "supports", "keyframes", "import", "charset", "inherit", "initial", "unset", "auto", "none", "block", "flex", "grid", "absolute", "relative", "fixed", "sticky"],
			markup: ["html", "head", "body", "div", "span", "script", "style", "class", "id", "href", "src", "type", "xml", "version", "encoding"]
		};
		/**
		 * The keyword lookup per language family, merged over the common set so a language
		 * profile lists only its own extras.
		 */
		const KEYWORD_SETS = new Map();
		for (const [family, words] of Object.entries(KEYWORDS)) {
			if (family === "common") continue;
			KEYWORD_SETS.set(family, new Set([...KEYWORDS.common, ...words]));
		}
		/** Language ids that borrow another family's keyword set verbatim. */
		const KEYWORD_ALIASES = {
			scss: "css",
			less: "css",
			mdx: "markup",
			markdown: "markup",
			html: "markup",
			xml: "markup",
			bash: "sh",
			zsh: "sh",
			csharp: "common"
		};
		/** The keyword set one language id resolves to, or the common set. */
		function keywordSetOf(lang) {
			return KEYWORD_SETS.get(lang) ?? KEYWORD_SETS.get(KEYWORD_ALIASES[lang]) ?? new Set(KEYWORDS.common);
		}
		/** Quote pairs a profile recognises, longest first so a triple quote wins. */
		const QUOTES_COMMON = ['"', "'", "`"];
		const QUOTES_PY = ['"""', "'''", '"', "'"];
		const QUOTES_RB = ['"', "'"];
		const QUOTES_SH = ['"', "'"];
		const QUOTES_SQL = ['"', "'"];
		const QUOTES_MARKUP = ['"', "'"];
		/**
		 * One language profile: which comment forms end a line, which quote strings open a
		 * string, and whether a leading `#` starts a comment. `line` is the line-comment
		 * token, `block` an inline block comment pair, `quotes` the string delimiters ordered
		 * longest first (a triple quote must beat the single it starts with).
		 */
		const LANG_COMMON = {
			line: "//",
			block: ["/*", "*/"],
			quotes: QUOTES_COMMON,
			hashComment: false
		};
		const LANG_PROFILES = {
			py: {
				line: "#",
				block: null,
				quotes: QUOTES_PY,
				hashComment: true
			},
			rb: {
				line: "#",
				block: null,
				quotes: QUOTES_RB,
				hashComment: true
			},
			sh: {
				line: "#",
				block: null,
				quotes: QUOTES_SH,
				hashComment: true
			},
			yaml: {
				line: "#",
				block: null,
				quotes: QUOTES_SH,
				hashComment: true,
				lexicalOnly: true
			},
			toml: {
				line: "#",
				block: null,
				quotes: QUOTES_SH,
				hashComment: true,
				lexicalOnly: true
			},
			ini: {
				line: ";",
				block: null,
				quotes: QUOTES_SH,
				hashComment: true,
				lexicalOnly: true
			},
			sql: {
				line: "--",
				block: ["/*", "*/"],
				quotes: QUOTES_SQL,
				hashComment: false
			},
			css: {
				line: null,
				block: ["/*", "*/"],
				quotes: QUOTES_MARKUP,
				hashComment: false
			},
			scss: {
				line: "//",
				block: ["/*", "*/"],
				quotes: QUOTES_MARKUP,
				hashComment: false
			},
			less: {
				line: "//",
				block: ["/*", "*/"],
				quotes: QUOTES_MARKUP,
				hashComment: false
			},
			html: {
				line: null,
				block: ["<!--", "-->"],
				quotes: QUOTES_MARKUP,
				hashComment: false
			},
			xml: {
				line: null,
				block: ["<!--", "-->"],
				quotes: QUOTES_MARKUP,
				hashComment: false
			}
		};
		/**
		 * Languages that are **not tokenized at all**, and why.
		 *
		 * Markdown is prose. A code tokenizer reading it colours English at random: `in`, `as`,
		 * `with`, `this`, `for`, `is`, `not`, `and`, `or` and `package` are all keywords in the
		 * C-like/Python sets, and an apostrophe in `shiki's` opens a string that swallows the
		 * rest of the line. The built-in `CodeBlock` gets away with markdown because shiki's
		 * markdown grammar knows prose from fenced code; an approximation cannot, so markdown
		 * renders plain — the red/green wash and the inline change marks still apply, and those
		 * are what carry the meaning in a prose diff anyway.
		 */
		const PLAIN_LANGS = new Set(["md", "mdx"]);
		/**
		 * The profile one language id tokenizes with. An id this table does not know gets the
		 * C-family profile, which is the safest approximation: it colours the comment and
		 * string forms almost every brace language shares.
		 */
		function profileOf(lang) {
			return LANG_PROFILES[lang] ?? LANG_COMMON;
		}
		/** Whether one code point can start an identifier the keyword table might match. */
		function isWordStart(ch) {
			return ch !== void 0 && /[\p{L}_$@]/u.test(ch);
		}
		/** Whether one code point continues an identifier. */
		function isWordPart(ch) {
			return ch !== void 0 && /[\p{L}\p{N}_$]/u.test(ch);
		}
		/**
		 * Whether the code-point array `chars` carries `text` starting at `at`.
		 *
		 * Every offset in this tokenizer is a **code-point** index into `chars`, never a
		 * UTF-16 index into the line: `charMarks` diffs code points, and a line holding an
		 * astral glyph would otherwise drift by one per glyph and cut a surrogate pair in
		 * half. The delimiters themselves are ASCII, so comparing code point to character
		 * is exact.
		 */
		function matchesAt(chars, at, text) {
			if (at < 0 || at + text.length > chars.length) return false;
			for (let index = 0; index < text.length; index++) if (chars[at + index] !== text[index]) return false;
			return true;
		}
		/** The first code-point index at or after `from` where `chars` carries `text`, or -1. */
		function indexOfToken(chars, text, from) {
			for (let at = Math.max(from, 0); at + text.length <= chars.length; at++) if (matchesAt(chars, at, text)) return at;
			return -1;
		}
		/** Whether the occurrence at `at` is escaped by an odd run of backslashes. */
		function isEscaped(chars, at) {
			let backslashes = 0;
			for (let scan = at - 1; scan >= 0 && chars[scan] === "\\"; scan--) backslashes++;
			return backslashes % 2 === 1;
		}
		/** The closing index of `quote` at or after `from`, skipping escaped occurrences. */
		function closeIndexOf(chars, quote, from) {
			for (let at = from; at <= chars.length; ) {
				const found = indexOfToken(chars, quote, at);
				if (found === -1) return -1;
				if (!isEscaped(chars, found)) return found;
				at = found + quote.length;
			}
			return -1;
		}
		/**
		 * Whether a delimiter keeps its string open on the following line. Only the
		 * multi-line forms do: a triple quote (a Python docstring) and a backtick (a JS
		 * template literal). An unterminated single quote is far more likely a line-local
		 * typo, so it colours the rest of its own line and lets the next line tokenize
		 * normally rather than swallowing the rest of the file.
		 */
		function carriesAcrossLines(quote) {
			return quote.length > 1 || quote === "`";
		}
		/**
		 * Whether the identifier at `at` follows a member-access dot, ignoring whitespace.
		 *
		 * `KEYWORD_SETS.get(lang)` is the case that matters: `get` is a reserved word only
		 * inside a class body, so painting it like `return` reads as a bug. After a `.` an
		 * identifier is a **property or method name**, never a keyword, never a constant, and
		 * not a declaration — so it is left in the default foreground.
		 */
		function isMemberAccess(chars, at) {
			for (let scan = at - 1; scan >= 0; scan--) {
				const ch = chars[scan];
				if (ch === " " || ch === "\t") continue;
				return ch === ".";
			}
			return false;
		}
		/**
		 * Whether a delimiter at `at` may open a string here.
		 *
		 * A single-character quote only opens when it is **not** preceded by a word
		 * character. That one rule is what keeps an apostrophe in ordinary text — `shiki's`,
		 * `don't`, `package's`, `12" screen` — from opening a string that colours the rest of
		 * the line: in real code a quote never begins mid-word, so nothing legitimate is lost,
		 * while prose (a comment, a string, a YAML value, a README) is no longer mangled.
		 * Multi-character delimiters (`"""`, `'''`) are unambiguous and always open.
		 */
		function opensString(chars, at, quote) {
			if (quote.length > 1) return true;
			return !isWordPart(chars[at - 1]);
		}
		/**
		 * Split `line` into classified runs, carrying multi-line constructs in and out.
		 *
		 * `state` is what the previous line left open: `openQuote` (a docstring or template
		 * literal) and `blockClose` (the closer of a `/* … *​/` block comment). Both are
		 * threaded through by {@link highlightDiffLines} so one side's lines scan as a whole,
		 * and the return carries this line's leftovers forward.
		 *
		 * Without the block-comment half, every line after the first of a multi-line comment
		 * was tokenized as **code** — a JS comment's prose came out keyword-coloured and a
		 * backtick inside it opened a string.
		 *
		 * A single-line string is opened and closed within the line; a delimiter that never
		 * closes colours the rest of the line, which is what an unterminated literal means.
		 *
		 * @returns `{ runs, openQuote, blockClose }`.
		 */
		function tokenizeLine(line, profile, keywords, state) {
			const runs = [];
			const chars = [...line];
			let at = 0;
			let openQuote = state.openQuote ?? null;
			let blockClose = state.blockClose ?? null;
			/* Finish a block comment an earlier line opened. Without this the second and
			   later lines of a `/* ... *​/` comment are tokenized as CODE — the reported
			   symptom was a JS comment whose prose came out keyword-coloured and whose
			   backtick opened a string. */
			if (blockClose !== null) {
				const close = indexOfToken(chars, blockClose, 0);
				if (close === -1) {
					appendRun(runs, line, TOKEN_COLOR.comment);
					return {
						runs,
						openQuote,
						blockClose
					};
				}
				const stop = close + blockClose.length;
				appendRun(runs, chars.slice(0, stop).join(""), TOKEN_COLOR.comment);
				at = stop;
				blockClose = null;
			}
			/* Finish a multi-line string an earlier line opened. */
			if (openQuote !== null) {
				const close = closeIndexOf(chars, openQuote, 0);
				if (close === -1) {
					appendRun(runs, line, TOKEN_COLOR.string);
					return {
						runs,
						openQuote,
						blockClose
					};
				}
				const stop = close + openQuote.length;
				appendRun(runs, chars.slice(0, stop).join(""), TOKEN_COLOR.string);
				at = stop;
				openQuote = null;
			}
			while (at < chars.length) {
				const ch = chars[at];
				if (profile.line !== null && matchesAt(chars, at, profile.line)) {
					appendRun(runs, chars.slice(at).join(""), TOKEN_COLOR.comment);
					break;
				}
				if (profile.hashComment && ch === "#") {
					appendRun(runs, chars.slice(at).join(""), TOKEN_COLOR.comment);
					break;
				}
				if (profile.block !== null && matchesAt(chars, at, profile.block[0])) {
					const open = profile.block[0].length;
					const close = indexOfToken(chars, profile.block[1], at + open);
					/* No closing delimiter on this line: the comment runs on, so the rest of
					   the line is a comment and the state carries the closer to the next line. */
					if (close === -1) {
						appendRun(runs, chars.slice(at).join(""), TOKEN_COLOR.comment);
						blockClose = profile.block[1];
						at = chars.length;
						break;
					}
					const stop = close + profile.block[1].length;
					appendRun(runs, chars.slice(at, stop).join(""), TOKEN_COLOR.comment);
					at = stop;
					continue;
				}
				const quote = profile.quotes.find((candidate) => matchesAt(chars, at, candidate) && opensString(chars, at, candidate));
				if (quote !== void 0) {
					const close = closeIndexOf(chars, quote, at + quote.length);
					if (close === -1) {
						appendRun(runs, chars.slice(at).join(""), TOKEN_COLOR.string);
						if (carriesAcrossLines(quote)) openQuote = quote;
						at = chars.length;
						break;
					}
					const stop = close + quote.length;
					appendRun(runs, chars.slice(at, stop).join(""), TOKEN_COLOR.string);
					at = stop;
					continue;
				}
				if (isWordStart(ch)) {
					let end = at + 1;
					while (end < chars.length && isWordPart(chars[end])) end++;
					const word = chars.slice(at, end).join("");
					const next = chars[end] ?? "";
					/* `@media` is a keyword in CSS, `@Override` an annotation in Java: the sigil
					   belongs to the token, the keyword lookup does not. */
					const bare = word[0] === "@" ? word.slice(1) : word;
					/* A data format's values are prose, so a word there is left unclassified:
					   `description: install in the for as is not` must not speckle the line with
					   keyword colours. Comments, strings and numbers still colour normally. */
					if (profile.lexicalOnly === true || isMemberAccess(chars, at)) appendRun(runs, word, void 0);
					else if (keywords.has(bare)) appendRun(runs, word, TOKEN_COLOR.keyword);
					else if (next === "(") appendRun(runs, word, TOKEN_COLOR.function);
					else if (word[0] === "$" || word[0] === "@") appendRun(runs, word, TOKEN_COLOR.parameter);
					/* SCREAMING_CASE reads as a constant, but a single letter does not: `A file
					   whose extension...` must not colour that `A`. */
					else if (word.length > 1 && word === word.toUpperCase() && /[A-Z]/.test(word)) appendRun(runs, word, TOKEN_COLOR.constant);
					else appendRun(runs, word, void 0);
					at = end;
					continue;
				}
				if (/[0-9]/.test(ch)) {
					/* A numeric literal: an optional radix prefix, then digits, underscores, an
					   optional fraction, and an optional exponent. A trailing `+`/`-` is taken
					   only directly after an exponent marker, so `1-2` stays two numbers. */
					let end = at;
					if (ch === "0" && /[xXoObB]/.test(chars[end + 1] ?? "")) {
						end += 2;
						while (end < chars.length && /[0-9a-fA-F_]/.test(chars[end])) end++;
					} else {
						while (end < chars.length && /[0-9_]/.test(chars[end])) end++;
						if (chars[end] === "." && /[0-9]/.test(chars[end + 1] ?? "")) {
							end++;
							while (end < chars.length && /[0-9_]/.test(chars[end])) end++;
						}
						if (/[eE]/.test(chars[end] ?? "") && /[0-9+\-]/.test(chars[end + 1] ?? "")) {
							end += 2;
							while (end < chars.length && /[0-9_]/.test(chars[end])) end++;
						}
					}
					appendRun(runs, chars.slice(at, end).join(""), TOKEN_COLOR.constant);
					at = end;
					continue;
				}
				if (/[{}()[\];,.:=<>+\-*/%!&|?~^]/.test(ch)) appendRun(runs, ch, TOKEN_COLOR.punctuation);
				else appendRun(runs, ch, void 0);
				at++;
			}
			return {
				runs,
				openQuote,
				blockClose
			};
		}
		/**
		 * The coloured runs of one `lang` side, one entry per source line.
		 *
		 * The scanner runs per line, which is what keeps the rows independent: a run can
		 * never carry a newline, so a row's runs always cover exactly its own text and
		 * {@link markedText} can map a character mark back onto them. Multi-line strings are
		 * threaded through as state instead — a Python docstring or a JS template literal is
		 * one string across its lines — so the only constructs this misses are the ones that
		 * need a real grammar (nested interpolation, regex-vs-division, heredocs).
		 *
		 * Returns one run list per line, always the same length as `lines`. A line whose
		 * tokens are all unclassified still returns its runs: an empty list would render the
		 * row blank, because {@link markedText} has nothing to draw.
		 *
		 * @param lines - the source lines to colour.
		 * @param lang - the language id, from {@link langOfPath}.
		 * @returns one run list per line, or undefined when nothing is coloured.
		 */
		function highlightDiffLines(lines, lang) {
			if (lang === void 0 || PLAIN_LANGS.has(lang)) return void 0;
			if (lines.length === 0) return void 0;
			const profile = profileOf(lang);
			const keywords = keywordSetOf(lang);
			let openQuote = null;
			let blockClose = null;
			return lines.map((line) => {
				if (line === "" && openQuote === null && blockClose === null) return [];
				const scanned = tokenizeLine(line, profile, keywords, {
					openQuote,
					blockClose
				});
				openQuote = scanned.openQuote;
				blockClose = scanned.blockClose;
				return scanned.runs;
			});
		}
		//#endregion
		/**
		 * Split one side's text into its content lines, by the terminator rule the
		 * built-in DiffBlock applies: empty text is zero lines and a single trailing
		 * newline terminates the last line instead of adding a blank one.
		 */
		function contentLines(text) {
			if (text === "") return [];
			return (text.endsWith("\n") ? text.slice(0, -1) : text).split("\n");
		}
		/**
		 * The inverse of {@link contentLines}: the text whose content lines are
		 * `lines`. A trailing empty line has to be re-terminated, otherwise it would
		 * read back as zero lines and a blank-line change would vanish.
		 */
		function linesText(lines) {
			if (lines.length === 0) return "";
			const text = lines.join("\n");
			return lines[lines.length - 1] === "" ? `${text}\n` : text;
		}
		/**
		 * Where two line lists differ: the old-side indices no new line matched and
		 * the new-side indices no old line matched, each ascending, so
		 * `removed.length + added.length` is the shortest edit script. Returns null
		 * when the edit distance exceeds {@link MAX_EDIT_DISTANCE}.
		 *
		 * The indices are what the backward walk retraces; a caller maps them back
		 * onto its own line lists, which keeps the alignment itself checkable.
		 */
		function changedLines(oldLines, newLines) {
			const minLength = Math.min(oldLines.length, newLines.length);
			let prefix = 0;
			while (prefix < minLength && oldLines[prefix] === newLines[prefix]) prefix++;
			let suffix = 0;
			while (suffix < minLength - prefix && oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]) suffix++;
			const changed = myersChangedLines(oldLines.slice(prefix, oldLines.length - suffix), newLines.slice(prefix, newLines.length - suffix));
			if (changed === null) return null;
			return {
				removedAt: changed.removedAt.map((at) => at + prefix),
				addedAt: changed.addedAt.map((at) => at + prefix)
			};
		}
		/**
		 * Myers O(ND) over the band the common prefix and suffix left over.
		 * `trace[distance]` snapshots the furthest-reaching x per diagonal before that
		 * step, which is what the backward walk retraces; matched lines are consumed
		 * without being recorded, so the walk yields only the two sides' changes.
		 */
		function myersChangedLines(oldLines, newLines) {
			const oldLength = oldLines.length;
			const newLength = newLines.length;
			const cap = Math.min(oldLength + newLength, MAX_EDIT_DISTANCE);
			const offset = cap + 1;
			const trace = [];
			let furthest = new Int32Array(2 * cap + 3);
			let reached = -1;
			for (let distance = 0; distance <= cap && reached === -1; distance++) {
				trace.push(furthest.slice());
				for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
					let x = diagonal === -distance || (diagonal !== distance && furthest[diagonal - 1 + offset] < furthest[diagonal + 1 + offset]) ? furthest[diagonal + 1 + offset] : furthest[diagonal - 1 + offset] + 1;
					let y = x - diagonal;
					while (x < oldLength && y < newLength && oldLines[x] === newLines[y]) {
						x++;
						y++;
					}
					furthest[diagonal + offset] = x;
					if (x >= oldLength && y >= newLength) {
						reached = distance;
						break;
					}
				}
			}
			if (reached === -1) return null;
			const removedAt = [];
			const addedAt = [];
			let x = oldLength;
			let y = newLength;
			for (let distance = reached; distance > 0; distance--) {
				const snapshot = trace[distance];
				const diagonal = x - y;
				const previousDiagonal = diagonal === -distance || (diagonal !== distance && snapshot[diagonal - 1 + offset] < snapshot[diagonal + 1 + offset]) ? diagonal + 1 : diagonal - 1;
				const previousX = snapshot[previousDiagonal + offset];
				const previousY = previousX - previousDiagonal;
				while (x > previousX && y > previousY) {
					x--;
					y--;
				}
				if (x === previousX) {
					addedAt.push(y - 1);
					y--;
				} else {
					removedAt.push(x - 1);
					x--;
				}
			}
			removedAt.reverse();
			addedAt.reverse();
			return {
				removedAt,
				addedAt
			};
		}
		/**
		 * The units the inline diff compares. A maximal run of letters, digits and
		 * underscore is one unit; a maximal whitespace run is one unit; every other
		 * code point — punctuation, symbols, and each CJK character, which carries no
		 * word boundary to lean on — is a unit of its own. CJK is deliberately kept
		 * out of the word rule even though it is a letter: folding a whole Chinese
		 * phrase into one unit would mark the entire phrase for a one-character fix.
		 *
		 * Comparing units instead of code points is what keeps a replaced word one
		 * mark. Myers reports the units no counterpart matched, and a unit is a word,
		 * so the run cannot shatter into the fragments a per-code-point diff produces:
		 * `registrations` → `tool rows` used to mark `regis` / `ati` / `n`, because the
		 * code points those two words happen to share were counted as unchanged.
		 */
		const MARK_WORD = /[\p{L}\p{N}_]/u;
		/** CJK: no whitespace word boundary exists, so one character is one unit. */
		function isCjkUnit(ch) {
			const code = ch.codePointAt(0);
			return code >= 0x3040 && code <= 0x30ff || code >= 0x3400 && code <= 0x4dbf || code >= 0x4e00 && code <= 0x9fff || code >= 0xf900 && code <= 0xfaff || code >= 0xfe30 && code <= 0xfe4f || code >= 0xff00 && code <= 0xffef || code >= 0x20000 && code <= 0x2fa1f;
		}
		function markUnits(text) {
			const units = [];
			let run = "";
			let kind;
			const flush = () => {
				if (run !== "") units.push(run);
				run = "";
			};
			for (const ch of text) {
				const next = MARK_WORD.test(ch) && !isCjkUnit(ch) ? "word" : /^\s$/.test(ch) ? "space" : void 0;
				if (next === void 0) {
					flush();
					kind = void 0;
					units.push(ch);
					continue;
				}
				if (next !== kind) {
					flush();
					kind = next;
				}
				run += ch;
			}
			flush();
			return units;
		}
		/**
		 * The share of one line's code points a range list marks.
		 */
		function markedShare(text, ranges) {
			const length = [...text].length;
			if (length === 0) return 0;
			let marked = 0;
			for (const [from, to] of ranges) marked += to - from;
			return marked / length;
		}
		/**
		 * Above this share of a line marked, the marks stop discriminating and the pair is
		 * left unmarked: the row background already says the line changed, so a chip over
		 * nearly all of it adds nothing and just makes the card look uniformly dark.
		 *
		 * Measured on this machine (2026-09-22): a legitimate two-word replacement covers
		 * 71-73%, while a rewritten paragraph — where the only text the two sides still share
		 * is punctuation — covers 85-97%. The line sits at 80%. **Both** sides are dropped
		 * together, because a half-marked pair reads as a bug rather than as a decision.
		 */
		const MARK_COVERAGE_MAX = 0.8;
		/**
		 * The inline character ranges one replaced line changed: on each side, the
		 * characters no counterpart matched, merged into ascending [start, end) runs.
		 * The ranges are indexed by **code point**, the space markedText slices in, so
		 * a range can never cut a surrogate pair. Only equal-count replacement pairs
		 * ask for them, so a word-level edit shows inside the line instead of the whole
		 * line reading as replaced.
		 */
		function charMarks(oldText, newText) {
			const oldUnits = markUnits(oldText);
			const newUnits = markUnits(newText);
			const changed = myersChangedLines(oldUnits, newUnits);
			if (changed === null) return {
				del: [],
				add: []
			};
			const del = rangesOf(oldUnits, changed.removedAt);
			const add = rangesOf(newUnits, changed.addedAt);
			if (markedShare(oldText, del) > MARK_COVERAGE_MAX || markedShare(newText, add) > MARK_COVERAGE_MAX) return {
				del: [],
				add: []
			};
			return {
				del,
				add
			};
		}
		/**
		 * Widest gap of matched units still treated as no boundary at all. One: a single
		 * matched character inside a replaced span is a coincidence.
		 */
		const MARK_GAP_UNITS = 1;
		/** A unit that carries no meaning of its own: whitespace, punctuation, or a symbol. */
		const MARK_NONWORD = /^[\s\p{P}\p{S}]+$/u;
		/**
		 * Whether the units strictly between two changed ones do not form a boundary.
		 *
		 * Two cases, neither of which a reader parses as content: the gap is at most
		 * {@link MARK_GAP_UNITS} units, or every unit in it is {@link MARK_NONWORD}. The
		 * second covers the backticks and commas around a change — `` `~` 前缀 `` must chip as
		 * one block, not as `~` plus a gap plus `前缀` — and it subsumes the whitespace case
		 * that keeps a multi-word replacement from chipping as `tool` + `rows`.
		 *
		 * Word characters in the gap are a real boundary: in `alpha, beta` the comma is
		 * swallowed, but `x = 1; y = 2;` keeps `1` and `2` as separate marks because `y` and
		 * `=` sit between them.
		 */
		function gapJoins(units, from, to) {
			if (to - from <= MARK_GAP_UNITS) return true;
			for (let at = from; at < to; at++) if (!MARK_NONWORD.test(units[at])) return false;
			return true;
		}
		/**
		 * Merge the changed unit indices into ascending [start, end) code-point ranges.
		 * Two changed units join when they are adjacent, or separated only by a gap
		 * {@link gapJoins} accepts. Myers reports the indices in ascending order, so one
		 * forward pass suffices.
		 */
		function rangesOf(units, indices) {
			const starts = [];
			const lengths = [];
			let at = 0;
			for (const unit of units) {
				starts.push(at);
				const length = [...unit].length;
				lengths.push(length);
				at += length;
			}
			const ranges = [];
			let previous = -1;
			for (const index of indices) {
				const end = starts[index] + lengths[index];
				const last = ranges[ranges.length - 1];
				if (last !== void 0 && gapJoins(units, previous + 1, index)) last[1] = end;
				else ranges.push([starts[index], end]);
				previous = index;
			}
			return ranges;
		}
		/**
		 * The rows one hunk renders: the changed lines coloured, the lines both sides
		 * kept as dim context, and every unchanged line appearing exactly once — the
		 * built-in DiffBlock paints the shared context on its `-` side and again on its
		 * `+` side. Returns null when the edit distance exceeds
		 * {@link MAX_EDIT_DISTANCE}, and the caller falls back to the whole-block shape.
		 */
		function hunkRows(oldText, newText) {
			const oldLines = contentLines(oldText);
			const newLines = contentLines(newText);
			const changed = changedLines(oldLines, newLines);
			if (changed === null) return null;
			const removed = new Set(changed.removedAt);
			const added = new Set(changed.addedAt);
			const rows = [];
			let oldAt = 0;
			let newAt = 0;
			while (oldAt < oldLines.length || newAt < newLines.length) {
				if (oldAt < oldLines.length && removed.has(oldAt)) {
					rows.push({
						kind: "del",
						text: oldLines[oldAt],
						marks: []
					});
					oldAt++;
					continue;
				}
				if (newAt < newLines.length && added.has(newAt)) {
					rows.push({
						kind: "add",
						text: newLines[newAt],
						marks: []
					});
					newAt++;
					continue;
				}
				rows.push({
					kind: "ctx",
					text: oldLines[oldAt],
					marks: []
				});
				oldAt++;
				newAt++;
			}
			return withMarks(rows);
		}
		/**
		 * Character-level Dice coefficient of two lines, in [0, 1].
		 *
		 * Similarity is measured on **characters**, not on {@link markUnits} units, because
		 * the pairs that must be recognised as related are exactly the ones whose words were
		 * replaced: `registrations` → `tool rows` shares no unit at all while sharing most of
		 * the line's characters. An order-insensitive multiset is enough here — this only
		 * decides which removed line belongs with which added line, and {@link charMarks}
		 * computes the precise ranges afterwards.
		 */
		function lineSimilarity(left, right) {
			const leftChars = [...left];
			const rightChars = [...right];
			if (leftChars.length === 0 || rightChars.length === 0) return 0;
			const counts = new Map();
			for (const ch of leftChars) counts.set(ch, (counts.get(ch) ?? 0) + 1);
			let shared = 0;
			for (const ch of rightChars) {
				const left = counts.get(ch) ?? 0;
				if (left === 0) continue;
				shared++;
				counts.set(ch, left - 1);
			}
			return 2 * shared / (leftChars.length + rightChars.length);
		}
		/**
		 * Above this many removed × added lines in one run, the similarity alignment is
		 * skipped: the walk below is quadratic in the run size, and a run that large is a
		 * rewrite rather than an edit. The positional fallback then applies, as it did before.
		 */
		const MARK_PAIR_CELLS = 16384;
		/**
		 * Pair each removed line of a run with the added line that replaced it, by content
		 * similarity rather than by position, preserving order.
		 *
		 * Position was wrong in both directions (2026-09-22): a run whose added side was
		 * longer than its removed side got **no** inline marks at all, and an insertion at the
		 * top of a run shifted every later pair, so one line's marks landed on another line's
		 * text.
		 *
		 * This is an order-preserving maximum-similarity alignment — a Needleman-Wunsch walk
		 * with a zero gap penalty — so unequal counts need no special case: an inserted or
		 * deleted line simply stays unpaired and keeps a plain row. A pair must score strictly
		 * above zero, which costs nothing: two lines sharing no character at all would mark
		 * every character on both sides and be dropped by the coverage rule anyway.
		 *
		 * Returns null when the run is too large for the quadratic walk, so the caller can fall
		 * back rather than silently marking nothing.
		 */
		function pairRun(delRows, addRows) {
			const delCount = delRows.length;
			const addCount = addRows.length;
			if (delCount === 0 || addCount === 0) return [];
			if (delCount * addCount > MARK_PAIR_CELLS) return null;
			const best = Array.from({
				length: delCount + 1
			}, () => new Float64Array(addCount + 1));
			/* 0 = pair these two, 1 = skip a removed line, 2 = skip an added line. The choice is
			   recorded rather than re-derived from the floats, so backtracking cannot drift on a
			   tie. */
			const pick = Array.from({
				length: delCount + 1
			}, () => new Uint8Array(addCount + 1));
			for (let del = 1; del <= delCount; del++) for (let add = 1; add <= addCount; add++) {
				let value = best[del - 1][add];
				let choice = 1;
				if (best[del][add - 1] > value) {
					value = best[del][add - 1];
					choice = 2;
				}
				const paired = best[del - 1][add - 1] + lineSimilarity(delRows[del - 1].text, addRows[add - 1].text);
				if (paired > value) {
					value = paired;
					choice = 0;
				}
				best[del][add] = value;
				pick[del][add] = choice;
			}
			const pairs = [];
			for (let del = delCount, add = addCount; del > 0 && add > 0;) {
				const choice = pick[del][add];
				if (choice === 0) {
					pairs.push([del - 1, add - 1]);
					del--;
					add--;
				} else if (choice === 1) del--;
				else add--;
			}
			pairs.reverse();
			return pairs;
		}
		/** Attach one line pair's inline marks to its two rows. */
		function applyMarks(delRow, addRow) {
			const marks = charMarks(delRow.text, addRow.text);
			delRow.marks = marks.del;
			addRow.marks = marks.add;
		}
		/**
		 * Give each changed line its inline marks.
		 *
		 * A run is a maximal block of removed rows followed by the added rows replacing it.
		 * Its two sides are aligned by {@link pairRun}, so a replacement whose sides differ in
		 * length still marks every line that has a counterpart, and marks land on the line they
		 * belong to even when the added side inserted a line at the top. A line the alignment
		 * leaves unpaired — a pure insertion or deletion inside the run — keeps a plain row.
		 *
		 * The earlier shape marked a run only when its two sides were the same length, and
		 * paired them by position; both halves of that are wrong for an insertion or a deletion.
		 * When the run is too large to align, an equal-length run falls back to that positional
		 * pairing (the shape this plugin shipped before) and an unequal one stays unmarked.
		 */
		function withMarks(rows) {
			for (let at = 0; at < rows.length; at++) {
				if (rows[at].kind !== "del") continue;
				let delEnd = at;
				while (delEnd < rows.length && rows[delEnd].kind === "del") delEnd++;
				let addEnd = delEnd;
				while (addEnd < rows.length && rows[addEnd].kind === "add") addEnd++;
				const delRows = rows.slice(at, delEnd);
				const addRows = rows.slice(delEnd, addEnd);
				const pairs = pairRun(delRows, addRows);
				if (pairs === null) {
					if (delRows.length === addRows.length) for (let offset = 0; offset < delRows.length; offset++) applyMarks(delRows[offset], addRows[offset]);
				} else for (const [del, add] of pairs) applyMarks(delRows[del], addRows[add]);
				at = addEnd - 1;
			}
			return rows;
		}
		/**
		 * The whole card body: one row list per hunk plus the totals the footer and the
		 * header stat print, counted from the rows the body actually renders. A hunk the
		 * line diff cannot resolve degrades to its removed block followed by its added
		 * block — exactly the built-in rendering.
		 */
		function buildDiffModel(diffs) {
			const files = [];
			const paths = new Set();
			const copyParts = [];
			let added = 0;
			let removed = 0;
			for (const diff of diffs) {
				paths.add(diff.path);
				const oldLines = contentLines(diff.oldText ?? "");
				const newLines = contentLines(diff.newText);
				const rows = hunkRows(diff.oldText ?? "", diff.newText) ?? fallbackRows(diff);
				annotateRows(rows, oldLines, newLines);
				/* Count and copy from the ORIGINAL text: the clipboard should hand back the
				   file's own indentation, not the dedented form the card displays. */
				for (const row of rows) {
					if (row.kind === "add") added++;
					else if (row.kind === "del") removed++;
					copyParts.push(row.kind === "add" ? "+ " + row.text : row.kind === "del" ? "- " + row.text : row.text);
				}
				const indent = commonIndentOf(rows);
				files.push({
					path: diff.path,
					lang: langOfPath(diff.path),
					/* The hunk's own anchors, carried to the renderer, plus the raw line arrays
					   the gutter fallback locates the post-image with. Numbering happens in the
					   renderer, not here, because a fallback base can arrive after this model
					   was built. */
					oldStart: typeof diff.oldStart === "number" ? diff.oldStart : null,
					newStart: typeof diff.newStart === "number" ? diff.newStart : null,
					/* `"meta"` hunks arrive with their own context; `"args"` hunks are bare
					   fragments and are the only ones the body fetches surrounding lines for. */
					source: diff.source === "meta" ? "meta" : "args",
					/* Kept so the context lines read from the file can be dedented by the same
					   amount as this hunk's own lines, or the hunk would sit flush left while
					   its context stayed indented. */
					indent,
					oldLines,
					newLines,
					lines: {
						del: stripIndent(oldLines, indent),
						add: stripIndent(newLines, indent)
					},
					rows: dedentRows(rows, indent)
				});
			}
			return {
				files,
				fileCount: paths.size,
				added,
				removed,
				copyText: copyParts.join("\n")
			};
		}
		/**
		 * The whitespace prefix every non-blank row of a hunk shares.
		 *
		 * A deeply nested hunk (five tabs, say) otherwise spends 40 columns of a narrow card
		 * on indentation that is identical on every line — the reported symptom was "so much
		 * blank in front, can it be left-aligned". Stripping the **common** prefix moves the
		 * code to the left edge while keeping every line's indentation relative to its
		 * neighbours, so a change in nesting depth is still visible.
		 *
		 * Blank lines do not constrain the prefix: a hunk containing one empty line would
		 * otherwise never dedent, and an empty line has no content to align.
		 */
		function commonIndentOf(rows) {
			let prefix = null;
			for (const row of rows) {
				if (row.text.trim() === "") continue;
				const whitespace = /^[ \t]*/.exec(row.text)[0];
				if (prefix === null) {
					prefix = whitespace;
					continue;
				}
				let at = 0;
				while (at < prefix.length && at < whitespace.length && prefix[at] === whitespace[at]) at++;
				prefix = prefix.slice(0, at);
				if (prefix === "") return "";
			}
			return prefix ?? "";
		}
		/** One side's lines with `indent` removed; a blank line collapses to empty. */
		function stripIndent(lines, indent) {
			if (indent === "") return lines;
			return lines.map((line) => line.trim() === "" ? "" : line.startsWith(indent) ? line.slice(indent.length) : line);
		}
		/**
		 * Apply the dedent to the rendered rows, shifting their inline marks by the same
		 * amount.
		 *
		 * The marks are code-point `[start, end)` ranges over the ORIGINAL row text, so
		 * cutting the prefix has to move them too — a range that fell entirely inside the
		 * removed indentation disappears, and one that straddles it is clipped to the new
		 * start. Without this the emphasis would land on the wrong characters.
		 */
		function dedentRows(rows, indent) {
			if (indent === "") return rows;
			const cut = indent.length;
			for (const row of rows) {
				row.text = row.text.trim() === "" ? "" : row.text.startsWith(indent) ? row.text.slice(cut) : row.text;
				const marks = [];
				for (const [start, end] of row.marks) {
					if (end <= cut) continue;
					marks.push([Math.max(start - cut, 0), end - cut]);
				}
				row.marks = marks;
			}
			return rows;
		}
		/**
		 * Stamp every row with the index of the source line it renders and the side it
		 * renders, so the renderer can look up that row's syntax runs without diffing the
		 * text back onto the line lists. The walk mirrors how {@link hunkRows} consumed the
		 * two sides — a delete advances the old side, an add the new side, a kept line both
		 * — and it holds for the unaligned fallback too, which is every old line then every
		 * new line.
		 */
		function annotateRows(rows, oldLines, newLines) {
			let oldAt = 0;
			let newAt = 0;
			for (const row of rows) {
				if (row.kind === "del") {
					row.side = "del";
					row.index = row.oldIndex = oldAt++;
				} else if (row.kind === "add") {
					row.side = "add";
					row.index = row.newIndex = newAt++;
				} else {
					row.side = "ctx";
					/* A kept line is one line on BOTH sides, and the two sides have diverged
					   by every add/delete above it — so its old and new positions differ, and
					   each is needed: the syntax runs come from the old side (`index`), the
					   gutter from the new side (`newIndex`), which is the file as it now is. */
					row.index = row.oldIndex = oldAt;
					row.newIndex = newAt;
					oldAt++;
					newAt++;
				}
			}
			return rows;
		}
		/**
		 * Give every row the number its gutter shows, and say whether that number is the
		 * file's own line.
		 *
		 * A row whose side carries an anchor shows `anchor + its index on that side` —
		 * the line it really occupies. Without one (an argument-derived hunk, a PTC
		 * sub-call, a hunk from a host that does not stamp) it shows its 1-based position
		 * in this hunk instead, marked relative: the renderer dims it and prefixes `~`,
		 * so a number that may not be the file's line never masquerades as one.
		 *
		 * Returns copies: the caller may re-run this with a base the gutter fallback
		 * resolved later, and the rows it was given must stay untouched.
		 */
		function numberRows(rows, oldStart, newStart) {
			let relative = 0;
			return rows.map((row) => {
				const base = row.side === "del" ? oldStart : newStart;
				const index = row.side === "del" ? row.oldIndex : row.newIndex;
				if (typeof base === "number" && typeof index === "number") return {
					...row,
					line: base + index,
					lineReal: true
				};
				return {
					...row,
					line: ++relative,
					lineReal: false
				};
			});
		}
		//#region gutter fallback
		/** Route the host half serves the current file on, for an unanchored hunk. */
		const READ_ROUTE = "/edit-diff/read";
		/**
		 * Read one workspace file through the host half's fenced route.
		 *
		 * Deliberately uncached: a cached text goes stale the moment the agent edits
		 * again, and a stale file yields a plausible-but-wrong line number — the exact
		 * failure this whole real/relative distinction exists to prevent. One read per
		 * expanded card is cheap next to that.
		 *
		 * @returns the text, or null when the route is absent or the file is not text.
		 */
		async function readWorkspaceFile(path, cwd) {
			const send = hostFetch();
			if (send === null) return null;
			let url;
			try {
				url = new URL(READ_ROUTE, hostBase()).href;
			} catch {
				return null;
			}
			try {
				const response = await send(url, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						cwd,
						path
					})
				});
				if (!response.ok) return null;
				const payload = await response.json();
				return payload?.kind === "text" && typeof payload.content === "string" ? payload.content : null;
			} catch {
				return null;
			}
		}
		/**
		 * The sole 0-based index where `needle` occurs in `fileLines`, or null when it is
		 * absent or occurs more than once. A duplicated block has no single anchor, and
		 * anchoring the first hit would number the wrong region — so ambiguity refuses
		 * rather than guessing.
		 */
		function locateOnce(needle, fileLines) {
			if (needle.length === 0) return null;
			let found = -1;
			for (let at = 0; at + needle.length <= fileLines.length; at++) {
				let hit = true;
				for (let offset = 0; offset < needle.length; offset++) {
					if (fileLines[at + offset] !== needle[offset]) {
						hit = false;
						break;
					}
				}
				if (!hit) continue;
				if (found !== -1) return null;
				found = at;
			}
			return found === -1 ? null : found;
		}
		/**
		 * How many real lines of context a located fragment gets on each side.
		 *
		 * Three, matching the `context: 3` the host's `structuredPatch` puts in a metadata
		 * hunk — so a fragment that has to borrow its context from the file looks like the
		 * hunks that arrived with their own.
		 */
		const CONTEXT_LINES = 3;
		/** The shape of "nothing located": no anchors, no context. */
		const NO_ANCHOR = {
			oldStart: null,
			newStart: null,
			before: [],
			after: []
		};
		/**
		 * The 1-based bases one hunk gets from the CURRENT file, or nulls when it does not
		 * sit there, plus the real lines around it.
		 *
		 * The current file IS the new file, so locating the post-image gives the new
		 * side's basis directly. The old side takes that same base: every shape this
		 * fallback serves is one argument-derived hunk per call — a bare replacement with
		 * nothing else in the hunk — so both sides' first row occupies that position. A
		 * multi-hunk wire diff, where the two sides legitimately differ by earlier hunks'
		 * deltas, is stamped by the host half and never reaches here.
		 *
		 * Context is returned only alongside a **new-side** anchor, because those rows are
		 * numbered from it: without one they would have to fall back to relative numbers,
		 * which is the ambiguity the anchor exists to remove. A deletion-only hunk therefore
		 * anchors (when it can) but brings no context back.
		 */
		function locateBases(fileLines, oldLines, newLines) {
			if (newLines.length > 0) {
				const at = locateOnce(newLines, fileLines);
				if (at === null) return NO_ANCHOR;
				return {
					oldStart: oldLines.length > 0 ? at + 1 : null,
					newStart: at + 1,
					before: fileLines.slice(Math.max(0, at - CONTEXT_LINES), at),
					after: fileLines.slice(at + newLines.length, at + newLines.length + CONTEXT_LINES)
				};
			}
			if (oldLines.length > 0) {
				/* A deletion-only hunk: its lines are gone from the file, so anchor on the
				   hunk's leading lines — which, for a wire hunk, are the context the deletion
				   kept. A bare argument-derived deletion has no context and refuses. */
				const at = locateOnce(oldLines.slice(0, Math.min(3, oldLines.length)), fileLines);
				return {
					oldStart: at === null ? null : at + 1,
					newStart: null,
					before: [],
					after: []
				};
			}
			return NO_ANCHOR;
		}
		/**
		 * Resolve a base for every file in one card that has none, reading each distinct
		 * path once. Takes its reader as an argument so the whole thing is testable
		 * without React or a host.
		 *
		 * @param files - the model's per-hunk file entries.
		 * @param cwd - the session workspace root, fencing the read.
		 * @param read - `(path, cwd) => Promise<string|null>`.
		 * @returns file index → `{ oldStart, newStart }`, only for the hunks that located.
		 */
		async function resolveBases(files, cwd, read) {
			const wanted = new Map();
			for (let index = 0; index < files.length; index++) {
				const file = files[index];
				if (typeof file.oldStart === "number" || typeof file.newStart === "number") continue;
				if (file.rows.length === 0) continue;
				const list = wanted.get(file.path);
				if (list === undefined) wanted.set(file.path, [index]);
				else list.push(index);
			}
			const bases = new Map();
			for (const [path, indexes] of wanted) {
				const text = await read(path, cwd);
				if (typeof text !== "string") continue;
				const fileLines = contentLines(text);
				for (const index of indexes) {
					const located = locateBases(fileLines, files[index].oldLines, files[index].newLines);
					if (located.oldStart !== null || located.newStart !== null) bases.set(index, located);
				}
			}
			return bases;
		}
		//#endregion
		/** The built-in shape for a hunk too large to align: every old line, then every new line. */
		function fallbackRows(diff) {
			const rows = [];
			for (const text of contentLines(diff.oldText ?? "")) rows.push({
				kind: "del",
				text,
				marks: []
			});
			for (const text of contentLines(diff.newText)) rows.push({
				kind: "add",
				text,
				marks: []
			});
			return rows;
		}
		function titleKeyOf(toolName, args) {
			if (toolName === "write") return "write";
			if (toolName === "edit" || toolName === "insert") return "edit";
			if (toolName === "str_replace_editor") {
				if (args?.command === "view") return "read";
				if (args?.command === "create") return "write";
			}
			return "edit";
		}
		/**
		 * The counts the header prints, or null when the call produced no hunk at all.
		 */
		function diffStat(model) {
			return model.fileCount === 0 ? null : {
				added: model.added,
				removed: model.removed
			};
		}
		//#endregion
		/**
		 * The coloured halves of a `+N -M` stat: a real count wears the diff's own
		 * success/error colour.
		 *
		 * With `suppressZero` (per-file rows and the tool-row header) a zero half is
		 * dropped entirely — a pure addition reads `+87`, not `+87 -0`; a zero is not a
		 * change, and a red "-0" reads as a warning. The turn-card title totals keep both
		 * halves, because that line mirrors the built-in DiffBlock shape.
		 */
		function statNode(counts, suppressZero) {
			const part = (kind, text) => {
				if (suppressZero && counts[kind] === 0) return null;
				return h("span", {
					key: kind,
					className: counts[kind] === 0 ? "dsh-edit-diff-stat-zero" : `dsh-edit-diff-${kind}`,
					children: text
				});
			};
			const parts = [part("added", `+${counts.added}`), part("removed", `-${counts.removed}`)];
			const shown = parts.filter((node) => node !== null);
			if (shown.length === 0) return null;
			return shown.flatMap((node, index) => index === 0 ? [node] : [" ", node]);
		}
		/**
		 * The per-file count as 0 or 1 children: a file whose hunk is unchanged (`+0 -0`)
		 * has nothing to report, and an empty span would still take the row's 8px gap.
		 */
		function countBadge(model) {
			const node = statNode(model, true);
			return node === null ? [] : [h("span", {
				key: "count",
				className: "dsh-edit-diff-turn-count",
				children: node
			})];
		}
		//#region card
		/**
		 * Keep a failing card on screen instead of letting the registry drop it.
		 *
		 * A render error in a slot entry is handled by the slot registry, not by this plugin,
		 * and both of its behaviours lose the card (2026-09-22): a **keyed** entry
		 * (`tool.call.toolview`) is abdicated, so the tool row silently reverts to the built-in
		 * rendering, while a **chain** entry (`conversation.chat.turnTail`) is left as a hole in
		 * the tail. Neither path tells the reader anything, and both look identical to "this
		 * plugin is not installed" or "this turn changed nothing".
		 *
		 * This boundary is the plugin's own, so a throw keeps the row and says so: the message
		 * plus a retry that remounts the child under a fresh key. React routes render and
		 * lifecycle errors here only — an event handler or a rejected promise still has to look
		 * after itself — and render is exactly the surface that used to take the row down.
		 */
		class CardBoundary extends React.Component {
			constructor(props) {
				super(props);
				this.state = {
					failed: false,
					attempt: 0
				};
			}
			static getDerivedStateFromError() {
				return { failed: true };
			}
			componentDidCatch(error, info) {
				console.error(`[dsh-edit-diff] ${this.props.label} 渲染失败，已保住这一行（可点「${this.props.dict?.retry ?? DICT.zh.retry}」重挂）：`, error, info?.componentStack ?? "");
			}
			render() {
				if (!this.state.failed) return h(Fragment, {
					key: this.state.attempt
				}, this.props.children);
				/* A missing dictionary must not take the fallback down too: this is the path that
				   runs *because* something already threw, and a throw here would escape the
				   boundary and lose the row — the exact outcome it exists to prevent. */
				const dict = this.props.dict ?? DICT.zh;
				return h("div", {
					className: "dsh-edit-diff-root",
					"data-tool": "edit-diff",
					"data-state": "error",
					children: h("div", {
						className: "dsh-edit-diff-row",
						children: [h("span", {
							key: "message",
							className: "dsh-edit-diff-failure",
							children: dict.renderFailed
						}), h("button", {
							key: "retry",
							type: "button",
							className: "dsh-edit-diff-retry",
							onClick: () => this.setState((previous) => ({
								failed: false,
								attempt: previous.attempt + 1
							})),
							children: dict.retry
						})]
					})
				});
			}
		}
		/**
		 * Wrap a card in {@link CardBoundary}. The dictionary is resolved here because the
		 * fallback needs its two labels even on the render where the card itself throws.
		 */
		function guarded(Component, label) {
			return function Guarded(props) {
				return h(CardBoundary, {
					label,
					dict: DICT[useLanguage(props.locale)] ?? DICT.zh
				}, h(Component, props));
			};
		}
		/**
		 * One file-mutation row: localized title, workspace-relative path with a
		 * `+added -removed` stat, and the diff body behind the disclosure.
		 */
		function EditDiffRow(props) {
			const { toolName, block, cwd, home, openFile, inspect, revealPath, probeReveal } = props;
			const dict = DICT[useLanguage(props.locale)] ?? DICT.zh;
			const [open, setOpen] = React.useState(false);
			const args = React.useMemo(() => parseArgs(argsRawOf(block)), [block]);
			const diffs = React.useMemo(() => resolveDiffs(toolName, block, args), [
				toolName,
				block,
				args
			]);
			const labels = React.useMemo(() => ({
				copy: dict.copy,
				copied: dict.copied,
				collapseAria: dict.collapseAria,
				expandAria: dict.expandAria,
				collapse: dict.collapse,
				expand: dict.expand,
				files: dict.files
			}), [dict]);
			const state = stateOf(block);
			const output = state === "running" ? null : resultText(block);
			const failure = state === "error" && output !== null ? firstLine(output) : null;
			const path = callPath(args);
			const summary = path === null ? null : relativizePath(path, cwd, home);
			const target = path === null ? null : absolutePathOf(path, cwd);
			const reveal = useRevealMenu({
				dict,
				revealPath,
				probeReveal
			});
			const model = React.useMemo(() => buildDiffModel(diffs), [diffs]);
			const stat = diffStat(model);
			/** Header badge as 0 or 1 children — a both-zero stat has nothing to say. */
			const badge = stat === null ? null : statNode(stat, true);
			const statBadge = badge === null ? [] : [h("span", {
				key: "stat",
				className: "dsh-edit-diff-stat",
				children: badge
			})];
			const body = diffs.length > 0 || output !== null && failure === null;
			const expandable = body;
			const isOpen = open && expandable;
			const onToggle = React.useCallback(() => setOpen((value) => !value), []);
			const onOpenFile = React.useCallback((event) => {
				event.stopPropagation();
				if (path === null || typeof openFile !== "function") return;
				openFile(path);
			}, [path, openFile]);
			const icon = state === "error" ? h(StateDot, { state: "error" }) : state === "stopped" ? h(StateDot, { state: "warning" }) : h(IconEditOutline16, { size: 14 });
			const collapsed = failure !== null ? h("span", {
				className: "dsh-edit-diff-failure",
				children: failure
			}) : summary === null ? null : h(Fragment, null, h("span", {
				className: "dsh-edit-diff-sep",
				"aria-hidden": true
			}), typeof openFile === "function" ? h("button", {
				type: "button",
				className: "dsh-edit-diff-file",
				onClick: onOpenFile,
				onKeyDown: (event) => {
					if (event.key === "Enter" || event.key === " ") event.stopPropagation();
				},
				children: summary
			}) : h("span", {
				className: "dsh-edit-diff-summary",
				children: summary
			}), ...statBadge);
			return h("div", {
				className: "dsh-edit-diff-root",
				"data-tool": toolName,
				"data-state": state,
				onContextMenu: (event) => {
					if (target === null) return;
					if (typeof event.target?.closest !== "function" || event.target.closest(".dsh-edit-diff-row") === null) return;
					reveal.openMenu(event, path, target);
				}
			}, h(DisclosureRow, {
				rowClassName: "dsh-edit-diff-row",
				leadingClassName: "dsh-edit-diff-leading",
				titleClassName: "dsh-edit-diff-title",
				icon,
				title: dict[titleKeyOf(toolName, args)] ?? dict.edit,
				open: isOpen,
				expandable,
				expandOnRowClick: true,
				keepContentWhenOpen: true,
				onToggle,
				collapsedContent: collapsed
			}, h("div", {
				className: "dsh-edit-diff-bodyWrap"
			}, diffs.length > 0 ? h(DiffBody, {
				model,
				labels,
				cwd
			}) : null, failure === null && output !== null ? h("pre", {
				className: "dsh-edit-diff-output",
				children: output
			}) : null, typeof inspect === "function" ? h("button", {
				type: "button",
				className: "dsh-edit-diff-inspectButton",
				onClick: (event) => {
					event.stopPropagation();
					inspect();
				},
				children: dict.inspect
			}) : null)), reveal.noteElementFor(path), reveal.menuElement);
		}
		//#endregion
		/**
		 * The diff body behind the disclosure: a path header per hunk, one dim row per
		 * unchanged line, one coloured row per change with its inline marks, plus the
		 * copy control and the both-side totals the built-in block also prints.
		 */
		function DiffBody({ model, labels, cwd }) {
			const [copied, setCopied] = React.useState(false);
			/**
			 * Bases the gutter fallback resolved from the CURRENT file, keyed by the model's
			 * file index. Empty until the read lands, and empty forever when the host half
			 * is absent — either way the rows keep their relative numbers, which is the
			 * honest answer rather than a guess.
			 */
			const [bases, setBases] = React.useState(() => new Map());
			React.useEffect(() => {
				let live = true;
				resolveBases(model.files, cwd, readWorkspaceFile).then((resolved) => {
					if (live && resolved.size > 0) setBases(resolved);
				}).catch(() => {});
				return () => {
					live = false;
				};
			}, [model, cwd]);
			/**
			 * Syntax runs for one file's two sides, keyed by the row indices
			 * {@link annotateRows} stamped, plus the gutter number each row shows. Numbering
			 * happens here rather than in the model because a base can arrive after the
			 * model was built.
			 */
			const rows = React.useMemo(() => bodyRows(model, bases), [model, bases]);
			const onCopy = React.useCallback(() => {
				if (copied || model.copyText === "") return;
				writeClipboard(model.copyText).then((ok) => {
					if (!ok) return;
					setCopied(true);
					window.setTimeout(() => setCopied(false), 1200);
				});
			}, [copied, model]);
			return h("div", {
				className: "dsh-edit-diff-body"
			}, h("button", {
				type: "button",
				className: "dsh-edit-diff-copy",
				onClick: onCopy,
				children: copied ? labels.copied : labels.copy
			}), h("div", {
				className: "dsh-edit-diff-scroll"
			}, rows.map((row, index) => diffLineNode(row, "row" + index))), h("div", {
				className: "dsh-edit-diff-footer",
				children: "└ +" + model.added + " -" + model.removed + " · " + labels.files(model.fileCount)
			}));
		}
		/**
		 * The real file lines around a located fragment, dedented to match the hunk, or two
		 * empty lists when this hunk gets none.
		 *
		 * Only an **argument-derived** fragment asks for them. A metadata hunk already carries
		 * the three lines of context `structuredPatch` produced, so fetching more would show
		 * six and read as if the edit spanned more than it did.
		 */
		function contextOf(file, located) {
			if (located === void 0 || file.source !== "args" || located.newStart === null) return EMPTY_CONTEXT;
			return {
				before: stripIndent(located.before ?? [], file.indent ?? ""),
				after: stripIndent(located.after ?? [], file.indent ?? "")
			};
		}
		/** No context at all — the shape a hunk with none carries. */
		const EMPTY_CONTEXT = {
			before: [],
			after: []
		};
		/**
		 * The body's flat row list: a path header per hunk, that hunk's rows with their syntax
		 * runs and gutter numbers, and the surrounding real lines for a located fragment.
		 *
		 * Pure on purpose. The gutter fallback resolves its anchors asynchronously, so this
		 * runs again whenever a base lands, and keeping it out of the component is what lets
		 * the row list — including the context rows and the paint offset they shift — be
		 * tested without React or a host.
		 *
		 * The context rows are numbered from the located new-side anchor: the lines before the
		 * fragment end at `newStart - 1`, and the ones after it begin at
		 * `newStart + the post-image's length`. Both are the file's own line numbers, so their
		 * gutter is the real one rather than a relative count.
		 *
		 * @param model - {@link buildDiffModel}'s output.
		 * @param bases - file index → the anchor {@link locateBases} returned.
		 */
		function bodyRows(model, bases) {
			const out = [];
			let previousPath;
			for (let index = 0; index < model.files.length; index++) {
				const file = model.files[index];
				out.push({
					kind: "path",
					text: previousPath === file.path ? "⋯" : file.path,
					marks: []
				});
				previousPath = file.path;
				const located = bases.get(index);
				const context = contextOf(file, located);
				const paint = paintFile(file, context);
				/* The painted sides carry the context lines at both ends, so every hunk row's
				   own run index shifts by the lines prepended. */
				const offset = context.before.length;
				for (let at = 0; at < context.before.length; at++) out.push({
					kind: "ctx",
					text: context.before[at],
					marks: [],
					line: located.newStart - context.before.length + at,
					lineReal: true,
					runs: paint?.del?.[at]
				});
				const numbered = numberRows(
					file.rows,
					located === void 0 ? file.oldStart : located.oldStart,
					located === void 0 ? file.newStart : located.newStart
				);
				for (const row of numbered) out.push({
					...row,
					runs: paint === void 0 ? void 0 : paint[row.side === "ctx" ? "del" : row.side]?.[row.index + offset]
				});
				for (let at = 0; at < context.after.length; at++) out.push({
					kind: "ctx",
					text: context.after[at],
					marks: [],
					line: located.newStart + file.lines.add.length + at,
					lineReal: true,
					runs: paint?.del?.[offset + file.lines.del.length + at]
				});
			}
			return out;
		}
		/**
		 * One file's syntax runs, keyed by side. A kept line is shared by both sides, so it
		 * is looked up on the `del` side — the two sides hold identical text there by
		 * definition. Returns undefined only for a language with no profile, which is what
		 * leaves a row plain.
		 *
		 * The context lines are prepended and appended to **both** sides before painting, so
		 * one scan covers the whole run of lines: a fragment lifted out of a docstring or a
		 * template literal keeps its multi-line string state instead of restarting it.
		 */
		function paintFile(file, context) {
			const lang = file.lang;
			if (lang === void 0) return void 0;
			const del = highlightDiffLines(context.before.concat(file.lines.del, context.after), lang);
			const add = highlightDiffLines(context.before.concat(file.lines.add, context.after), lang);
			if (del === void 0 && add === void 0) return void 0;
			return {
				del,
				add
			};
		}
		/** One body row: the path header, a folded gap, or a diff line with its marks. */
		function diffLineNode(row, key) {
			const kind = row.kind === "path" ? "path" : row.kind === "gap" ? "gap" : row.kind === "del" ? "del" : row.kind === "add" ? "add" : "ctx";
			return h("div", {
				key,
				className: "dsh-edit-diff-line dsh-edit-diff-" + kind,
				children: [row.line === void 0 ? null : h("span", {
					key: "gutter",
					/* A relative number is dimmed and otherwise bare: it counts rows inside this
					   hunk, not lines in the file, and the dimmer step is what says so.
					   **Do not** add a marker glyph back. Two were tried and both read worse
					   than the number alone: `~` is a low-profile squiggle that smears into the
					   CSS-drawn `- `/`+ ` row marker at 10px, and `?` was reported as harder to
					   read still. The cost of colour-only is real — it is invisible to a
					   colourblind reader — and it is accepted, not overlooked. */
					className: row.lineReal === true ? "dsh-edit-diff-gutter" : "dsh-edit-diff-gutter dsh-edit-diff-gutterRelative",
					children: String(row.line)
				}), rowText(row)]
			});
		}
		/**
		 * One row's text: its syntactic runs, with the changed-character ranges cut out of
		 * them.
		 *
		 * Two range spaces have to line up. {@link charMarks} diffs **code points**, so every
		 * cut below runs over code-point arrays — `String.prototype.slice` counts UTF-16 code
		 * units and would cut a surrogate pair in half on a line holding an astral glyph. The
		 * runs come from the tokenizer as plain strings covering the whole line in order, so
		 * a run's own start offset lets a mark range be found inside it.
		 */
		function rowText(row) {
			if (row.runs === void 0) return row.marks.length === 0 ? row.text : markedText(row, [{
				text: row.text,
				color: void 0,
				plain: true
			}]);
			return markedText(row, row.runs);
		}
		/**
		 * A row's runs with its inline marks split out as their own nested spans.
		 *
		 * Each run becomes `[before][mark][after]` for every char range it contains; a run
		 * carrying no change is emitted whole, so a line that changed nothing keeps the
		 * tokenizer's own span count.
		 */
		function markedText(row, runs) {
			const parts = [];
			let lineAt = 0;
			for (let index = 0; index < runs.length; index++) {
				const run = runs[index];
				const chars = [...run.text];
				const runStart = lineAt;
				const runEnd = runStart + chars.length;
				lineAt = runEnd;
				const style = run.color === void 0 ? void 0 : {
					color: run.color
				};
				const ranges = row.marks.filter((range) => range[1] > runStart && range[0] < runEnd);
				if (ranges.length === 0) {
					if (chars.length === 0) continue;
					/* A run with no colour and nothing to mark is just text: an un-painted row
					   renders exactly the element tree it rendered before syntax existed. */
					if (run.plain === true) parts.push(run.text);
					else parts.push(h("span", {
						key: "run" + index,
						className: "dsh-edit-diff-token",
						style,
						children: run.text
					}));
					continue;
				}
				let at = 0;
				const pieces = [];
				for (const range of ranges) {
					const from = Math.max(range[0], runStart) - runStart;
					const to = Math.min(range[1], runEnd) - runStart;
					if (from > at) pieces.push(chars.slice(at, from).join(""));
					pieces.push(h("span", {
						key: "mark" + range[0],
						className: "dsh-edit-diff-mark",
						children: chars.slice(from, to).join("")
					}));
					at = to;
				}
				if (at < chars.length) pieces.push(chars.slice(at).join(""));
				parts.push(run.plain === true ? pieces : h("span", {
					key: "run" + index,
					className: "dsh-edit-diff-token",
					style,
					children: pieces
				}));
			}
			return parts;
		}
		//#endregion
		//#region turn card
		/** Turn-data key this plugin publishes its per-turn changes under. */
		const TURN_DATA_KEY = "edit-diff";
		/** Rows the card previews before its show-more control. */
		const TURN_PREVIEW_ROWS = 5;
		/** Bound on the call-routing maps, which only guard a pathological page. */
		const CALL_ROUTE_LIMIT = 8192;
		/** Root call id -> turn, learned from root tool/call events. */
		const rootCallTurns = new Map();
		/** Sub-call id -> parent call id, so a nested record reaches its root call. */
		const callParents = new Map();
		/** Remember a root call's turn. */
		function rememberRootCall(callId, turn) {
			if (rootCallTurns.size >= CALL_ROUTE_LIMIT) rootCallTurns.clear();
			rootCallTurns.set(callId, turn);
		}
		/** Remember one sub-call edge. */
		function rememberCallParent(callId, parentCallId) {
			if (callParents.size >= CALL_ROUTE_LIMIT) callParents.clear();
			callParents.set(callId, parentCallId);
		}
		/**
		 * The turn a call belongs to: a root call's own turn, or the turn of its nearest
		 * ancestor root. Wire PTC dispatch records carry no turn coordinate, so this walk
		 * is what routes a run_code child's edit back to the turn that started it.
		 */
		function turnOfCall(callId) {
			let cursor = callId;
			for (let depth = 0; cursor !== void 0 && depth < 32; depth++) {
				const turn = rootCallTurns.get(cursor);
				if (turn !== void 0) return turn;
				cursor = callParents.get(cursor);
			}
			return void 0;
		}
		/**
		 * Learn one wire record's place in the call tree: the turn a root call belongs to,
		 * and the parent a dispatched child hangs off. This runs while the record is
		 * matched, not while it is folded: the assembler takes every Match of a prepended
		 * page before it applies any of that page's Updates, so a child routed from the
		 * fold alone would find no ancestor and drop out of its turn.
		 */
		function rememberCallRoute(event) {
			const data = event.data;
			if (event.type === "tool/call") {
				const callId = String(data.callId ?? "");
				if (callId === "") return;
				if (data.parentCallId === void 0) rememberRootCall(callId, data.turn);
				else rememberCallParent(callId, String(data.parentCallId));
				return;
			}
			const subCallId = String(data.subCallId ?? "");
			if (subCallId === "") return;
			rememberCallParent(subCallId, String(data.parentCallId));
		}
		/** Append one settled call's hunks to a turn's changed list. */
		function appendChanged(state, seq, hunks) {
			const path = hunks.length === 0 ? void 0 : hunks[0].path;
			if (typeof path !== "string") return state;
			return {
				...state,
				changed: [...state.changed, {
					seq,
					path,
					diffs: hunks
				}]
			};
		}
		/**
		 * Fold one wire event into a turn's accumulator state. Root mutations settle with
		 * their applied hunks in the result metadata; a PTC dispatch child never carries
		 * metadata, so it is derived from the arguments its start record kept.
		 */
		function foldTurnEvent(state, match) {
			const event = match.event;
			const data = event.data;
			if (event.type === "tool/call") {
				const callId = String(data.callId ?? "");
				if (callId === "") return state;
				const calls = new Map(state.calls);
				calls.set(callId, {
					name: String(data.name ?? ""),
					argsRaw: typeof data.arguments === "string" ? data.arguments : ""
				});
				return {
					...state,
					calls
				};
			}
			if (event.type === "tool/result") {
				const content = data.message?.content?.[0];
				if (content === void 0 || content === null || content.isError === true) return state;
				const call = state.calls.get(String(data.message?.source?.callId ?? ""));
				if (call === void 0 || TOOL_KEYS.indexOf(call.name) === -1) return state;
				return appendChanged(state, match.event.seq, resolveDiffs(call.name, {
					kind: "tool-result",
					meta: data.meta,
					isError: false
				}, parseArgs(call.argsRaw)));
			}
			if (event.type === "tool/ptc-dispatch-start") {
				const subCallId = String(data.subCallId ?? "");
				if (subCallId === "") return state;
				const calls = new Map(state.calls);
				calls.set(subCallId, {
					name: String(data.name ?? ""),
					argsRaw: JSON.stringify(data.arguments ?? {})
				});
				return {
					...state,
					calls
				};
			}
			if (event.type === "tool/ptc-dispatch") {
				if (data.isError === true) return state;
				const call = state.calls.get(String(data.subCallId ?? ""));
				if (call === void 0 || TOOL_KEYS.indexOf(call.name) === -1) return state;
				return appendChanged(state, match.event.seq, deriveDiffs(call.name, parseArgs(call.argsRaw)));
			}
			return state;
		}
		/** The per-turn accumulator definition the conversation event registry runs. */
		function turnChangesDefinition() {
			return {
				kind: TURN_DATA_KEY,
				match: (event) => {
					if (event.type === "tool/call") {
						rememberCallRoute(event);
						return {
							id: String(event.data.turn),
							role: "update"
						};
					}
					if (event.type === "tool/ptc-dispatch-start" || event.type === "tool/ptc-dispatch") {
						rememberCallRoute(event);
						const turn = turnOfCall(String(event.data.parentCallId));
						return turn === void 0 ? null : {
							id: String(turn),
							role: "update"
						};
					}
					if (event.type === "turn/start") return {
						id: String(event.data.turn),
						role: "start"
					};
					if (event.type === "tool/result" && event.surfaceOp === "append") return {
						id: String(event.data.turn),
						role: "update"
					};
					return null;
				},
				start: (_context, match) => ({
					turn: match.event.data.turn,
					calls: new Map(),
					changed: []
				}),
				update: (context, match) => foldTurnEvent(context.state, match),
				buildLocationData: (context, scope, previous) => {
					if (scope !== "turn" || context.state === void 0) return null;
					const { changed } = context.state;
					if (previous != null && previous.kind === "turn" && previous.turn === context.state.turn && previous.key === TURN_DATA_KEY && previous.value?.changed === changed) return previous;
					return {
						kind: "turn",
						turn: context.state.turn,
						key: TURN_DATA_KEY,
						value: { changed }
					};
				}
			};
		}
		/**
		 * One row per path: a file edited several times in the turn keeps every hunk, in
		 * settlement order.
		 */
		function mergeChangedFiles(changed) {
			const rows = [];
			const byPath = new Map();
			for (const entry of changed) {
				const row = byPath.get(entry.path);
				if (row === void 0) {
					const created = {
						path: entry.path,
						diffs: [...entry.diffs]
					};
					byPath.set(entry.path, created);
					rows.push(created);
				} else row.diffs.push(...entry.diffs);
			}
			return rows;
		}
		/**
		 * Claim the turn tail only for a turn that changed files before its closing
		 * assistant. The chain compares select results by identity, so one published data
		 * object and one closing seq always answer the same array.
		 */
		const turnSelectMemo = new WeakMap();
		function selectChangedFiles(owner) {
			/* Defensive by design: the chain renderer catches a throwing selector and treats
			   it as "declined", so an exception here is indistinguishable from "this turn
			   changed nothing" and would hide a real wiring bug. */
			const turn = owner?.turn;
			if (turn === null || turn === void 0) return null;
			const data = turn.data !== null && turn.data !== void 0 && typeof turn.data.get === "function" ? turn.data.get(TURN_DATA_KEY) : void 0;
			if (data === void 0 || !Array.isArray(data.changed)) return null;
			let bySeq = turnSelectMemo.get(data);
			if (bySeq === void 0) {
				bySeq = new Map();
				turnSelectMemo.set(data, bySeq);
			}
			const cached = bySeq.get(owner.seq);
			if (cached !== void 0) return cached;
			const changed = data.changed.filter((entry) => entry.seq <= owner.seq);
			const matched = changed.length === 0 ? null : { changed };
			bySeq.set(owner.seq, matched);
			return matched;
		}
				/**
		 * Split one path for display: the file name keeps the emphasis and its
		 * directory stays dim behind it, spelled as the tool rows already spell paths
		 * (forward slashes, so a Windows path reads the same on every surface).
		 */
		function splitDisplayPath(path) {
			const value = normalizeSeparators(String(path ?? ""));
			const index = value.lastIndexOf("/");
			return index === -1 ? {
				dir: "",
				base: value
			} : {
				dir: value.slice(0, index + 1),
				base: value.slice(index + 1)
			};
		}
		/**
		 * The connection's generic-RPC caller, or undefined when the service is absent
		 * or hostile. Every read is guarded, so this can never throw.
		 */
		function rpcCallOf(ctx) {
			try {
				const rpc = ctx?.get?.("connection")?.rpc;
				const call = rpc?.call;
				return typeof call === "function" ? call.bind(rpc) : void 0;
			} catch {
				return void 0;
			}
		}
		/**
		 * Whether this deployment can hand a path to the user's own desktop: the page
		 * has to reach the Host on the operator's machine (loopback) and the session
		 * controller's opener capability has to answer true. The probe is a round trip,
		 * so every absence, hostility or transport failure resolves false, never throws.
		 */
		async function canRevealPaths(ctx) {
			const call = rpcCallOf(ctx);
			if (call === void 0) return false;
			try {
				if (ctx.get("connection")?.isLoopback !== true) return false;
				const answer = await call("/api", "session/canOpenWorkspacePath", { args: {} });
				return answer !== null && typeof answer === "object" && answer.ok === true && answer.value === true;
			} catch {
				return false;
			}
		}
		/**
		 * Reveal one path on the Host desktop. Fire and forget: the affordance is
		 * best-effort, so a refusal (unknown path, no desktop, offline) only swallows.
		 */
		/** One failure message out of whatever the transport threw. */
		function errorTextOf(error) {
			if (typeof error === "string") return error;
			const message = error?.message;
			return typeof message === "string" && message !== "" ? message : String(error);
		}
		/**
		 * The containing folder of one path, spelled with the separators the path
		 * already uses — no platform guessing on a path the host owns.
		 */
		function folderPathOf(path) {
			const value = String(path ?? "");
			const index = Math.max(value.lastIndexOf("/"), value.lastIndexOf("\\"));
			return index <= 0 ? value : value.slice(0, index);
		}
		/** Route this plugin's own host half serves the reveal on. */
		const REVEAL_ROUTE = "/edit-diff/reveal";

		/** One backslash, spelled without a literal so no escape can go wrong. */
		const PATH_SEP = String.fromCharCode(92);
		/** Whether one path is already absolute in either separator convention. */
		function isAbsolutePath(path) {
			if (path.startsWith("/")) return true;
			if (path.startsWith(PATH_SEP + PATH_SEP)) return true;
			return path.length > 2 && path[1] === ":" && (path[2] === "/" || path[2] === PATH_SEP);
		}
		/**
		 * One path in the separator convention `sample` spells: a sample that uses a
		 * backslash produces a backslash path. The desktop host hands the result straight
		 * to Explorer's `/select`, which ignores a forward-slash path without saying so,
		 * and the clipboard wants the spelling the transcript's own root uses.
		 */
		function nativeSeparators(value, sample = value) {
			return sample.includes(PATH_SEP) ? value.replace(/\//g, PATH_SEP) : value;
		}
		/**
		 * The absolute form of one recorded path: the transcript is free to spell a path
		 * relative to the workspace, while the file manager and the clipboard both need
		 * the absolute one.
		 */
		function absolutePathOf(path, cwd) {
			const value = String(path ?? "");
			if (value === "") return value;
			if (isAbsolutePath(value)) return nativeSeparators(value);
			const raw = typeof cwd === "string" ? cwd : "";
			const root = raw !== "" ? stripTrailingSeparators(normalizeSeparators(raw)) : "";
			if (root === "") return value;
			const tail = value.startsWith("./") ? value.slice(2) : value;
			return nativeSeparators(root + "/" + tail, raw);
		}
		/**
		 * The Host's base URL for its own HTTP routes. A carrier may report a null
		 * origin (a page that is not served over HTTP), and then requests ride the
		 * internal origin the connection already uses — the exact convention the
		 * shipped open-in-app client follows. On the desktop renderer the page origin
		 * already IS the harness server, so a relative URL would reach the same place;
		 * the absolute form is what also covers a null-origin carrier.
		 */
		function hostBase() {
			const origin = typeof location !== "undefined" ? location?.origin : void 0;
			return typeof origin === "string" && origin !== "" && origin !== "null" ? origin : "http://dsh.internal";
		}
		/** The reveal route as an absolute URL, or null when it cannot be built here. */
		function revealUrl() {
			try {
				return new URL(REVEAL_ROUTE, hostBase()).href;
			} catch {
				return null;
			}
		}
		/**
		 * The fetch the carrier handed the connection, or the page's own fetch. The
		 * carrier's fetch is preferred because it carries the connection's own request
		 * plumbing; the page's own fetch reaches the Host too — the desktop renderer is
		 * served BY the harness server, and every same-origin request from it gets the
		 * renderer access header injected — so it is a working fallback, not a dead end.
		 */
		function hostFetch() {
			const carrier = typeof globalThis !== "undefined" ? globalThis.__DSH_TRANSPORT__?.fetch : void 0;
			if (typeof carrier === "function") return carrier;
			return typeof fetch === "function" ? fetch : null;
		}
		/**
		 * Ask this plugin's own host half to reveal one path.
		 * @returns { missing, detail }: detail null once the host confirmed; otherwise
		 * the reason, with missing telling the caller whether a fallback exists at all.
		 */
		async function revealViaHostRoute(path) {
			const send = hostFetch();
			if (send === null) return {
				missing: true,
				detail: "这个界面没有可用的 fetch"
			};
			const url = revealUrl();
			if (url === null) return {
				missing: true,
				detail: "拼不出宿主 URL"
			};
			try {
				const response = await send(url, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ path })
				});
				// 404 is this route absent; 405 is the deployment's static frontend answering
				// for an unregistered path. Both mean "not served here" — fall back.
				if (response.status === 404 || response.status === 405) return {
					missing: true,
					detail: "HTTP " + response.status + " " + url
				};
				let answer = null;
				try {
					answer = await response.json();
				} catch {}
				if (response.ok === true && answer !== null && typeof answer === "object" && answer.ok === true) return {
					missing: false,
					detail: null
				};
				const reason = answer !== null && typeof answer === "object" && typeof answer.error === "string" && answer.error !== "" ? answer.error : "HTTP " + response.status;
				return {
					missing: false,
					detail: "宿主路由 " + reason + "（" + url + "）"
				};
			} catch (error) {
				return {
					missing: true,
					detail: "请求失败 " + errorTextOf(error) + "（" + url + "）"
				};
			}
		}
		/** The Host's own opener, over the connection's generic RPC channel. */
		function revealViaCoreRpc(ctx, path) {
			const call = rpcCallOf(ctx);
			if (call === void 0) return Promise.resolve("没有可用的连接通道");
			const settled = Promise.resolve().then(() => call("/api", "session/openWorkspacePath", { args: { request: {
				path,
				action: "reveal"
			} } })).then((answer) => answer !== null && typeof answer === "object" && answer.ok === true ? null : "host 拒绝了请求：" + JSON.stringify(answer).slice(0, 200), (error) => errorTextOf(error));
			const timer = typeof window !== "undefined" && typeof window.setTimeout === "function" ? new Promise((resolve) => {
				window.setTimeout(() => resolve("host 4 秒内没有应答（若资源管理器已经弹出，忽略这条）"), 4000);
			}) : null;
			return timer === null ? settled : Promise.race([settled, timer]);
		}
		/**
		 * Reveal one path and report which channel answered, because the two are not the
		 * same gesture to the user: { via: "route" } is this plugin's own host route (it
		 * forces a visible window), { via: "host", note } is the Host's own opener after
		 * the route failed — note carries why, so a silent fallback cannot hide a broken
		 * route. { text } means neither channel worked.
		 */
		function revealPathVia(ctx, path) {
			return Promise.resolve(revealViaHostRoute(path)).then((route) => {
				if (route.detail === null) return { via: "route" };
				return Promise.resolve(revealViaCoreRpc(ctx, path)).then((official) => {
					if (official === null) return {
						via: "host",
						note: route.detail
					};
					return { text: route.missing ? official : route.detail + "；官方端点也失败：" + official };
				}, (error) => ({ text: errorTextOf(error) }));
			}, (error) => ({ text: errorTextOf(error) }));
		}
		/** Best-effort clipboard write: a refused or missing clipboard is not an error. */
		function copyPathText(text) {
			try {
				Promise.resolve(writeClipboard(text)).catch(() => {});
			} catch {}
		}
		/**
		 * One row's context menu: reveal on the desktop when the deployment can, and
		 * copy the path exactly as the row spells it.
		 */
		function pathMenuItems(dict, canReveal) {
			const items = [];
			if (canReveal) items.push({
				id: "reveal",
				label: dict.revealInExplorer
			});
			items.push({
				id: "copyFolderPath",
				label: dict.copyFolderPath
			}, {
				id: "copyFilePath",
				label: dict.copyFilePath
			});
			return items;
		}
		/**
		 * What one reveal answer says under the row that was clicked, and whether it reads
		 * as a failure. Pure, so the smoke suite pins the wording instead of a hand test.
		 */
		function revealNoteText(dict, outcome) {
			const via = outcome === null || typeof outcome !== "object" ? void 0 : outcome.via;
			const note = outcome !== null && typeof outcome === "object" && typeof outcome.note === "string" ? outcome.note : "";
			if (via === "route") return {
				text: dict.revealOpened,
				tone: "info"
			};
			if (via === "host") return {
				text: dict.revealRequested + (note === "" ? "" : "；宿主路由未用上：" + note),
				tone: "info"
			};
			return {
				text: errorTextOf(outcome !== null && typeof outcome === "object" ? outcome.text : outcome),
				tone: "error"
			};
		}
		/**
		 * One row's path context menu, as one gesture shared by the turn card and the tool
		 * rows: probe once, offer reveal when the deployment can hand a path to the desktop,
		 * offer both copies always, and report whichever channel answered under the row that
		 * was clicked. Two owners for one gesture would drift apart.
		 */
		function useRevealMenu({ dict, revealPath, probeReveal }) {
			const [menu, setMenu] = React.useState(null);
			const [note, setNote] = React.useState(null);
			const [canReveal, setCanReveal] = React.useState(false);
			React.useEffect(() => {
				if (typeof probeReveal !== "function") return void 0;
				let live = true;
				probeReveal().then((answer) => {
					if (live) setCanReveal(answer === true);
				}, () => {});
				return () => {
					live = false;
				};
			}, [probeReveal]);
			const openMenu = React.useCallback((event, key, target) => {
				event.preventDefault();
				setMenu({
					key,
					target,
					x: event.clientX,
					y: event.clientY
				});
			}, []);
			const onSelect = React.useCallback((id) => {
				if (menu === null) return;
				const key = menu.key;
				const target = menu.target;
				setMenu(null);
				if (id === "copyFilePath") {
					copyPathText(target);
					return;
				}
				if (id === "copyFolderPath") {
					copyPathText(folderPathOf(target));
					return;
				}
				if (id !== "reveal") return;
				if (typeof revealPath !== "function") {
					setNote({
						path: key,
						text: dict.revealUnavailable,
						tone: "error"
					});
					return;
				}
				Promise.resolve(revealPath(target)).then((outcome) => {
					const line = revealNoteText(dict, outcome);
					setNote({
						path: key,
						text: line.text,
						tone: line.tone
					});
					try {
						if (line.tone === "error") console.warn("[dsh-edit-diff] 在资源管理器中打开失败:", line.text);
						else console.info("[dsh-edit-diff] 已请求在资源管理器中显示（" + (outcome === null || typeof outcome !== "object" ? "" : outcome.via) + "）:", target);
					} catch {}
				}, (error) => setNote({
					path: key,
					text: errorTextOf(error),
					tone: "error"
				}));
			}, [menu, dict, revealPath]);
			const noteElementFor = (key) => {
				if (note === null || note.path !== key) return null;
				return h("div", {
					className: note.tone === "info" ? "dsh-edit-diff-note dsh-edit-diff-note-info" : "dsh-edit-diff-note",
					children: note.text
				});
			};
			const menuElement = menu === null ? null : h("div", {
				className: "dsh-edit-diff-turn-menu"
			}, h(Menu, {
				open: true,
				portal: true,
				items: pathMenuItems(dict, canReveal),
				onClose: () => setMenu(null),
				onSelect,
				getAnchorRect: () => ({
					left: menu.x,
					top: menu.y,
					right: menu.x,
					bottom: menu.y,
					width: 0,
					height: 0
				})
			}));
			return {
				canReveal,
				openMenu,
				noteElementFor,
				menuElement
			};
		}
		/** Empty workspace source: the card then spells every path as the tool wrote it. */
		const EMPTY_CWD_SOURCE = {
			getSnapshot: () => void 0,
			subscribe: () => () => {}
		};
		/**
		 * The workspace root a turn card's rows are spelled against. It is the same
		 * getSnapshot/subscribe source the framework's own views read, because the root
		 * can arrive after the first render and the card has to re-render when it does.
		 * The slot's inject factory receives the Session id, which is what selects it.
		 */
		function workspaceSourceOf(sessions, sessionId) {
			if (sessions === void 0 || sessions.list === void 0 || typeof sessionId !== "string" || sessionId === "") return null;
			return {
				getSnapshot: () => sessions.list.getSnapshot().byId[sessionId]?.cwd,
				subscribe: (listener) => sessions.list.subscribe(listener)
			};
		}
		/** Read one workspace root from a slot-injected source. */
		function useWorkspaceCwd(source) {
			const active = source ?? EMPTY_CWD_SOURCE;
			return React.useSyncExternalStore(active.subscribe, active.getSnapshot);
		}
		/**
		 * The per-turn card: every file this turn's mutations changed, each row with
		 * its own +N -M, a caret that collapses the list, and per-file actions that
		 * review the hunk inline or hand the path to the chat's opener.
		 */
		function TurnDiffCard({ matched, openFile, locale, cwdSource, revealPath, probeReveal }) {
			const dict = DICT[useLanguage(locale)] ?? DICT.zh;
			const cwd = useWorkspaceCwd(cwdSource);
			const reveal = useRevealMenu({
				dict,
				revealPath,
				probeReveal
			});
			const [collapsed, setCollapsed] = React.useState(false);
			const [showAll, setShowAll] = React.useState(false);
			const [openPath, setOpenPath] = React.useState(null);
			const rows = React.useMemo(() => mergeChangedFiles(matched.changed).map((row) => ({
				path: row.path,
				absolute: absolutePathOf(row.path, cwd),
				display: splitDisplayPath(relativizePath(row.path, cwd)),
				model: buildDiffModel(row.diffs)
			})), [matched, cwd]);
			const labels = React.useMemo(() => ({
				copy: dict.copy,
				copied: dict.copied,
				collapseAria: dict.collapseAria,
				expandAria: dict.expandAria,
				collapse: dict.collapse,
				expand: dict.expand,
				files: dict.files
			}), [dict]);
			const totals = React.useMemo(() => {
				let added = 0;
				let removed = 0;
				for (const row of rows) {
					added += row.model.added;
					removed += row.model.removed;
				}
				return {
					added,
					removed
				};
			}, [rows]);
			const visible = showAll ? rows : rows.slice(0, TURN_PREVIEW_ROWS);
			const hiddenRows = rows.length - visible.length;
			const toggleRow = (path) => setOpenPath(openPath === path ? null : path);
			return h("div", {
				className: "dsh-edit-diff-turn"
			}, h("div", {
				className: "dsh-edit-diff-turn-head"
			}, h("button", {
				type: "button",
				className: "dsh-edit-diff-turn-toggle",
				"aria-expanded": !collapsed,
				title: dict.filesChanged(rows.length),
				onClick: () => setCollapsed(!collapsed)
			}, h("span", {
				className: collapsed ? "dsh-edit-diff-turn-caret" : "dsh-edit-diff-turn-caret dsh-edit-diff-turn-caret-open",
				"aria-hidden": true
			}, h(IconChevronRightOutline14, null)), h("span", {
				className: "dsh-edit-diff-turn-title",
				children: dict.filesChanged(rows.length)
			}), h("span", {
				className: "dsh-edit-diff-turn-total",
				children: statNode(totals)
			}))), collapsed ? null : h("div", {
				className: "dsh-edit-diff-turn-body"
			}, visible.map((row) => h("div", {
				key: row.path,
				className: "dsh-edit-diff-turn-item"
			}, h("div", {
				className: "dsh-edit-diff-turn-row",
				onContextMenu: (event) => reveal.openMenu(event, row.path, row.absolute)
			}, h("button", {
				type: "button",
				className: "dsh-edit-diff-turn-main",
				title: row.path,
				"aria-expanded": openPath === row.path,
				onClick: () => toggleRow(row.path)
			}, h("span", {
				className: "dsh-edit-diff-turn-icon",
				"aria-hidden": true
			}, h(FileTypeIcon, {
				path: row.path,
				size: 14
			})), h("span", {
				className: "dsh-edit-diff-turn-name",
				children: row.display.base
			}), row.display.dir === "" ? null : h("span", {
				className: "dsh-edit-diff-turn-dir",
				children: row.display.dir
			})), ...countBadge(row.model), h("span", {
				className: "dsh-edit-diff-turn-actions"
			}, h("button", {
				type: "button",
				className: "dsh-edit-diff-turn-action dsh-edit-diff-turn-review",
				"aria-expanded": openPath === row.path,
				title: dict.review,
				onClick: () => toggleRow(row.path),
				children: dict.review
			}), typeof openFile === "function" ? h("button", {
				type: "button",
				className: "dsh-edit-diff-turn-action dsh-edit-diff-turn-open",
				onClick: () => openFile(row.path),
				children: dict.open
			}) : null)), reveal.noteElementFor(row.path), openPath === row.path ? h(DiffBody, {
				key: "body",
				model: row.model,
				labels
			}) : null)), hiddenRows > 0 ? h("button", {
				type: "button",
				className: "dsh-edit-diff-turn-more",
				onClick: () => setShowAll(true),
				children: dict.showMore(hiddenRows)
			}) : null, showAll && rows.length > TURN_PREVIEW_ROWS ? h("button", {
				type: "button",
				className: "dsh-edit-diff-turn-more",
				onClick: () => setShowAll(false),
				children: dict.showLess
			}) : null), reveal.menuElement);
		}//#endregion
		//#region apply
		const TOOL_KEYS = [
			"edit",
			"write",
			"insert",
			"str_replace_editor"
		];
		const inject = ["slots", "locale", "uiConversation", "sessions"];
		/**
		 * Election rank of the turn-tail entry.
		 *
		 * A chain elects the first entry whose selector accepts, ascending by
		 * priority, and equal priorities keep registration order — so `-1`, the rank
		 * that shadows the built-in rows, is not enough here. Any other plugin that
		 * also shadows the tail sits on exactly `-1` too, and whichever bundle the
		 * loader mounts first silently wins every election. `dsh-better-sidebar`
		 * (0.19.1) does precisely that: its selector claims every turn that produced
		 * files, which is exactly the set of turns this card exists for. An order of
		 * magnitude below the shadowing convention keeps this card elected without
		 * depending on load order; `reportTurnTailCompetition` names anything that
		 * still outranks it.
		 */
		const TURN_TAIL_PRIORITY = -100;
		/**
		 * Shadow the built-in file-mutation rows with a diff-first card.
		 *
		 * The slot registry resolves one winner per key at the lowest priority, so
		 * registering below the built-in rows (priority 0) takes them over without
		 * touching any shipped bundle. This is what lets a run_code sub-call — the
		 * shape the built-in `diffCardModel` refuses outright — show its hunks.
		 */
		function apply(ctx) {
			installStyles();
			const locale = ctx.get("locale");
			const sessions = ctx.get("sessions");
			const revealPath = (path) => revealPathVia(ctx, path);
			/**
			 * The capability probe is one RPC round trip and every tool row and the turn card
			 * want the same answer, so they share one in-flight probe instead of asking once per
			 * row. A negative answer is not remembered: the connection can become ready later and
			 * the next right-click should be able to see it.
			 */
			let revealProbe = null;
			let revealProbeReady = false;
			const probeReveal = () => {
				if (revealProbeReady) return Promise.resolve(true);
				if (revealProbe !== null) return revealProbe;
				revealProbe = canRevealPaths(ctx).then((answer) => {
					revealProbe = null;
					if (answer === true) revealProbeReady = true;
					return answer === true;
				}, () => {
					revealProbe = null;
					return false;
				});
				return revealProbe;
			};
			const register = ctx.slots.register.bind(ctx.slots);
			for (const key of TOOL_KEYS) ctx.slots.inject("tool.call.toolview", () => register({
				name: "tool.call.toolview",
				key,
				priority: -1,
				registrant: "dsh-edit-diff",
				inject: () => ({
					locale,
					revealPath,
					probeReveal
				})
			}, guarded(EditDiffRow, "工具行")));
			/* The turn-tail slot is registered BEFORE the accumulator, and unconditionally.
			   A single missing service used to take the whole card down silently: the guard
			   below returned early, so no slot and no accumulator were ever wired, and the
			   only visible symptom was the built-in deliverables card taking the tail. */
			ctx.slots.inject("conversation.chat.turnTail", () => register({
				name: "conversation.chat.turnTail",
				priority: TURN_TAIL_PRIORITY,
				select: selectChangedFiles,
				registrant: "dsh-edit-diff",
				inject: (sessionId) => ({
					locale,
					cwdSource: workspaceSourceOf(sessions, sessionId),
					revealPath,
					probeReveal
				})
			}, guarded(TurnDiffCard, "轮末改动卡")));
			reportTurnTailCompetition(ctx);
			const uiConversation = conversationOf(ctx);
			if (uiConversation === void 0) {
				/* Loud on purpose: the card declines for every turn when this seat is missing,
				   which is indistinguishable from "this turn changed nothing" on screen. */
				console.warn("[dsh-edit-diff] 轮末改动卡未接线：拿不到 uiConversation 的事件注册表（工具行的差异卡不受影响）。");
				return;
			}
			uiConversation.events.register(turnChangesDefinition());
		}
		/**
		 * Name any turn-tail entry that can still outrank this card.
		 *
		 * Losing the election is invisible: the tail simply shows someone else's row,
		 * which reads exactly like "this turn changed nothing". The competition is
		 * therefore reported once per distinct set of rivals instead of waiting to be
		 * noticed by eye. Registration order is deliberately not the tie-breaker —
		 * {@link TURN_TAIL_PRIORITY} is what decides, so anything at or below it is a
		 * real regression rather than noise.
		 */
		function reportTurnTailCompetition(ctx) {
			let reported = "";
			const inspect = () => {
				let occupants;
				try {
					occupants = ctx.slots.snapshot("conversation.chat.turnTail")?.[0]?.occupants ?? [];
				} catch {
					return;
				}
				const rivals = occupants.filter((occupant) => occupant.registrant !== "dsh-edit-diff" && occupant.priority <= TURN_TAIL_PRIORITY).map((occupant) => `${occupant.registrant ?? "?"}@${occupant.priority}`);
				const signature = rivals.join(", ");
				if (signature === "" || signature === reported) return;
				reported = signature;
				console.warn(`[dsh-edit-diff] 轮末链上有不高于本插件的占用者：${signature} —— 链按优先级升序选举，它先认领时本插件的轮末卡不会出现。`);
			};
			inspect();
			if (typeof ctx.slots.subscribe !== "function") return;
			ctx.effect(() => ctx.slots.subscribe("conversation.chat.turnTail", inspect), "dsh-edit-diff: 轮末链竞争检查");
		}
		/**
		 * Whether one service exposes the conversation event registry this plugin folds on.
		 */
		function hasEventRegistry(service) {
			if (service === null || typeof service !== "object") return false;
			const events = service.events;
			return events !== null && typeof events === "object" && typeof events.register === "function";
		}
		/**
		 * The conversation service seat, by property first and `ctx.get` second.
		 *
		 * The built-in turn-tail cards reach it as `ctx.uiConversation`; this plugin reached
		 * it only as `ctx.get("uiConversation")`. Both name the same seat, but a bundle can
		 * be handed a context where one of the two is not wired, so asking both ways costs
		 * nothing and removes that failure mode.
		 */
		function conversationOf(ctx) {
			if (hasEventRegistry(ctx.uiConversation)) return ctx.uiConversation;
			const looked = typeof ctx.get === "function" ? ctx.get("uiConversation") : void 0;
			return hasEventRegistry(looked) ? looked : void 0;
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.EditDiffRow = EditDiffRow;
		exports.TurnDiffCard = TurnDiffCard;
			exports.__internals = {
			absolutePathOf,
			annotateRows,
			bodyRows,
			buildDiffModel,
			canRevealPaths,
			CardBoundary,
			contextOf,
			guarded,
			hostBase,
			changedLines,
			charMarks,
			contentLines,
			deriveDiffs,
			errorTextOf,
			folderPathOf,
			highlightDiffLines,
			hunkRows,
			langOfPath,
			linesText,
			lineSimilarity,
			locateBases,
			locateOnce,
			mergeChangedFiles,
			metaDiffs,
			numberRows,
			pairRun,
			pathMenuItems,
			relativizePath,
			resolveBases,
			revealNoteText,
			revealPathVia,
			revealViaHostRoute,
			rpcCallOf,
			titleKeyOf,
			stateOf
		};
		return module.exports;
	}
});
