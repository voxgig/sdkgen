// Vendor text (a spec's field and entity descriptions) placed into a generated
// markdown page. One rule for every sink, so a pipe or a line break cannot end
// a table row and a link relative to the spec's own site cannot dangle.

// A relative markdown link becomes its label; an absolute one or an anchor stays.
function unlinkRelative(text: string): string {
  return text.replace(/\[([^\]]*)\]\(([^)\s]*)\)/g, (all: string, label: string, href: string) =>
    /^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(href) ? all : label)
}

// Text for one table cell: one line, its pipes escaped.
function mdCell(text: any): string {
  if (null == text) return ''
  return unlinkRelative(String(text))
    .replace(/\r?\n+/g, ' ')
    .replace(/\|/g, () => '\\|')
    .replace(/\$\$/g, () => '$&#36;')
    .trim()
}

// Text as a code span in one table cell: fenced by more backticks than any
// run inside it, padded where it meets a backtick, its pipes escaped (GFM
// reads `\|` in a cell's code span as a pipe).
function mdCodeCell(text: any): string {
  const t = String(null == text ? '' : text).replace(/\r?\n+/g, ' ')
  const run = Math.max(0, ...(t.match(/`+/g) || []).map((r) => r.length))
  const fence = '`'.repeat(run + 1)
  const pad = /^`|`$/.test(t) ? ' ' : ''
  return (fence + pad + t + pad + fence).replace(/\|/g, () => '\\|')
}

// Text for a paragraph of its own: line breaks kept, relative links unwrapped.
function mdInline(text: any): string {
  if (null == text) return ''
  return unlinkRelative(String(text)).replace(/\$\$/g, () => '$&#36;').trim()
}


// The words of a paragraph for wrapping: a code span with spaces in it stays
// one word, so a wrapped line never breaks inside it.
function spans(text: string): string[] {
  const out: string[] = []
  for (const word of text.split(' ')) {
    const open = 0 < out.length && 1 === (out[out.length - 1].split('`').length - 1) % 2
    if (open) out[out.length - 1] += ' ' + word
    else out.push(word)
  }
  return out
}


export {
  mdCell,
  mdCodeCell,
  mdInline,
  spans,
}
