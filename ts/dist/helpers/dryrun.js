"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.showDryrun = showDryrun;
// Log every path the run touched, one line each, plus a total. `written`
// covers both new and overwritten files — in a dry run nothing reached disk,
// so the list IS the preview.
function showDryrun(log, point, jres, folder) {
    const files = (jres && jres.files) || {};
    const prefix = null == folder ? '' :
        (folder.endsWith('/') ? folder : folder + '/');
    const rel = (p) => ('' !== prefix && p.startsWith(prefix)) ?
        p.slice(prefix.length) : p;
    let count = 0;
    for (const kind of ['written', 'merged', 'conflicted']) {
        for (const file of (files[kind] || [])) {
            count++;
            log.info({ point, file, kind, note: kind + ': ' + rel(file) });
        }
    }
    log.info({
        point, count,
        note: '** DRY RUN ** ' + count + ' file' + (1 === count ? '' : 's') +
            ' would change; nothing was written'
    });
    return count;
}
//# sourceMappingURL=dryrun.js.map