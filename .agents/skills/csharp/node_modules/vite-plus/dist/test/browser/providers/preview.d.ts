import { SelectorOptions } from '../../browser.js';
import { BrowserProvider, TestProject, BrowserProviderOption } from '../../node.js';
export { defineBrowserCommand } from '../../_at-vitest-browser.js';

declare function preview(): BrowserProviderOption;
declare class PreviewBrowserProvider implements BrowserProvider {
	name: "preview";
	supportsParallelism: boolean;
	private project;
	private open;
	distRoot: string;
	initScripts: string[];
	constructor(project: TestProject);
	isOpen(): boolean;
	getCommandsContext(): {};
	openPage(_sessionId: string, url: string): Promise<void>;
	close(): Promise<void>;
}
declare module '../../browser.js' {
	interface UserEventClickOptions extends SelectorOptions {}
	interface UserEventHoverOptions extends SelectorOptions {}
	interface UserEventFillOptions extends SelectorOptions {}
	interface UserEventSelectOptions extends SelectorOptions {}
	interface UserEventClearOptions extends SelectorOptions {}
	interface UserEventDoubleClickOptions extends SelectorOptions {}
	interface UserEventTripleClickOptions extends SelectorOptions {}
	interface UserEventUploadOptions extends SelectorOptions {}
	interface UserEventWheelBaseOptions extends SelectorOptions {}
	interface LocatorScreenshotOptions extends SelectorOptions {}
}

export { PreviewBrowserProvider, preview };
