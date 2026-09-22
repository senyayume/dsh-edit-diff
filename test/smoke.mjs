import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const bundlePath = join(here, "..", "lib", "client.js");
/**
 * React for this harness: the DSH app's own copy when the machine has one, otherwise
 * whatever `npm install` left in node_modules. Every hook is stubbed below, so only
 * createElement/Fragment are used and any React 18 works.
 */
function loadReact() {
	const roots = [process.env.DSH_APP_ROOT, "D:/DSH Desktop/resources/app"].filter((root) => typeof root === "string" && root !== "");
	for (const root of roots) {
		try {
			return createRequire(join(root, "package.json"))("react");
		} catch {}
	}
	try {
		return createRequire(import.meta.url)("react");
	} catch {
		throw new Error("smoke 需要 react 18：先 npm install，或把 DSH_APP_ROOT 指向放有 package.json 的 DSH 应用目录");
	}
}
const React = loadReact();
React.useState = (initial) => [typeof initial === "function" ? initial() : initial, () => {}];
React.useEffect = () => {};
React.useMemo = (factory) => factory();
React.useCallback = (callback) => callback;
React.useSyncExternalStore = (subscribe, getSnapshot) => getSnapshot();
const expand = (node) => {
	if (Array.isArray(node)) return node.map(expand);
	if (node === null || typeof node !== "object") return node;
	if (typeof node.type === "function") {
		/*
		 * A class component is the error boundary, and calling it as a plain function throws
		 * ("Class constructor … cannot be invoked without 'new'"), so it is instantiated the
		 * way React would. A throw from `render` is offered to `getDerivedStateFromError` and
		 * the component re-renders once, which is the contract the boundary is written against
		 * — without this the boundary could not be exercised at all.
		 */
		const isClass = typeof node.type.prototype?.render === "function";
		if (isClass) {
			const instance = new node.type(node.props);
			instance.props = node.props;
			instance.state = instance.state ?? {};
			try {
				return expand(instance.render());
			} catch (error) {
				if (typeof node.type.getDerivedStateFromError !== "function") throw error;
				instance.state = { ...instance.state, ...node.type.getDerivedStateFromError(error) };
				const html = expand(instance.render());
				if (typeof instance.componentDidCatch === "function") instance.componentDidCatch(error, { componentStack: "" });
				return html;
			}
		}
		return expand(node.type(node.props));
	}
	return {
		...node,
		props: {
			...node.props,
			children: expand(node.props.children)
		}
	};
};
const render = (element) => JSON.stringify(expand(element));
/**
 * The text of every inline mark span in a rendered tree, concatenated.
 *
 * A mark range is cut per token, so one changed run can render as several mark spans
 * (`" CHANGED"` arrives as `" "` + `"CHANGED"` once the tokenizer separates the number
 * from the word). Asserting on the concatenation keeps the check about *what is marked*
 * rather than about how many spans the tokenizer happened to emit.
 */
const markText = (html) => [...html.matchAll(/"className":"dsh-edit-diff-mark","children":"((?:[^"\\]|\\.)*)"/g)].map((match) => JSON.parse(`"${match[1]}"`)).join("");
/** How many rows carry one row class. */
const rowCount = (html, kind) => html.split(`"className":"dsh-edit-diff-line dsh-edit-diff-${kind}"`).length - 1;

const registrations = [];
const primitivesStub = {
	DisclosureRow: ({ title, collapsedContent, children }) =>
		React.createElement("div", { "data-title": title }, collapsedContent, children),
	IconEditOutline16: () => React.createElement("i", null, "icon"),
	FileTypeIcon: ({ path, size }) => React.createElement("i", { "data-file-type": path, "data-size": size }),
	IconChevronRightOutline14: () => React.createElement("i", null, "caret"),
	Menu: ({ open, items }) => React.createElement("div", { "data-menu": open === true ? "open" : "closed" }, items.map((item) => React.createElement("span", { key: item.id, "data-menu-item": item.id }, item.label))),
	StateDot: ({ state }) => React.createElement("i", null, state),
	writeClipboard: () => Promise.resolve(true)
};
/*
 * Deliberately NOT stubbed here: `highlightLines`, `subscribeGrammarLoaded`,
 * `grammarLoadCount`. The shipped package does not export them, and stubbing them
 * made this harness test a fake dependency — it stayed green while the real card
 * crashed on open and then silently lost all colour. The tokenizer under test is
 * the plugin's own and is reached through `__internals`.
 */

const sandbox = {
	window: { __ModuleLoader__: { load: (registration) => registrations.push(registration) } },
	navigator: { language: "zh-CN" },
	URL,
	document: {
		querySelector: () => null,
		createElement: () => ({ dataset: {}, set textContent(value) { this._text = value; } }),
		head: { appendChild: () => {} }
	},
	console
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(bundlePath, "utf8"), sandbox, { filename: bundlePath });

assert.equal(registrations.length, 1, "the bundle registers exactly one module");
const registration = registrations[0];
assert.equal(registration.id, "dsh-edit-diff", "the module id is the package name");

const moduleExports = registration.factory((specifier) => {
	if (specifier === "react") return React;
	if (specifier === "@deepseek-ai/dsh-client-ui-primitives") return primitivesStub;
	throw new Error(`unexpected require: ${specifier}`);
});

assert.deepEqual([...moduleExports.inject], ["slots", "locale", "uiConversation", "sessions"]);
assert.equal(typeof moduleExports.apply, "function");
const plain = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const internals = Object.fromEntries(Object.entries(moduleExports.__internals).map(([key, fn]) => [key, (...args) => plain(fn(...args))]));

const editArgs = {
	file_path: "D:/Projects/demo/tests/unit/test_x.py",
	old_string: "a\nb",
	new_string: "a\nb\nc"
};
assert.deepEqual(internals.deriveDiffs("edit", editArgs), [{
	path: "D:/Projects/demo/tests/unit/test_x.py",
	oldText: "a\nb",
	newText: "a\nb\nc"
}]);
assert.deepEqual(internals.deriveDiffs("write", {
	file_path: "x.md",
	content: "hello"
}), [{
	path: "x.md",
	oldText: null,
	newText: "hello"
}]);
assert.deepEqual(internals.deriveDiffs("str_replace_editor", {
	command: "create",
	path: "new.py",
	file_text: "print(1)"
}), [{
	path: "new.py",
	oldText: null,
	newText: "print(1)"
}]);
assert.deepEqual(internals.deriveDiffs("str_replace_editor", {
	command: "str_replace",
	path: "new.py",
	old_str: "1",
	new_str: "2"
}), [{
	path: "new.py",
	oldText: "1",
	newText: "2"
}]);
assert.deepEqual(internals.deriveDiffs("str_replace_editor", {
	command: "insert",
	path: "new.py",
	insert_line: 3,
	new_str: "x"
}), [{
	path: "new.py",
	oldText: null,
	newText: "x"
}]);
assert.deepEqual(internals.deriveDiffs("str_replace_editor", {
	command: "view",
	path: "new.py"
}), []);
assert.deepEqual(internals.deriveDiffs("edit", { file_path: "x" }), []);

assert.equal(internals.relativizePath("D:\\Projects\\demo\\a.md", "D:/Projects/demo", "C:/Users/dev"), "a.md");
assert.equal(internals.relativizePath("C:\\Users\\dev\\notes.md", "D:/Projects/demo", "C:/Users/dev"), "~/notes.md");
assert.equal(internals.relativizePath("D:/other/a.md", "D:/Projects/demo", "C:/Users/dev"), "D:/other/a.md");

const settledBlock = {
	kind: "tool-result",
	callId: "call_1",
	call: { name: "edit", argsRaw: JSON.stringify(editArgs) },
	content: [{ type: "text", text: "The file has been edited successfully." }],
	meta: { diffs: [{ path: editArgs.file_path, oldText: "a", newText: "b" }] },
	isError: false
};
// 结算元数据里的行号锚由 host 半身打上；没有（旧 host / 参数推导的 hunk）就是 null，
// 行号列会退回窗口内相对编号。字段始终存在，形状统一。
assert.deepEqual(internals.metaDiffs(settledBlock), [{
	path: editArgs.file_path,
	oldText: "a",
	newText: "b",
	oldStart: null,
	newStart: null
}]);
assert.deepEqual(internals.metaDiffs({
	...settledBlock,
	meta: { diffs: [{ path: "a.md", oldText: "a", newText: "b", oldStart: 7, newStart: 9 }] }
}), [{
	path: "a.md",
	oldText: "a",
	newText: "b",
	oldStart: 7,
	newStart: 9
}], "a stamped hunk carries its anchors through");
// 非法锚一律当没有：0、负数、小数、字符串都不是 1 基行号。
assert.deepEqual(internals.metaDiffs({
	...settledBlock,
	meta: { diffs: [{ path: "a.md", oldText: "a", newText: "b", oldStart: 0, newStart: "9" }] }
})[0].oldStart, null, "a zero anchor is not a line");
assert.equal(internals.metaDiffs({
	...settledBlock,
	meta: { diffs: [{ path: "a.md", oldText: "a", newText: "b", oldStart: 1.5, newStart: 9 }] }
})[0].oldStart, null, "a fractional anchor is not a line");
assert.equal(internals.metaDiffs({ ...settledBlock, meta: { diffs: [] } }), null);
assert.equal(internals.metaDiffs({ ...settledBlock, meta: { diffs: [{ path: "x", oldText: 1, newText: "y" }] } }), null);
assert.equal(internals.stateOf({ callId: "c", name: "edit", argsRaw: "{}" }), "running");
assert.equal(internals.stateOf({ ...settledBlock, isError: true }), "error");
assert.equal(internals.stateOf({ ...settledBlock, isError: true, error: { code: "interrupted" } }), "stopped");
assert.equal(internals.titleKeyOf("write", {}), "write");
assert.equal(internals.titleKeyOf("str_replace_editor", { command: "view" }), "read");
assert.equal(internals.titleKeyOf("str_replace_editor", { command: "str_replace" }), "edit");

const subCallBlock = {
	...settledBlock,
	parentCallId: "call_root",
	meta: void 0
};
const html = render(moduleExports.EditDiffRow({
	toolName: "edit",
	block: subCallBlock,
	cwd: "D:/Projects/demo",
	home: "C:/Users/dev",
	openFile: () => {},
	inspect: () => {}
}));
assert.match(html, /"data-tool":"edit"/);
assert.match(html, /"data-state":"ok"/);
assert.match(html, /"className":"dsh-edit-diff-added","children":"\+1"/, `the added count is coloured, got: ${html}`);
// 工具行头部的 +N -M 抑制零值：纯新增只显示 +N，不再拖一个 "-0"（红色零读起来像告警）。
// 只看 stat 节点自身——页脚那行照旧带 -0，整串 doesNotMatch 会误伤。
const headStat = /"className":"dsh-edit-diff-stat","children":\[(.*?)\]\}/.exec(html);
assert.ok(headStat, `the tool-row stat node is present, got: ${html}`);
assert.match(headStat[1], /"className":"dsh-edit-diff-added","children":"\+1"/, `the added count is coloured, got: ${headStat[1]}`);
assert.doesNotMatch(headStat[1], /-0/, `the tool-row header drops the zero half, got: ${headStat[1]}`);

// 页脚仍保留两侧：那是内置 DiffBlock 的形状，零也照出。
assert.match(html, /"className":"dsh-edit-diff-footer","children":"└ \+1 -0 · 1 个文件"/, `the footer keeps both halves, got: ${html}`);

// 长 hunk 不再折叠成 16 行，改为 max-height 滚动容器：所有行都进 DOM，且包在 .dsh-edit-diff-scroll 里。
assert.match(html, /"className":"dsh-edit-diff-scroll"/, `the body rows sit in the scroll container, got: ${html}`);
assert.doesNotMatch(html, /dsh-edit-diff-fold/, `the fold control is gone, got: ${html}`);
assert.match(html, /"data-title":"编辑"/);

// 长 hunk：折叠整套已删，改为 max-height:320px 的滚动容器。所有行都进 DOM（不靠"展开"才可见），
// 页脚与复制按钮留在滚动区外，滚到哪儿都在。
const longRows = Array.from({ length: 60 }, (_, i) => ({ kind: "add", text: "line " + i, marks: [] }));
const longHtml = render(moduleExports.EditDiffRow({
	toolName: "edit",
	block: {
		...settledBlock,
		meta: { diffs: [{ path: "a.md", oldText: "", newText: longRows.map((r) => r.text).join("\n") }] }
	},
	cwd: "D:/Projects/demo",
	home: "C:/Users/dev",
	openFile: () => {},
	inspect: () => {}
}));
assert.match(longHtml, /"className":"dsh-edit-diff-scroll"/, `long hunk uses the scroll container, got: ${longHtml}`);
assert.doesNotMatch(longHtml, /dsh-edit-diff-fold/, `no fold control on a long hunk, got: ${longHtml}`);
// 最后一行真的在 DOM 里，而不是被折叠掉：60 条 add 行全部到场，且末行的文字（现在是
// 「line 」+ 数字 token 两段）确实渲染出来了。
assert.equal(rowCount(longHtml, "add"), 60, `every added row is in the DOM, got: ${longHtml}`);
assert.ok(longHtml.includes("line 59"), `the last row's text is rendered, got: ${longHtml}`);
assert.doesNotMatch(longHtml, /展开其余/, `no "expand the rest" affordance remains, got: ${longHtml}`);

// 两侧都是零（hunk 文本没变：no-op edit、空 create、空 write 等）时，头部不再渲染空的
// stat span —— 那个 span 带 margin-left:10px/flex:none，空着也会占位。
const zeroBlock = {
	kind: "result",
	call: { callId: "c_zero", name: "edit", argsRaw: JSON.stringify({ file_path: "a.md", old_string: "same", new_string: "same" }) },
	content: [{ type: "text", text: "The file has been edited successfully." }],
	meta: void 0,
	isError: false
};
const zeroHtml = render(moduleExports.EditDiffRow({
	toolName: "edit",
	block: zeroBlock,
	cwd: "D:/Projects/demo",
	home: "C:/Users/dev",
	openFile: () => {},
	inspect: () => {}
}));
assert.doesNotMatch(zeroHtml, /dsh-edit-diff-stat/, `a both-zero header renders no stat span, got: ${zeroHtml}`);
// 但页脚照旧两侧都出：那是内置 DiffBlock 的形状。
assert.match(zeroHtml, /"className":"dsh-edit-diff-footer","children":"└ \+0 -0 · 1 个文件"/, `the footer still prints both zeros, got: ${zeroHtml}`);
assert.match(html, /tests\/unit\/test_x\.py/);

// 工具行也带那套右键入口（与轮末卡同源）。它在 contextmenu 之前不渲染任何东西，
// 拿到通道后渲染结果必须与原来一致——右键菜单是加菜，不是换盘。
const rowWithReveal = render(moduleExports.EditDiffRow({
	toolName: "edit",
	block: subCallBlock,
	cwd: "D:/Projects/demo",
	home: "C:/Users/dev",
	openFile: () => {},
	inspect: () => {},
	revealPath: () => Promise.resolve({ via: "route" }),
	probeReveal: () => Promise.resolve(true)
}));
assert.equal(rowWithReveal, html, "拿到 reveal 通道后工具行的渲染一字不变");
assert.doesNotMatch(rowWithReveal, /dsh-edit-diff-note/, "没点右键就没有提示行");

const failedHtml = render(moduleExports.EditDiffRow({
	toolName: "write",
	block: {
		kind: "tool-result",
		callId: "call_2",
		call: { name: "write", argsRaw: JSON.stringify({ file_path: "a.md", content: "x" }) },
		content: [{ type: "text", text: "boom\nstack" }],
		isError: true
	},
	cwd: "D:/Projects/demo",
	home: "C:/Users/dev"
}));
assert.match(failedHtml, /"data-state":"error"/);
assert.match(failedHtml, /boom/);
// 失败的调用没有应用过的 hunk：参数里的改动不算数，红行不能声称 +N -M、也不给差异体。
assert.doesNotMatch(failedHtml, /dsh-edit-diff-stat/, "失败的调用不显示 +N -M");
assert.doesNotMatch(failedHtml, /"className":"dsh-edit-diff-body"/, "失败的调用没有差异体");

const englishHtml = render(moduleExports.EditDiffRow({
	toolName: "str_replace_editor",
	block: {
		kind: "tool-result",
		callId: "call_3",
		call: {
			name: "str_replace_editor",
			argsRaw: JSON.stringify({ command: "str_replace", path: "D:/Projects/demo/a.py", old_str: "x", new_str: "y" })
		},
		content: [{ type: "text", text: "ok" }],
		isError: false
	},
	cwd: "D:/Projects/demo",
	home: "C:/Users/dev",
	locale: { getSnapshot: () => ({ active: "en-US" }), subscribe: () => () => {} }
}));
assert.match(englishHtml, /"data-title":"Edit"/);
assert.match(englishHtml, /"className":"dsh-edit-diff-added","children":"\+1"/);
assert.match(englishHtml, /"className":"dsh-edit-diff-removed","children":"-1"/);


const slotsCalls = [];
const definitions = [];
const SESSION_ID = "session-1";
// 会话 workspace 根：轮末卡按它把绝对路径拼回相对路径（与工具行同一套口径）。
const listSnapshot = { byId: { [SESSION_ID]: { cwd: "D:/Projects/demo" } } };
const fakeSessions = {
	list: {
		getSnapshot: () => listSnapshot,
		subscribe: () => () => {}
	}
};
const fakeCtx = {
	get: (name) => name === "locale" ? { getSnapshot: () => ({ active: "zh-CN" }) } : name === "uiConversation" ? { events: { register: (definition) => definitions.push(definition) } } : name === "sessions" ? fakeSessions : void 0,
	slots: {
		register: (options) => options,
		inject: (name, factory) => slotsCalls.push([name, factory(SESSION_ID)])
	}
};
moduleExports.apply(fakeCtx);
assert.equal(slotsCalls.length, 5, "four tool rows plus the turn tail");
assert.deepEqual(slotsCalls.map(([name]) => name), [
	"tool.call.toolview",
	"tool.call.toolview",
	"tool.call.toolview",
	"tool.call.toolview",
	"conversation.chat.turnTail"
]);
assert.deepEqual(slotsCalls.slice(0, 4).map(([, options]) => options.key), [
	"edit",
	"write",
	"insert",
	"str_replace_editor"
]);
for (const [, options] of slotsCalls.slice(0, 4)) assert.equal(options.priority, -1, "tool rows shadow the built-in rows");
const tailOptions = slotsCalls[4][1];
// 轮末槽是**链**：链按优先级升序选举，同优先级按注册先后。第三方插件
// （dsh-better-sidebar 0.19.1 就是）同样用 -1 遮蔽内置行，靠注册顺序赢过它等于靠运气，
// 所以轮末条目必须严格排在 -1 之下。
assert.equal(tailOptions.priority, -100, "the turn tail sorts strictly below the -1 shadowing convention");
assert.ok(tailOptions.priority < -1, "a lower rank than any -1 shadower, so load order cannot decide the election");
assert.equal(typeof tailOptions.select, "function", "the turn tail is claimed by select");
assert.equal(definitions.length, 1, "one conversation definition is registered");
const definition = definitions[0];
assert.equal(definition.kind, "edit-diff");

// 轮末累积器：根调用用结果 meta 的真实 hunk，PTC 子调用无 meta 则按参数推导。
// 派发顺序照抄框架：一个事件先 match（PTC 路由表在这一步学习），再按 role 调 start / update。
// match 对象是 { event, role, location }，没有 seq；seq 只在事件上（match.event.seq）。
let state;
const dispatch = (event, seq) => {
	const wire = { ...event, seq };
	const result = definition.match(wire);
	if (result === null) return null;
	const match = { event: wire, role: result.role, location: {} };
	if (result.role === "start") state = definition.start({ state }, match);
	else if (state !== void 0) state = definition.update({ state }, match);
	return match;
};
dispatch({ type: "turn/start", data: { turn: 3 } }, 9);
dispatch({
	type: "tool/call",
	data: { turn: 3, callId: "root_1", name: "edit", arguments: JSON.stringify({ file_path: "demo/a.md", old_string: "x", new_string: "y" }) }
}, 10);
dispatch({
	type: "tool/result",
	surfaceOp: "append",
	data: { message: { content: [{ isError: false }], source: { callId: "root_1" } }, meta: { diffs: [{ path: "demo/a.md", oldText: "x", newText: "y" }] } }
}, 11);
dispatch({ type: "tool/call", data: { turn: 3, callId: "root_2", name: "run_code", arguments: "{}" } }, 12);
dispatch({
	type: "tool/ptc-dispatch-start",
	data: { parentCallId: "root_2", subCallId: "sub_1", name: "edit", arguments: { file_path: "demo/a.md", old_string: "y", new_string: "z" } }
}, 13);
dispatch({ type: "tool/ptc-dispatch", data: { parentCallId: "root_2", subCallId: "sub_1", isError: false } }, 14);
dispatch({
	type: "tool/call",
	data: { turn: 3, callId: "root_3", name: "write", arguments: JSON.stringify({ file_path: "demo/b.md", content: "hi" }) }
}, 15);
dispatch({
	type: "tool/result",
	surfaceOp: "append",
	data: { message: { content: [{ isError: true }], source: { callId: "root_3" } } }
}, 16);
// The assembler seeds locationData with `null` (emptyLocationData), not undefined.
const published = definition.buildLocationData({ state }, "turn", null);
assert.equal(plain(published.value.changed).length, 2, "the settled root edit and the PTC child edit are counted, the failed write is not");
assert.deepEqual(plain(published.value.changed).map((entry) => entry.path), ["demo/a.md", "demo/a.md"]);
assert.deepEqual(plain(published.value.changed).map((entry) => entry.seq), [11, 14], "每条改动带的是落定事件的 seq —— 框架的 match 上没有 seq 字段");
assert.equal(definition.buildLocationData({ state }, "turn", published), published, "an unchanged accumulator republishes the same Location data object");
assert.deepEqual(internals.mergeChangedFiles(published.value.changed).map((row) => row.path), ["demo/a.md"], "one row per path");
assert.deepEqual(plain(definition.match({ type: "turn/start", data: { turn: 3 } })), { id: "3", role: "start" });
assert.deepEqual(plain(definition.match({ type: "tool/result", data: { turn: 3 }, surfaceOp: "append" })), { id: "3", role: "update" });
assert.equal(definition.match({ type: "tool/result", data: { turn: 3 } }), null, "only append-surface results are transcript material");
assert.deepEqual(plain(definition.match({ type: "tool/ptc-dispatch", data: { parentCallId: "root_2", subCallId: "sub_1" } })), { id: "3", role: "update" }, "a PTC record routes to the turn that started its run_code");
assert.equal(definition.match({ type: "tool/ptc-dispatch", data: { parentCallId: "nobody", subCallId: "sub_9" } }), null);

// 加载更早的历史时，框架先把整页事件 match 完，再统一 update（ConversationNodeAssembler.prepend）。
// 路由表必须在 match 阶段就学会，否则这一页的 PTC 子调用找不到启动它的轮次。
const page = [
	{ type: "turn/start", seq: 40, data: { turn: 9 } },
	{ type: "tool/call", seq: 41, data: { turn: 9, callId: "root_9", name: "run_code", arguments: "{}" } },
	{
		type: "tool/ptc-dispatch-start",
		seq: 42,
		data: { parentCallId: "root_9", subCallId: "sub_9", name: "edit", arguments: { file_path: "demo/c.md", old_string: "1", new_string: "2" } }
	},
	{ type: "tool/ptc-dispatch", seq: 43, data: { parentCallId: "root_9", subCallId: "sub_9", isError: false } }
];
const pageMatches = page.map((event) => ({ event, result: definition.match(event) }));
assert.deepEqual(plain(pageMatches.map(({ result }) => result)), [
	{ id: "9", role: "start" },
	{ id: "9", role: "update" },
	{ id: "9", role: "update" },
	{ id: "9", role: "update" }
], "整页先 match 再 update 时，PTC 子调用照样定位到启动它的轮次");
let pageState = definition.start({}, { event: page[0], role: "start", location: {} });
for (const { event, result } of pageMatches.slice(1)) pageState = definition.update({ state: pageState }, { event, role: result.role, location: {} });
const pagePublished = definition.buildLocationData({ state: pageState }, "turn", null);
assert.deepEqual(plain(pagePublished.value.changed).map((entry) => entry.path), ["demo/c.md"], "prepend 路径下 PTC 子调用的改动同样入账");
assert.deepEqual(plain(pagePublished.value.changed).map((entry) => entry.seq), [43]);
assert.notEqual(definition.buildLocationData({ state: pageState }, "turn", { kind: "turn", turn: 9, key: "edit-diff", value: null }), null, "previous.value 为空时重建，而不是抛 TypeError 掀翻会话装配");

const turnData = { get: (key) => key === "edit-diff" ? published.value : void 0 };
const owner = { turn: { data: turnData }, seq: 11 };
const claim = tailOptions.select(owner);
assert.equal(plain(claim).changed.length, 1, "only changes settled before the closing assistant count");
assert.equal(tailOptions.select(owner), claim, "select results stay identity-stable");
assert.equal(tailOptions.select({ turn: { data: turnData }, seq: 14 }).changed.length, 2, "两条改动都落在标题行的 seq 之内时一起入账");
assert.equal(tailOptions.select({ turn: { data: { get: () => void 0 } }, seq: 11 }), null, "a turn without changes declines");

const turnLocale = { getSnapshot: () => ({ active: "en-US" }), subscribe: () => () => {} };
const turnHtml = render(moduleExports.TurnDiffCard({
	matched: { changed: published.value.changed },
	openFile: () => {},
	locale: turnLocale
}));
assert.match(turnHtml, /1 file changed/);
assert.match(turnHtml, /"className":"dsh-edit-diff-turn-toggle","aria-expanded":true/);
assert.match(turnHtml, /"className":"dsh-edit-diff-turn-name","children":"a\.md"/);
assert.match(turnHtml, /"className":"dsh-edit-diff-turn-dir","children":"demo\/"/);
assert.match(turnHtml, /"data-file-type":"demo\/a\.md","data-size":14/);
assert.match(turnHtml, /"className":"dsh-edit-diff-turn-action dsh-edit-diff-turn-review","aria-expanded":false,"title":"Review","children":"Review"/);
assert.match(turnHtml, /"className":"dsh-edit-diff-added","children":"\+2"/);
assert.match(turnHtml, /"className":"dsh-edit-diff-removed","children":"-2"/);
assert.match(turnHtml, /"className":"dsh-edit-diff-turn-action dsh-edit-diff-turn-open","children":"Open"/);

// 路径口径：会话 workspace 内的绝对路径拼成相对路径再拆名/目录，出了 workspace 原样显示。
const tailInjected = tailOptions.inject(SESSION_ID);
assert.equal(tailInjected.cwdSource.getSnapshot(), "D:/Projects/demo", "轮末卡按会话 workspace 取根");

// 逐文件行同样抑制零值：纯新增的文件显示 +N，不带 "-0"。
const zeroFileHtml = render(moduleExports.TurnDiffCard({
	matched: { changed: [{ seq: 1, path: "D:/Projects/demo/only-add.md", diffs: [{ path: "D:/Projects/demo/only-add.md", oldText: "", newText: "x" }] }] },
	openFile: () => {},
	locale: turnLocale,
	cwdSource: tailInjected.cwdSource
}));
const perFileStat = /"className":"dsh-edit-diff-turn-count","children":\[(.*?)\]\}/.exec(zeroFileHtml);
assert.ok(perFileStat, `the per-file stat node is present, got: ${zeroFileHtml}`);
assert.doesNotMatch(perFileStat[1], /-0/, `the per-file row drops the zero half, got: ${perFileStat[1]}`);
assert.match(perFileStat[1], /"children":"\+1"/, `the per-file row keeps the real count, got: ${perFileStat[1]}`);

// 同一件事在轮末卡的逐文件行上：没有可报的增减就不渲染计数 span（否则吃掉行内 8px gap）。
const zeroTurnHtml = render(moduleExports.TurnDiffCard({
	matched: { changed: [{ seq: 1, path: "D:/Projects/demo/same.md", diffs: [{ path: "D:/Projects/demo/same.md", oldText: "same", newText: "same" }] }] },
	openFile: () => {},
	locale: turnLocale
}));
assert.doesNotMatch(zeroTurnHtml, /dsh-edit-diff-turn-count/, `a both-zero per-file row renders no count span, got: ${zeroTurnHtml}`);
assert.match(zeroTurnHtml, /"className":"dsh-edit-diff-turn-total"/, `the title totals are still rendered, got: ${zeroTurnHtml}`);

// charMarks 的区间是**码点**下标（对齐粒度是词，但下标空间仍是码点），所以 markedText
// 也必须按码点切。用 String.slice（按 UTF-16 码元）切含星平面字符的行，会把代理对劈成
// 两半：emoji 裂成两个替换字符，且标记落在代理半体上、真正的改动字符反而不高亮。
const astralBlock = {
	kind: "result",
	call: { callId: "c_astral", name: "edit", argsRaw: JSON.stringify({ file_path: "a.md" }) },
	content: [{ type: "text", text: "The file has been edited successfully." }],
	meta: { diffs: [{ path: "a.md", oldText: "a\u{1F600}b", newText: "a\u{1F600}c" }] },
	isError: false
};
const astralHtml = render(moduleExports.EditDiffRow({
	toolName: "edit",
	block: astralBlock,
	cwd: "D:/Projects/demo",
	home: "C:/Users/dev",
	openFile: () => {},
	inspect: () => {}
}));
// emoji 原样保留（劈开的话 JSON 里会变成 "a\ud83d" 这样的孤立代理）
assert.ok(astralHtml.includes("a\u{1F600}"), `the astral glyph stays whole, got: ${astralHtml}`);
// 下划线落在真正改动的字符上
assert.match(astralHtml, /"className":"dsh-edit-diff-mark","children":"b"/, `the deleted char is the marked one, got: ${astralHtml}`);
assert.match(astralHtml, /"className":"dsh-edit-diff-mark","children":"c"/, `the added char is the marked one, got: ${astralHtml}`);
// 改动的是一个 emoji 时，整颗 emoji 一起高亮（相邻码元并成一段）
const astralSwapHtml = render(moduleExports.EditDiffRow({
	toolName: "edit",
	block: { ...astralBlock, meta: { diffs: [{ path: "a.md", oldText: "a\u{1F600}b", newText: "a\u{1F601}b" }] } },
	cwd: "D:/Projects/demo",
	home: "C:/Users/dev",
	openFile: () => {},
	inspect: () => {}
}));
// 用 includes + 字符串字面量：正则字面量里的 \u{...} 需要 u 标志，容易写错。
assert.ok(astralSwapHtml.includes('"className":"dsh-edit-diff-mark","children":"\u{1F600}"'), `the whole old emoji is marked, got: ${astralSwapHtml}`);
assert.ok(astralSwapHtml.includes('"className":"dsh-edit-diff-mark","children":"\u{1F601}"'), `the whole new emoji is marked, got: ${astralSwapHtml}`);
// 但标题行的合计仍保留两侧——那行对齐内置 DiffBlock 的形状，零也照出。
const titleTotal = /"className":"dsh-edit-diff-turn-total","children":\[(.*?)\]\}/.exec(turnHtml);
assert.ok(titleTotal, `the turn title totals are present, got: ${turnHtml}`);
assert.match(titleTotal[1], /"children":"\+2"/, `the title keeps the added half, got: ${titleTotal[1]}`);
assert.match(titleTotal[1], /"children":"-2"/, `the title keeps the removed half, got: ${titleTotal[1]}`);
const workspaceHtml = render(moduleExports.TurnDiffCard({
	matched: { changed: [{ seq: 1, path: "D:/Projects/demo/notes/plan.md", diffs: [{ path: "D:/Projects/demo/notes/plan.md", oldText: "a", newText: "b" }] }] },
	openFile: () => {},
	locale: turnLocale,
	cwdSource: tailInjected.cwdSource
}));
assert.match(workspaceHtml, /"className":"dsh-edit-diff-turn-name","children":"plan\.md"/);
assert.match(workspaceHtml, /"className":"dsh-edit-diff-turn-dir","children":"notes\/"/);
assert.match(workspaceHtml, /"title":"D:\/Projects\/demo\/notes\/plan\.md"/);

// 右键菜单：原生入口走 connection 的通用 RPC（能力探测 + reveal），非 loopback / 无服务 / 拒绝都不给该项；
// 两项复制都复制**绝对路径**：文件本身、以及它所在文件夹。
const rpcCalls = [];
const openerCtx = {
	get: (name) => name === "connection" ? {
		isLoopback: true,
		rpc: { call: (channel, endpoint, payload) => {
			rpcCalls.push([channel, endpoint, payload]);
			return Promise.resolve({ ok: true, value: true });
		} }
	} : void 0
};
const openers = moduleExports.__internals;
assert.equal(await openers.canRevealPaths(openerCtx), true, "loopback + 能力为真才给「在资源管理器中打开」");
assert.deepEqual(plain(await openers.revealPathVia(openerCtx, "demo/a.md")), { via: "host", note: "这个界面没有可用的 fetch" }, "路由不可用时回落官方端点，并把原因一起带出来");
assert.deepEqual(plain(rpcCalls), [
	["/api", "session/canOpenWorkspacePath", { args: {} }],
	["/api", "session/openWorkspacePath", { args: { request: { path: "demo/a.md", action: "reveal" } } }]
]);
assert.equal(await openers.canRevealPaths({ get: () => ({ isLoopback: false, rpc: { call: () => Promise.resolve({ ok: true, value: true }) } }) }), false, "非 loopback 不给原生入口");
assert.equal(await openers.canRevealPaths({ get: () => void 0 }), false, "没有 connection 服务时安静降级");
const refusingCtx = { get: () => ({ isLoopback: true, rpc: { call: () => Promise.reject(new Error("gateway/internal")) } }) };
assert.deepEqual(plain(await openers.revealPathVia(refusingCtx, "demo/a.md")), { text: "gateway/internal" }, "两条路都不成时把原因交给卡片");
assert.deepEqual(plain(await openers.revealPathVia({ get: () => void 0 }, "demo/a.md")), { text: "没有可用的连接通道" }, "连通道都没有时也要说清");
assert.equal(openers.folderPathOf("D:/Projects/demo/a.md"), "D:/Projects/demo", "复制文件夹路径去掉最后一段");
assert.equal(openers.folderPathOf("a.md"), "a.md", "没有目录段就原样");
assert.equal(openers.folderPathOf("D:\\Projects\\demo\\a.md"), "D:\\Projects\\demo", "反斜杠路径同样处理");
assert.deepEqual(plain(openers.pathMenuItems({ revealInExplorer: "Reveal", copyFilePath: "File", copyFolderPath: "Folder" }, true)), [
	{ id: "reveal", label: "Reveal" },
	{ id: "copyFolderPath", label: "Folder" },
	{ id: "copyFilePath", label: "File" }
]);
assert.deepEqual(plain(openers.pathMenuItems({ revealInExplorer: "Reveal", copyFilePath: "File", copyFolderPath: "Folder" }, false)), [
	{ id: "copyFolderPath", label: "Folder" },
	{ id: "copyFilePath", label: "File" }
]);
// 提示文案只有一处：route / host / 失败三种口径都由它决定，卡片与工具行共用同一份。
const noteDict = {
	revealOpened: "已请本插件宿主打开资源管理器",
	revealRequested: "已请求在资源管理器中显示（官方 host 已确认）",
	revealUnavailable: "当前界面没有原生打开通道"
};
assert.deepEqual(plain(openers.revealNoteText(noteDict, { via: "route" })), { text: "已请本插件宿主打开资源管理器", tone: "info" }, "宿主路由成功就报成功");
assert.deepEqual(plain(openers.revealNoteText(noteDict, { via: "host", note: "HTTP 404 x" })), { text: "已请求在资源管理器中显示（官方 host 已确认）；宿主路由未用上：HTTP 404 x", tone: "info" }, "回落时把路由为什么没用上一起写出来");
assert.deepEqual(plain(openers.revealNoteText(noteDict, { via: "host", note: "" })), { text: "已请求在资源管理器中显示（官方 host 已确认）", tone: "info" }, "没有原因就不硬凑分号");
assert.deepEqual(plain(openers.revealNoteText(noteDict, { text: "宿主路由 boom；官方端点也失败：x" })), { text: "宿主路由 boom；官方端点也失败：x", tone: "error" }, "两条都不成时按失败显示原话");

// 能力探测是一趟 RPC：所有工具行与轮末卡共用同一次，一屏编辑行不该变成一屏 RPC。
const sharedRpc = [];
const sharedCalls = [];
const sharedCtx = {
	get: (name) => name === "connection" ? {
		isLoopback: true,
		rpc: { call: () => {
			sharedRpc.push(1);
			return Promise.resolve({ ok: true, value: true });
		} }
	} : void 0,
	slots: {
		register: (options) => options,
		inject: (name, factory) => sharedCalls.push([name, factory(SESSION_ID)])
	}
};
moduleExports.apply(sharedCtx);
const sharedRowA = sharedCalls[0][1].inject();
const sharedRowB = sharedCalls[3][1].inject();
// 四个工具行 + 轮末槽。**旧断言写的是 4**——它把「拿不到 uiConversation 就整段 return」
// 这个缺陷当成预期行为钉住了，所以轮末卡消失时测试照样全绿。槽位现在无条件注册。
assert.equal(sharedCalls.length, 5, "four tool rows plus the turn tail, even without the conversation seat");
assert.deepEqual(sharedCalls.map(([name]) => name), [
	"tool.call.toolview",
	"tool.call.toolview",
	"tool.call.toolview",
	"tool.call.toolview",
	"conversation.chat.turnTail"
], "the turn tail is wired regardless of the conversation seat");
assert.equal(typeof sharedRowA.revealPath, "function", "工具行拿到与卡片同源的 reveal 通道");
assert.equal(typeof sharedRowA.probeReveal, "function", "工具行拿到同一个能力探测");
assert.deepEqual(plain(await Promise.all([sharedRowA.probeReveal(), sharedRowB.probeReveal(), sharedRowA.probeReveal()])), [true, true, true], "并发探测都拿到同一答案");
assert.equal(sharedRpc.length, 1, "并发探测合并成一次 RPC");
assert.equal(plain(await sharedRowB.probeReveal()), true);
assert.equal(sharedRpc.length, 1, "答「可以」之后不再重复探测");const noRpc = [];
const noCalls = [];
moduleExports.apply({
	get: (name) => name === "connection" ? {
		isLoopback: true,
		rpc: { call: () => {
			noRpc.push(1);
			return Promise.resolve({ ok: true, value: false });
		} }
	} : void 0,
	slots: {
		register: (options) => options,
		inject: (name, factory) => noCalls.push([name, factory(SESSION_ID)])
	}
});
const noRow = noCalls[0][1].inject();
assert.equal(plain(await noRow.probeReveal()), false);
assert.equal(plain(await noRow.probeReveal()), false);
assert.equal(noRpc.length, 2, "答「不可以」不记忆：连接可能稍后就绪，下次右键要能重试");

// 轮末卡的接线：拿不到 uiConversation 时，**槽位照样要注册**，而且必须出声。
// 旧写法在那一步直接 `return`，于是既没注册槽位也没注册累积器，屏幕上唯一的症状是
// 「轮末卡不见了」——和「这一轮没改文件」长得一模一样，用户没法分辨（2026-09-21 反馈）。
const noConvSlots = [];
const noConvWarnings = [];
const realWarn = console.warn;
console.warn = (message) => noConvWarnings.push(message);
moduleExports.apply({
  get: (name) => name === "locale" ? { getSnapshot: () => "zh-CN", subscribe: () => () => {} }
    : name === "sessions" ? { list: { getSnapshot: () => ({ byId: {} }), subscribe: () => () => {} } } : void 0,
  slots: {
    register: (options) => options,
    inject: (name, factory) => noConvSlots.push([name, factory(SESSION_ID)])
  }
});
console.warn = realWarn;
assert.ok(noConvSlots.some(([name]) => name === "conversation.chat.turnTail"), "the turn tail is registered even without the conversation seat");
assert.equal(noConvWarnings.length, 1, "and the miss is reported instead of being silent");
assert.match(noConvWarnings[0], /轮末改动卡未接线/, "the warning names the broken card");
// 座位缺席时 select 只能安静拒绝：链式渲染器把「抛异常」也当成拒绝，抛出去就再也看不见了。
const orphanTail = noConvSlots.find(([name]) => name === "conversation.chat.turnTail")?.[1];
assert.equal(orphanTail.select({ turn: { data: { get: () => void 0 } }, seq: 1 }), null, "a missing accumulator declines quietly");
assert.equal(orphanTail.select({ turn: 3, seq: 1 }), null, "a malformed owner declines instead of throwing");
assert.equal(orphanTail.select({}), null, "an owner with no turn declines instead of throwing");

// 轮末链的竞争上报：链按优先级升序选举，同优先级按注册先后，所以「被别人先认领」和
// 「这一轮没改文件」在屏幕上一模一样。低于本插件优先级的邻居必须出声（2026-09-21：
// dsh-better-sidebar 0.19.1 在同一个 -1 上截胡，卡片整晚没出现过）。
const rivalWarnings = [];
const applyWithRivals = (occupants) => {
	const calls = [];
	const listeners = [];
	console.warn = (message) => rivalWarnings.push(message);
	moduleExports.apply({
		get: (name) => name === "locale" ? { getSnapshot: () => "zh-CN", subscribe: () => () => {} }
			: name === "sessions" ? { list: { getSnapshot: () => ({ byId: {} }), subscribe: () => () => {} } }
				: name === "uiConversation" ? { events: { register: () => () => {} } } : void 0,
		slots: {
			register: (options) => options,
			inject: (name, factory) => calls.push([name, factory(SESSION_ID)]),
			snapshot: () => [{ occupants }],
			subscribe: (key, fn) => {
				listeners.push(fn);
				return () => {};
			}
		},
		effect: (fn) => fn()
	});
	console.warn = realWarn;
	return listeners;
};
// 同优先级的第三方遮蔽者：注册顺序说了算，等于靠运气 —— 必须点名。
applyWithRivals([{ registrant: "dsh-edit-diff", priority: -100 }, { registrant: "dsh-better-sidebar", priority: -1 }, { registrant: "builtin", priority: 0 }]);
assert.equal(rivalWarnings.length, 0, "a rival above our rank cannot preempt the election and stays quiet");
rivalWarnings.length = 0;
// 真正能压过我们的（不高于 -100）才出声，并且只出一次。
const rivalListeners = applyWithRivals([{ registrant: "dsh-edit-diff", priority: -100 }, { registrant: "someone-else", priority: -100 }]);
assert.equal(rivalWarnings.length, 1, "a rival at or below our rank is reported");
assert.match(rivalWarnings[0], /someone-else@-100/, "the warning names the rival and its rank");
assert.match(rivalWarnings[0], /轮末卡不会出现/, "and says what the user loses");
for (const listener of rivalListeners) listener();
assert.equal(rivalWarnings.length, 1, "the same rival set is reported once, not on every mutation");

// 宿主路由优先：成功就不再碰官方端点；只有路由不在（404 / 没有 fetch）才回落到官方端点。
const routeCalls = [];
sandbox.fetch = async (url, init) => {
	routeCalls.push([url, init.method, JSON.parse(init.body).path]);
	return sandbox.__routeAnswer;
};
sandbox.__routeAnswer = { status: 200, ok: true, json: async () => ({ ok: true }) };
rpcCalls.length = 0;
assert.deepEqual(plain(await openers.revealPathVia(openerCtx, "D:/Projects/demo/a.md")), { via: "route" }, "宿主路由成功即报 via=route");
assert.equal(rpcCalls.length, 0, "宿主路由成功时不再走官方端点");
assert.deepEqual(plain(routeCalls), [["http://dsh.internal/edit-diff/reveal", "POST", "D:/Projects/demo/a.md"]], "页面 origin 为空时走载体内部 origin");
sandbox.location = { origin: "http://127.0.0.1:3080" };
routeCalls.length = 0;
assert.deepEqual(plain(await openers.revealPathVia(openerCtx, "D:/Projects/demo/a.md")), { via: "route" }, "有页面 origin 时按它拼绝对 URL");
assert.deepEqual(plain(routeCalls), [["http://127.0.0.1:3080/edit-diff/reveal", "POST", "D:/Projects/demo/a.md"]]);
delete sandbox.location;
sandbox.__routeAnswer = { status: 404, ok: false, json: async () => ({ ok: false, error: "not found" }) };
const missing404 = plain(await openers.revealPathVia(openerCtx, "D:/Projects/demo/a.md"));
assert.equal(missing404.via, "host", "404 视为路由不在并回落");
assert.match(missing404.note, /HTTP 404/, "并把 404 写进 note");
assert.equal(rpcCalls.length, 1, "回落时官方端点确实被调用");

sandbox.__routeAnswer = { status: 405, ok: false, json: async () => ({ ok: false, error: "method not allowed" }) };
rpcCalls.length = 0;
const missing405 = plain(await openers.revealPathVia(openerCtx, "D:/Projects/demo/a.md"));
assert.equal(missing405.via, "host", "静态前端的 405 同样按路由不在处理");
assert.match(missing405.note, /HTTP 405/, "并把 405 写进 note");
assert.equal(rpcCalls.length, 1, "405 之后也回落到官方端点");
sandbox.__routeAnswer = { status: 500, ok: false, json: async () => ({ ok: false, error: "boom" }) };
assert.match(plain(await openers.revealPathVia(openerCtx, "D:/Projects/demo/a.md")).note, /宿主路由 boom/, "路由报错就把原话交给卡片");
delete sandbox.fetch;
// 载体给的 fetch 优先：桌面渲染器只有它到得了宿主。
const carrierCalls = [];
sandbox.__DSH_TRANSPORT__ = { fetch: async (url) => { carrierCalls.push(url); return { status: 200, ok: true, json: async () => ({ ok: true }) }; } };
sandbox.fetch = async () => { throw new Error("页面自带的 fetch 不该被用到"); };
assert.deepEqual(plain(await openers.revealPathVia(openerCtx, "D:/Projects/demo/a.md")), { via: "route" }, "载体 fetch 在时优先用它");
assert.deepEqual(plain(carrierCalls), ["http://dsh.internal/edit-diff/reveal"]);
delete sandbox.__DSH_TRANSPORT__;
assert.deepEqual(plain(await openers.revealPathVia({ get: () => void 0 }, "demo/a.md")), { text: "没有可用的连接通道" }, "没有 fetch 时同样回落");

// 卡里的路径可能是相对写法：reveal 与两项复制都要落成绝对路径。
assert.equal(openers.absolutePathOf("dsh-edit-diff/README.md", "D:/work/plugins"), "D:/work/plugins/dsh-edit-diff/README.md", "相对路径按会话根拼绝对");
assert.equal(openers.absolutePathOf("./a.md", "D:/Projects/"), "D:/Projects/a.md", "去掉 ./ 前缀");
assert.equal(openers.absolutePathOf("D:/x/y.md", "D:/Projects"), "D:/x/y.md", "本来就是绝对路径就原样");
assert.equal(openers.absolutePathOf("a.md", void 0), "a.md", "拿不到会话根就原样");
// 会话根是反斜杠拼法时，拼出来的绝对路径也得是反斜杠：桌面宿主要把它交给 Explorer
// 的 /select，而 Explorer 对正斜杠路径是静默无视的（没有窗口，也没有报错）。
assert.equal(openers.absolutePathOf(".local/a.py", "D:\\Projects\\demo"), "D:\\Projects\\demo\\.local\\a.py", "反斜杠会话根拼出的绝对路径是原生拼法");
assert.equal(openers.absolutePathOf("D:\\x/y.md", "D:/Projects"), "D:\\x\\y.md", "混合拼法的绝对路径归一到原生");

const manyFiles = {
	changed: [1, 2, 3, 4, 5, 6, 7].map((n) => ({
		seq: n,
		path: "demo/f" + n + ".md",
		diffs: [{ path: "demo/f" + n + ".md", oldText: "a", newText: "b" }]
	}))
};
const manyHtml = render(moduleExports.TurnDiffCard({ matched: manyFiles, openFile: () => {}, locale: turnLocale }));
assert.match(manyHtml, /7 files changed/);
assert.match(manyHtml, /Show 2 more files/);
assert.equal(manyHtml.split("dsh-edit-diff-turn-row").length - 1, 5, "the preview renders five rows");

// 行级对齐：相同行只渲染一次（暗色上下文），改动行分色并在行内标出真正改动的字符。
const sevenLineHunk = {
	path: "demo/app.py",
	oldText: "line 7\nline 8\nline 9\nline 10\nline 11\nline 12\nline 13",
	newText: "line 7\nline 8\nline 9\nline 10 CHANGED\nline 11\nline 12\nline 13"
};
const hunkRows = internals.hunkRows(sevenLineHunk.oldText, sevenLineHunk.newText);
assert.deepEqual(hunkRows.map((row) => row.kind), [
	"ctx",
	"ctx",
	"ctx",
	"del",
	"add",
	"ctx",
	"ctx",
	"ctx"
], "shared context renders once per side, around the change");
assert.deepEqual(hunkRows.map((row) => row.text), [
	"line 7",
	"line 8",
	"line 9",
	"line 10",
	"line 10 CHANGED",
	"line 11",
	"line 12",
	"line 13"
]);
assert.deepEqual(hunkRows[3].marks, [], "the removed side kept every character");
assert.deepEqual(hunkRows[4].marks, [[7, 15]], "only the appended word is marked on the added side");
assert.deepEqual(internals.charMarks("const a = 1;", "const b = 1;"), {
	del: [[6, 7]],
	add: [[6, 7]]
});
/*
 * 行内标记的对齐粒度是**词**，不是码点（2026-09-21 收工时的未闭合项）。
 *
 * 这一对是真实改动行，取自本仓提交 9a6c36d 的 diff。按码点做 Myers 时它给出的是
 * `[74,79) regis` + `[81,84) ati` + `[85,86) n` 这样的碎片——因为 `registrations` 与
 * `tool rows` 之间能对齐的公共字符（o / r / t 一类）被算成了「没变」，剩下的未对齐
 * 码点天然不连续。碎片在屏幕上就是「高亮乱标」。
 *
 * 断言必须落在**区间本身**，不能只看 markText 拼出来的文本：碎片拼起来正好等于完整
 * 的词，那个 helper 会让这个缺陷继续绿着——这正是它上次逃过全套测试的原因。
 */
const realOldLine = 'for (const [, options] of slotsCalls) assert.equal(options.priority, -1, "registrations shadow the built-in rows");';
const realNewLine = 'for (const [, options] of slotsCalls.slice(0, 4)) assert.equal(options.priority, -1, "tool rows shadow the built-in rows");';
const realMarks = internals.charMarks(realOldLine, realNewLine);
/** The marked text of each range, so an assertion can name what the reader sees. */
const sliceMarked = (text, ranges) => ranges.map(([from, to]) => [...text].slice(from, to).join(""));
assert.deepEqual(realMarks.del, [[74, 87]], "the replaced word is one contiguous range, not per-character fragments");
assert.equal(realMarks.del.length, 1, "one range, not the three fragments a per-code-point diff produced");
assert.deepEqual(sliceMarked(realOldLine, realMarks.del), ["registrations"], "and it covers the whole removed word");
// 新增侧这一行有三处真实改动：`.slice(0, 4)` 插入、`)` 位移、`registrations` → `tool rows`。
// 前两处各是一块；第三处必须是一块覆盖两个词的区间（词间的空白不是读者眼里的边界）。
// `.slice(0, 4)` 插入与随之位移的 `)` 之间只隔一个被匹配的单元，短空档规则把它们并成一块——
// 读起来就是「这一段是插进来的」，比 `\`.slice(0, 4\`` + `\`)\`` 中间留个洞更准。
assert.deepEqual(realMarks.add, [[36, 49], [86, 96]], "the inserted call and the paren that moved with it read as one block");
assert.deepEqual(sliceMarked(realNewLine, realMarks.add), [".slice(0, 4))", "tool rows "], "the multi-word replacement chips as one block");
// 空档里只要全是**非词字符**（空白 / 标点 / 符号）就不是边界（2026-09-22 用户截图反馈）：
// `` `~` 前缀 `` → `` `?` 后缀 `` 里的反引号与空格不承载意义，必须并成一块，而不是
// `~` + 空档 + `前缀` 两块；`靠字形而不是靠颜色` → `不要` 里的 `不` 也不再切碎短语。
const coincidenceOld = "  「这个号可能不是文件里的真行号」。区分**靠字形而不是靠颜色**：行首本来就有 CSS 画的 `- `/`+ ` 标记，";
const coincidenceNew = "  **不要**给它加标记字形：`~` 是低矮波浪线，在 10px 下会和行首 CSS 画的 `- `/`+ ` 标记糊在一起；";
const coincidence = internals.charMarks(coincidenceOld, coincidenceNew);
assert.ok(sliceMarked(coincidenceOld, coincidence.del).some((piece) => piece.includes("靠字形而不是靠颜色")), `the replaced phrase is one run, got: ${JSON.stringify(sliceMarked(coincidenceOld, coincidence.del))}`);
assert.deepEqual(internals.charMarks("加 `~` 前缀。", "加 `?` 后缀。"), {
	del: [[3, 7]],
	add: [[3, 7]]
}, "the backticks and space around a change do not split the mark");
// 但空档里只要有**一个词字符**，那就是有意义的边界：`1; y = 2` 里的 `y` 和 `=` 挡住合并。
assert.deepEqual(internals.charMarks("x = 1; y = 2;", "x = 3; y = 4;"), {
	del: [[4, 5], [11, 12]],
	add: [[4, 5], [11, 12]]
}, "a word character between two changes stays a boundary");
assert.deepEqual(internals.charMarks("甲不乙", "甲要乙"), {
	del: [[1, 2]],
	add: [[1, 2]]
}, "a shared character at the edge of a change is a real boundary");
assert.deepEqual(internals.charMarks("中文测试", "中文测式"), {
	del: [[3, 4]],
	add: [[3, 4]]
}, "a run of shared CJK characters keeps per-character precision");
// 粒度是词，但 CJK 逐字：中文没有空白词边界，把整句当一个词会让改一个字就高亮整句。
assert.deepEqual(internals.charMarks("const 中文测试 = 1;", "const 中文测式 = 1;"), {
	del: [[9, 10]],
	add: [[9, 10]]
}, "CJK keeps per-character precision instead of marking the whole phrase");
assert.deepEqual(internals.charMarks("a alpha beta c", "a gamma delta c"), {
	del: [[2, 12]],
	add: [[2, 13]]
}, "a two-word replacement merges across the space between the words");
// 但合并只在**空白与标点**上发生：空档里只要有一个词字符，那就是有意义的边界。
// `alpha, beta` 的逗号被吞掉（它不承载意义），而 `1; y = 2` 里的 `y` 和 `=` 会挡住合并。
assert.deepEqual(internals.charMarks("a alpha, beta c", "a gamma, delta c"), {
	del: [[2, 13]],
	add: [[2, 14]]
}, "punctuation between two changes does not split the mark");
assert.deepEqual(internals.charMarks("x = 1; y = 2;", "x = 3; y = 4;"), {
	del: [[4, 5], [11, 12]],
	add: [[4, 5], [11, 12]]
}, "a word character between two changes stays a boundary");
// 反引号同理：`` `~` 前缀 `` 必须是一块，不是 `~` + 空档 + `前缀`（2026-09-22 用户截图）。
assert.deepEqual(internals.charMarks("加 `~` 前缀。", "加 `?` 后缀。"), {
	del: [[3, 7]],
	add: [[3, 7]]
}, "the backticks and space around a change do not split the mark");
// 覆盖过满就干脆不标（2026-09-22 用户截图反馈「全被加深了」）：一行几乎全被染深时，标记不再有
// 区分力——行底色已经说了「这行变了」。下面这对是真实的重写段落（本仓提交 a778336 的 README）：
// 两侧还共享的只剩标点，覆盖率 86% / 91%。
const rewriteOld = "  两条合并/剔除规则都只碰这一层：**夹在改动中间**的孤立单汉字匹配不算匹配（`不是` → `不要` 里的 `不`";
const rewriteNew = "  两个改动之间的空档**全是非词字符**（空白 / 标点 / 符号）时并成一块：反引号与空格不承载意义，";
assert.deepEqual(internals.charMarks(rewriteOld, rewriteNew), {
	del: [],
	add: []
}, "a rewritten line carries no marks at all");
// 阈值是量出来的：合法的两词替换覆盖 71-73%，重写段落 85-97%，线画在 80%。
assert.deepEqual(internals.charMarks("a alpha beta c", "a gamma delta c"), {
	del: [[2, 12]],
	add: [[2, 13]]
}, "a two-word replacement stays under the coverage line and keeps its marks");
const sevenModel = internals.buildDiffModel([sevenLineHunk]);
assert.equal(sevenModel.added, 1);
assert.equal(sevenModel.removed, 1);
assert.equal(sevenModel.fileCount, 1);
assert.equal(sevenModel.files[0].rows.length, 8);
assert.equal(sevenModel.copyText, "line 7\nline 8\nline 9\n- line 10\n+ line 10 CHANGED\nline 11\nline 12\nline 13");
assert.equal(internals.buildDiffModel([{
	path: "a.md",
	oldText: "a\nb",
	newText: "a\nb\nc"
}]).copyText, "a\nb\n+ c", "a pure insertion keeps its context and adds one line");
assert.equal(internals.buildDiffModel([{
	path: "a.md",
	oldText: "a\nb\nc",
	newText: "a\nc"
}]).copyText, "a\n- b\nc", "a pure deletion removes one line in place");
const writeModel = internals.buildDiffModel([{
	path: "w.md",
	oldText: null,
	newText: "x\ny"
}]);
assert.deepEqual(writeModel.files[0].rows.map((row) => row.kind), ["add", "add"], "a whole-file write has no old side");
assert.equal(writeModel.added, 2);
assert.equal(writeModel.removed, 0);
assert.equal(internals.buildDiffModel([{
	path: "a.md",
	oldText: "a\n\nb",
	newText: "a\nX\nb"
}]).copyText, "a\n- \n+ X\nb", "a blank line survives the text round trip");
assert.deepEqual(internals.changedLines([""], ["X"]), { removedAt: [0], addedAt: [0] });
assert.deepEqual(internals.changedLines(["c", "b", "c", "b"], ["b", "c"]), { removedAt: [0, 3], addedAt: [] });
assert.equal(internals.linesText([""]), "\n");
assert.equal(internals.linesText(["", ""]), "\n\n");
assert.equal(internals.linesText(["a", ""]), "a\n\n");
assert.equal(internals.linesText([]), "");

// ── 居左：剥掉整段共有的前导空白 ──────────────────────────────────────────────
// 用户反馈「这个文件前面怎么空了那么多，这种能不能让他居左」：深层嵌套的 hunk 用 5 个 tab
// 就吃掉 40 列。剥掉**共有**前缀后代码贴左，但行与行的相对缩进保留，嵌套变化仍看得见。
const deepHunk = {
  path: "demo/deep.js",
  oldText: "\t\t\tif (a) {\n\t\t\t\tgo();\n\t\t\t}",
  newText: "\t\t\tif (a) {\n\t\t\t\tgo(1);\n\t\t\t}"
};
const deepModel = internals.buildDiffModel([deepHunk]);
assert.deepEqual(deepModel.files[0].rows.map((row) => row.text), [
  "if (a) {",
  "\tgo();",
  "\tgo(1);",
  "}"
], "the shared indent is stripped so the code starts at the left edge");
// 复制出来的文本仍是文件**原本**的缩进：粘回文件时不该丢缩进。
assert.ok(deepModel.copyText.includes("\t\t\t\tgo();"), `the copied text keeps the file's own indentation, got: ${JSON.stringify(deepModel.copyText)}`);
// 行内 mark 必须跟着左移同样的量，否则强调会落在错的字符上。
// 这里 `)` → `1` 是一次**纯插入**（旧串是新串的子序列），所以只有增侧有标记。
const deepAdd = deepModel.files[0].rows.find((row) => row.kind === "add");
assert.deepEqual(deepAdd.marks, [[4, 5]], `the inline mark shifts with the dedent, got: ${JSON.stringify(deepAdd.marks)}`);
assert.equal([...deepAdd.text][4], "1", "the mark still lands on the character that changed");
assert.deepEqual(deepModel.files[0].rows.find((row) => row.kind === "del").marks, [], "a pure insertion marks nothing on the removed side");
// 替换（两侧都改）时删侧的标记同样左移。
const replacedModel = internals.buildDiffModel([{ path: "a.js", oldText: "\t\t\tfoo();", newText: "\t\t\tbar();" }]);
const replacedDel = replacedModel.files[0].rows.find((row) => row.kind === "del");
const replacedAdd = replacedModel.files[0].rows.find((row) => row.kind === "add");
assert.equal(replacedDel.text, "foo();", "the removed line is dedented");
assert.deepEqual(replacedDel.marks, [[0, 3]], `the removed side's mark shifts too, got: ${JSON.stringify(replacedDel.marks)}`);
assert.equal([...replacedDel.text].slice(0, 3).join(""), "foo", "the removed mark still covers the word that went away");
assert.deepEqual(replacedAdd.marks, [[0, 3]], "and the added side's mark matches it");
// 相对缩进保留。
const nestedHunk = internals.buildDiffModel([{ path: "a.js", oldText: "", newText: "\tif (x) {\n\t\tgo();\n\t}" }]);
assert.deepEqual(nestedHunk.files[0].rows.map((row) => row.text), ["if (x) {", "\tgo();", "}"], "relative indentation survives the dedent");
// 空行不参与「共有前缀」的计算，否则含空行的 hunk 永远居不了左。
const blankHunk = internals.buildDiffModel([{ path: "a.js", oldText: "", newText: "\t\ta\n\n\t\tb" }]);
assert.deepEqual(blankHunk.files[0].rows.map((row) => row.text), ["a", "", "b"], "a blank line does not block the dedent");
// 本来就贴左的 hunk 一字不动。
const flushHunk = internals.buildDiffModel([{ path: "a.js", oldText: "", newText: "a\nb" }]);
assert.deepEqual(flushHunk.files[0].rows.map((row) => row.text), ["a", "b"], "an already flush hunk is untouched");
// 着色用的两侧行也必须一起去缩进，否则 token 与行文本对不上。
assert.deepEqual(deepModel.files[0].lines.del, ["if (a) {", "\tgo();", "}"], "the painted old side is dedented too");
assert.deepEqual(deepModel.files[0].lines.add, ["if (a) {", "\tgo(1);", "}"], "the painted new side is dedented too");
assert.deepEqual(internals.contentLines("\n"), [""]);
assert.deepEqual(internals.contentLines("\n\n"), ["", ""]);
const disjointOld = Array.from({ length: 600 }, (_, index) => "old " + (index + 1)).join("\n");
const disjointNew = Array.from({ length: 600 }, (_, index) => "new " + (index + 1)).join("\n");
assert.equal(internals.hunkRows(disjointOld, disjointNew), null, "a hunk past the edit-distance cap is not aligned");

// ── run 的配对按内容相似度，不按位置（2026-09-22）─────────────────────────────
// 改动前：一个 run 只有在**删增行数相等**时才标，而且**按位置**配对。两半都是错的——
// 增侧比删侧多一行就整块不加深；在 run 顶部插一行会让后面每一对都错位，加深落在别的行上。
// 这一对是「run 顶部插了一行注释、其余行改了一个词」：删侧 1 行、增侧 2 行。
const runHunk = {
  path: "demo/run.js",
  oldText: "const total = count(a);\nconst name = label(b);",
  newText: "// rewritten below\nconst total = tally(a);\nconst name = label(b);"
};
const runRows = internals.buildDiffModel([runHunk]).files[0].rows;
assert.deepEqual(runRows.map((row) => row.kind), ["del", "add", "add", "ctx"], "the inserted line joins the added side of the run");
const runDel = runRows[0];
const runInserted = runRows[1];
const runPaired = runRows[2];
assert.deepEqual(runDel.marks, [[14, 19]], `an unequal run still marks the removed side, got: ${JSON.stringify(runDel.marks)}`);
assert.equal([...runDel.text].slice(14, 19).join(""), "count", "the removed mark covers the word that went away");
assert.deepEqual(runPaired.marks, [[14, 19]], `the removed line pairs with its real counterpart, not with the inserted line, got: ${JSON.stringify(runPaired.marks)}`);
assert.equal([...runPaired.text].slice(14, 19).join(""), "tally", "and the mark lands on the line that replaced it");
assert.deepEqual(runInserted.marks, [], "the inserted line has no counterpart and keeps a plain row");

// pairRun 的契约：顺序保持、按内容配对、空边与不相干的边不配对。
const rowsOf = (texts) => texts.map((text) => ({
  text,
  marks: []
}));
assert.deepEqual(internals.pairRun(rowsOf(["alpha one", "beta two"]), rowsOf(["alpha one x", "beta two y"])), [[0, 0], [1, 1]], "same-length runs pair line for line");
assert.deepEqual(internals.pairRun(rowsOf(["alpha one"]), rowsOf(["// new", "alpha one x"])), [[0, 1]], "a line inserted at the top does not capture the pair below it");
assert.deepEqual(internals.pairRun(rowsOf(["alpha one", "beta two"]), rowsOf(["beta two y"])), [[1, 0]], "an order-preserving alignment leaves the deleted line unpaired");
assert.deepEqual(internals.pairRun(rowsOf([]), rowsOf(["x"])), [], "an added-only run pairs nothing");
assert.deepEqual(internals.pairRun(rowsOf(["x"]), rowsOf([])), [], "a removed-only run pairs nothing");
assert.deepEqual(internals.pairRun(rowsOf(["aaaa"]), rowsOf(["bbbb"])), [], "two lines sharing no character do not pair");
// 超过 MARK_PAIR_CELLS（16384 = 128×128）时返回 null，让调用方回退而不是静默不标。
const overCap = Array.from({ length: 129 }, (_, index) => "line " + index);
assert.equal(internals.pairRun(rowsOf(overCap), rowsOf(overCap)), null, "a run too large to align reports null instead of pairing nothing");
// 相似度是**字符**级 Dice：必须认得出「换了词的同一行」，而 `registrations` → `tool rows` 的
// 单元交集是空的——按单元算会把这一对判成不相干，主 fixture 的标记就全丢了。
assert.equal(internals.lineSimilarity("same text", "same text"), 1, "identical lines are maximally similar");
assert.equal(internals.lineSimilarity("aaaa", "bbbb"), 0, "no shared character is no similarity");
assert.equal(internals.lineSimilarity("", "bbbb"), 0, "an empty line never pairs");
assert.equal(internals.lineSimilarity("ab", "ac"), 0.5, "one shared character of two is half");
assert.ok(internals.lineSimilarity(realOldLine, realNewLine) > 0.8, "the replaced-word fixture still reads as the same line");
// 回退：等长 run 超过上限时退回按位置配对（改动前的形状），不等长的则完全不标——
// 两条都只是「退化成旧行为」，不会把标记落到错的行上还假装成功。
const bigRun = 129;
const bigOld = Array.from({ length: bigRun }, (_, index) => "old line " + index).join("\n");
const bigNew = Array.from({ length: bigRun }, (_, index) => "new line " + index).join("\n");
const bigRows = internals.hunkRows(bigOld, bigNew);
assert.ok(bigRows !== null, "the line diff still aligns an over-cap run");
const bigDel = bigRows.find((row) => row.kind === "del");
assert.ok(bigDel.marks.length > 0, `an over-cap equal-length run falls back to positional pairing instead of losing its marks, got: ${JSON.stringify(bigDel.marks)}`);
const bigModel = internals.buildDiffModel([{
	path: "big.md",
	oldText: disjointOld,
	newText: disjointNew
}]);
assert.equal(bigModel.files[0].rows.length, 1200, "it degrades to the whole removed block then the whole added block");
assert.equal(bigModel.removed, 600);
assert.equal(bigModel.added, 600);
const dedupedHtml = render(moduleExports.EditDiffRow({
	toolName: "edit",
	block: {
		kind: "tool-result",
		callId: "call_4",
		call: {
			name: "edit",
			argsRaw: JSON.stringify({ file_path: "D:/Projects/demo/app.py", old_string: "line 10", new_string: "line 10 CHANGED" })
		},
		content: [{ type: "text", text: "The file has been edited successfully." }],
		meta: { diffs: [sevenLineHunk] },
		isError: false
	},
	cwd: "D:/Projects/demo",
	home: "C:/Users/dev",
	openFile: () => {},
	inspect: () => {}
}));
assert.match(dedupedHtml, /"className":"dsh-edit-diff-added","children":"\+1"/, "the row counts only the changed lines: " + dedupedHtml);
assert.match(dedupedHtml, /"className":"dsh-edit-diff-removed","children":"-1"/, "the row counts only the changed lines: " + dedupedHtml);
assert.match(dedupedHtml, /"className":"dsh-edit-diff-line dsh-edit-diff-add"/, "the changed line renders as an add row");
// 改动的那一段被标出来。mark 会按 token 边界切成几段（数字/空格/单词各成一段），
// 所以断言拼接后的文本，而不是某一段 span。
assert.equal(markText(dedupedHtml), " CHANGED", "the changed word is marked inside the line");
assert.match(dedupedHtml, /"className":"dsh-edit-diff-line dsh-edit-diff-ctx"/, "shared context renders as a dim row");
// 上下文行各渲染一次：这一 hunk 里 7/8/9 与 11/12/13 共 6 行。
assert.equal(rowCount(dedupedHtml, "ctx"), 6, "shared context renders exactly once per side");


// 随机小样本对照 O(n·m) 的 LCS 长度：Myers 保留的行必须是最长公共子序列，
// 也就是删/增两侧的改动集都是最小的。
let seed = 20260919;
const random = () => {
	seed = (seed * 1103515245 + 12345) & 0x7fffffff;
	return seed / 0x7fffffff;
};
const lcsLength = (left, right) => {
	let previous = new Array(right.length + 1).fill(0);
	for (const line of left) {
		const current = new Array(right.length + 1).fill(0);
		for (let index = 0; index < right.length; index++) {
			current[index + 1] = line === right[index] ? previous[index] + 1 : Math.max(previous[index + 1], current[index]);
		}
		previous = current;
	}
	return previous[right.length];
};
const keptLines = (lines, changedAt) => {
	const dropped = new Set(changedAt);
	return lines.filter((_line, index) => !dropped.has(index));
};
for (let round = 0; round < 400; round++) {
	const alphabet = ["a", "b", "c"];
	const make = () => Array.from({ length: Math.floor(random() * 8) }, () => alphabet[Math.floor(random() * alphabet.length)]);
	const oldLines = make();
	const newLines = make();
	const changed = internals.changedLines(oldLines, newLines);
	assert.notEqual(changed, null, "a small pair stays under the edit-distance cap");
	assert.equal(new Set(changed.removedAt).size, changed.removedAt.length, "an old index is reported once");
	assert.equal(new Set(changed.addedAt).size, changed.addedAt.length, "a new index is reported once");
	for (const at of changed.removedAt) assert.ok(at >= 0 && at < oldLines.length, "a removed index is inside the old side");
	for (const at of changed.addedAt) assert.ok(at >= 0 && at < newLines.length, "an added index is inside the new side");
	const keptOld = keptLines(oldLines, changed.removedAt);
	const keptNew = keptLines(newLines, changed.addedAt);
	assert.deepEqual(keptOld, keptNew, "the lines neither side changed are one common subsequence");
	assert.equal(keptOld.length, lcsLength(oldLines, newLines), "those lines are a longest common subsequence");
}


// ── 语法着色与行底高亮 ────────────────────────────────────────────────────────
// 扩展名到语法 id 的映射与读卡同一张表：认识的扩展名给 id，不认识/无扩展名给 undefined
// （渲染成纯文本，而不是猜一个语法）。
assert.equal(internals.langOfPath("D:/a/b.ts"), "ts", "a TypeScript file resolves");
assert.equal(internals.langOfPath("D:/a/B.PY"), "py", "the extension match is case-insensitive");
assert.equal(internals.langOfPath("D:/a/notes.markdown"), "md", "a long alias resolves");
assert.equal(internals.langOfPath("D:/a/Makefile"), undefined, "no extension means no language");
assert.equal(internals.langOfPath("D:/a/.gitignore"), undefined, "a dotfile has no language");
assert.equal(internals.langOfPath("D:/a/x.unknownext"), undefined, "an unknown extension means no language");
assert.equal(internals.langOfPath(""), undefined, "an empty path means no language");
assert.equal(internals.langOfPath(undefined), undefined, "an absent path means no language");

// 每一行都带上它在源文件里的行号与所在侧，渲染层据此取那一行的着色串。
const annotated = internals.annotateRows(
	[{ kind: "ctx" }, { kind: "del" }, { kind: "add" }, { kind: "ctx" }],
	["a", "b", "c"],
	["a", "c"]
);
assert.deepEqual(annotated, [
	{ kind: "ctx", side: "ctx", index: 0, oldIndex: 0, newIndex: 0 },
	{ kind: "del", side: "del", index: 1, oldIndex: 1 },
	{ kind: "add", side: "add", index: 1, newIndex: 1 },
	{ kind: "ctx", side: "ctx", index: 2, oldIndex: 2, newIndex: 2 }
], "a delete advances the old side only and an add the new side only");
// 上下文行两侧都有位置，而且**会分叉**：它上面每有一个新增，新侧行号就比旧侧大 1。
// `index` 仍是旧侧（语法 run 按旧侧取），`newIndex` 是给行号列用的——那才是文件现在的样子。
assert.deepEqual(internals.annotateRows(
	[{ kind: "add" }, { kind: "ctx" }],
	["a"],
	["x", "a"]
), [
	{ kind: "add", side: "add", index: 0, newIndex: 0 },
	{ kind: "ctx", side: "ctx", index: 0, oldIndex: 0, newIndex: 1 }
], "a kept line after an insertion sits at different old and new positions");

// ── 行号列 ────────────────────────────────────────────────────────────────────
// 有锚：行号是**文件里的真实行**。删除行读旧侧基准，新增与上下文行读新侧基准——
// 上下文行在文件**现在**的位置上，这才是读者要问的「这行在哪」。
const anchoredModel = internals.buildDiffModel([{
	path: "a.md", oldText: "a\nb\nc", newText: "a\nB\nc", oldStart: 10, newStart: 20
}]);
assert.deepEqual([anchoredModel.files[0].oldStart, anchoredModel.files[0].newStart], [10, 20], "the hunk's anchors reach the model");
assert.deepEqual(internals.numberRows(anchoredModel.files[0].rows, 10, 20).map((row) => [row.kind, row.line, row.lineReal]), [
	["ctx", 20, true],
	["del", 11, true],
	["add", 21, true],
	["ctx", 22, true]
], "an anchored hunk numbers every row at its real file line");
// 没锚（参数推导的 hunk、PTC 子调用、旧 host）：退回窗口内相对编号，并标记为非真实。
const unanchoredModel = internals.buildDiffModel([{
	path: "a.md", oldText: "a\nb\nc", newText: "a\nB\nc"
}]);
assert.deepEqual([unanchoredModel.files[0].oldStart, unanchoredModel.files[0].newStart], [null, null], "an unstamped hunk carries no anchors");
assert.deepEqual(internals.numberRows(unanchoredModel.files[0].rows, null, null).map((row) => [row.line, row.lineReal]), [
	[1, false],
	[2, false],
	[3, false],
	[4, false]
], "an unanchored hunk numbers the window instead of claiming a file line");
// numberRows 返回**副本**：gutter fallback 迟到解析出基准后要再跑一次，传进去的行必须原样不动。
const numberedSource = unanchoredModel.files[0].rows;
internals.numberRows(numberedSource, 10, 20);
assert.equal(numberedSource[0].line, void 0, "numbering never mutates the rows it was given");

// ── 行号 fallback：读**当前**文件定位 hunk 后像 ────────────────────────────────
// 服务的对象是 PTC 子调用（结果块没有 meta）与旧 host 写下的 hunk。当前文件就是新文件，
// 所以定位后像得到的是新侧基准；这个 fallback 只遇到「一次调用一个 hunk」的形状，
// 两侧首行同位置，所以旧侧取同一个基准。多 hunk 的 wire diff 由 host 打戳，不会走到这里。
const fallbackLines = "alpha\nbeta\nGAMMA\ndelta".split("\n");
assert.deepEqual(internals.locateBases(fallbackLines, ["beta", "gamma"], ["beta", "GAMMA"]), {
	oldStart: 2,
	newStart: 2,
	before: ["alpha"],
	after: ["delta"]
}, "a located post-image gives both sides the same base, plus the real lines around it");
assert.deepEqual(internals.locateBases(fallbackLines, [], ["GAMMA"]), {
	oldStart: null,
	newStart: 3,
	before: ["alpha", "beta"],
	after: ["delta"]
}, "a pure addition numbers only its new side");
// 定位不到就**不猜**：缺失、或出现多次（没有唯一锚点，锚第一个会标错区间），都拒绝。
const refused = {
	oldStart: null,
	newStart: null,
	before: [],
	after: []
};
assert.deepEqual(internals.locateBases(fallbackLines, ["x"], ["not-in-the-file"]), refused, "an absent post-image is refused");
assert.deepEqual(internals.locateBases("dup\nmid\ndup\n".split("\n"), ["x"], ["dup"]), refused, "an ambiguous post-image is refused rather than anchored at the first hit");
// 纯删除：那几行已经从文件里消失了，裸片段没有上下文可锚 → 拒绝。
assert.deepEqual(internals.locateBases(fallbackLines, ["beta", "gamma", "delta"], []), refused, "a deletion-only hunk has nothing left to anchor on");
// 上下文：每侧最多 CONTEXT_LINES = 3 行，到文件边界就截断（只给**新侧有锚**的片段，
// 因为那些行要按锚换算真实行号）。
const longLines = Array.from({ length: 20 }, (_, index) => "line " + index);
const longLocated = internals.locateBases(longLines, [], ["line 10"]);
assert.deepEqual(longLocated.before, ["line 7", "line 8", "line 9"], "at most three lines of context before the fragment");
assert.deepEqual(longLocated.after, ["line 11", "line 12", "line 13"], "and at most three after it");
assert.deepEqual(internals.locateBases(longLines, [], ["line 0"]).before, [], "a fragment at the top of the file has nothing before it");
assert.deepEqual(internals.locateBases(longLines, [], ["line 19"]).after, [], "and one at the bottom has nothing after it");
assert.equal(internals.locateOnce(["beta"], fallbackLines), 1, "locateOnce reports the 0-based index");
assert.equal(internals.locateOnce([], fallbackLines), null, "an empty needle has no position");

// resolveBases：同一条路径只读一次；已经有锚的 hunk 不读；读不到就不进表（保持相对编号）。
const readCalls = [];
// resolveBases 是**异步**的，所以这里取原始导出：`internals` 那层 `plain()` 包装只适合同步
// 纯函数——它对返回值做 JSON 往返，而 `JSON.stringify(Promise)` 是 `{}`，于是 `await` 会立刻
// 返回、读取还在后台跑（第一次写成 `internals.resolveBases` 时就是这么被骗过去的）。
const rawBases = await moduleExports.__internals.resolveBases([
	{ path: "a.md", oldStart: null, newStart: null, oldLines: ["beta", "gamma"], newLines: ["beta", "GAMMA"], rows: [{}] },
	{ path: "a.md", oldStart: 10, newStart: 10, oldLines: [], newLines: [], rows: [{}] },
	{ path: "b.md", oldStart: null, newStart: null, oldLines: [], newLines: ["x"], rows: [{}] }
], "D:/ws", async (path, cwd) => {
	readCalls.push([path, cwd]);
	return path === "a.md" ? "alpha\nbeta\nGAMMA\ndelta\n" : null;
});
const resolvedBases = new Map([...rawBases].map(([key, value]) => [key, plain(value)]));
assert.deepEqual(readCalls, [["a.md", "D:/ws"], ["b.md", "D:/ws"]], "each distinct path is read once, and only when a hunk needs it");
assert.deepEqual(resolvedBases.get(0), {
	oldStart: 2,
	newStart: 2,
	before: ["alpha"],
	after: ["delta"]
}, "the unanchored hunk that located gets a base and the lines around it");
assert.equal(resolvedBases.has(1), false, "an already-anchored hunk is never re-read");
assert.equal(resolvedBases.has(2), false, "a hunk whose file could not be read keeps its relative numbers");

// ── context boost：裸片段补上真实的前后文（2026-09-22）────────────────────────
// 参数推导出来的 hunk 是**裸片段**（`edit` 只带被替换的文本、PTC 子调用什么都不带），
// 展开后就是凭空两行、看不出在文件的哪里。host 的 read 路由本来就要为行号读这个文件，
// 同一次读把片段周围的行一起带回来。
// bodyRows 是从组件里提出来的**纯函数**：gutter fallback 是异步的，基准迟到就要重跑一次，
// 提出来才能在没有 React / 没有宿主的情况下验「上下文行 + 它们把着色 run 挤出的偏移」。
const fragmentModel = internals.buildDiffModel([{
	path: "demo/a.py",
	oldText: "    total = count(a)",
	newText: "    total = tally(a)",
	source: "args"
}]);
const fragmentFile = fragmentModel.files[0];
assert.equal(fragmentFile.indent, "    ", "the model carries the indent the context lines must be dedented by");
assert.equal(fragmentFile.source, "args", "an argument-derived hunk is tagged as such");
const fragmentAnchor = {
	oldStart: 5,
	newStart: 5,
	before: ["    def run():", "        pass", "    # note"],
	after: ["    return total"]
};
assert.deepEqual(internals.contextOf(fragmentFile, fragmentAnchor), {
	before: ["def run():", "    pass", "# note"],
	after: ["return total"]
}, "context lines are dedented by the same amount as the hunk, so the block stays flush left together");
const fragmentRows = internals.bodyRows(fragmentModel, new Map([[0, fragmentAnchor]]));
assert.deepEqual(fragmentRows.map((row) => row.kind), ["path", "ctx", "ctx", "ctx", "del", "add", "ctx"], "the fragment gains real context on both sides");
assert.deepEqual(fragmentRows.slice(1, 4).map((row) => row.text), ["def run():", "    pass", "# note"], "the lines before it are the file's own");
assert.deepEqual(fragmentRows.slice(1, 4).map((row) => row.line), [2, 3, 4], "numbered from the anchor: they end at newStart - 1");
assert.deepEqual(fragmentRows[6].line, 6, "and the line after it starts right past the post-image");
assert.deepEqual(fragmentRows.slice(1, 4).concat([fragmentRows[6]]).map((row) => row.lineReal), [true, true, true, true], "borrowed context is a real file line, so its gutter is the real one");
// 关键不变量：每一行的着色 run 必须描述**它自己**那一行。上下文把着色 run 的偏移整体推后，
// 偏移一旦算错，取到的就是邻行的 token——拼起来正好不等于这一行。比断言具体 token 耐改得多。
for (const row of fragmentRows) {
	if (row.runs === void 0) continue;
	assert.equal(row.runs.map((run) => run.text).join(""), row.text, `a row's runs must describe that row, got: ${JSON.stringify(row)}`);
}
assert.equal(fragmentRows[4].runs !== void 0, true, "the hunk's own rows are still painted after the offset shift");
// 只有**参数推导**的 hunk 借上下文：metadata hunk 自带 structuredPatch 的三行上下文，
// 再补一份就是六行，读起来像这次改动波及得更远。
const metaModel = internals.buildDiffModel([{
	path: "demo/a.py",
	oldText: "    a = 1",
	newText: "    a = 2",
	source: "meta"
}]);
assert.equal(internals.contextOf(metaModel.files[0], fragmentAnchor).before.length, 0, "a metadata hunk keeps its own context");
assert.equal(internals.bodyRows(metaModel, new Map([[0, fragmentAnchor]])).filter((row) => row.kind === "ctx").length, 0, "so the body adds none");
// 没定位到就不补——补出来的行没有锚可以编号，只能假装是真实行号。
assert.equal(internals.bodyRows(fragmentModel, new Map()).filter((row) => row.kind === "ctx").length, 0, "an unlocated fragment gets no context rather than a guess");
// 纯删除的锚在新侧是 null，也没有上下文可编号。
assert.equal(internals.contextOf(fragmentFile, { oldStart: 3, newStart: null, before: ["x"], after: ["y"] }).before.length, 0, "a deletion-only anchor brings no context back");

/** One edit card over the given hunk, rendered to HTML. */
const editCardHtml = (diff) => render(moduleExports.EditDiffRow({
	toolName: "edit",
	block: {
		kind: "result",
		call: { callId: "c_gutter", name: "edit", argsRaw: JSON.stringify({ file_path: "a.md" }) },
		content: [{ type: "text", text: "The file has been edited successfully." }],
		meta: { diffs: [diff] },
		isError: false
	},
	cwd: "D:/Projects/demo",
	home: "C:/Users/dev",
	openFile: () => {},
	inspect: () => {}
}));
const stampedHtml = editCardHtml({ path: "a.md", oldText: "a\nb\nc", newText: "a\nB\nc", oldStart: 10, newStart: 20 });
assert.match(stampedHtml, /"className":"dsh-edit-diff-gutter","children":"20"/, `a real line number renders bare, got: ${stampedHtml}`);
assert.match(stampedHtml, /"className":"dsh-edit-diff-gutter","children":"11"/, `the removed side reads its own base, got: ${stampedHtml}`);
assert.doesNotMatch(stampedHtml, /dsh-edit-diff-gutterRelative/, "a fully anchored hunk has no relative numbers");
// 相对行号是**裸数字 + 更暗的一档字色**。不要加标记字形：`~` 在 10px 下会和行首
// CSS 画的 `- `/`+ ` 标记糊在一起，`?` 更看不清——两个都试过，都比不加更糟。
// 代价是纯颜色区分对色觉障碍读者无效，这是**已知并接受**的取舍，不是漏掉。
const relativeHtml = editCardHtml({ path: "a.md", oldText: "a\nb\nc", newText: "a\nB\nc" });
assert.match(relativeHtml, /"className":"dsh-edit-diff-gutter dsh-edit-diff-gutterRelative","children":"1"/, `a relative number is dimmed and bare, got: ${relativeHtml}`);

// 着色器是插件自带的本地分词器（primitives 不导出它的 highlighter）：未知语法给 undefined
// （整行纯文本、底色照画），已知语法按行给出着色串，且**每一行都返回自己的 runs**——
// 哪怕那一行一个彩色 token 都没有。
assert.equal(internals.highlightDiffLines(["a = 1"], undefined), undefined, "no language means no colouring");
assert.equal(internals.highlightDiffLines([], "py"), undefined, "no lines means nothing to colour");

const pyLines = ['x = """start', "still the string", 'end"""  # done'];
const pyRuns = internals.highlightDiffLines(pyLines, "py");
assert.ok(Array.isArray(pyRuns), "a known language returns runs");
assert.equal(pyRuns.length, pyLines.length, "one run list per source line");
// 每行的 runs 拼起来必须还原整行：着色只加颜色，绝不吞字或改字。
for (const [index, line] of pyLines.entries()) {
	assert.equal(pyRuns[index].map((run) => run.text).join(""), line, `line ${index} round-trips through the tokenizer`);
}
// 注释按行内注释着色：`# done` 及其之后是注释。
assert.equal(pyRuns[2].at(-1).color, "var(--shiki-token-comment)", "a trailing # comment wears the theme's comment colour");
assert.ok(pyRuns[2].at(-1).text.includes("# done"), "the comment run carries the comment text");

// 关键字、字符串、数字各归各类，且颜色都是主题包的 --shiki-token-* 变量（与内置 CodeBlock 同源）。
const codeRuns = internals.highlightDiffLines(['def f(x): return "s" + 42'], "py")[0];
const colorOf = (runs, text) => runs.find((run) => run.text === text)?.color;
assert.equal(colorOf(codeRuns, "def"), "var(--shiki-token-keyword)", "a python keyword wears the keyword colour");
assert.equal(colorOf(codeRuns, "return"), "var(--shiki-token-keyword)", "the common keyword set is merged into every profile");
assert.equal(colorOf(codeRuns, '"s"'), "var(--shiki-token-string)", "a string literal wears the string colour");
assert.equal(colorOf(codeRuns, "42"), "var(--shiki-token-constant)", "a numeric literal wears the constant colour");
assert.equal(colorOf(codeRuns, "f"), "var(--shiki-token-function)", "an identifier before ( is a call");
assert.equal(codeRuns.map((run) => run.text).join(""), 'def f(x): return "s" + 42', "the coloured line round-trips");

// 回归：一行里没有任何彩色 token 时，**必须仍然返回那一行的 runs**。
// 旧实现用 `runs.some(run => run.color !== undefined) ? runs : []`，于是这样的行拿到空数组，
// 经 markedText 渲染成**空白行**——代码在卡片里凭空消失。
const plainRuns = internals.highlightDiffLines(["foo bar"], "py")[0];
assert.ok(plainRuns.length > 0, "a line with no coloured token still returns its runs");
assert.equal(plainRuns.map((run) => run.text).join(""), "foo bar", "and that line still carries its text");
assert.ok(plainRuns.every((run) => run.color === undefined), "those runs carry no colour, so the row keeps the theme foreground");

// 行内注释按语言取形：`//`（C 家族）、`#`（py/sh/yaml）、`--`（SQL）。
assert.equal(colorOf(internals.highlightDiffLines(["x = 1 // note"], "ts")[0], "// note"), "var(--shiki-token-comment)", "the C-family line comment is recognised");
assert.equal(colorOf(internals.highlightDiffLines(["x = 1 # note"], "yaml")[0], "# note"), "var(--shiki-token-comment)", "the hash comment is recognised where # comments");
assert.equal(colorOf(internals.highlightDiffLines(["select 1 -- note"], "sql")[0], "-- note"), "var(--shiki-token-comment)", "the SQL line comment is recognised");
// 字符串里的 `#` 不是注释：注释识别必须让位给字符串。
const hashInString = internals.highlightDiffLines(['x = "a # b"'], "py")[0];
assert.equal(hashInString.map((run) => run.text).join(""), 'x = "a # b"', "a # inside a string does not truncate the line");
assert.ok(hashInString.some((run) => run.color === "var(--shiki-token-string)" && run.text.includes("# b")), "the whole string stays one string run");

// 跨行**块注释**：`/* … */` 里的第二行起过去被当成代码分词——注释里的散文被撒上关键字色，
// 而里面的反引号还会开一个字符串（渲染截图里实际看到的就是这样）。
const blockComment = internals.highlightDiffLines([
	"/* A data format's values are prose, so a word there is left unclassified:",
	"   `description: install in the for as is not` must not speckle the line",
	"   keyword colours. Comments, strings and numbers still colour normally. */",
	"const x = 1;"
], "js");
for (const index of [0, 1, 2]) {
	assert.ok(blockComment[index].every((run) => run.color === "var(--shiki-token-comment)"), `comment line ${index} is entirely a comment`);
}
assert.equal(blockComment[3].map((run) => run.text).join(""), "const x = 1;", "the line after the comment tokenizes normally");
assert.equal(colorOf(blockComment[3], "const"), "var(--shiki-token-keyword)", "and it is code again");
// 单行块注释照旧。
assert.equal(colorOf(internals.highlightDiffLines(["a /* note */ b"], "js")[0], "/* note */"), "var(--shiki-token-comment)", "a single-line block comment is still one comment run");
// CSS 只有块注释，同样要跨行。
const cssComment = internals.highlightDiffLines(["/* one", "   two */", "a { color: red }"], "css");
assert.ok(cssComment[1].every((run) => run.color === "var(--shiki-token-comment)"), "a CSS block comment continues onto the next line");
assert.equal(colorOf(cssComment[2], "red"), undefined, "and the rule after it is tokenized as code");

// 转义引号不能让字符串提前闭合。
const escaped = internals.highlightDiffLines(['x = "a\\"b" + 1'], "py")[0];
assert.equal(escaped.map((run) => run.text).join(""), 'x = "a\\"b" + 1', "an escaped quote round-trips");
assert.equal(colorOf(escaped, '"a\\"b"'), "var(--shiki-token-string)", "the escaped quote stays inside the string");
assert.equal(colorOf(escaped, "1"), "var(--shiki-token-constant)", "the code after the string is tokenized again");

// 跨行字符串：Python 三引号是一段字符串，不是「每行各开一个」。
// 逐行独立分词会把收尾的 `"""` 当成一次新开串，于是 `end"""  # done` 那行的注释被吞进字符串；
// 分词器因此把多行定界符当状态在行间传递。
const docstring = internals.highlightDiffLines(['def f():', '    """doc', "    more", '    """', "    return 1"], "py");
assert.equal(docstring[1].at(-1).color, "var(--shiki-token-string)", "the docstring opener is a string");
assert.equal(docstring[2][0].color, "var(--shiki-token-string)", "the docstring's middle line is the same string");
assert.equal(docstring[3][0].color, "var(--shiki-token-string)", "the closing line starts as the string");
assert.equal(docstring[3].map((run) => run.text).join(""), '    """', "the closing line carries only the delimiter here");
assert.equal(colorOf(docstring[4], "return"), "var(--shiki-token-keyword)", "the line after the docstring tokenizes normally again");
// 收尾行后面还有代码时，字符串在定界符处闭合，其余照常分词。
const closedThenCode = internals.highlightDiffLines(['"""doc', 'end""" + x  # note'], "py");
assert.equal(colorOf(closedThenCode[1], 'end"""'), "var(--shiki-token-string)", "the string closes at its delimiter");
assert.equal(colorOf(closedThenCode[1], "# note"), "var(--shiki-token-comment)", "the comment after the closing delimiter is a comment again");
// 模板串（反引号）同样跨行；但单个引号不跨行——那是行内笔误，不该吞掉后面的文件。
const template = internals.highlightDiffLines(["const a = `one", "two`;"], "ts");
assert.equal(template[1][0].color, "var(--shiki-token-string)", "a template literal continues onto the next line");
const singleQuote = internals.highlightDiffLines(["x = 'unterminated", "y = 1"], "py");
assert.equal(colorOf(singleQuote[1], "1"), "var(--shiki-token-constant)", "an unterminated single quote does not swallow the next line");

// 星平面字符不能把 token 边界算错：分词器全程按**码点**索引，
// 否则行内每多一个 emoji，后面的 token 就整体错位一格。
const astralLine = internals.highlightDiffLines(['x = "\u{1F600}\u{1F600}"  # note'], "py")[0];
assert.equal(astralLine.map((run) => run.text).join(""), 'x = "\u{1F600}\u{1F600}"  # note', "an astral line round-trips");
assert.equal(colorOf(astralLine, '"\u{1F600}\u{1F600}"'), "var(--shiki-token-string)", "the string still closes at the right code point");
assert.equal(colorOf(astralLine, "# note"), "var(--shiki-token-comment)", "and the comment after it is still found");

// ── 散文不是代码 ────────────────────────────────────────────────────────────
// Markdown 整个不做分词。代码分词器读英文会随机上色：in / as / with / this / for / is /
// not / and / or / package 都是关键字集合里的词，而 `shiki's` 里的撇号会开一个字符串
// 把整行吞掉。内置 CodeBlock 敢处理 markdown 是因为 shiki 的 markdown 语法分得清散文与
// 围栏代码；近似分词器分不清，所以 markdown 走纯文本（底色与行内改动标记照旧）。
assert.equal(internals.highlightDiffLines(["Syntax highlighting uses a local tokenizer"], "md"), undefined, "markdown is prose, not code: no tokenizing");
assert.equal(internals.highlightDiffLines(["# Title", "some text"], "mdx"), undefined, "mdx likewise");
// 长别名要经 langOfPath 落到同一个 id 上才走纯文本（"markdown" 本身不是 lang id）。
assert.equal(internals.langOfPath("D:/a/notes.markdown"), "md", "the long alias still resolves to md");
assert.equal(internals.highlightDiffLines(["text"], internals.langOfPath("D:/a/notes.markdown")), undefined, "so a .markdown file is plain too");

// 撇号不开字符串：单词中间的引号是标点，不是字符串定界符。
// 这一条同时救了注释、字符串和 YAML 值里的英文散文。
const apostrophe = internals.highlightDiffLines(["grammar. The highlighter uses shiki's pure-JS engine"], "ts")[0];
assert.equal(apostrophe.map((run) => run.text).join(""), "grammar. The highlighter uses shiki's pure-JS engine", "an apostrophe line round-trips");
assert.ok(apostrophe.every((run) => run.color !== "var(--shiki-token-string)"), "an apostrophe in a word does not open a string");
// 但真正的字符串照旧：引号前不是单词字符。
const realString = internals.highlightDiffLines(["x = 'abc' + 'de'"], "py")[0];
assert.equal(colorOf(realString, "'abc'"), "var(--shiki-token-string)", "a quote after a non-word character still opens a string");
assert.equal(colorOf(realString, "'de'"), "var(--shiki-token-string)", "and the second literal opens too");
// 英寸记号同理。
const inchMark = internals.highlightDiffLines(['size = 12" wide'], "ts")[0];
assert.ok(inchMark.every((run) => run.color !== "var(--shiki-token-string)"), 'a 12" inch mark does not open a string');

// 单个大写字母不算常量：`A file whose extension...` 里的 A 不该上色；SCREAMING_CASE 才算。
const capsRuns = internals.highlightDiffLines(["A file whose MIT licence uses MAX_SIZE"], "ts")[0];
assert.equal(colorOf(capsRuns, "A"), undefined, "a lone capital letter is not a constant");
assert.equal(colorOf(capsRuns, "MIT"), "var(--shiki-token-constant)", "an all-caps word is a constant");
assert.equal(colorOf(capsRuns, "MAX_SIZE"), "var(--shiki-token-constant)", "SCREAMING_CASE is a constant");

// 成员访问名不是关键字：`.` 之后的标识符是属性/方法名。
// `KEYWORD_SETS.get(lang)` 里 `get` 只在 class body 内才是保留字，按 `return` 那样上关键字色
// 读起来就是错的（2026-09-21 用户截图反馈的第二例）。`.` 之后的词一律保持默认前景色。
const memberLine = internals.highlightDiffLines(["return KEYWORD_SETS.get(lang) ?? new Set(KEYWORDS.common);"], "js")[0];
assert.equal(colorOf(memberLine, "get"), undefined, "a member name after a dot is not a keyword");
assert.equal(colorOf(memberLine, "return"), "var(--shiki-token-keyword)", "a real keyword is still a keyword");
assert.equal(colorOf(memberLine, "common"), undefined, "a property name is not classified either");
// 点号带空格也认（`a . b`）。
assert.equal(colorOf(internals.highlightDiffLines(["x = a . get(y)"], "js")[0], "get"), undefined, "whitespace around the dot does not defeat the member rule");
// 但不在点号之后的同名标识符照旧按关键字处理（`get` 已从表里移除，用 `in` 验证规则本身）。
assert.equal(colorOf(internals.highlightDiffLines(["for (k in obj)"], "js")[0], "in"), "var(--shiki-token-keyword)", "a keyword outside member position still colours");
assert.equal(colorOf(internals.highlightDiffLines(["obj.in(k)"], "js")[0], "in"), undefined, "the same word as a member name does not");

// 数据格式（yaml / toml / ini）只做词法着色：注释、字符串、数字照上，**单词不分类**。
// 否则 `description: install in the for as is not` 会被关键字色撒满。
const yamlProse = internals.highlightDiffLines(["description: install in the for as is not"], "yaml")[0];
assert.ok(yamlProse.every((run) => run.color !== "var(--shiki-token-keyword)"), "a data value's words are not keywords");
assert.equal(yamlProse.map((run) => run.text).join(""), "description: install in the for as is not", "the data line round-trips");
assert.equal(colorOf(internals.highlightDiffLines(["n: 42  # count"], "yaml")[0], "42"), "var(--shiki-token-constant)", "a data number still colours");
assert.equal(colorOf(internals.highlightDiffLines(["n: 42  # count"], "yaml")[0], "# count"), "var(--shiki-token-comment)", "a data comment still colours");
assert.equal(colorOf(internals.highlightDiffLines(["k = 'v'"], "toml")[0], "'v'"), "var(--shiki-token-string)", "a data string still colours");
assert.equal(colorOf(internals.highlightDiffLines(["if = 1"], "ini")[0], "if"), undefined, "an ini key that reads as a keyword stays plain");

// 着色后的行：token 各自成 span（各带自己的 color），真正改动的字符在 token **内部**
// 再切一层 mark，且 mark 的边界按码点算——星平面字符不能被劈开。
const coloredHunk = {
	path: "D:/Projects/demo/tests/unit/test_paint.py",
	oldText: 'x = "OLD"\ny = 1',
	newText: 'x = "NEW"\ny = 1'
};
const paintedHtml = render(moduleExports.EditDiffRow({
	toolName: "edit",
	block: {
		kind: "result",
		call: { callId: "c_paint", name: "edit", argsRaw: JSON.stringify({ file_path: coloredHunk.path }) },
		content: [{ type: "text", text: "The file has been edited successfully." }],
		meta: { diffs: [coloredHunk] },
		isError: false
	},
	cwd: "D:/Projects/demo",
	home: "C:/Users/dev",
	openFile: () => {},
	inspect: () => {}
}));
assert.match(paintedHtml, /"className":"dsh-edit-diff-token","style":\{"color":"var\(--shiki-token-string\)"/, "a token run wears the theme's own colour: " + paintedHtml);
assert.match(paintedHtml, /"className":"dsh-edit-diff-mark","children":"OLD"/, "the changed characters keep their own mark: " + paintedHtml);
assert.match(paintedHtml, /"className":"dsh-edit-diff-mark","children":"NEW"/, "the added characters are marked too: " + paintedHtml);
// 行底高亮由 CSS 类承担，两个半边分色。
assert.match(paintedHtml, /"className":"dsh-edit-diff-line dsh-edit-diff-del"/, "the removed line keeps its own row class");
assert.match(paintedHtml, /"className":"dsh-edit-diff-line dsh-edit-diff-add"/, "the added line keeps its own row class");
// 未改动的上下文行同样着色：它按**旧侧**的行号去取（两侧在这一行上文本相同），
// 所以拿到的必须是那一行的 token，而不是空。
assert.match(paintedHtml, /"className":"dsh-edit-diff-line dsh-edit-diff-ctx","children":\[\{"type":"span"/, "a kept context line is coloured from the old side too: " + paintedHtml);

// 星平面字符 + 着色同时在场：mark 的范围落在 token 内部时也必须按码点切。
const astralPaint = {
	path: "D:/Projects/demo/tests/unit/test_paint.py",
	oldText: 'x = "a\u{1F600}b"',
	newText: 'x = "a\u{1F600}c"'
};
const astralPaintHtml = render(moduleExports.EditDiffRow({
	toolName: "edit",
	block: {
		kind: "result",
		call: { callId: "c_ap", name: "edit", argsRaw: JSON.stringify({ file_path: astralPaint.path }) },
		content: [{ type: "text", text: "The file has been edited successfully." }],
		meta: { diffs: [astralPaint] },
		isError: false
	},
	cwd: "D:/Projects/demo",
	home: "C:/Users/dev",
	openFile: () => {},
	inspect: () => {}
}));
assert.ok(astralPaintHtml.includes("a\u{1F600}"), "the astral glyph survives a coloured line: " + astralPaintHtml);
assert.match(astralPaintHtml, /"className":"dsh-edit-diff-mark","children":"b"/, "the marked char inside a token is the changed one");

// 没有扩展名的文件：没有语法，但底色与行内 mark 照旧。
const plainHtml = render(moduleExports.EditDiffRow({
	toolName: "edit",
	block: {
		kind: "result",
		call: { callId: "c_plain", name: "edit", argsRaw: JSON.stringify({ file_path: "D:/Projects/demo/Makefile" }) },
		content: [{ type: "text", text: "The file has been edited successfully." }],
		meta: { diffs: [{ path: "D:/Projects/demo/Makefile", oldText: "OLD KEEP", newText: "NEW KEEP" }] },
		isError: false
	},
	cwd: "D:/Projects/demo",
	home: "C:/Users/dev",
	openFile: () => {},
	inspect: () => {}
}));
assert.doesNotMatch(plainHtml, /dsh-edit-diff-token/, "an unknown extension renders no token spans: " + plainHtml);
assert.match(plainHtml, /"className":"dsh-edit-diff-line dsh-edit-diff-del"/, "it still carries the removed row class");
assert.match(plainHtml, /"className":"dsh-edit-diff-mark","children":"OLD"/, "it still marks the changed characters");

// ── 私有 crash boundary（2026-09-22）────────────────────────────────────────
// 渲染抛异常时，槽注册表自己会处理，而它的两种行为都把卡丢掉：keyed 槽（工具行）把 entry
// **退位**，那一行静默变回内置样式；chain 槽（轮末卡）不退位，留一个洞。两种都看不出原因，
// 和「没装这个插件」「这一轮没改文件」在屏幕上一模一样。所以插件自带一层 boundary。
// 注意：guarded / CardBoundary 必须从 moduleExports.__internals 直接取——测试用的
// `internals` 包装会把返回值 JSON 化，而 React 元素过一趟 JSON 就把 `type` 丢了。
const rawInternals = moduleExports.__internals;
const ProbeOk = () => React.createElement("div", { className: "probe-ok" }, "ok");
const ProbeBoom = () => {
	throw new Error("probe boom");
};
const passHtml = render(React.createElement(rawInternals.guarded(ProbeOk, "探针"), { locale: void 0 }));
assert.match(passHtml, /probe-ok/, "a healthy card renders straight through the boundary");
assert.doesNotMatch(passHtml, /dsh-edit-diff-retry/, "and a healthy card shows no fallback");

const boundaryDict = { renderFailed: "差异卡渲染失败", retry: "重试" };
const logged = [];
const realConsoleError = console.error;
console.error = (...args) => logged.push(args.map((arg) => String(arg)).join(" "));
let boomHtml;
try {
	boomHtml = render(React.createElement(rawInternals.CardBoundary, {
		label: "探针行",
		dict: boundaryDict
	}, React.createElement(ProbeBoom, null)));
} finally {
	console.error = realConsoleError;
}
assert.match(boomHtml, /差异卡渲染失败/, `a throw shows the failure message instead of taking the row down, got: ${boomHtml}`);
assert.match(boomHtml, /"className":"dsh-edit-diff-retry"/, "and the fallback offers a retry");
assert.match(boomHtml, /重试/, "with the localized retry label");
assert.match(boomHtml, /"className":"dsh-edit-diff-root"/, "the fallback still occupies the row, so the slot entry is not abdicated");
assert.ok(logged.some((line) => line.includes("探针行") && line.includes("probe boom")), `the diagnostic names both the card and the error, got: ${JSON.stringify(logged)}`);

// 重试：onClick 复位 failed 并递增 attempt，于是子树以**新 key** 重挂，而不是复用抛过异常的树。
const retryProps = {
	label: "探针行",
	dict: boundaryDict,
	children: null
};
const retryInstance = new rawInternals.CardBoundary(retryProps);
retryInstance.props = retryProps;
retryInstance.state = { failed: true, attempt: 0 };
retryInstance.setState = (update) => {
	retryInstance.state = { ...retryInstance.state, ...(typeof update === "function" ? update(retryInstance.state, retryInstance.props) : update) };
};
const findRetry = (node) => {
	if (Array.isArray(node)) return node.map(findRetry).find(Boolean) ?? null;
	if (node === null || typeof node !== "object") return null;
	if (node.props?.className === "dsh-edit-diff-retry") return node;
	return findRetry(node.props?.children);
};
const retryButton = findRetry(retryInstance.render());
assert.ok(retryButton !== null, "the fallback carries a real button element");
assert.equal(typeof retryButton.props.onClick, "function", "whose click handler is wired");
retryButton.props.onClick();
assert.equal(retryInstance.state.failed, false, "retry clears the failure");
assert.equal(retryInstance.state.attempt, 1, "and bumps the attempt so the child remounts under a new key");
assert.doesNotMatch(render(retryInstance.render()), /dsh-edit-diff-retry/, "a retried boundary renders its child again instead of the fallback");
// 兜底路径自己不能再抛：少了字典也必须画出 fallback，否则异常会穿过 boundary 把行丢掉——
// 正是它存在要防的那件事。
const bareBoundary = render(React.createElement(rawInternals.CardBoundary, {
	label: "探针行"
}, React.createElement(ProbeBoom, null)));
assert.match(bareBoundary, /差异卡渲染失败/, "a boundary without a dictionary still renders the fallback");
assert.match(bareBoundary, /重试/, "falling back to the built-in Chinese labels");

// 样式表：底色落在行类上，语法色只在 token 上，且主题变量仍是唯一真源。
// 按内容定位那条样式表，不用行号：bundle 上方每加一段注释/绑定都会让行号漂移，
// 断言就会去匹配一段无关正文（2026-09-21 加语法着色绑定与注释时实际踩到）。
const cssLine = readFileSync(bundlePath, "utf8").split("\n").find((line) => line.includes(".dsh-edit-diff-root{"));
assert.ok(cssLine !== void 0, "the stylesheet line is present in the bundle");
const css = cssLine;
assert.match(css, /\.dsh-edit-diff-del\{background:var\(--dsh-edit-diff-del-bg\)\}/, "the removed row paints its own background");
assert.match(css, /\.dsh-edit-diff-add\{background:var\(--dsh-edit-diff-add-bg\)\}/, "the added row paints its own background");
// 整行底色是唯一的增删信号：行类不得再强制文字颜色，否则 shiki 的 token 颜色会被继承盖掉，
// 整行文字变成单一的红/绿（2026-09-21 实际就是这样：全绿的文字、看不到语法色）。
assert.doesNotMatch(css, /\.dsh-edit-diff-del\{[^}]*color:/, "the removed row does not force a text colour");
assert.doesNotMatch(css, /\.dsh-edit-diff-add\{[^}]*color:/, "the added row does not force a text colour");
// 行号列：真实行号一档字色，相对行号更暗一档，数字对齐用 tabular-nums。
assert.match(css, /\.dsh-edit-diff-gutter\{[^}]*font-variant-numeric:tabular-nums/, "the gutter keeps numbers in a fixed column");
assert.match(css, /\.dsh-edit-diff-gutterRelative\{color:var\(--dsw-alias-label-caption\)\}/, "the relative gutter uses the dimmer caption colour");
assert.match(css, /\.dsh-edit-diff-del \.dsh-edit-diff-mark\{background:var\(--dsh-edit-diff-del-bg-hit\)\}/, "a changed run inside a removed line darkens");
assert.match(css, /\.dsh-edit-diff-add \.dsh-edit-diff-mark\{background:var\(--dsh-edit-diff-add-bg-hit\)\}/, "a changed run inside an added line darkens");
assert.match(css, /\.dsh-edit-diff-mark\{border-radius:2px\}/, "marks no longer underline the changed text");
assert.doesNotMatch(css, /dsh-edit-diff-mark\{[^}]*text-decoration/, "the underline that coloured the text is gone");
assert.match(css, /--dsh-edit-diff-add-bg:color-mix\(in srgb,var\(--dsw-alias-state-success-primary\) 16%,transparent\)/, "the added wash is derived from the theme's success token");
assert.match(css, /\.dsh-edit-diff-stat\{[^}]*border-radius:4px/, "the header stat is a pill, not bare coloured text");
assert.match(css, /\.dsh-edit-diff-added\{background:var\(--dsh-edit-diff-add-bg\)/, "the added half of a stat wears the wash");
assert.match(css, /\.dsh-edit-diff-footer\{padding-top:8px/, "the footer rule survives the stylesheet edit");
assert.match(css, /\.dsh-edit-diff-retry\{[^}]*border-radius:999px/, "the fallback's retry control is a pill, like the card's other buttons");
// 行底要铺满整行（短行也铺满、长行随内容撑开），这样它读起来是「一行有底色」，
// 而不是「一段文字被涂了色」。
assert.match(css, /\.dsh-edit-diff-scroll\{[^}]*display:flex[^}]*flex-direction:column\}/, "rows stack as flex items so a short row still fills the width");
assert.match(css, /\.dsh-edit-diff-line\{[^}]*min-width:max-content/, "a long row grows past the container and scrolls instead of clipping its tint");

console.log("smoke: ok");
