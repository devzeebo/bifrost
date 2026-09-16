import { i as isWide, r as isFullWidth } from "./strip-ansi-C3wrWz9t.js";
//#region ../../node_modules/.pnpm/is-fullwidth-code-point@5.1.0/node_modules/is-fullwidth-code-point/index.js
function isFullwidthCodePoint(codePoint) {
	if (!Number.isInteger(codePoint)) return false;
	return isFullWidth(codePoint) || isWide(codePoint);
}
//#endregion
export { isFullwidthCodePoint as t };
