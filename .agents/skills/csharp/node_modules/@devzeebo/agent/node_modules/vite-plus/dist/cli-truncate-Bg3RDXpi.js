import { a as ansiStyles, n as eastAsianWidth, t as stripAnsi } from "./strip-ansi-C3wrWz9t.js";
import { t as isFullwidthCodePoint } from "./is-fullwidth-code-point-BUNlIICg.js";
//#region ../../node_modules/.pnpm/slice-ansi@8.0.0/node_modules/slice-ansi/tokenize-ansi.js
const ESCAPE_CODE_POINT = 27;
const C1_DCS_CODE_POINT = 144;
const C1_SOS_CODE_POINT = 152;
const C1_CSI_CODE_POINT = 155;
const C1_ST_CODE_POINT = 156;
const C1_OSC_CODE_POINT = 157;
const C1_PM_CODE_POINT = 158;
const C1_APC_CODE_POINT = 159;
const ESCAPES = /* @__PURE__ */ new Set([
	ESCAPE_CODE_POINT,
	C1_DCS_CODE_POINT,
	C1_SOS_CODE_POINT,
	C1_CSI_CODE_POINT,
	C1_ST_CODE_POINT,
	C1_OSC_CODE_POINT,
	C1_PM_CODE_POINT,
	C1_APC_CODE_POINT
]);
const ESCAPE = "\x1B";
const ANSI_BELL = "\x07";
const ANSI_CSI = "[";
const ANSI_OSC = "]";
const ANSI_DCS = "P";
const ANSI_SOS = "X";
const ANSI_PM = "^";
const ANSI_APC = "_";
const ANSI_SGR_TERMINATOR = "m";
const ANSI_OSC_TERMINATOR = "\\";
const ANSI_STRING_TERMINATOR = `${ESCAPE}${ANSI_OSC_TERMINATOR}`;
const C1_OSC = "";
const C1_STRING_TERMINATOR = "";
const ANSI_HYPERLINK_ESC_PREFIX = `${ESCAPE}${ANSI_OSC}8;`;
const ANSI_HYPERLINK_C1_PREFIX = `${C1_OSC}8;`;
const ANSI_HYPERLINK_ESC_CLOSE = `${ANSI_HYPERLINK_ESC_PREFIX};`;
const ANSI_HYPERLINK_C1_CLOSE = `${ANSI_HYPERLINK_C1_PREFIX};`;
const CODE_POINT_0 = "0".codePointAt(0);
const CODE_POINT_9 = "9".codePointAt(0);
const CODE_POINT_SEMICOLON = ";".codePointAt(0);
const CODE_POINT_COLON = ":".codePointAt(0);
const CODE_POINT_CSI_PARAMETER_START = "0".codePointAt(0);
const CODE_POINT_CSI_PARAMETER_END = "?".codePointAt(0);
const CODE_POINT_CSI_INTERMEDIATE_START = " ".codePointAt(0);
const CODE_POINT_CSI_INTERMEDIATE_END = "/".codePointAt(0);
const CODE_POINT_CSI_FINAL_START = "@".codePointAt(0);
const CODE_POINT_CSI_FINAL_END = "~".codePointAt(0);
const REGIONAL_INDICATOR_SYMBOL_LETTER_A = 127462;
const REGIONAL_INDICATOR_SYMBOL_LETTER_Z = 127487;
const SGR_RESET_CODE = 0;
const SGR_EXTENDED_FOREGROUND_CODE = 38;
const SGR_DEFAULT_FOREGROUND_CODE = 39;
const SGR_EXTENDED_BACKGROUND_CODE = 48;
const SGR_DEFAULT_BACKGROUND_CODE = 49;
const SGR_COLOR_TYPE_ANSI_256 = 5;
const SGR_COLOR_TYPE_TRUECOLOR = 2;
const SGR_ANSI_256_FRAGMENT_LENGTH = 3;
const SGR_TRUECOLOR_FRAGMENT_LENGTH = 5;
const SGR_ANSI_256_LAST_PARAMETER_OFFSET = 2;
const SGR_TRUECOLOR_LAST_PARAMETER_OFFSET = 4;
const VARIATION_SELECTOR_16_CODE_POINT = 65039;
const COMBINING_ENCLOSING_KEYCAP_CODE_POINT = 8419;
const EMOJI_PRESENTATION_GRAPHEME_REGEX = /\p{Emoji_Presentation}/u;
const GRAPHEME_SEGMENTER = new Intl.Segmenter(void 0, { granularity: "grapheme" });
const endCodeNumbers = /* @__PURE__ */ new Set();
for (const [, end] of ansiStyles.codes) endCodeNumbers.add(end);
function isSgrParameterCharacter(codePoint) {
	return codePoint >= CODE_POINT_0 && codePoint <= CODE_POINT_9 || codePoint === CODE_POINT_SEMICOLON || codePoint === CODE_POINT_COLON;
}
function isCsiParameterCharacter(codePoint) {
	return codePoint >= CODE_POINT_CSI_PARAMETER_START && codePoint <= CODE_POINT_CSI_PARAMETER_END;
}
function isCsiIntermediateCharacter(codePoint) {
	return codePoint >= CODE_POINT_CSI_INTERMEDIATE_START && codePoint <= CODE_POINT_CSI_INTERMEDIATE_END;
}
function isCsiFinalCharacter(codePoint) {
	return codePoint >= CODE_POINT_CSI_FINAL_START && codePoint <= CODE_POINT_CSI_FINAL_END;
}
function isRegionalIndicatorCodePoint(codePoint) {
	return codePoint >= REGIONAL_INDICATOR_SYMBOL_LETTER_A && codePoint <= REGIONAL_INDICATOR_SYMBOL_LETTER_Z;
}
function createControlParseResult(code, endIndex) {
	return {
		token: {
			type: "control",
			code
		},
		endIndex
	};
}
function isEmojiStyleGrapheme(grapheme) {
	if (EMOJI_PRESENTATION_GRAPHEME_REGEX.test(grapheme)) return true;
	for (const character of grapheme) {
		const codePoint = character.codePointAt(0);
		if (codePoint === VARIATION_SELECTOR_16_CODE_POINT || codePoint === COMBINING_ENCLOSING_KEYCAP_CODE_POINT) return true;
	}
	return false;
}
function getGraphemeWidth(grapheme) {
	let regionalIndicatorCount = 0;
	for (const character of grapheme) {
		const codePoint = character.codePointAt(0);
		if (isFullwidthCodePoint(codePoint)) return 2;
		if (isRegionalIndicatorCodePoint(codePoint)) regionalIndicatorCount++;
	}
	if (regionalIndicatorCount >= 1) return 2;
	if (isEmojiStyleGrapheme(grapheme)) return 2;
	return 1;
}
function getSgrPrefix(code) {
	if (code.startsWith("")) return "";
	return `${ESCAPE}${ANSI_CSI}`;
}
function createSgrCode(prefix, values) {
	return `${prefix}${values.join(";")}${ANSI_SGR_TERMINATOR}`;
}
function getSgrFragments(code) {
	const fragments = [];
	const sgrPrefix = getSgrPrefix(code);
	let parameterString;
	if (code.startsWith(`${ESCAPE}${ANSI_CSI}`)) parameterString = code.slice(2, -1);
	else if (code.startsWith("")) parameterString = code.slice(1, -1);
	else return fragments;
	const rawCodes = parameterString.length === 0 ? [String(SGR_RESET_CODE)] : parameterString.split(";");
	let index = 0;
	while (index < rawCodes.length) {
		const codeNumber = Number.parseInt(rawCodes[index], 10);
		if (Number.isNaN(codeNumber)) {
			index++;
			continue;
		}
		if (codeNumber === SGR_RESET_CODE) {
			fragments.push({ type: "reset" });
			index++;
			continue;
		}
		if (codeNumber === SGR_EXTENDED_FOREGROUND_CODE || codeNumber === SGR_EXTENDED_BACKGROUND_CODE) {
			const colorType = Number.parseInt(rawCodes[index + 1], 10);
			if (colorType === SGR_COLOR_TYPE_ANSI_256 && index + SGR_ANSI_256_LAST_PARAMETER_OFFSET < rawCodes.length) {
				const openCode = createSgrCode(sgrPrefix, rawCodes.slice(index, index + SGR_ANSI_256_FRAGMENT_LENGTH));
				fragments.push({
					type: "start",
					code: openCode,
					endCode: ansiStyles.color.ansi(codeNumber === SGR_EXTENDED_FOREGROUND_CODE ? SGR_DEFAULT_FOREGROUND_CODE : SGR_DEFAULT_BACKGROUND_CODE)
				});
				index += SGR_ANSI_256_FRAGMENT_LENGTH;
				continue;
			}
			if (colorType === SGR_COLOR_TYPE_TRUECOLOR && index + SGR_TRUECOLOR_LAST_PARAMETER_OFFSET < rawCodes.length) {
				const openCode = createSgrCode(sgrPrefix, rawCodes.slice(index, index + SGR_TRUECOLOR_FRAGMENT_LENGTH));
				fragments.push({
					type: "start",
					code: openCode,
					endCode: ansiStyles.color.ansi(codeNumber === SGR_EXTENDED_FOREGROUND_CODE ? SGR_DEFAULT_FOREGROUND_CODE : SGR_DEFAULT_BACKGROUND_CODE)
				});
				index += SGR_TRUECOLOR_FRAGMENT_LENGTH;
				continue;
			}
			const openCode = createSgrCode(sgrPrefix, [rawCodes[index]]);
			fragments.push({
				type: "start",
				code: openCode,
				endCode: ansiStyles.color.ansi(codeNumber === SGR_EXTENDED_FOREGROUND_CODE ? SGR_DEFAULT_FOREGROUND_CODE : SGR_DEFAULT_BACKGROUND_CODE)
			});
			index++;
			continue;
		}
		if (endCodeNumbers.has(codeNumber)) {
			fragments.push({
				type: "end",
				endCode: ansiStyles.color.ansi(codeNumber)
			});
			index++;
			continue;
		}
		const mappedEndCode = ansiStyles.codes.get(codeNumber);
		if (mappedEndCode !== void 0) {
			const openCode = createSgrCode(sgrPrefix, [rawCodes[index]]);
			fragments.push({
				type: "start",
				code: openCode,
				endCode: ansiStyles.color.ansi(mappedEndCode)
			});
			index++;
			continue;
		}
		const openCode = createSgrCode(sgrPrefix, [rawCodes[index]]);
		fragments.push({
			type: "start",
			code: openCode,
			endCode: ansiStyles.reset.open
		});
		index++;
	}
	if (fragments.length === 0) fragments.push({ type: "reset" });
	return fragments;
}
function parseCsiCode(string, index) {
	const escapeCodePoint = string.codePointAt(index);
	let sequenceStartIndex;
	if (escapeCodePoint === ESCAPE_CODE_POINT) {
		if (string[index + 1] !== ANSI_CSI) return;
		sequenceStartIndex = index + 2;
	} else if (escapeCodePoint === C1_CSI_CODE_POINT) sequenceStartIndex = index + 1;
	else return;
	let hasCanonicalSgrParameters = true;
	for (let sequenceIndex = sequenceStartIndex; sequenceIndex < string.length; sequenceIndex++) {
		const codePoint = string.codePointAt(sequenceIndex);
		if (isCsiFinalCharacter(codePoint)) {
			const code = string.slice(index, sequenceIndex + 1);
			if (string[sequenceIndex] !== ANSI_SGR_TERMINATOR || !hasCanonicalSgrParameters) return createControlParseResult(code, sequenceIndex + 1);
			return {
				token: {
					type: "sgr",
					code,
					fragments: getSgrFragments(code)
				},
				endIndex: sequenceIndex + 1
			};
		}
		if (isCsiParameterCharacter(codePoint)) {
			if (!isSgrParameterCharacter(codePoint)) hasCanonicalSgrParameters = false;
			continue;
		}
		if (isCsiIntermediateCharacter(codePoint)) {
			hasCanonicalSgrParameters = false;
			continue;
		}
		const endIndex = sequenceIndex;
		return createControlParseResult(string.slice(index, endIndex), endIndex);
	}
	return createControlParseResult(string.slice(index), string.length);
}
function parseHyperlinkCode(string, index) {
	let hyperlinkPrefix;
	let hyperlinkClose;
	const codePoint = string.codePointAt(index);
	if (codePoint === ESCAPE_CODE_POINT && string.startsWith(ANSI_HYPERLINK_ESC_PREFIX, index)) {
		hyperlinkPrefix = ANSI_HYPERLINK_ESC_PREFIX;
		hyperlinkClose = ANSI_HYPERLINK_ESC_CLOSE;
	} else if (codePoint === C1_OSC_CODE_POINT && string.startsWith(ANSI_HYPERLINK_C1_PREFIX, index)) {
		hyperlinkPrefix = ANSI_HYPERLINK_C1_PREFIX;
		hyperlinkClose = ANSI_HYPERLINK_C1_CLOSE;
	} else return;
	const uriStart = string.indexOf(";", index + hyperlinkPrefix.length);
	if (uriStart === -1) return createControlParseResult(string.slice(index), string.length);
	for (let sequenceIndex = uriStart + 1; sequenceIndex < string.length; sequenceIndex++) {
		const character = string[sequenceIndex];
		if (character === ANSI_BELL) return {
			token: {
				type: "hyperlink",
				code: string.slice(index, sequenceIndex + 1),
				action: sequenceIndex === uriStart + 1 ? "close" : "open",
				closePrefix: hyperlinkClose,
				terminator: ANSI_BELL
			},
			endIndex: sequenceIndex + 1
		};
		if (character === ESCAPE && string[sequenceIndex + 1] === ANSI_OSC_TERMINATOR) return {
			token: {
				type: "hyperlink",
				code: string.slice(index, sequenceIndex + 2),
				action: sequenceIndex === uriStart + 1 ? "close" : "open",
				closePrefix: hyperlinkClose,
				terminator: ANSI_STRING_TERMINATOR
			},
			endIndex: sequenceIndex + 2
		};
		if (character === C1_STRING_TERMINATOR) return {
			token: {
				type: "hyperlink",
				code: string.slice(index, sequenceIndex + 1),
				action: sequenceIndex === uriStart + 1 ? "close" : "open",
				closePrefix: hyperlinkClose,
				terminator: C1_STRING_TERMINATOR
			},
			endIndex: sequenceIndex + 1
		};
	}
	return createControlParseResult(string.slice(index), string.length);
}
function parseControlStringCode(string, index) {
	const codePoint = string.codePointAt(index);
	let sequenceStartIndex;
	let supportsBellTerminator = false;
	switch (codePoint) {
		case ESCAPE_CODE_POINT:
			switch (string[index + 1]) {
				case ANSI_OSC:
					sequenceStartIndex = index + 2;
					supportsBellTerminator = true;
					break;
				case ANSI_DCS:
				case ANSI_SOS:
				case ANSI_PM:
				case ANSI_APC:
					sequenceStartIndex = index + 2;
					break;
				case ANSI_OSC_TERMINATOR: return createControlParseResult(ANSI_STRING_TERMINATOR, index + 2);
				default: return;
			}
			break;
		case C1_OSC_CODE_POINT:
			sequenceStartIndex = index + 1;
			supportsBellTerminator = true;
			break;
		case C1_DCS_CODE_POINT:
		case C1_SOS_CODE_POINT:
		case C1_PM_CODE_POINT:
		case C1_APC_CODE_POINT:
			sequenceStartIndex = index + 1;
			break;
		case C1_ST_CODE_POINT: return createControlParseResult(C1_STRING_TERMINATOR, index + 1);
		default: return;
	}
	for (let sequenceIndex = sequenceStartIndex; sequenceIndex < string.length; sequenceIndex++) {
		if (supportsBellTerminator && string[sequenceIndex] === ANSI_BELL) return createControlParseResult(string.slice(index, sequenceIndex + 1), sequenceIndex + 1);
		if (string[sequenceIndex] === ESCAPE && string[sequenceIndex + 1] === ANSI_OSC_TERMINATOR) return createControlParseResult(string.slice(index, sequenceIndex + 2), sequenceIndex + 2);
		if (string[sequenceIndex] === C1_STRING_TERMINATOR) return createControlParseResult(string.slice(index, sequenceIndex + 1), sequenceIndex + 1);
	}
	return createControlParseResult(string.slice(index), string.length);
}
function parseAnsiCode(string, index) {
	const codePoint = string.codePointAt(index);
	if (codePoint === ESCAPE_CODE_POINT || codePoint === C1_OSC_CODE_POINT) {
		const hyperlinkCode = parseHyperlinkCode(string, index);
		if (hyperlinkCode) return hyperlinkCode;
	}
	const controlStringCode = parseControlStringCode(string, index);
	if (controlStringCode) return controlStringCode;
	return parseCsiCode(string, index);
}
function appendTrailingAnsiTokens(string, index, tokens) {
	while (index < string.length) {
		const nextCodePoint = string.codePointAt(index);
		if (!ESCAPES.has(nextCodePoint)) break;
		const escapeCode = parseAnsiCode(string, index);
		if (!escapeCode) break;
		tokens.push(escapeCode.token);
		index = escapeCode.endIndex;
	}
	return index;
}
function parseCharacterTokenWithRawSegmentation(string, index, graphemeSegments) {
	const segment = graphemeSegments.containing(index);
	if (!segment || segment.index !== index) return;
	return {
		token: {
			type: "character",
			value: segment.segment,
			visibleWidth: getGraphemeWidth(segment.segment),
			isGraphemeContinuation: false
		},
		endIndex: index + segment.segment.length
	};
}
function collectVisibleCharacters(string) {
	const visibleCharacters = [];
	let index = 0;
	while (index < string.length) {
		const codePoint = string.codePointAt(index);
		if (ESCAPES.has(codePoint)) {
			const code = parseAnsiCode(string, index);
			if (code) {
				index = code.endIndex;
				continue;
			}
		}
		const value = String.fromCodePoint(codePoint);
		visibleCharacters.push({
			value,
			visibleWidth: 1,
			isGraphemeContinuation: false
		});
		index += value.length;
	}
	return visibleCharacters;
}
function applyGraphemeMetadata(visibleCharacters) {
	if (visibleCharacters.length === 0) return;
	const visibleString = visibleCharacters.map(({ value }) => value).join("");
	const scalarOffsets = [];
	let scalarOffset = 0;
	for (const visibleCharacter of visibleCharacters) {
		scalarOffsets.push(scalarOffset);
		scalarOffset += visibleCharacter.value.length;
	}
	let scalarIndex = 0;
	for (const segment of GRAPHEME_SEGMENTER.segment(visibleString)) {
		while (scalarIndex < visibleCharacters.length && scalarOffsets[scalarIndex] < segment.index) scalarIndex++;
		let graphemeIndex = scalarIndex;
		let isFirstInGrapheme = true;
		while (graphemeIndex < visibleCharacters.length && scalarOffsets[graphemeIndex] < segment.index + segment.segment.length) {
			visibleCharacters[graphemeIndex].visibleWidth = isFirstInGrapheme ? getGraphemeWidth(segment.segment) : 0;
			visibleCharacters[graphemeIndex].isGraphemeContinuation = !isFirstInGrapheme;
			isFirstInGrapheme = false;
			graphemeIndex++;
		}
		scalarIndex = graphemeIndex;
	}
}
function tokenizeAnsiWithVisibleSegmentation(string, { endCharacter = Number.POSITIVE_INFINITY } = {}) {
	const tokens = [];
	const visibleCharacters = collectVisibleCharacters(string);
	applyGraphemeMetadata(visibleCharacters);
	let index = 0;
	let visibleCharacterIndex = 0;
	let visibleCount = 0;
	while (index < string.length) {
		const codePoint = string.codePointAt(index);
		if (ESCAPES.has(codePoint)) {
			const code = parseAnsiCode(string, index);
			if (code) {
				tokens.push(code.token);
				index = code.endIndex;
				continue;
			}
		}
		const value = String.fromCodePoint(codePoint);
		const visibleCharacter = visibleCharacters[visibleCharacterIndex];
		let visibleWidth = isFullwidthCodePoint(codePoint) ? 2 : value.length;
		if (visibleCharacter) visibleWidth = visibleCharacter.visibleWidth;
		const token = {
			type: "character",
			value,
			visibleWidth,
			isGraphemeContinuation: visibleCharacter ? visibleCharacter.isGraphemeContinuation : false
		};
		tokens.push(token);
		index += value.length;
		visibleCharacterIndex++;
		visibleCount += token.visibleWidth;
		if (visibleCount >= endCharacter) {
			const nextVisibleCharacter = visibleCharacters[visibleCharacterIndex];
			if (!nextVisibleCharacter || !nextVisibleCharacter.isGraphemeContinuation) {
				index = appendTrailingAnsiTokens(string, index, tokens);
				break;
			}
		}
	}
	return tokens;
}
function areValuesInSameGrapheme(leftValue, rightValue) {
	const pair = `${leftValue}${rightValue}`;
	const splitIndex = leftValue.length;
	for (const segment of GRAPHEME_SEGMENTER.segment(pair)) {
		if (segment.index === splitIndex) return false;
		if (segment.index > splitIndex) return true;
	}
	return true;
}
function hasAnsiSplitContinuationAhead(string, startIndex, previousVisibleValue, graphemeSegments) {
	if (!previousVisibleValue) return false;
	let index = startIndex;
	let hasAnsiCode = false;
	while (index < string.length) {
		const codePoint = string.codePointAt(index);
		if (ESCAPES.has(codePoint)) {
			const code = parseAnsiCode(string, index);
			if (code) {
				hasAnsiCode = true;
				index = code.endIndex;
				continue;
			}
		}
		if (!hasAnsiCode) return false;
		const characterToken = parseCharacterTokenWithRawSegmentation(string, index, graphemeSegments);
		if (!characterToken) return true;
		return areValuesInSameGrapheme(previousVisibleValue, characterToken.token.value);
	}
	return false;
}
function tokenizeAnsi(string, { endCharacter = Number.POSITIVE_INFINITY } = {}) {
	const tokens = [];
	const graphemeSegments = GRAPHEME_SEGMENTER.segment(string);
	let index = 0;
	let visibleCount = 0;
	let previousVisibleValue;
	let hasAnsiSinceLastVisible = false;
	while (index < string.length) {
		const codePoint = string.codePointAt(index);
		if (ESCAPES.has(codePoint)) {
			const code = parseAnsiCode(string, index);
			if (code) {
				tokens.push(code.token);
				index = code.endIndex;
				hasAnsiSinceLastVisible = true;
				continue;
			}
		}
		const characterToken = parseCharacterTokenWithRawSegmentation(string, index, graphemeSegments);
		if (!characterToken) return tokenizeAnsiWithVisibleSegmentation(string, { endCharacter });
		if (hasAnsiSinceLastVisible && previousVisibleValue && areValuesInSameGrapheme(previousVisibleValue, characterToken.token.value)) return tokenizeAnsiWithVisibleSegmentation(string, { endCharacter });
		tokens.push(characterToken.token);
		index = characterToken.endIndex;
		visibleCount += characterToken.token.visibleWidth;
		hasAnsiSinceLastVisible = false;
		previousVisibleValue = characterToken.token.value;
		if (visibleCount >= endCharacter) {
			if (hasAnsiSplitContinuationAhead(string, index, previousVisibleValue, graphemeSegments)) return tokenizeAnsiWithVisibleSegmentation(string, { endCharacter });
			index = appendTrailingAnsiTokens(string, index, tokens);
			break;
		}
	}
	return tokens;
}
//#endregion
//#region ../../node_modules/.pnpm/slice-ansi@8.0.0/node_modules/slice-ansi/index.js
function applySgrFragments(activeStyles, fragments) {
	for (const fragment of fragments) switch (fragment.type) {
		case "reset":
			activeStyles.clear();
			break;
		case "end":
			activeStyles.delete(fragment.endCode);
			break;
		case "start":
			activeStyles.delete(fragment.endCode);
			activeStyles.set(fragment.endCode, fragment.code);
	}
	return activeStyles;
}
function undoAnsiCodes(activeStyles) {
	return [...activeStyles.keys()].reverse().join("");
}
function closeHyperlink(hyperlinkToken) {
	return `${hyperlinkToken.closePrefix}${hyperlinkToken.terminator}`;
}
function shouldIncludeSgrAfterEnd(token, activeStyles) {
	let hasStartFragment = false;
	let hasClosingEffect = false;
	for (const fragment of token.fragments) {
		if (fragment.type === "start") {
			hasStartFragment = true;
			continue;
		}
		if (fragment.type === "reset" && activeStyles.size > 0) {
			hasClosingEffect = true;
			continue;
		}
		if (fragment.type === "end" && activeStyles.has(fragment.endCode)) hasClosingEffect = true;
	}
	return hasClosingEffect && !hasStartFragment;
}
function applySgrToken({ token, isPastEnd, activeStyles, returnValue, include, activeHyperlink, position }) {
	if (isPastEnd && !shouldIncludeSgrAfterEnd(token, activeStyles)) return {
		activeStyles,
		activeHyperlink,
		position,
		returnValue,
		include
	};
	activeStyles = applySgrFragments(activeStyles, token.fragments);
	if (include) returnValue += token.code;
	return {
		activeStyles,
		activeHyperlink,
		position,
		returnValue,
		include
	};
}
function applyHyperlinkToken({ token, isPastEnd, activeStyles, activeHyperlink, position, returnValue, include }) {
	if (isPastEnd && (token.action !== "close" || !activeHyperlink)) return {
		activeStyles,
		activeHyperlink,
		position,
		returnValue,
		include
	};
	if (token.action === "open") activeHyperlink = token;
	else if (token.action === "close") activeHyperlink = void 0;
	if (include) returnValue += token.code;
	return {
		activeStyles,
		activeHyperlink,
		position,
		returnValue,
		include
	};
}
function applyControlToken({ token, isPastEnd, activeStyles, activeHyperlink, position, returnValue, include }) {
	if (!isPastEnd && include) returnValue += token.code;
	return {
		activeStyles,
		activeHyperlink,
		position,
		returnValue,
		include
	};
}
function applyCharacterToken({ token, start, activeStyles, activeHyperlink, position, returnValue, include }) {
	if (!include && position >= start && !token.isGraphemeContinuation) {
		include = true;
		returnValue = [...activeStyles.values()].join("");
		if (activeHyperlink) returnValue += activeHyperlink.code;
	}
	if (include) returnValue += token.value;
	position += token.visibleWidth;
	return {
		activeStyles,
		activeHyperlink,
		position,
		returnValue,
		include
	};
}
const tokenHandlers = {
	sgr: applySgrToken,
	hyperlink: applyHyperlinkToken,
	control: applyControlToken,
	character: applyCharacterToken
};
function applyToken(parameters) {
	const tokenHandler = tokenHandlers[parameters.token.type];
	if (!tokenHandler) {
		const { activeStyles, activeHyperlink, position, returnValue, include } = parameters;
		return {
			activeStyles,
			activeHyperlink,
			position,
			returnValue,
			include
		};
	}
	return tokenHandler(parameters);
}
function createHasContinuationAheadMap(tokens) {
	const hasContinuationAhead = Array.from({ length: tokens.length }, () => false);
	let nextCharacterIsContinuation = false;
	for (let tokenIndex = tokens.length - 1; tokenIndex >= 0; tokenIndex--) {
		const token = tokens[tokenIndex];
		hasContinuationAhead[tokenIndex] = nextCharacterIsContinuation;
		if (token.type === "character") nextCharacterIsContinuation = Boolean(token.isGraphemeContinuation);
	}
	return hasContinuationAhead;
}
function sliceAnsi(string, start, end) {
	const tokens = tokenizeAnsi(string, { endCharacter: end });
	const hasContinuationAhead = createHasContinuationAheadMap(tokens);
	let activeStyles = /* @__PURE__ */ new Map();
	let activeHyperlink;
	let position = 0;
	let returnValue = "";
	let include = false;
	for (const [tokenIndex, token] of tokens.entries()) {
		let isPastEnd = end !== void 0 && position >= end;
		if (isPastEnd && token.type !== "character" && hasContinuationAhead[tokenIndex]) isPastEnd = false;
		if (isPastEnd && token.type === "character" && !token.isGraphemeContinuation) break;
		({activeStyles, activeHyperlink, position, returnValue, include} = applyToken({
			token,
			isPastEnd,
			start,
			activeStyles,
			activeHyperlink,
			position,
			returnValue,
			include
		}));
	}
	if (!include) return "";
	if (activeHyperlink) returnValue += closeHyperlink(activeHyperlink);
	returnValue += undoAnsiCodes(activeStyles);
	return returnValue;
}
//#endregion
//#region ../../node_modules/.pnpm/string-width@8.2.1/node_modules/string-width/index.js
/**
Logic:
- Segment graphemes to match how terminals render clusters.
- Width rules:
1. Skip non-printing clusters (Default_Ignorable, Control, pure Mark, lone Surrogates). Tabs are ignored by design.
2. RGI emoji clusters (\p{RGI_Emoji}) are double-width.
3. Minimally-qualified/unqualified emoji clusters (ZWJ sequences with 2+ Extended_Pictographic, or keycap sequences) are double-width.
4. Hangul jamo collapse each standard modern Hangul L+V or L+V+T syllable piece to width 2.
Unmatched repeated leading/vowel/trailing jamo stay additive because that matches how the terminals we target render them.
5. Otherwise use East Asian Width of the cluster's first visible code point, and add widths for trailing Halfwidth/Fullwidth Forms within the same cluster (e.g., dakuten/handakuten/prolonged sound mark).
*/
const segmenter = new Intl.Segmenter();
const zeroWidthClusterRegex = /^(?:\p{Default_Ignorable_Code_Point}|\p{Control}|\p{Format}|\p{Mark}|\p{Surrogate})+$/v;
const leadingNonPrintingRegex = /^[\p{Default_Ignorable_Code_Point}\p{Control}\p{Format}\p{Mark}\p{Surrogate}]+/v;
const rgiEmojiRegex = /^\p{RGI_Emoji}$/v;
const unqualifiedKeycapRegex = /^[\d#*]\u20E3$/;
const extendedPictographicRegex = /\p{Extended_Pictographic}/gu;
function isDoubleWidthNonRgiEmojiSequence(segment) {
	if (segment.length > 50) return false;
	if (unqualifiedKeycapRegex.test(segment)) return true;
	if (segment.includes("‍")) {
		const pictographics = segment.match(extendedPictographicRegex);
		return pictographics !== null && pictographics.length >= 2;
	}
	return false;
}
function baseVisible(segment) {
	return segment.replace(leadingNonPrintingRegex, "");
}
function isZeroWidthCluster(segment) {
	return zeroWidthClusterRegex.test(segment);
}
function isHangulLeadingJamo(codePoint) {
	return codePoint >= 4352 && codePoint <= 4447 || codePoint >= 43360 && codePoint <= 43388;
}
function isHangulVowelJamo(codePoint) {
	return codePoint >= 4448 && codePoint <= 4519 || codePoint >= 55216 && codePoint <= 55238;
}
function isHangulTrailingJamo(codePoint) {
	return codePoint >= 4520 && codePoint <= 4607 || codePoint >= 55243 && codePoint <= 55291;
}
function isHangulJamo(codePoint) {
	return isHangulLeadingJamo(codePoint) || isHangulVowelJamo(codePoint) || isHangulTrailingJamo(codePoint);
}
function hangulClusterWidth(visibleSegment, eastAsianWidthOptions) {
	const codePoints = [];
	for (const character of visibleSegment) {
		if (zeroWidthClusterRegex.test(character)) continue;
		codePoints.push(character.codePointAt(0));
	}
	if (codePoints.length === 0) return;
	let width = 0;
	for (let index = 0; index < codePoints.length; index++) {
		const codePoint = codePoints[index];
		if (!isHangulJamo(codePoint)) {
			if (width === 0) return;
			for (let remaining = index; remaining < codePoints.length; remaining++) width += eastAsianWidth(codePoints[remaining], eastAsianWidthOptions);
			return width;
		}
		if (isHangulLeadingJamo(codePoint) && isHangulVowelJamo(codePoints[index + 1])) {
			width += 2;
			index += isHangulTrailingJamo(codePoints[index + 2]) ? 2 : 1;
			continue;
		}
		width += eastAsianWidth(codePoint, eastAsianWidthOptions);
	}
	return width;
}
function trailingHalfwidthWidth(visibleSegment, eastAsianWidthOptions) {
	let extra = 0;
	let first = true;
	for (const character of visibleSegment) {
		if (first) {
			first = false;
			continue;
		}
		if (character >= "＀" && character <= "￯") extra += eastAsianWidth(character.codePointAt(0), eastAsianWidthOptions);
	}
	return extra;
}
function stringWidth(input, options = {}) {
	if (typeof input !== "string" || input.length === 0) return 0;
	const { ambiguousIsNarrow = true, countAnsiEscapeCodes = false } = options;
	let string = input;
	if (!countAnsiEscapeCodes && (string.includes("\x1B") || string.includes(""))) string = stripAnsi(string);
	if (string.length === 0) return 0;
	if (/^[\u0020-\u007E]*$/.test(string)) return string.length;
	let width = 0;
	const eastAsianWidthOptions = { ambiguousAsWide: !ambiguousIsNarrow };
	for (const { segment } of segmenter.segment(string)) {
		if (isZeroWidthCluster(segment)) continue;
		if (rgiEmojiRegex.test(segment) || isDoubleWidthNonRgiEmojiSequence(segment)) {
			width += 2;
			continue;
		}
		const visibleSegment = baseVisible(segment);
		const hangulWidth = hangulClusterWidth(visibleSegment, eastAsianWidthOptions);
		if (hangulWidth !== void 0) {
			width += hangulWidth;
			continue;
		}
		const codePoint = visibleSegment.codePointAt(0);
		width += eastAsianWidth(codePoint, eastAsianWidthOptions);
		width += trailingHalfwidthWidth(visibleSegment, eastAsianWidthOptions);
	}
	return width;
}
//#endregion
//#region ../../node_modules/.pnpm/cli-truncate@5.2.0/node_modules/cli-truncate/index.js
function getIndexOfNearestSpace(string, wantedIndex, shouldSearchRight) {
	if (string.charAt(wantedIndex) === " ") return wantedIndex;
	const direction = shouldSearchRight ? 1 : -1;
	for (let index = 0; index <= 3; index++) {
		const finalIndex = wantedIndex + index * direction;
		if (string.charAt(finalIndex) === " ") return finalIndex;
	}
	return wantedIndex;
}
function cliTruncate(text, columns, options = {}) {
	const { position = "end", space = false, preferTruncationOnSpace = false } = options;
	let { truncationCharacter = "…" } = options;
	if (typeof text !== "string") throw new TypeError(`Expected \`input\` to be a string, got ${typeof text}`);
	if (typeof columns !== "number") throw new TypeError(`Expected \`columns\` to be a number, got ${typeof columns}`);
	if (columns < 1) return "";
	const length = stringWidth(text);
	if (length <= columns) return text;
	if (columns === 1) return truncationCharacter;
	const ANSI = {
		ESC: 27,
		LEFT_BRACKET: 91,
		LETTER_M: 109
	};
	const isSgrParameter = (code) => code >= 48 && code <= 57 || code === 59;
	function leadingSgrSpanEndIndex(string) {
		let index = 0;
		while (index + 2 < string.length && string.codePointAt(index) === ANSI.ESC && string.codePointAt(index + 1) === ANSI.LEFT_BRACKET) {
			let j = index + 2;
			while (j < string.length && isSgrParameter(string.codePointAt(j))) j++;
			if (j < string.length && string.codePointAt(j) === ANSI.LETTER_M) {
				index = j + 1;
				continue;
			}
			break;
		}
		return index;
	}
	function trailingSgrSpanStartIndex(string) {
		let start = string.length;
		while (start > 1 && string.codePointAt(start - 1) === ANSI.LETTER_M) {
			let j = start - 2;
			while (j >= 0 && isSgrParameter(string.codePointAt(j))) j--;
			if (j >= 1 && string.codePointAt(j - 1) === ANSI.ESC && string.codePointAt(j) === ANSI.LEFT_BRACKET) {
				start = j - 1;
				continue;
			}
			break;
		}
		return start;
	}
	function appendWithInheritedStyleFromEnd(visible, suffix) {
		const start = trailingSgrSpanStartIndex(visible);
		if (start === visible.length) return visible + suffix;
		return visible.slice(0, start) + suffix + visible.slice(start);
	}
	function prependWithInheritedStyleFromStart(prefix, visible) {
		const end = leadingSgrSpanEndIndex(visible);
		if (end === 0) return prefix + visible;
		return visible.slice(0, end) + prefix + visible.slice(end);
	}
	if (position === "start") {
		if (preferTruncationOnSpace) {
			const right = sliceAnsi(text, getIndexOfNearestSpace(text, length - columns + 1, true), length).trim();
			return prependWithInheritedStyleFromStart(truncationCharacter, right);
		}
		if (space) truncationCharacter += " ";
		const right = sliceAnsi(text, length - columns + stringWidth(truncationCharacter), length);
		return prependWithInheritedStyleFromStart(truncationCharacter, right);
	}
	if (position === "middle") {
		if (space) truncationCharacter = ` ${truncationCharacter} `;
		const half = Math.floor(columns / 2);
		if (preferTruncationOnSpace) {
			const spaceNearFirstBreakPoint = getIndexOfNearestSpace(text, half);
			const spaceNearSecondBreakPoint = getIndexOfNearestSpace(text, length - (columns - half) + 1, true);
			return sliceAnsi(text, 0, spaceNearFirstBreakPoint) + truncationCharacter + sliceAnsi(text, spaceNearSecondBreakPoint, length).trim();
		}
		return sliceAnsi(text, 0, half) + truncationCharacter + sliceAnsi(text, length - (columns - half) + stringWidth(truncationCharacter), length);
	}
	if (position === "end") {
		if (preferTruncationOnSpace) return appendWithInheritedStyleFromEnd(sliceAnsi(text, 0, getIndexOfNearestSpace(text, columns - 1)), truncationCharacter);
		if (space) truncationCharacter = ` ${truncationCharacter}`;
		return appendWithInheritedStyleFromEnd(sliceAnsi(text, 0, columns - stringWidth(truncationCharacter)), truncationCharacter);
	}
	throw new Error(`Expected \`options.position\` to be either \`start\`, \`middle\` or \`end\`, got ${position}`);
}
//#endregion
export { cliTruncate as default };
