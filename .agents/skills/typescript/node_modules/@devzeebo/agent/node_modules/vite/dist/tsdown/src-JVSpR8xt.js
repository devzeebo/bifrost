import { D as __commonJSMin, k as __require } from "./main-Bcv7jU2b.js";
//#region ../../node_modules/.pnpm/lilconfig@3.1.3/node_modules/lilconfig/src/index.js
var require_src$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const path = __require("path");
	const fs = __require("fs");
	const os = __require("os");
	const url = __require("url");
	const fsReadFileAsync = fs.promises.readFile;
	/** @type {(name: string, sync: boolean) => string[]} */
	function getDefaultSearchPlaces(name, sync) {
		return [
			"package.json",
			`.${name}rc.json`,
			`.${name}rc.js`,
			`.${name}rc.cjs`,
			...sync ? [] : [`.${name}rc.mjs`],
			`.config/${name}rc`,
			`.config/${name}rc.json`,
			`.config/${name}rc.js`,
			`.config/${name}rc.cjs`,
			...sync ? [] : [`.config/${name}rc.mjs`],
			`${name}.config.js`,
			`${name}.config.cjs`,
			...sync ? [] : [`${name}.config.mjs`]
		];
	}
	/**
	* @type {(p: string) => string}
	*
	* see #17
	* On *nix, if cwd is not under homedir,
	* the last path will be '', ('/build' -> '')
	* but it should be '/' actually.
	* And on Windows, this will never happen. ('C:\build' -> 'C:')
	*/
	function parentDir(p) {
		return path.dirname(p) || path.sep;
	}
	/** @type {import('./index').LoaderSync} */
	const jsonLoader = (_, content) => JSON.parse(content);
	const requireFunc = typeof __webpack_require__ === "function" ? __non_webpack_require__ : __require;
	/** @type {import('./index').LoadersSync} */
	const defaultLoadersSync = Object.freeze({
		".js": requireFunc,
		".json": requireFunc,
		".cjs": requireFunc,
		noExt: jsonLoader
	});
	module.exports.defaultLoadersSync = defaultLoadersSync;
	/** @type {import('./index').Loader} */
	const dynamicImport = async (id) => {
		try {
			return (await import(
				/* webpackIgnore: true */
				url.pathToFileURL(id).href
)).default;
		} catch (e) {
			try {
				return requireFunc(id);
			} catch (requireE) {
				if (requireE.code === "ERR_REQUIRE_ESM" || requireE instanceof SyntaxError && requireE.toString().includes("Cannot use import statement outside a module")) throw e;
				throw requireE;
			}
		}
	};
	/** @type {import('./index').Loaders} */
	const defaultLoaders = Object.freeze({
		".js": dynamicImport,
		".mjs": dynamicImport,
		".cjs": dynamicImport,
		".json": jsonLoader,
		noExt: jsonLoader
	});
	module.exports.defaultLoaders = defaultLoaders;
	/**
	* @param {string} name
	* @param {import('./index').Options | import('./index').OptionsSync} options
	* @param {boolean} sync
	* @returns {Required<import('./index').Options | import('./index').OptionsSync>}
	*/
	function getOptions(name, options, sync) {
		/** @type {Required<import('./index').Options>} */
		const conf = {
			stopDir: os.homedir(),
			searchPlaces: getDefaultSearchPlaces(name, sync),
			ignoreEmptySearchPlaces: true,
			cache: true,
			transform: (x) => x,
			packageProp: [name],
			...options,
			loaders: {
				...sync ? defaultLoadersSync : defaultLoaders,
				...options.loaders
			}
		};
		conf.searchPlaces.forEach((place) => {
			const key = path.extname(place) || "noExt";
			const loader = conf.loaders[key];
			if (!loader) throw new Error(`Missing loader for extension "${place}"`);
			if (typeof loader !== "function") throw new Error(`Loader for extension "${place}" is not a function: Received ${typeof loader}.`);
		});
		return conf;
	}
	/** @type {(props: string | string[], obj: Record<string, any>) => unknown} */
	function getPackageProp(props, obj) {
		if (typeof props === "string" && props in obj) return obj[props];
		return (Array.isArray(props) ? props : props.split(".")).reduce((acc, prop) => acc === void 0 ? acc : acc[prop], obj) || null;
	}
	/** @param {string} filepath */
	function validateFilePath(filepath) {
		if (!filepath) throw new Error("load must pass a non-empty string");
	}
	/** @type {(loader: import('./index').Loader, ext: string) => void} */
	function validateLoader(loader, ext) {
		if (!loader) throw new Error(`No loader specified for extension "${ext}"`);
		if (typeof loader !== "function") throw new Error("loader is not a function");
	}
	/** @type {(enableCache: boolean) => <T>(c: Map<string, T>, filepath: string, res: T) => T} */
	const makeEmplace = (enableCache) => (c, filepath, res) => {
		if (enableCache) c.set(filepath, res);
		return res;
	};
	/** @type {import('./index').lilconfig} */
	module.exports.lilconfig = function lilconfig(name, options) {
		const { ignoreEmptySearchPlaces, loaders, packageProp, searchPlaces, stopDir, transform, cache } = getOptions(name, options ?? {}, false);
		const searchCache = /* @__PURE__ */ new Map();
		const loadCache = /* @__PURE__ */ new Map();
		const emplace = makeEmplace(cache);
		return {
			async search(searchFrom = process.cwd()) {
				/** @type {import('./index').LilconfigResult} */
				const result = {
					config: null,
					filepath: ""
				};
				/** @type {Set<string>} */
				const visited = /* @__PURE__ */ new Set();
				let dir = searchFrom;
				dirLoop: while (true) {
					if (cache) {
						const r = searchCache.get(dir);
						if (r !== void 0) {
							for (const p of visited) searchCache.set(p, r);
							return r;
						}
						visited.add(dir);
					}
					for (const searchPlace of searchPlaces) {
						const filepath = path.join(dir, searchPlace);
						try {
							await fs.promises.access(filepath);
						} catch {
							continue;
						}
						const content = String(await fsReadFileAsync(filepath));
						const loaderKey = path.extname(searchPlace) || "noExt";
						const loader = loaders[loaderKey];
						if (searchPlace === "package.json") {
							const pkg = await loader(filepath, content);
							const maybeConfig = getPackageProp(packageProp, pkg);
							if (maybeConfig != null) {
								result.config = maybeConfig;
								result.filepath = filepath;
								break dirLoop;
							}
							continue;
						}
						const isEmpty = content.trim() === "";
						if (isEmpty && ignoreEmptySearchPlaces) continue;
						if (isEmpty) {
							result.isEmpty = true;
							result.config = void 0;
						} else {
							validateLoader(loader, loaderKey);
							result.config = await loader(filepath, content);
						}
						result.filepath = filepath;
						break dirLoop;
					}
					if (dir === stopDir || dir === parentDir(dir)) break dirLoop;
					dir = parentDir(dir);
				}
				const transformed = result.filepath === "" && result.config === null ? transform(null) : transform(result);
				if (cache) for (const p of visited) searchCache.set(p, transformed);
				return transformed;
			},
			async load(filepath) {
				validateFilePath(filepath);
				const absPath = path.resolve(process.cwd(), filepath);
				if (cache && loadCache.has(absPath)) return loadCache.get(absPath);
				const { base, ext } = path.parse(absPath);
				const loaderKey = ext || "noExt";
				const loader = loaders[loaderKey];
				validateLoader(loader, loaderKey);
				const content = String(await fsReadFileAsync(absPath));
				if (base === "package.json") {
					const pkg = await loader(absPath, content);
					return emplace(loadCache, absPath, transform({
						config: getPackageProp(packageProp, pkg),
						filepath: absPath
					}));
				}
				/** @type {import('./index').LilconfigResult} */
				const result = {
					config: null,
					filepath: absPath
				};
				const isEmpty = content.trim() === "";
				if (isEmpty && ignoreEmptySearchPlaces) return emplace(loadCache, absPath, transform({
					config: void 0,
					filepath: absPath,
					isEmpty: true
				}));
				result.config = isEmpty ? void 0 : await loader(absPath, content);
				return emplace(loadCache, absPath, transform(isEmpty ? {
					...result,
					isEmpty,
					config: void 0
				} : result));
			},
			clearLoadCache() {
				if (cache) loadCache.clear();
			},
			clearSearchCache() {
				if (cache) searchCache.clear();
			},
			clearCaches() {
				if (cache) {
					loadCache.clear();
					searchCache.clear();
				}
			}
		};
	};
	/** @type {import('./index').lilconfigSync} */
	module.exports.lilconfigSync = function lilconfigSync(name, options) {
		const { ignoreEmptySearchPlaces, loaders, packageProp, searchPlaces, stopDir, transform, cache } = getOptions(name, options ?? {}, true);
		const searchCache = /* @__PURE__ */ new Map();
		const loadCache = /* @__PURE__ */ new Map();
		const emplace = makeEmplace(cache);
		return {
			search(searchFrom = process.cwd()) {
				/** @type {import('./index').LilconfigResult} */
				const result = {
					config: null,
					filepath: ""
				};
				/** @type {Set<string>} */
				const visited = /* @__PURE__ */ new Set();
				let dir = searchFrom;
				dirLoop: while (true) {
					if (cache) {
						const r = searchCache.get(dir);
						if (r !== void 0) {
							for (const p of visited) searchCache.set(p, r);
							return r;
						}
						visited.add(dir);
					}
					for (const searchPlace of searchPlaces) {
						const filepath = path.join(dir, searchPlace);
						try {
							fs.accessSync(filepath);
						} catch {
							continue;
						}
						const loaderKey = path.extname(searchPlace) || "noExt";
						const loader = loaders[loaderKey];
						const content = String(fs.readFileSync(filepath));
						if (searchPlace === "package.json") {
							const pkg = loader(filepath, content);
							const maybeConfig = getPackageProp(packageProp, pkg);
							if (maybeConfig != null) {
								result.config = maybeConfig;
								result.filepath = filepath;
								break dirLoop;
							}
							continue;
						}
						const isEmpty = content.trim() === "";
						if (isEmpty && ignoreEmptySearchPlaces) continue;
						if (isEmpty) {
							result.isEmpty = true;
							result.config = void 0;
						} else {
							validateLoader(loader, loaderKey);
							result.config = loader(filepath, content);
						}
						result.filepath = filepath;
						break dirLoop;
					}
					if (dir === stopDir || dir === parentDir(dir)) break dirLoop;
					dir = parentDir(dir);
				}
				const transformed = result.filepath === "" && result.config === null ? transform(null) : transform(result);
				if (cache) for (const p of visited) searchCache.set(p, transformed);
				return transformed;
			},
			load(filepath) {
				validateFilePath(filepath);
				const absPath = path.resolve(process.cwd(), filepath);
				if (cache && loadCache.has(absPath)) return loadCache.get(absPath);
				const { base, ext } = path.parse(absPath);
				const loaderKey = ext || "noExt";
				const loader = loaders[loaderKey];
				validateLoader(loader, loaderKey);
				const content = String(fs.readFileSync(absPath));
				if (base === "package.json") {
					const pkg = loader(absPath, content);
					return transform({
						config: getPackageProp(packageProp, pkg),
						filepath: absPath
					});
				}
				const result = {
					config: null,
					filepath: absPath
				};
				const isEmpty = content.trim() === "";
				if (isEmpty && ignoreEmptySearchPlaces) return emplace(loadCache, absPath, transform({
					filepath: absPath,
					config: void 0,
					isEmpty: true
				}));
				result.config = isEmpty ? void 0 : loader(absPath, content);
				return emplace(loadCache, absPath, transform(isEmpty ? {
					...result,
					isEmpty,
					config: void 0
				} : result));
			},
			clearLoadCache() {
				if (cache) loadCache.clear();
			},
			clearSearchCache() {
				if (cache) searchCache.clear();
			},
			clearCaches() {
				if (cache) {
					loadCache.clear();
					searchCache.clear();
				}
			}
		};
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/postcss-load-config@6.0.1_jiti@2.7.0_postcss@8.5.26_tsx@4.23.12_yaml@2.9.0/node_modules/postcss-load-config/src/req.js
var require_req = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const { createRequire } = __require("node:module");
	const { pathToFileURL } = __require("node:url");
	const TS_EXT_RE = /\.[mc]?ts$/;
	let tsx;
	let jiti;
	let importError = [];
	/**
	* @param {string} name
	* @param {string} rootFile
	* @returns {Promise<any>}
	*/
	async function req(name, rootFile = __filename) {
		let url = createRequire(rootFile).resolve(name);
		try {
			return (await import(`${pathToFileURL(url)}?t=${Date.now()}`)).default;
		} catch (err) {
			if (!TS_EXT_RE.test(url))
 /* c8 ignore start */
			throw err;
		}
		if (tsx === void 0) try {
			tsx = await import("tsx/cjs/api");
		} catch (error) {
			importError.push(error);
		}
		if (tsx) {
			let loaded = tsx.require(name, rootFile);
			return loaded && "__esModule" in loaded ? loaded.default : loaded;
		}
		if (jiti === void 0) try {
			jiti = (await import("jiti")).default;
		} catch (error) {
			importError.push(error);
		}
		if (jiti) return jiti(rootFile, { interopDefault: true })(name);
		throw new Error(`'tsx' or 'jiti' is required for the TypeScript configuration files. Make sure it is installed\nError: ${importError.map((error) => error.message).join("\n")}`);
	}
	module.exports = req;
}));
//#endregion
//#region ../../node_modules/.pnpm/postcss-load-config@6.0.1_jiti@2.7.0_postcss@8.5.26_tsx@4.23.12_yaml@2.9.0/node_modules/postcss-load-config/src/options.js
var require_options = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const req = require_req();
	/**
	* Load Options
	*
	* @private
	* @method options
	*
	* @param  {Object} config  PostCSS Config
	*
	* @return {Promise<Object>} options PostCSS Options
	*/
	async function options(config, file) {
		if (config.parser && typeof config.parser === "string") try {
			config.parser = await req(config.parser, file);
		} catch (err) {
			throw new Error(`Loading PostCSS Parser failed: ${err.message}\n\n(@${file})`);
		}
		if (config.syntax && typeof config.syntax === "string") try {
			config.syntax = await req(config.syntax, file);
		} catch (err) {
			throw new Error(`Loading PostCSS Syntax failed: ${err.message}\n\n(@${file})`);
		}
		if (config.stringifier && typeof config.stringifier === "string") try {
			config.stringifier = await req(config.stringifier, file);
		} catch (err) {
			throw new Error(`Loading PostCSS Stringifier failed: ${err.message}\n\n(@${file})`);
		}
		return config;
	}
	module.exports = options;
}));
//#endregion
//#region ../../node_modules/.pnpm/postcss-load-config@6.0.1_jiti@2.7.0_postcss@8.5.26_tsx@4.23.12_yaml@2.9.0/node_modules/postcss-load-config/src/plugins.js
var require_plugins = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const req = require_req();
	/**
	* Plugin Loader
	*
	* @private
	* @method load
	*
	* @param  {String} plugin PostCSS Plugin Name
	* @param  {Object} options PostCSS Plugin Options
	*
	* @return {Promise<Function>} PostCSS Plugin
	*/
	async function load(plugin, options, file) {
		try {
			if (options === null || options === void 0 || Object.keys(options).length === 0) return await req(plugin, file);
			else return (await req(plugin, file))(options);
		} catch (err) {
			throw new Error(`Loading PostCSS Plugin failed: ${err.message}\n\n(@${file})`);
		}
	}
	/**
	* Load Plugins
	*
	* @private
	* @method plugins
	*
	* @param {Object} config PostCSS Config Plugins
	*
	* @return {Promise<Array>} plugins PostCSS Plugins
	*/
	async function plugins(config, file) {
		let list = [];
		if (Array.isArray(config.plugins)) list = config.plugins.filter(Boolean);
		else {
			list = Object.entries(config.plugins).filter(([, options]) => {
				return options !== false;
			}).map(([plugin, options]) => {
				return load(plugin, options, file);
			});
			list = await Promise.all(list);
		}
		if (list.length && list.length > 0) list.forEach((plugin, i) => {
			if (plugin.default) plugin = plugin.default;
			if (plugin.postcss === true) plugin = plugin();
			else if (plugin.postcss) plugin = plugin.postcss;
			if (!(typeof plugin === "object" && Array.isArray(plugin.plugins) || typeof plugin === "object" && plugin.postcssPlugin || typeof plugin === "function")) throw new TypeError(`Invalid PostCSS Plugin found at: plugins[${i}]\n\n(@${file})`);
		});
		return list;
	}
	module.exports = plugins;
}));
//#endregion
//#region ../../node_modules/.pnpm/postcss-load-config@6.0.1_jiti@2.7.0_postcss@8.5.26_tsx@4.23.12_yaml@2.9.0/node_modules/postcss-load-config/src/index.js
var require_src = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const { resolve } = __require("node:path");
	const config = require_src$1();
	const loadOptions = require_options();
	const loadPlugins = require_plugins();
	const req = require_req();
	const interopRequireDefault = (obj) => obj && obj.__esModule ? obj : { default: obj };
	/**
	* Process the result from cosmiconfig
	*
	* @param  {Object} ctx Config Context
	* @param  {Object} result Cosmiconfig result
	*
	* @return {Promise<Object>} PostCSS Config
	*/
	async function processResult(ctx, result) {
		let file = result.filepath || "";
		let projectConfig = interopRequireDefault(result.config).default || {};
		if (typeof projectConfig === "function") projectConfig = projectConfig(ctx);
		else projectConfig = Object.assign({}, projectConfig, ctx);
		if (!projectConfig.plugins) projectConfig.plugins = [];
		let res = {
			file,
			options: await loadOptions(projectConfig, file),
			plugins: await loadPlugins(projectConfig, file)
		};
		delete projectConfig.plugins;
		return res;
	}
	/**
	* Builds the Config Context
	*
	* @param  {Object} ctx Config Context
	*
	* @return {Object} Config Context
	*/
	function createContext(ctx) {
		/**
		* @type {Object}
		*
		* @prop {String} cwd=process.cwd() Config search start location
		* @prop {String} env=process.env.NODE_ENV Config Enviroment, will be set to `development` by `postcss-load-config` if `process.env.NODE_ENV` is `undefined`
		*/
		ctx = Object.assign({
			cwd: process.cwd(),
			env: process.env.NODE_ENV
		}, ctx);
		if (!ctx.env) process.env.NODE_ENV = "development";
		return ctx;
	}
	async function loader(filepath) {
		return req(filepath);
	}
	let yaml;
	async function yamlLoader(_, content) {
		if (!yaml) try {
			yaml = await import("yaml");
		} catch (e) {
			/* c8 ignore start */
			throw new Error(`'yaml' is required for the YAML configuration files. Make sure it is installed\nError: ${e.message}`);
		}
		return yaml.parse(content);
	}
	/** @return {import('lilconfig').Options} */
	const withLoaders = (options = {}) => {
		let moduleName = "postcss";
		return {
			...options,
			loaders: {
				...options.loaders,
				".cjs": loader,
				".cts": loader,
				".js": loader,
				".mjs": loader,
				".mts": loader,
				".ts": loader,
				".yaml": yamlLoader,
				".yml": yamlLoader
			},
			searchPlaces: [
				...options.searchPlaces || [],
				"package.json",
				`.${moduleName}rc`,
				`.${moduleName}rc.json`,
				`.${moduleName}rc.yaml`,
				`.${moduleName}rc.yml`,
				`.${moduleName}rc.ts`,
				`.${moduleName}rc.cts`,
				`.${moduleName}rc.mts`,
				`.${moduleName}rc.js`,
				`.${moduleName}rc.cjs`,
				`.${moduleName}rc.mjs`,
				`${moduleName}.config.ts`,
				`${moduleName}.config.cts`,
				`${moduleName}.config.mts`,
				`${moduleName}.config.js`,
				`${moduleName}.config.cjs`,
				`${moduleName}.config.mjs`
			]
		};
	};
	/**
	* Load Config
	*
	* @method rc
	*
	* @param  {Object} ctx Config Context
	* @param  {String} path Config Path
	* @param  {Object} options Config Options
	*
	* @return {Promise} config PostCSS Config
	*/
	function rc(ctx, path, options) {
		/**
		* @type {Object} The full Config Context
		*/
		ctx = createContext(ctx);
		/**
		* @type {String} `process.cwd()`
		*/
		path = path ? resolve(path) : process.cwd();
		return config.lilconfig("postcss", withLoaders(options)).search(path).then((result) => {
			if (!result) throw new Error(`No PostCSS Config found in: ${path}`);
			return processResult(ctx, result);
		});
	}
	/**
	* Autoload Config for PostCSS
	*
	* @author Michael Ciniawsky @michael-ciniawsky <michael.ciniawsky@gmail.com>
	* @license MIT
	*
	* @module postcss-load-config
	* @version 2.1.0
	*
	* @requires comsiconfig
	* @requires ./options
	* @requires ./plugins
	*/
	module.exports = rc;
}));
//#endregion
export default require_src();
export {};
