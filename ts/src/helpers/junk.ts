


const NOISE: RegExp[] = [
  /~$/,
  /^\.#/,
  /^#.*#$/,
  /\.sw[a-p]$/,
  /\.(bak|orig|rej)$/,

  /^\.DS_Store$/,
  /^__MACOSX$/,
  /^Thumbs\.db$/i,
  /^desktop\.ini$/i,

  // Version control. A nested checkout inside a template tree is never the
  // payload, and copying one produces a project git cannot make sense of.
  /^\.git$/,
  /^\.svn$/,
  /^\.hg$/,
  /^\.idea$/,
]


const BUILD: RegExp[] = [
  /^node_modules$/,
  /^__pycache__$/,
  /\.py[co]$/,
  /^\.(pytest|mypy|ruff)_cache$/,
  /^\.tox$/,
  /^\.venv$/,
  /^\.gradle$/,
  /\.class$/,
  /^\.dart_tool$/,
  /^\.?zig-cache$/,
  /^zig-out$/,
  /^_build$/,
  /^\.elixir_ls$/,
  /^\.cpcache$/,
  /^\.stack-work$/,
  /^dist-newstyle$/,
  /^\.cargo$/,
]


const JUNK: RegExp[] = [...NOISE, ...BUILD]


function isJunk(name: string): boolean {
  return matches(name, JUNK)
}


function isNoise(name: string): boolean {
  return matches(name, NOISE)
}


function matches(name: string, patterns: RegExp[]): boolean {
  for (const re of patterns) {
    // These are module-level regexes reused across every entry of every tree.
    // None carries `g` or `y` today, but a `test` on a stateful regex resumes
    // from the previous match and would skip every other file — the exact bug
    // jostraca's own `excluded()` carries a comment about.
    re.lastIndex = 0

    if (re.test(name)) {
      return true
    }
  }

  return false
}


function copyOpts(): { Copy: { ignore: RegExp[] } } {
  return {
    Copy: {
      ignore: [/~$/, ...JUNK]
    }
  }
}


export {
  JUNK,
  NOISE,
  BUILD,
  isJunk,
  isNoise,
  copyOpts,
}
