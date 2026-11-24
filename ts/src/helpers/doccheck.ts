import Path from 'node:path'

import { claimedFiles } from './generated'


type DocFinding = {
  point: 'doc-link-dangling' | 'doc-table-broken'
  file: string
  line: number
  note: string
}


// GitHub's heading anchors, which is what a reader's browser follows.
function slug(heading: string): string {
  return heading.trim().toLowerCase()
    .replace(/`/g, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-')
}


function anchors(text: string): Set<string> {
  const out = new Set<string>()
  const seen = new Map<string, number>()
  let fence = false
  for (const line of text.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence
    if (fence) continue
    const m = /^#{1,6}\s+(.*)$/.exec(line)
    if (!m) continue
    const s = slug(m[1])
    const n = seen.get(s) ?? 0
    out.add(0 === n ? s : s + '-' + n)
    seen.set(s, n + 1)
  }
  return out
}


// The lines of a document outside its fenced blocks, numbered from one.
function prose(text: string): [number, string][] {
  const out: [number, string][] = []
  let fence = ''
  text.split('\n').forEach((line, i) => {
    const open = /^ {0,3}(`{3,}|~{3,})/.exec(line)
    if (open && ('' === fence || open[1].startsWith(fence))) {
      fence = '' === fence ? open[1] : ''
    }
    else if ('' === fence) {
      out.push([i + 1, line])
    }
  })
  return out
}


function cells(row: string): number {
  return (row.trim().match(/(?<!\\)\|/g) || []).length
}


const DELIMITER = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/

// Each row of a table ends as its header ends and holds as many cells; a
// row with no header before it is the second half of a row a line break cut.
function tables(file: string, text: string): DocFinding[] {
  const out: DocFinding[] = []
  const lines = prose(text)
  let header: string | null = null
  for (let i = 0; i < lines.length; i++) {
    const [num, line] = lines[i]
    if (!/^ {0,3}\|/.test(line)) {
      header = null
    }
    else if (null == header) {
      if (DELIMITER.test(lines[i + 1]?.[1] ?? '')) {
        header = line
        i++
      }
      else {
        out.push({ point: 'doc-table-broken', file, line: num, note: 'a row outside a table: ' + line })
      }
    }
    else if (cells(line) !== cells(header) ||
      line.trim().endsWith('|') !== header.trim().endsWith('|')) {
      out.push({ point: 'doc-table-broken', file, line: num, note: line })
    }
  }
  return out
}


// A malformed escape such as `100%.md` is a path as written, as a browser reads it.
function decoded(rel: string): string {
  try {
    return decodeURI(rel)
  }
  catch (_err) {
    return rel
  }
}


function links(file: string, text: string, docs: Map<string, string>,
  exists: (rel: string) => boolean): DocFinding[] {
  const out: DocFinding[] = []
  const dir = Path.posix.dirname(file)
  for (const [num, line] of prose(text)) {
    const bare = line.replace(/(`+)[^`][\s\S]*?\1/g, '')
    for (const m of bare.matchAll(/\]\(<?([^)\s>]+)>?(?:\s+"[^"]*")?\)/g)) {
      const href = m[1]
      if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('/')) continue
      const [rel, frag] = href.split('#')
      const target = '' === rel ? file : Path.posix.normalize(Path.posix.join(dir, decoded(rel)))
      if ('' !== rel && !exists(target)) {
        out.push({ point: 'doc-link-dangling', file, line: num, note: target })
      }
      else if (null != frag && '' !== frag && docs.has(target) && !anchors(docs.get(target)!).has(frag)) {
        out.push({ point: 'doc-link-dangling', file, line: num, note: target + '#' + frag })
      }
    }
  }
  return out
}


function walk(node: any, visit: (node: any) => void): void {
  if (null == node) return
  visit(node)
  for (const child of node.children ?? []) walk(child, visit)
}


// Every Markdown file a pass kept, checked against what the pass wrote and
// what is already in `folder`: a relative link that resolves nowhere, and a
// table row that a line break or a pipe has broken. A dry run copies nothing,
// so there a path under a copy's destination counts as written.
function docFindings(root: any, folder: string, onDisk: (path: string) => boolean,
  dryrun = false): DocFinding[] {
  const rel = (full: string) =>
    Path.relative(Path.resolve(folder), Path.resolve(full)).split(Path.sep).join('/')
  const claims = claimedFiles(root, folder)
  const written = new Set<string>(Object.keys(claims.files).map(rel))
  const copied = claims.copies.map((c: any) => rel(c.to))

  const docs = new Map<string, string>()
  walk(root, (node: any) => {
    if ('file' === node.kind && 'string' === typeof node.fullpath && node.fullpath.endsWith('.md') &&
      Array.isArray(node.content)) {
      docs.set(rel(node.fullpath), node.content.join(''))
    }
  })

  const exists = (path: string): boolean => written.has(path) ||
    [...written].some((p) => p.startsWith(path + '/')) ||
    (dryrun && copied.some((c) => path === c || path.startsWith(c + '/'))) ||
    onDisk(Path.join(folder, path))

  const out: DocFinding[] = []
  for (const [file, text] of docs) {
    out.push(...tables(file, text), ...links(file, text, docs, exists))
  }
  return out
}


export {
  anchors,
  docFindings,
  slug,
}

export type { DocFinding }
