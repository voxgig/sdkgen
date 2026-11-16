import { escapeRe } from '../utility'


// A per-target component: `.sdk/src/cmp/<t>/<Name>_<t>.ts`, compiled by the
// project to `.sdk/dist/cmp/<t>/<Name>_<t>.js`, which the loader requires.

const CMP_SRC = 'src/cmp/'
const CMP_DIST = 'dist/cmp/'

// What `tsc` writes beside each compiled module.
const COMPILED_EXTS = ['.js', '.js.map', '.d.ts', '.d.ts.map']

const COMPONENT_RE = /^src\/cmp\/([^/]+)\/([A-Za-z]+)_\1\.ts$/


function componentModule(target: string, name: string): string {
  return './cmp/' + target + '/' + name + '_' + target
}


function componentSource(target: string, name: string): string {
  return CMP_SRC + target + '/' + name + '_' + target + '.ts'
}


function parseComponent(rel: string): { target: string, name: string } | undefined {
  const m = rel.match(COMPONENT_RE)
  return null == m ? undefined : { target: m[1], name: m[2] }
}


// `src/cmp/<t>/X.ts` -> `dist/cmp/<t>/X`, relative to `.sdk`.
function compiledStem(rel: string): string {
  return CMP_DIST + rel.slice(CMP_SRC.length).replace(/\.ts$/, '')
}


function compiledFiles(rel: string): string[] {
  const stem = compiledStem(rel)
  return COMPILED_EXTS.map((ext) => stem + ext)
}


// `dist/cmp/<t>/X.js` -> `src/cmp/<t>/X`, without an extension: the source
// may be `.ts` or `.js`.
function sourceStem(distRel: string): string {
  return CMP_SRC + distRel.slice(CMP_DIST.length).replace(/\.js$/, '')
}


function aliasCmpName(name: string, torigname: string, tname: string): string {
  return name.replace(
    new RegExp('_' + escapeRe(torigname) + '(\\.[^.]+)$'), '_' + tname + '$1')
}


function aliasCmpText(
  src: string, torigname: string, tname: string, cmpbase = CMP_SRC,
): string {
  const orig = escapeRe(torigname)

  return src
    // The fragment directory, read relative to __dirname. The fragments are
    // copied into the ALIAS's folder, so leaving the origin path would miss —
    // or, if the origin target is also installed, silently read ITS fragments.
    .replace(new RegExp(escapeRe(cmpbase) + orig + '/', 'g'), cmpbase + tname + '/')
    // Sibling imports: `'./Package_go'` -> `'./Package_go2'`. Anchored on the
    // closing quote (captured, so the style is preserved) to keep it off file
    // EXTENSIONS — `Main.fragment.go` must not become `Main.fragment.go2`.
    .replace(new RegExp('_' + orig + '([\'"])', 'g'), '_' + tname + '$1')
}


export {
  CMP_SRC,
  CMP_DIST,
  COMPILED_EXTS,
  componentModule,
  componentSource,
  parseComponent,
  compiledStem,
  compiledFiles,
  sourceStem,
  aliasCmpName,
  aliasCmpText,
}
