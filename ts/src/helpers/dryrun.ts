// Report what a dry run WOULD have done.
//
// `@voxgig/util`'s showChanges only lists merged and conflicted files, which
// on a fresh `target add` is nothing at all — so `-y target add ts` printed
// `** DRY RUN **`, listed no files, and (before the control fix) wrote them
// anyway. A preview that shows nothing is indistinguishable from a preview of
// nothing, which is exactly the wrong answer for the command whose whole job
// is to overwrite a project's vendored scaffold.

// Subset of jostraca's result: the per-outcome file lists.
type FileLists = {
  written?: string[]
  merged?: string[]
  conflicted?: string[]
  unchanged?: string[]
  preserved?: string[]
}


// Log every path the run touched, one line each, plus a total. `written`
// covers both new and overwritten files — in a dry run nothing reached disk,
// so the list IS the preview.
function showDryrun(log: any, point: string, jres: any, folder?: string) {
  const files: FileLists = (jres && jres.files) || {}

  const prefix = null == folder ? '' :
    (folder.endsWith('/') ? folder : folder + '/')

  const rel = (p: string) => ('' !== prefix && p.startsWith(prefix)) ?
    p.slice(prefix.length) : p

  let count = 0

  for (const kind of ['written', 'merged', 'conflicted'] as const) {
    for (const file of (files[kind] || [])) {
      count++
      log.info({ point, file, kind, note: kind + ': ' + rel(file) })
    }
  }

  log.info({
    point, count,
    note: '** DRY RUN ** ' + count + ' file' + (1 === count ? '' : 's') +
      ' would change; nothing was written'
  })

  return count
}


export type {
  FileLists,
}

export {
  showDryrun,
}
