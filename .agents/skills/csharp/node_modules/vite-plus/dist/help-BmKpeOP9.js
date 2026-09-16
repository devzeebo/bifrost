import { stripVTControlCharacters, styleText } from "node:util";
//#region src/utils/help.ts
const HELP_RIGHT_MARGIN = 4;
function toLines(value) {
	if (!value) return [];
	return Array.isArray(value) ? [...value] : [value];
}
function visibleLength(value) {
	return stripVTControlCharacters(value).length;
}
function padVisible(value, width) {
	const padding = Math.max(0, width - visibleLength(value));
	return `${value}${" ".repeat(padding)}`;
}
function contentWidth() {
	const terminalWidth = process.stdout.columns;
	return Number.isFinite(terminalWidth) ? Math.max(0, terminalWidth - HELP_RIGHT_MARGIN) : Infinity;
}
function wrapLine(line, width) {
	if (!Number.isFinite(width) || width <= 0 || visibleLength(line) <= width) return [line];
	const content = line.trim();
	if (!content) return [line];
	const indent = line.slice(0, line.length - line.trimStart().length);
	const output = [];
	let current = indent;
	for (const [, whitespace, word] of content.matchAll(/(\s*)(\S+)/gu)) {
		const candidate = `${current}${current === indent ? "" : whitespace}${word}`;
		if (current === indent || visibleLength(candidate) <= width) current = candidate;
		else {
			output.push(current);
			current = `${indent}${word}`;
		}
	}
	output.push(current);
	return output;
}
function renderRows(rows) {
	if (rows.length === 0) return [];
	const labelWidth = Math.max(...rows.map((row) => visibleLength(row.label)));
	const descriptionWidth = contentWidth() - labelWidth - 4;
	const output = [];
	for (const row of rows) {
		const descriptionLines = toLines(row.description).flatMap((line) => wrapLine(line, descriptionWidth));
		if (descriptionLines.length === 0) {
			output.push(`  ${row.label}`);
			continue;
		}
		const [firstLine, ...rest] = descriptionLines;
		output.push(`  ${padVisible(row.label, labelWidth)}  ${firstLine}`);
		for (const line of rest) output.push(`  ${" ".repeat(labelWidth)}  ${line}`);
	}
	return output;
}
function heading(label, color) {
	if (!color) return `${label}:`;
	return label === "Usage" ? styleText("bold", `${label}:`) : styleText(["blue", "bold"], `${label}:`);
}
function renderMutedCommentSuffix(line, color) {
	if (!color) return line;
	const commentIndex = line.indexOf(" #");
	if (commentIndex === -1) return line;
	return `${line.slice(0, commentIndex)}${styleText("gray", line.slice(commentIndex))}`;
}
function renderCliDoc(doc, options = {}) {
	const color = options.color ?? true;
	const output = [];
	if (doc.usage) {
		const usage = color ? styleText("bold", doc.usage) : doc.usage;
		output.push(`${heading("Usage", color)} ${usage}`);
	}
	const summaryLines = toLines(doc.summary);
	if (summaryLines.length > 0) {
		if (output.length > 0) output.push("");
		output.push(...summaryLines);
	}
	for (const section of doc.sections) {
		if (output.length > 0) output.push("");
		output.push(heading(section.title, color));
		const lines = toLines(section.lines);
		if (lines.length > 0) output.push(...lines.flatMap((line) => wrapLine(renderMutedCommentSuffix(line, color), contentWidth())));
		if (section.rows && section.rows.length > 0) output.push(...renderRows(section.rows));
	}
	if (doc.documentationUrl) {
		if (output.length > 0) output.push("");
		output.push(`${heading("Documentation", color)} ${doc.documentationUrl}`);
	}
	output.push("");
	return output.join("\n");
}
//#endregion
export { renderCliDoc as t };
