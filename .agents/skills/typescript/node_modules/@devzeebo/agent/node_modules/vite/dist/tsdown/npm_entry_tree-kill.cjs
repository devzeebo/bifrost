//#region ../../node_modules/.pnpm/tree-kill@1.2.2/node_modules/tree-kill/index.js
var require_tree_kill = /* @__PURE__ */ require("./npm_cjs_chunk_rolldown-runtime.cjs").__commonJSMin(((exports, module) => {
	var childProcess = require("child_process");
	var spawn = childProcess.spawn;
	var exec = childProcess.exec;
	module.exports = function(pid, signal, callback) {
		if (typeof signal === "function" && callback === void 0) {
			callback = signal;
			signal = void 0;
		}
		pid = parseInt(pid);
		if (Number.isNaN(pid)) {
			if (callback) return callback(/* @__PURE__ */ new Error("pid must be a number"));
			else throw new Error("pid must be a number");
		}
		var tree = {};
		var pidsToProcess = {};
		tree[pid] = [];
		pidsToProcess[pid] = 1;
		switch (process.platform) {
			case "win32":
				exec("taskkill /pid " + pid + " /T /F", callback);
				break;
			case "darwin":
				buildProcessTree(pid, tree, pidsToProcess, function(parentPid) {
					return spawn("pgrep", ["-P", parentPid]);
				}, function() {
					killAll(tree, signal, callback);
				});
				break;
			default: buildProcessTree(pid, tree, pidsToProcess, function(parentPid) {
				return spawn("ps", [
					"-o",
					"pid",
					"--no-headers",
					"--ppid",
					parentPid
				]);
			}, function() {
				killAll(tree, signal, callback);
			});
		}
	};
	function killAll(tree, signal, callback) {
		var killed = {};
		try {
			Object.keys(tree).forEach(function(pid) {
				tree[pid].forEach(function(pidpid) {
					if (!killed[pidpid]) {
						killPid(pidpid, signal);
						killed[pidpid] = 1;
					}
				});
				if (!killed[pid]) {
					killPid(pid, signal);
					killed[pid] = 1;
				}
			});
		} catch (err) {
			if (callback) return callback(err);
			else throw err;
		}
		if (callback) return callback();
	}
	function killPid(pid, signal) {
		try {
			process.kill(parseInt(pid, 10), signal);
		} catch (err) {
			if (err.code !== "ESRCH") throw err;
		}
	}
	function buildProcessTree(parentPid, tree, pidsToProcess, spawnChildProcessesList, cb) {
		var ps = spawnChildProcessesList(parentPid);
		var allData = "";
		ps.stdout.on("data", function(data) {
			var data = data.toString("ascii");
			allData += data;
		});
		var onClose = function(code) {
			delete pidsToProcess[parentPid];
			if (code != 0) {
				if (Object.keys(pidsToProcess).length == 0) cb();
				return;
			}
			allData.match(/\d+/g).forEach(function(pid) {
				pid = parseInt(pid, 10);
				tree[parentPid].push(pid);
				tree[pid] = [];
				pidsToProcess[pid] = 1;
				buildProcessTree(pid, tree, pidsToProcess, spawnChildProcessesList, cb);
			});
		};
		ps.on("close", onClose);
	}
}));
//#endregion
//#region dist/tsdown/_npm_entry_tree-kill.cjs
module.exports = require_tree_kill();
//#endregion
