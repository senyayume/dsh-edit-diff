import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, win32 } from "node:path";
import { READ_ROUTE, REVEAL_EXEC_OPTIONS, REVEAL_ROUTE, anchorDefinition, anchorHunks, apply, isTrustedRequest, mountAnchors, revealCommand, revealTargetOf } from "../lib/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoFile = join(here, "..", "lib", "index.js");

assert.equal(REVEAL_ROUTE, "/edit-diff/reveal", "the client half posts to this exact route");

// 平台命令：Windows 用 /n 强制新窗口，让手势每次都有一只看得到的结果
// （实测普通 /select 在目录已开窗时也照样再开一只并置前，/n 不比它慢）。
assert.deepEqual(revealCommand("D:\\a\\b.md", "win32"), {
	command: "explorer.exe",
	args: ["/n,/select,D:\\a\\b.md"]
});
assert.deepEqual(revealCommand("/a/b.md", "darwin"), {
	command: "open",
	args: ["-R", "/a/b.md"]
});
assert.deepEqual(revealCommand("/a/b.md", "linux"), {
	command: "xdg-open",
	args: ["/a"]
});
// Explorer 的 /select 对正斜杠路径是**静默**无视的：进程照样退 1、没有窗口，
// 调用方分不出这和一次成功交棒有什么区别，所以 argv 里必须是原生拼法。
// 相对路径会被客户端用 "/" 拼上会话根，`D:/a/b.md` 这种形状真的会到这儿。
assert.deepEqual(revealCommand("D:/a/b.md", "win32"), {
	command: "explorer.exe",
	args: ["/n,/select," + win32.join("D:/a", "b.md")]
});

// 打开器的 execFile 选项里不许出现 windowsHide：libuv 把它翻成
// STARTUPINFO.wShowWindow = SW_HIDE，新拉起的 explorer 用 SW_SHOWDEFAULT 建窗口时
// 继承成隐藏窗口——窗口建了、文件选中了、用户什么也看不见（2026-09-19 的真因）。
assert.equal(REVEAL_EXEC_OPTIONS.windowsHide, void 0, "the opener must not run hidden");
assert.equal(Object.isFrozen(REVEAL_EXEC_OPTIONS), true, "the opener options are not to be mutated at runtime");

// 只认绝对且真实存在的文件——这条路由不接受任意字符串。
assert.equal(revealTargetOf(repoFile), repoFile, "an existing absolute file passes");
// 正斜杠拼法也是绝对路径，校验照过——归一到原生拼法是命令构造那一层的责任。
assert.equal(revealTargetOf(repoFile.replace(/\\/g, "/")), repoFile.replace(/\\/g, "/"), "a forward-slash absolute path passes validation");
assert.equal(revealTargetOf("lib/index.js"), null, "a relative path is refused");
assert.equal(revealTargetOf(join(here, "..", "lib", "nope.js")), null, "a missing file is refused");
assert.equal(revealTargetOf(here), null, "a directory is refused");
assert.equal(revealTargetOf(""), null, "an empty path is refused");
assert.equal(revealTargetOf("a".repeat(1025)), null, "an over-long path is refused");
assert.equal(revealTargetOf(void 0), null, "a non-string is refused");

// 浏览器侧栅栏：回环/受信权威 + 同站 + Origin 一致。
assert.equal(isTrustedRequest({ headers: { host: "127.0.0.1:3080" } }), true, "loopback literal passes");
assert.equal(isTrustedRequest({ headers: { host: "localhost:3080" } }), true, "localhost passes");
assert.equal(isTrustedRequest({ headers: { host: "evil.example" } }), false, "an undeclared authority is refused");
assert.equal(isTrustedRequest({ headers: { host: "192.168.1.9:3080" } }), false, "a LAN literal is refused unless declared");
assert.equal(isTrustedRequest({ headers: { host: "192.168.1.9:3080" } }, ["192.168.1.9"]), true, "a declared authority passes");
assert.equal(isTrustedRequest({ headers: { host: "127.0.0.1", "sec-fetch-site": "cross-site" } }), false, "a cross-site fetch is refused");
assert.equal(isTrustedRequest({ headers: { host: "127.0.0.1", origin: "http://127.0.0.1:3080" } }), true, "a matching Origin passes");
assert.equal(isTrustedRequest({ headers: { host: "127.0.0.1", origin: "https://evil.example" } }), false, "a foreign Origin is refused");
assert.equal(isTrustedRequest({ headers: {} }), false, "an absent Host is refused");

// apply 不靠模块级 inject 把关：webServer 什么时候出现，路由什么时候挂上。
// （把插件整体 gate 在服务上，会让没有该服务的部署连一次 reveal 都没有。）
const injected = [];
const effects = [];
const routes = [];
apply({
	inject: (deps, callback) => {
		injected.push(deps);
		callback({
			effect: (factory, label) => {
				effects.push(label);
				factory();
			},
			webServer: {
				register: (route) => {
					routes.push(route);
					return () => {};
				}
			},
			get: () => void 0
		});
	}
});
assert.deepEqual(injected, [["webServer"], ["tools"]], "the routes wait for the web server, the anchors for the tools registry");
assert.deepEqual(effects, ["dsh-edit-diff: host routes", "dsh-edit-diff: diff anchors"], "both registrations are owned by effects");
assert.deepEqual(routes.map((route) => [route.kind, route.path]), [
	["exact", REVEAL_ROUTE],
	["exact", READ_ROUTE]
], "both routes answer one exact path each");
for (const route of routes) assert.equal(typeof route.handler, "function", "each route owns its handler");

// ==== 行号锚：把结算后的 hunk 钉到它真实占据的行 ====
// 基准是 execute outcome 自己的 before/after——正是 hunk 的来源——所以在原文里单调定位
// 就得到精确行号：不用读文件，也不怕文件后来被改。hunk 按文件顺序到达，生产者又会把共享
// 3 行上下文的改动并成一个 hunk，所以两个 hunk 的窗口不重叠，前向搜索要么命中真实位置、
// 要么什么都找不到。
const multiBefore = "one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\n";
const multiAfter = "one\nTWO\nthree\nfour\nfive\nSIX\nseven\neight\n";
const multiHunks = [
	{ path: "a.md", oldText: "one\ntwo\nthree", newText: "one\nTWO\nthree" },
	{ path: "a.md", oldText: "five\nsix\nseven", newText: "five\nSIX\nseven" }
];
anchorHunks(multiHunks, multiBefore, multiAfter);
assert.deepEqual(multiHunks.map((hunk) => [hunk.oldStart, hunk.newStart]), [[1, 1], [5, 5]], "each hunk is anchored at its real line, in file order");
// 第二处改动在第 4 行：单 hunk 也要精确，不是「从 1 数起」。
const lateHunk = [{ path: "a.md", oldText: "four\nfive\nsix", newText: "four\nfive\nSIX" }];
anchorHunks(lateHunk, multiBefore, multiAfter);
assert.deepEqual([lateHunk[0].oldStart, lateHunk[0].newStart], [4, 4], "a single late hunk numbers from its own position");
// 定位不到就**不猜**：宁可不打戳，也不给一个错的行号（半个对的行号比没有更坏）。
const orphan = [{ path: "a.md", oldText: "nope\nnope", newText: "also-nope" }];
anchorHunks(orphan, "a\nb\n", "a\nB\n");
assert.deepEqual([orphan[0].oldStart, orphan[0].newStart], [null, null], "an unlocatable hunk stays unstamped instead of guessing");
// 任一侧「有内容却定位不到」→ 两侧都清掉。这条是**对称**的：只清一侧会留下一个
// oldStart 有号、newStart 无号的混合对，而读者分不出哪一半是假的。
const halfPair = [{ path: "a.md", oldText: "not-there", newText: "B" }];
anchorHunks(halfPair, "a\nb\n", "a\nB\n");
assert.deepEqual([halfPair[0].oldStart, halfPair[0].newStart], [null, null], "an old side that carries text but does not locate refuses both");
const halfPairNew = [{ path: "a.md", oldText: "a\nb", newText: "a\nNOT-THERE" }];
anchorHunks(halfPairNew, "a\nb\n", "a\nB\n");
assert.deepEqual([halfPairNew[0].oldStart, halfPairNew[0].newStart], [null, null], "and so does a new side that carries text but does not locate");
// 新建：只有新侧有位置；两侧字段都在，null 表示「这一侧没有位置」，不是「字段缺失」。
const created = [{ path: "n.md", oldText: null, newText: "x\ny" }];
anchorHunks(created, null, "p\nq\nx\ny\n");
assert.deepEqual([created[0].oldStart, created[0].newStart], [null, 3], "a creation numbers only its new side");
// 纯新增（有旧侧文本但那一侧为空）：同样只有新侧有位置。
const pureAdd = [{ path: "a.md", oldText: null, newText: "three\nfour" }];
anchorHunks(pureAdd, multiBefore, multiAfter);
assert.deepEqual([pureAdd[0].oldStart, pureAdd[0].newStart], [null, 3], "a pure addition anchors its new side only");

// 包装：借用来的定义只换一个方法，卸载必须还原（否则热重载会越包越深）。
const calls = [];
const definition = {
	name: "edit",
	output: {
		presentationMeta(args, value) {
			calls.push(value);
			return { diffs: [{ path: "a.md", oldText: "b\nc", newText: "b\nC" }] };
		}
	}
};
const restore = anchorDefinition(definition);
assert.equal(typeof restore, "function", "a wrappable definition returns a restorer");
const stamped = definition.output.presentationMeta({}, { before: "a\nb\nc\n", after: "a\nb\nC\n" });
assert.deepEqual([stamped.diffs[0].oldStart, stamped.diffs[0].newStart], [2, 2], "the wrapped projector stamps what it returns");
assert.equal(calls.length, 1, "and still delegates to the original projector");
assert.equal(anchorDefinition(definition), null, "a second wrap is refused, so hot reload cannot nest them");
assert.equal(anchorDefinition({ name: "edit", output: Object.freeze({ presentationMeta: () => ({}) }) }), null, "a frozen projector is refused");
restore();
const bare = definition.output.presentationMeta({}, { before: "a\nb\nc\n", after: "a\nb\nC\n" });
assert.deepEqual([bare.diffs[0].oldStart, bare.diffs[0].newStart], [undefined, undefined], "unload restores the bare projector");

// 派发闸：preset 工具按 agent scope 挂载，apply 时 get() 常常读不到，所以还要包住
// createSuccessResult —— 每次执行都会经过它，定义在首次结算派发时被包上，无论它何时挂载。
const late = {
	name: "write",
	output: {
		presentationMeta: () => ({ diffs: [{ path: "n.md", oldText: null, newText: "x" }] })
	}
};
const mounted = [];
class Registry {
	get(name) { return this.entries?.[name]; }
	createSuccessResult(exec, tool, candidate) {
		return tool.output.presentationMeta({}, candidate);
	}
}
const registry = new Registry();
registry.entries = { write: late };
const restoreMount = mountAnchors(registry);
const lateResult = registry.createSuccessResult({}, late, { before: null, after: "p\nq\nx\n" });
assert.equal(lateResult.diffs[0].newStart, 3, "a definition mounted after apply is wrapped on its first dispatch");
restoreMount();
assert.equal(registry.createSuccessResult({}, late, { before: null, after: "p\nq\nx\n" }).diffs[0].newStart, undefined, "unload restores the registry gate too");

/** One fake request with a JSON body, delivered on the next tick. */
function requestOf({ method = "POST", host = "127.0.0.1:3080", body = "{}", origin, site } = {}) {
	const request = new EventEmitter();
	request.method = method;
	request.headers = { host };
	if (origin !== undefined) request.headers.origin = origin;
	if (site !== undefined) request.headers["sec-fetch-site"] = site;
	request.destroy = () => {};
	request.resume = () => {};
	setImmediate(() => {
		request.emit("data", Buffer.from(body, "utf8"));
		request.emit("end");
	});
	return request;
}
/** One fake response capturing status and parsed body. */
function responseOf() {
	const response = { status: void 0, body: void 0, headers: void 0 };
	response.writeHead = (status, headers) => {
		response.status = status;
		response.headers = headers;
	};
	response.end = (text) => {
		response.body = JSON.parse(text);
	};
	return response;
}

const handler = routes[0].handler;
const call = async (options) => {
	const response = responseOf();
	await handler(requestOf(options), response);
	return response;
};

assert.equal((await call({ method: "GET" })).status, 405, "a non-POST request is refused");
assert.equal((await call({ host: "evil.example" })).status, 403, "an untrusted authority is refused");
assert.equal((await call({ site: "cross-site" })).status, 403, "a cross-site fetch is refused");
assert.equal((await call({ body: "not json" })).status, 400, "a malformed body is refused");
assert.equal((await call({ body: JSON.stringify({ path: "lib/index.js" }) })).status, 400, "a relative path is refused");
assert.equal((await call({ body: JSON.stringify({ path: join(here, "..", "lib", "nope.js") }) })).status, 400, "a missing file is refused");
// 成功分支会真的拉起文件管理器，因此这里只验它走到 spawn 之前就拒绝的那些；
// 成功路径由 live 验收（B11）覆盖。

// ==== fenced read 路由：客户端行号 fallback 的唯一数据来源 ====
// fallback 要读**当前**文件来定位 hunk 后像，所以这条路由的栅栏就是它的全部安全性：
// 工作区包含性 + 拒符号链接 + 只读常规文件 + 读前读后各验一次路径身份 + 读取上限。
const readRoute = routes[1].handler;
const readRoot = mkdtempSync(join(tmpdir(), "edit-diff-read-"));
const outsideFile = join(readRoot, "..", "edit-diff-outside-" + String(Date.now()) + ".txt");
try {
	mkdirSync(join(readRoot, "sub"));
	writeFileSync(join(readRoot, "a.txt"), "one\ntwo\nthree\n");
	writeFileSync(join(readRoot, "bin.dat"), Buffer.from([
		97,
		0,
		98
	]));
	writeFileSync(join(readRoot, "big.txt"), "x".repeat(600 * 1024));
	writeFileSync(outsideFile, "secret\n");
	const read = async (payload) => {
		const response = responseOf();
		await readRoute(requestOf({ body: JSON.stringify(payload) }), response);
		return response;
	};
	assert.equal((await read({
		cwd: readRoot,
		path: "a.txt"
	})).body.content, "one\ntwo\nthree\n", "a fenced read returns the file text");
	assert.equal((await read({
		cwd: readRoot,
		path: "a.txt"
	})).body.size, 14, "and reports the real size");
	assert.equal((await read({
		cwd: readRoot,
		path: "../" + outsideFile.split(/[\\/]/).pop()
	})).body.kind, "error", "a file outside the workspace is refused");
	assert.equal((await read({
		cwd: readRoot,
		path: "sub"
	})).body.kind, "error", "a directory is refused");
	assert.equal((await read({
		cwd: readRoot,
		path: "bin.dat"
	})).body.kind, "binary", "a binary file is reported, never decoded");
	assert.equal((await read({
		cwd: readRoot,
		path: "nope.txt"
	})).body.kind, "error", "a missing file is an error, not a crash");
	assert.equal((await read({
		cwd: "",
		path: "a.txt"
	})).body.kind, "error", "an absent cwd is refused");
	const big = await read({
		cwd: readRoot,
		path: "big.txt"
	});
	assert.equal(big.body.truncated, true, "a file over the read cap is truncated");
	assert.equal(big.body.content.length, 512 * 1024, "and the truncation is bounded");
	assert.equal(big.body.size, 600 * 1024, "while the reported size stays the real one");
} finally {
	rmSync(readRoot, {
		recursive: true,
		force: true
	});
	rmSync(outsideFile, { force: true });
}

console.log("host: ok");
