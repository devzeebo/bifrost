import { CustomComparatorsRegistry } from './_at-vitest-browser.js';
export { defineBrowserCommand } from './_at-vitest-browser.js';
import { SelectorOptions, ScreenshotMatcherOptions, ScreenshotComparatorRegistry } from './browser.js';
import { BrowserProvider, TestProject, CDPSession, BrowserProviderOption } from './node.js';
import { ClickOptions, MoveToOptions, DragAndDropOptions, remote } from 'webdriverio';

declare const webdriverBrowsers: readonly ["firefox", "chrome", "edge", "safari"];
type WebdriverBrowser = (typeof webdriverBrowsers)[number];
interface WebdriverProviderOptions extends Partial<Parameters<typeof remote>[0]> {}
declare function webdriverio(options?: WebdriverProviderOptions): BrowserProviderOption<WebdriverProviderOptions>;
declare class WebdriverBrowserProvider implements BrowserProvider {
	name: "webdriverio";
	supportsParallelism: boolean;
	browser: WebdriverIO.Browser | null;
	private browserName;
	private project;
	private options?;
	private closing;
	private iframeSwitched;
	private topLevelContext;
	initScripts: string[];
	getSupportedBrowsers(): readonly string[];
	constructor(project: TestProject, options: WebdriverProviderOptions);
	isIframeSwitched(): boolean;
	switchToTestFrame(): Promise<void>;
	switchToMainFrame(): Promise<void>;
	setViewport(options: {
		width: number;
		height: number;
	}): Promise<void>;
	getCommandsContext(): {
		browser: WebdriverIO.Browser | null;
	};
	openBrowser(): Promise<WebdriverIO.Browser>;
	private buildCapabilities;
	openPage(sessionId: string, url: string): Promise<void>;
	private _throwIfClosing;
	close(): Promise<void>;
	getCDPSession(_sessionId: string): Promise<CDPSession>;
}
declare module './browser.js' {
	interface UserEventClickOptions extends Partial<ClickOptions>, SelectorOptions {}
	interface UserEventHoverOptions extends MoveToOptions, SelectorOptions {}
	interface UserEventDragAndDropOptions extends DragAndDropOptions {
		sourceX?: number;
		sourceY?: number;
		targetX?: number;
		targetY?: number;
	}
	interface UserEventFillOptions extends SelectorOptions {}
	interface UserEventSelectOptions extends SelectorOptions {}
	interface UserEventClearOptions extends SelectorOptions {}
	interface UserEventDoubleClickOptions extends SelectorOptions {}
	interface UserEventTripleClickOptions extends SelectorOptions {}
	interface UserEventWheelBaseOptions extends SelectorOptions {}
	interface LocatorScreenshotOptions extends SelectorOptions {}
}
interface WebdriverCDPSession {
	send: (method: string, params?: Record<string, unknown>) => Promise<unknown>;
	on: (event: string, listener: (...args: unknown[]) => void) => void;
	once: (event: string, listener: (...args: unknown[]) => void) => void;
	off: (event: string, listener: (...args: unknown[]) => void) => void;
}
declare module './node.js' {
	interface BrowserCommandContext {
		browser: WebdriverIO.Browser;
	}
	interface _BrowserNames {
		webdriverio: WebdriverBrowser;
	}
	interface ToMatchScreenshotOptions extends Omit<ScreenshotMatcherOptions, "comparatorName" | "comparatorOptions">, CustomComparatorsRegistry {}
	interface ToMatchScreenshotComparators extends ScreenshotComparatorRegistry {}
	interface CDPSession extends WebdriverCDPSession {}
}

export { WebdriverBrowserProvider, webdriverio };
export type { WebdriverProviderOptions };
