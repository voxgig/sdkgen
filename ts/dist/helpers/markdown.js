"use strict";
// Vendor text (a spec's field and entity descriptions) placed into a generated
// markdown page. One rule for every sink, so a pipe or a line break cannot end
// a table row and a link relative to the spec's own site cannot dangle.
Object.defineProperty(exports, "__esModule", { value: true });
exports.mdCell = mdCell;
exports.mdInline = mdInline;
// A relative markdown link becomes its label; an absolute one or an anchor stays.
function unlinkRelative(text) {
    return text.replace(/\[([^\]]*)\]\(([^)\s]*)\)/g, (all, label, href) => /^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(href) ? all : label);
}
// Text for one table cell: one line, its pipes escaped.
function mdCell(text) {
    if (null == text)
        return '';
    return unlinkRelative(String(text))
        .replace(/\r?\n+/g, ' ')
        .replace(/\|/g, () => '\\|')
        .replace(/\$\$/g, () => '$&#36;')
        .trim();
}
// Text for a paragraph of its own: line breaks kept, relative links unwrapped.
function mdInline(text) {
    if (null == text)
        return '';
    return unlinkRelative(String(text)).replace(/\$\$/g, () => '$&#36;').trim();
}
//# sourceMappingURL=markdown.js.map