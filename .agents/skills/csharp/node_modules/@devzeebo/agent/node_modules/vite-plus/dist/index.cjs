const require_define_config = require("./define-config-WiVlryJ2.cjs");
//#region src/index.cts
const vite = require("@voidzero-dev/vite-plus-core");
const { configDefaults, coverageConfigDefaults, defaultBrowserPort, defaultExclude, defaultInclude } = require("vitest/config");
const { defineConfig, defineProject, lazyPlugins } = (require_define_config.init_define_config(), require_define_config.__toCommonJS(require_define_config.define_config_exports));
module.exports = {
	...vite,
	configDefaults,
	coverageConfigDefaults,
	defaultBrowserPort,
	defaultExclude,
	defaultInclude,
	defineProject,
	defineConfig,
	lazyPlugins
};
//#endregion
