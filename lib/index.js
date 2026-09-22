//#region host entry
/**
 * Host half of dsh-edit-diff. Two jobs, both optional to the deployment:
 *
 * 1. **Diff anchors** — wrap the borrowed `edit`/`write` definitions'
 *    `output.presentationMeta` so each settled hunk's wire meta carries the 1-based
 *    `oldStart`/`newStart` it really occupies. The client half prints those as real
 *    file line numbers; without this it falls back to window-relative numbering.
 * 2. **Reveal** — serve the card's "show in file manager" gesture on one fenced
 *    route, so it does not depend on any other Host surface: the request names one
 *    file, the host runs the platform opener with an argv array (never a shell
 *    string), and the answer carries either the confirmation or the reason.
 *
 * Neither job gates the plugin: a deployment missing the tools service, the web
 * server, or both still loads and keeps its own degradation chain.
 */
import { execFile } from "node:child_process";
import { dirname, isAbsolute, relative, resolve, win32 } from "node:path";
import { statSync } from "node:fs";
import { lstat, readFile, realpath } from "node:fs/promises";
//#endregion
//#region reveal command
/** Route the client half posts one reveal request to. */
export const REVEAL_ROUTE = "/edit-diff/reveal";
/** Largest accepted request body, in bytes. */
const MAX_BODY_BYTES = 4096;
/** Longest accepted path, in characters. */
const MAX_PATH_LENGTH = 1024;
/**
 * How long the opener may run before it is killed. Explorer hands the job to the
 * running shell and exits (with status 1), so this only bounds a real hang.
 */
const COMMAND_TIMEOUT_MS = 10000;
/** One backslash, spelled without a literal so no escape can go wrong. */
const SEP = String.fromCharCode(92);
/**
 * The platform's "select this file in the file manager" command.
 *
 * The Windows form opens a NEW window on purpose, so the gesture always has one
 * unambiguous result the user can see. It is not a workaround for a swallowed
 * handoff: measured on this machine, a plain `/select` with a folder window
 * already open still spawned a SECOND window (725 ms) and that new window took
 * the foreground — so `/n` costs nothing and says what it does. Nor is it slower:
 * after the zombie-window pile was cleared, `/n,/select` opened in 650/764/1581 ms
 * against 1485/2091/766 ms for the plain form (explorer.exe's own startup, ~300 ms
 * of which is the spawned process reaching its handoff, is the whole cost).
 *
 * The path goes to Explorer in its native spelling, because Explorer's `/select`
 * parsing ignores a forward-slash path *silently*: the process still exits 1, so
 * the caller cannot tell that apart from a handoff, and no window is ever built.
 * A relative path spelled in a transcript makes the client join it with "/", so
 * `D:/a/b.md` is a shape that really arrives here.
 *
 * @param path - absolute file path.
 * @param platform - platform to build for; injectable for tests.
 * @returns the command and its argv.
 */
export function revealCommand(path, platform = process.platform) {
	if (platform === "darwin") return {
		command: "open",
		args: [
			"-R",
			path
		]
	};
	if (platform === "win32") return {
		command: "explorer.exe",
		args: ["/n,/select," + win32.normalize(path)]
	};
	return {
		command: "xdg-open",
		args: [dirname(path)]
	};
}
/**
 * Whether one request authority may reach this plugin's routes at all: a loopback
 * Host, or an authority the deployment itself declared; a same-site fetch; and an
 * Origin consistent with that Host. An absent Origin is same-origin by definition
 * here.
 *
 * @param request - incoming request.
 * @param trustedHosts - non-loopback authorities this deployment serves.
 * @returns whether the request may proceed.
 */
export function isTrustedRequest(request, trustedHosts = []) {
	const host = headerOf(request, "host");
	if (host === undefined) return false;
	const authority = authorityOf(host);
	if (authority === null) return false;
	if (!isLoopbackHostname(authority.hostname) && !trustedHosts.some((entry) => trustedAuthority(entry, authority))) return false;
	if (headerOf(request, "sec-fetch-site") === "cross-site") return false;
	const origin = headerOf(request, "origin");
	if (origin === undefined) return true;
	try {
		return new URL(origin).hostname === authority.hostname;
	} catch {
		return false;
	}
}
/**
 * Whether one candidate is the absolute, existing file path this route reveals.
 *
 * @param value - untrusted candidate.
 * @returns the path, or null when it is not revealable.
 */
export function revealTargetOf(value) {
	if (typeof value !== "string") return null;
	const path = value.trim();
	if (path === "" || path.length > MAX_PATH_LENGTH) return null;
	if (!isAbsolutePath(path)) return null;
	try {
		return statSync(path).isFile() ? path : null;
	} catch {
		return null;
	}
}
/** One header value, or undefined when absent or repeated. */
function headerOf(request, name) {
	const value = request?.headers?.[name];
	return typeof value === "string" && value !== "" ? value : undefined;
}
/** Parse one Host/authority string, or null when it is not one. */
function authorityOf(value) {
	try {
		const url = new URL("http://" + value);
		return url.hostname === "" ? null : url;
	} catch {
		return null;
	}
}
/** Whether one hostname is a loopback name or an IPv4 loopback literal. */
function isLoopbackHostname(hostname) {
	const value = hostname.toLowerCase();
	if (value === "localhost" || value === "::1") return true;
	const parts = value.split(".");
	if (parts.length !== 4 || parts[0] !== "127") return false;
	return parts.every((part) => part !== "" && Number(part) >= 0 && Number(part) <= 255);
}
/** Whether a declared trusted authority covers the request authority. */
function trustedAuthority(entry, authority) {
	try {
		const declared = new URL("http://" + entry);
		return declared.hostname === authority.hostname && (declared.port === "" || declared.port === authority.port);
	} catch {
		return false;
	}
}
/** Whether one path is absolute for either separator convention. */
function isAbsolutePath(path) {
	if (path.startsWith("/")) return true;
	if (path.startsWith(SEP + SEP)) return true;
	return path.length > 2 && path[1] === ":" && (path[2] === "/" || path[2] === SEP);
}
//#endregion
//#region diff anchors
/**
 * Marker guarding one definition's projector against a second wrap. A Symbol, so
 * it cannot collide with anything the definition itself carries.
 */
const ANCHOR_STAMPED = Symbol("dsh-edit-diff.anchorStamped");
/** Whether one side of a hunk carries any text to place. */
function carriesText(value) {
	return typeof value === "string" && value !== "";
}

/**
 * A locator that walks one side's full text once, in file order.
 *
 * Hunks arrive in file order, and the producer merges changes that share three
 * context lines, so two hunks' windows never overlap: a forward search from the
 * previous hit either lands on the true position or finds nothing at all. That is
 * what makes the walk monotonic — and monotonic is what makes it one pass over
 * the text instead of one search per hunk from the top.
 *
 * @param text - the side's full text; anything else means "no basis".
 * @returns a `stamp(hunk, field, needle)` function, or null without a basis.
 */
function makeAnchorScanner(text) {
	if (typeof text !== "string") return null;
	let cursor = 0;
	let lines = 0;
	/** Advance the cursor to `end`, counting the newlines passed over. */
	const advanceTo = (end) => {
		for (let at = cursor; at < end; at++) if (text.charCodeAt(at) === 10) lines++;
		cursor = end;
	};
	return (hunk, field, needle) => {
		// An empty side — a pure insert or a pure delete — has no position on it.
		if (typeof needle !== "string" || needle === "") {
			hunk[field] = null;
			return;
		}
		const at = text.indexOf(needle, cursor);
		if (at < 0) {
			hunk[field] = null;
			return;
		}
		advanceTo(at);
		hunk[field] = lines + 1;
		advanceTo(at + needle.length);
	};
}
/**
 * Stamp one hunk list in place with the 1-based line each side starts on,
 * located in the very texts those hunks were computed from.
 *
 * The pair passed in is the execute outcome's own `before`/`after`, so the
 * position is exact and costs no file read — nothing can have drifted since the
 * hunk was produced. Anything ambiguous stays unstamped rather than claiming a
 * wrong line, and a hunk whose two sides disagree (one located, the other
 * carrying content that did not) clears both: half a pair is worse than none,
 * because the reader cannot tell which half lied.
 *
 * @param diffs - the wire hunks, stamped in place.
 * @param before - the pre-image text; null for a creation.
 * @param after - the post-image text.
 */
export function anchorHunks(diffs, before, after) {
	if (!Array.isArray(diffs)) return;
	const stampNew = makeAnchorScanner(after);
	if (stampNew === null) return;
	const stampOld = makeAnchorScanner(before);
	for (const hunk of diffs) {
		if (hunk === null || typeof hunk !== "object" || typeof hunk.path !== "string") continue;
		// Both fields are always written, so the stamped shape is uniform: null
		// means "no position on this side", never "field missing".
		hunk.oldStart = null;
		hunk.newStart = null;
		stampNew(hunk, "newStart", hunk.newText);
		if (stampOld !== null) stampOld(hunk, "oldStart", hunk.oldText);
		// A side that carries content but did not locate means this hunk does not sit
		// in the text it claims to come from, so neither side may claim a position: a
		// mixed pair is worse than none, because the reader cannot tell which half
		// lied. An empty side — a pure insert, a pure delete, or a creation — has no
		// position to lose, so the other side's stamp stands.
		if (carriesText(hunk.newText) && hunk.newStart === null || carriesText(hunk.oldText) && hunk.oldStart === null) {
			hunk.oldStart = null;
			hunk.newStart = null;
		}
	}
}
/**
 * Wrap one borrowed tool definition's `output.presentationMeta` so every settled
 * diff carries the position its hunks really occupy.
 *
 * The kernel computes `meta.diffs` inside that hook and persists the return as the
 * block's wire `meta`, so this is the one place that sees both the hunks and the
 * outcome they came from. The definition is a borrowed registry value, so
 * replacing a single method on it reaches every consumer at once; the wrap never
 * throws into serving, and the returned restorer puts the original back.
 *
 * @param definition - one tool definition.
 * @returns a restorer, or null when this definition is not wrappable.
 */
export function anchorDefinition(definition) {
	if (definition === null || typeof definition !== "object" || definition[ANCHOR_STAMPED] === true) return null;
	const output = definition.output;
	if (output === null || typeof output !== "object" || typeof output.presentationMeta !== "function") return null;
	if (Object.isFrozen(definition) || Object.isFrozen(output)) return null;
	const original = output.presentationMeta.bind(definition);
	output.presentationMeta = (args, value) => {
		const meta = original(args, value);
		try {
			if (meta !== null && typeof meta === "object" && value !== null && typeof value === "object") {
				anchorHunks(meta.diffs, value.before, value.after);
			}
		} catch {}
		return meta;
	};
	definition[ANCHOR_STAMPED] = true;
	return () => {
		output.presentationMeta = original;
		delete definition[ANCHOR_STAMPED];
	};
}
/**
 * Wrap every `edit`/`write` definition this registry will serve.
 *
 * Preset tools mount per agent scope, so a one-shot `get()` at apply time misses
 * both the definitions mounted before this plugin and the ones mounted after it.
 * The dispatch gate closes that hole: every execution resolves its definition
 * through `createSuccessResult`, so wrapping that one prototype method reaches any
 * definition on its first settled dispatch, whenever it happened to mount.
 *
 * @param tools - the host tools registry.
 * @returns a restorer that puts every wrapped projector back.
 */
export function mountAnchors(tools) {
	const restorers = [];
	const wrap = (definition) => {
		try {
			if (definition === null || typeof definition !== "object") return;
			if (definition.name !== "edit" && definition.name !== "write") return;
			const restore = anchorDefinition(definition);
			if (restore !== null) restorers.push(restore);
		} catch {}
	};
	for (const name of ["edit", "write"]) {
		try {
			wrap(tools?.get?.(name));
		} catch {}
	}
	let prototype = null;
	let original = null;
	try {
		prototype = Object.getPrototypeOf(tools);
		if (prototype !== null && typeof prototype.createSuccessResult === "function") {
			original = prototype.createSuccessResult;
			prototype.createSuccessResult = function (exec, tool, candidate) {
				wrap(tool);
				return original.call(this, exec, tool, candidate);
			};
		}
	} catch {
		prototype = null;
		original = null;
	}
	return () => {
		if (prototype !== null && original !== null) {
			try {
				prototype.createSuccessResult = original;
			} catch {}
		}
		for (let at = restorers.length - 1; at >= 0; at--) {
			try {
				restorers[at]();
			} catch {}
		}
	};
}
//#endregion
//#region fenced read
/** Route the client half posts one file read to, for the gutter fallback. */
export const READ_ROUTE = "/edit-diff/read";
/** Most bytes this route will hand back, so one read cannot flood the renderer. */
const READ_CAP_BYTES = 512 * 1024;
/** Whether one resolved candidate is the fence root itself or below it. */
function insideFence(root, candidate) {
	const child = relative(root, candidate);
	return child === "" || !child.startsWith("..") && !isAbsolute(child);
}
/**
 * Read one file inside the session workspace, or explain why not.
 *
 * The fence is the point of this route, so it is deliberately paranoid: realpath
 * the root, contain the candidate, refuse a symlink and anything that is not a
 * regular file, realpath again, and re-contain the result — and then re-verify
 * the path identity on BOTH sides of the read, because a check-then-use swap
 * would otherwise read a file outside the fence.
 *
 * @param cwd - the session workspace root.
 * @param requested - the file path, relative to that root or absolute.
 * @returns `{ kind: "text", content, size, truncated }` or `{ kind: "binary", size }`.
 * @throws when the request is outside the fence or cannot be read.
 */
export async function readFencedText(cwd, requested) {
	if (typeof cwd !== "string" || cwd === "") throw new Error("cwd is required");
	if (typeof requested !== "string" || requested === "") throw new Error("path is required");
	const root = await realpath(cwd);
	const candidate = resolve(root, requested);
	if (!insideFence(root, candidate)) throw new Error("path is outside the session workspace");
	const link = await lstat(candidate);
	if (link.isSymbolicLink()) throw new Error("symbolic links are not supported");
	if (!link.isFile()) throw new Error("path is not a regular file");
	const filename = await realpath(candidate);
	if (!insideFence(root, filename)) throw new Error("resolved path is outside the session workspace");
	/** The path must still be the same file after the read, or the read is void. */
	const assertSame = async () => {
		if (await realpath(candidate) !== filename) throw new Error("file changed while being read");
	};
	await assertSame();
	let bytes = await readFile(filename);
	await assertSame();
	const truncated = link.size > READ_CAP_BYTES;
	if (truncated) bytes = bytes.subarray(0, READ_CAP_BYTES);
	// The NUL check runs on the capped head too, so a large binary cannot slip
	// through as truncated text garbage.
	if (bytes.includes(0)) return {
		kind: "binary",
		size: link.size
	};
	if (truncated) {
		// A raw cut can land mid-UTF-8-sequence; walk back over continuation bytes
		// to the lead byte and drop the incomplete tail rather than decoding U+FFFD.
		for (let back = 1; back <= 3 && back <= bytes.length; back++) {
			const last = bytes[bytes.length - back];
			if ((last & 192) === 128) continue;
			const need = last >= 240 ? 4 : last >= 224 ? 3 : last >= 192 ? 2 : 1;
			if (need > back) bytes = bytes.subarray(0, bytes.length - back);
			break;
		}
	}
	const text = bytes.toString("utf8");
	return {
		kind: "text",
		// Display layer only: a leading BOM would ride the first line's number.
		content: text.charCodeAt(0) === 0xfeff ? text.slice(1) : text,
		size: link.size,
		truncated
	};
}
//#endregion
//#region route
/** One failure message out of whatever was thrown. */
function messageOf(error) {
	const message = error?.message;
	return typeof message === "string" && message !== "" ? message : String(error);
}
/** Write one JSON answer. */
function writeJson(response, status, body) {
	const text = JSON.stringify(body);
	response.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store",
		"content-length": Buffer.byteLength(text)
	});
	response.end(text);
}
/** Read one bounded JSON body. */
function readJsonBody(request) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let size = 0;
		request.on("data", (chunk) => {
			size += chunk.length;
			if (size > MAX_BODY_BYTES) {
				reject(new Error("request body is too large"));
				request.destroy();
				return;
			}
			chunks.push(chunk);
		});
		request.on("error", reject);
		request.on("end", () => {
			try {
				resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
			} catch (error) {
				reject(new Error("request body is not JSON: " + messageOf(error)));
			}
		});
	});
}
/**
 * Options for the opener process. `windowsHide` must stay OUT of this object.
 *
 * libuv turns `windowsHide: true` into `STARTUPINFO.wShowWindow = SW_HIDE` plus
 * `STARTF_USESHOWWINDOW`, and a freshly spawned explorer.exe builds its window
 * with `SW_SHOWDEFAULT` — so the new folder window inherits SW_HIDE. What comes
 * out is a window that exists, carries the right selection, and is invisible:
 * the user sees nothing at all. Measured on this machine with the very command
 * this route runs, three ways: `windowsHide: true` → `IsWindowVisible` false;
 * `windowsHide: false` → true; option absent → true. The flag exists to hide the
 * console window of a *console* program, and explorer.exe is a GUI program, so
 * leaving it out costs nothing.
 */
export const REVEAL_EXEC_OPTIONS = Object.freeze({
	encoding: "utf8",
	timeout: COMMAND_TIMEOUT_MS
});
/**
 * Run one reveal, tolerating the opener's exit status 1: the file manager took
 * the job over, so a non-zero launcher exit is a handoff, not a failure.
 */
function runReveal(path) {
	return new Promise((resolve, reject) => {
		const { command, args } = revealCommand(path);
		execFile(command, args, REVEAL_EXEC_OPTIONS, (error, _stdout, stderr) => {
			if (error === null || error.code === 1) {
				resolve();
				return;
			}
			const detail = typeof stderr === "string" && stderr.trim() !== "" ? stderr.trim() : messageOf(error);
			reject(new Error(detail));
		});
	});
}
/**
 * Clear the two gates every route here shares, or answer and return null.
 *
 * Opportunistic on the trusted-host list: it only exists where the web runtime
 * was loaded, and `isTrustedRequest` is permissive on loopback alone.
 */
async function acceptJson(ctx, request, response) {
	let trustedHosts = [];
	try {
		trustedHosts = ctx.get("webRuntime")?.trustedHosts ?? [];
	} catch {}
	if (!isTrustedRequest(request, trustedHosts)) {
		writeJson(response, 403, {
			ok: false,
			error: "forbidden"
		});
		return null;
	}
	if (request.method !== "POST") {
		writeJson(response, 405, {
			ok: false,
			error: "method not allowed"
		});
		return null;
	}
	try {
		return await readJsonBody(request);
	} catch (error) {
		writeJson(response, 400, {
			ok: false,
			error: messageOf(error)
		});
		return null;
	}
}
/** The handler behind {@link REVEAL_ROUTE}. */
function revealHandler(ctx) {
	return async (request, response) => {
		const body = await acceptJson(ctx, request, response);
		if (body === null) return;
		const target = revealTargetOf(body?.path);
		if (target === null) {
			writeJson(response, 400, {
				ok: false,
				error: "path must be an existing absolute file path"
			});
			return;
		}
		try {
			await runReveal(target);
			writeJson(response, 200, {
				ok: true,
				path: target
			});
		} catch (error) {
			writeJson(response, 500, {
				ok: false,
				error: messageOf(error)
			});
		}
	};
}
/**
 * The handler behind {@link READ_ROUTE}: the client half's gutter fallback reads
 * the CURRENT file through this and locates a hunk's post-image in it, so a hunk
 * the host could not stamp (a PTC sub-call, whose result block carries no `meta`)
 * still gets a real line number. Answers 200 with a `kind` discriminator for
 * every outcome, so the client's `res.ok` path handles them all alike.
 */
function readHandler(ctx) {
	return async (request, response) => {
		const body = await acceptJson(ctx, request, response);
		if (body === null) return;
		try {
			writeJson(response, 200, {
				ok: true,
				...await readFencedText(String(body?.cwd ?? ""), String(body?.path ?? ""))
			});
		} catch (error) {
			writeJson(response, 200, {
				ok: false,
				kind: "error",
				error: messageOf(error)
			});
		}
	};
}
/**
 * Mount both host routes as soon as this deployment serves a web server. The
 * plugin itself loads unconditionally: a deployment without one (or a browser
 * half without these routes) keeps its own degradation chain, so an unserved
 * route is a supported state, not a failure. Gating the whole plugin on the
 * service instead would mean no reveal and no gutter fallback wherever the
 * server is absent.
 *
 * @param ctx - host plugin context.
 */
/** One line into the Host log, so a mount that never happened is visible from outside. */
function noteOf(ctx, level, message) {
	try {
		ctx.logger?.[level]?.(message);
	} catch {}
}
export function apply(ctx) {
	noteOf(ctx, "info", "[dsh-edit-diff] host half loaded");
	ctx.inject(["webServer"], (webCtx) => webCtx.effect(() => {
		const disposers = [];
		/** Register one route; a failure here must not take the other one down. */
		const mount = (path, handler, note) => {
			try {
				disposers.push(webCtx.webServer.register({
					kind: "exact",
					path,
					handler
				}));
				noteOf(ctx, "info", note);
			} catch (error) {
				noteOf(ctx, "error", "[dsh-edit-diff] " + path + " failed to mount: " + messageOf(error));
			}
		};
		mount(REVEAL_ROUTE, revealHandler(ctx), "[dsh-edit-diff] reveal route mounted at " + REVEAL_ROUTE);
		mount(READ_ROUTE, readHandler(ctx), "[dsh-edit-diff] read route mounted at " + READ_ROUTE);
		return () => {
			for (const dispose of disposers) {
				try {
					dispose();
				} catch {}
			}
		};
	}, "dsh-edit-diff: host routes"));
	// Diff anchors: the client half prints real file line numbers from the
	// `oldStart`/`newStart` this stamps into each settled hunk's wire meta. Optional
	// exactly like the routes — a deployment without the tools service keeps relative
	// numbering instead of failing to load.
	ctx.inject(["tools"], (toolsCtx) => {
		try {
			toolsCtx.effect(() => mountAnchors(toolsCtx.tools), "dsh-edit-diff: diff anchors");
			noteOf(ctx, "info", "[dsh-edit-diff] diff anchors mounted on edit/write");
		} catch (error) {
			noteOf(ctx, "error", "[dsh-edit-diff] diff anchors failed to mount: " + messageOf(error));
		}
	});
}
//#endregion
