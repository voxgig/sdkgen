"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cmd_package_check = cmd_package_check;
exports.checkPackage = checkPackage;
const kindCollection_1 = require("../helpers/kindCollection");
const applicability_1 = require("../helpers/applicability");
const node_path_1 = __importDefault(require("node:path"));
const types_1 = require("../types");
const utility_1 = require("../utility");
const manifest_1 = require("../helpers/manifest");
const definition_1 = require("../helpers/definition");
const modelcheck_1 = require("../helpers/modelcheck");
const featureSource_1 = require("../helpers/featureSource");
const shipped_1 = require("../helpers/shipped");
const kind_1 = require("./kind");
const SAME_FILE_LIMIT = 5;
function claims(map, key) {
    const value = map?.[key];
    return Array.isArray(value) ?
        value.filter((n) => 'string' === typeof n && '' !== n) : [];
}
async function cmd_package_check(args, actx) {
    const refs = args.slice(2).flatMap((a) => 'string' === typeof a ? a.split(',') : a)
        .filter((r) => null != r && '' !== r);
    const reports = (0 === refs.length ? ['.'] : refs)
        .map((ref) => checkPackage(ref, actx));
    const ok = reports.every((r) => r.ok);
    return {
        report: {
            ok,
            packages: reports,
            // The one line the CLI prints when it exits non-zero. Built here
            // because the counts are here; `bin/voxgig-sdkgen` must not have to
            // know what a check finding is.
            summary: reports.map((r) => r.summary).join('\n'),
        },
    };
}
// The battery, for one package. Logs as it goes and returns what it found, so
// a caller in a test can assert on findings without parsing log lines.
function checkPackage(ref, actx) {
    const fs = actx.fs();
    const log = actx.log;
    const { found, search } = (0, manifest_1.probePackage)(fs, actx.folder ?? '.', ref);
    if (null == found) {
        throw new utility_1.SdkGenError('Package not found: ' + ref + '\n  looked for a `.sdk` folder in:\n    ' +
            search.join('\n    '));
    }
    const { root, sdk, read } = found;
    log.info({
        point: 'package-check-start', package: ref, root,
        note: ref + ': checking ' + root
    });
    const findings = [
        ...checkManifest(fs, sdk, read),
        ...checkItems(fs, sdk, read.manifest),
        ...checkFeatureSource(fs, sdk, read.manifest),
    ];
    for (const f of findings) {
        const level = 'error' === f.level ? 'error' : f.level;
        log[level](f);
    }
    const errors = findings.filter((f) => 'error' === f.level).length;
    const warnings = findings.filter((f) => 'warn' === f.level).length;
    const summary = ref + ': ' + (0 === errors ?
        (0 === warnings ? 'no findings' : warnings + ' warning(s)') :
        errors + ' error(s), ' + warnings + ' warning(s)');
    log.info({
        point: 'package-check-end', package: ref, root, errors, warnings,
        note: summary
    });
    return { ok: 0 === errors, ref, root, errors, warnings, findings, summary };
}
function checkManifest(fs, sdk, read) {
    if (null != read.err) {
        return [{
                level: 'error', point: 'manifest-unreadable', file: read.file,
                note: read.file + ': ' + read.err
            }];
    }
    if (null == read.manifest) {
        // A WARNING, not an error: the `.sdk` may be perfectly good, and a direct
        // `target add <path>/<name>` installs from it today. What it cannot do is
        // be installed as a package, which is what the manifest is for.
        return [{
                level: 'warn', point: 'manifest-absent', file: read.file,
                note: read.file + ': no manifest, so `package add` cannot install this' +
                    ' — its items can still be added directly by path'
            }];
    }
    return (0, manifest_1.validateManifest)(fs, sdk, read.manifest, kind_1.KINDS);
}
function checkItems(fs, sdk, manifest) {
    const found = [];
    for (const kind of Object.keys(kind_1.KINDS).sort()) {
        const claimed = claims(manifest?.provides, kind);
        const ondisk = (0, definition_1.definitionNames)(fs, sdk, kind);
        const names = Array.from(new Set([...claimed, ...ondisk])).sort();
        for (const name of names) {
            const file = (0, definition_1.definitionPath)(sdk, kind, name);
            if (!fs.existsSync(file)) {
                continue;
            }
            found.push(...checkDefinition(fs, kind, name, file));
        }
    }
    return found;
}
function checkDefinition(fs, kind, name, file) {
    const found = [];
    const src = String(fs.readFileSync(file, 'utf8'));
    const at = (level, point, note) => ({ level, point, kind, name, file, note: file + ': ' + note });
    // 1. The provenance anchor. Its absence costs nothing at add time and
    //    everything afterwards: the copy records no source, so `doctor` and
    //    `package update` cannot find where it came from.
    if (!modelcheck_1.ANCHOR_RE.test(src)) {
        found.push(at('error', 'model-anchor-missing', 'no `' + modelcheck_1.ANCHOR + '` line — the copy would record no provenance, so ' +
            '`package update` and `doctor` could never locate its source'));
    }
    const slashes = (0, modelcheck_1.slashComments)(src);
    for (const s of slashes.slice(0, SAME_FILE_LIMIT)) {
        found.push(at('error', 'model-slash-comment', s.line + ': `' + s.text + '` — aontu takes `#` comments only; a `//` ' +
            'or `/* */` line is a parse error in a consumer, which configures the ' +
            'parser strictly even though a bare Aontu() accepts it'));
    }
    if (SAME_FILE_LIMIT < slashes.length) {
        found.push(at('error', 'model-slash-comment', 'and ' + (slashes.length - SAME_FILE_LIMIT) + ' more slash-comment line(s)'));
    }
    if (0 < slashes.length) {
        return found;
    }
    const strict = (0, modelcheck_1.compileModel)(src, file);
    if (0 < strict.errors.length) {
        // Which parser rejected it changes what the author must do, so say. A
        // file that a bare Aontu() accepts and the strict one rejects is almost
        // always the comment dialect above.
        const bare = (0, modelcheck_1.compileModel)(src, file, { strict: false });
        found.push(at('error', 'model-parse', strict.errors.join(' | ') +
            (0 === bare.errors.length ?
                '  (it DOES compile under a bare Aontu() — the difference is the ' +
                    'comment dialect a consumer configures)' : '')));
        return found;
    }
    const declared = (0, kindCollection_1.kindCollection)(strict.model, kind)?.[name];
    if (null == declared || 'object' !== typeof declared) {
        found.push(at('error', 'model-key-missing', 'declares no `main: kit: ' + (kind === 'edition' ? 'doc: edition' : kind) + ': ' + name + ':` block — the file ' +
            'is installed and included under its own name, so nothing it declares ' +
            'under another name is reachable'));
    }
    // 5. The base schema. A non-defaulted key the file omits (`ext`,
    //    `comment.line`, `module.name`, a feature's `title`) compiles fine
    //    alone and fails the consumer's whole model.
    const unified = (0, modelcheck_1.compileModel)(src, file, { schema: true });
    for (const err of unified.errors.slice(0, SAME_FILE_LIMIT)) {
        found.push(at('error', 'model-schema', err + '  (unified with the base schema — this is what a consumer compiles)'));
    }
    const tagkey = 'feature' === kind ? 'needs' : 'provides';
    const unknown = null == declared ? [] : (0, applicability_1.unknownTags)(declared[tagkey]);
    if (0 < unknown.length) {
        found.push(at('error', 'model-tag-unknown', 'declares unknown applicability tag(s) in `' + tagkey + '`: ' +
            unknown.join(', ') + ' — the vocabulary is CLOSED (' + applicability_1.TAGS.join(', ') +
            '), so an unrecognised tag makes this ' + kind +
            ' match nothing rather than failing loudly'));
    }
    if ('target' === kind) {
        found.push(...checkTargetModel(src, name, file, at));
    }
    if ('feature' === kind) {
        found.push(...checkFeatureModel(strict.model, name, at));
    }
    return found;
}
// The publish-override probe: unify the target model with a project that sets
// the keys a project owns. Concrete-vs-concrete is a conflict in aontu, so a
// package that pins one makes it impossible for the consumer to set it — and
// the consumer's error names the CONSUMER's file.
function checkTargetModel(src, name, file, at) {
    const probe = (0, modelcheck_1.publishOverrideProbe)(src, file, name);
    if (0 === probe.errors.length) {
        return [];
    }
    return [at('error', 'target-publish-pinned', 'a project cannot override its publication values: ' +
            probe.errors.join(' | ') +
            '  (the target model sets a key the schema already defaults — leave ' +
            '`publish.version`, `publish.registry.package`, `state` and `active` ' +
            'unset; registry identity is yours, versions and names are the ' +
            "project's)")];
}
// Per-target dependencies belong DIRECTLY under the feature
// (`deps: <target>: {…}`), which is the only path `collectDeps` reads. The
// other spelling — `feature.<f>.target.<t>.deps` — is schema-legal, because
// every target model declares that slot, so nothing errors and the
// dependency simply never reaches the generated manifest.
function checkFeatureModel(model, name, at) {
    const targets = model?.main?.[types_1.KIT]?.feature?.[name]?.target;
    if (null == targets || 'object' !== typeof targets) {
        return [];
    }
    const found = [];
    for (const tname of Object.keys(targets).sort()) {
        const deps = targets[tname]?.deps;
        if (null == deps || 'object' !== typeof deps) {
            continue;
        }
        const named = Object.keys(deps).filter((d) => null != deps[d] && 'object' === typeof deps[d] &&
            0 < Object.keys(deps[d]).length);
        if (0 === named.length) {
            continue;
        }
        found.push(at('warn', 'feature-deps-misplaced', 'declares ' + named.join(', ') + ' under `feature: ' + name +
            ': target: ' + tname + ': deps:` — nothing reads that path. ' +
            'Per-target dependencies go directly under the feature: `deps: ' +
            tname + ': { ' + named[0] + ': {…} }`'));
    }
    return found;
}
// The template trees: does a feature's declared coverage exist, and is
// anything in a target's tree feature-shaped but invisible to the trim?
function checkFeatureSource(fs, sdk, manifest) {
    const found = [];
    const file = node_path_1.default.join(sdk, '..', manifest_1.MANIFEST);
    // The catalogue a CONSUMER will have: this generator's own features, plus
    // the package's. A package shipping a copy of a bundled target ships source
    // for features it does not provide, and those are not strays.
    const bundled = (0, featureSource_1.availableFeatures)(fs, (0, shipped_1.scaffoldFolder)());
    const known = new Set([...bundled, ...(0, featureSource_1.availableFeatures)(fs, sdk)]);
    // Declared coverage. `targetsSupported: { <feature>: [<target>, …] }` is
    // the author's statement about which targets a feature ships source for, so
    // it is checkable — unlike its absence, which means nothing either way.
    const supported = manifest?.targetsSupported;
    for (const fname of Object.keys(supported ?? {}).sort()) {
        for (const tname of claims(supported, fname)) {
            const tm = node_path_1.default.join(sdk, 'tm', tname);
            if (0 === (0, featureSource_1.findFeatureSources)(fs, tm, [fname.toLowerCase()]).length) {
                found.push({
                    level: 'warn', point: 'feature-source-undelivered', file,
                    kind: 'feature', name: fname,
                    note: file + ': `targetsSupported.' + fname + '` claims ' + tname +
                        ', but tm/' + tname + ' holds no source this generator can find ' +
                        'for it — see the naming conventions in ' +
                        'docs/how-to/add-a-feature.md'
                });
            }
        }
    }
    if (0 === bundled.length) {
        return found;
    }
    const targets = new Set([
        ...claims(manifest?.provides, 'target'),
        ...(0, definition_1.definitionNames)(fs, sdk, 'target'),
    ]);
    for (const tname of Array.from(targets).sort()) {
        const tm = node_path_1.default.join(sdk, 'tm', tname);
        const strays = (0, featureSource_1.findFeatureEntries)(fs, tm, known)
            .filter((e) => e.shaped && !known.has(e.name) && featureSource_1.BASE_FEATURE !== e.name);
        if (0 === strays.length) {
            continue;
        }
        found.push({
            level: 'warn', point: 'feature-source-unrecognised', file,
            kind: 'target', name: tname,
            note: 'tm/' + tname + ': ' + strays.map((e) => e.path).join(', ') +
                ' — named like feature source, but no `model/feature/<name>.aontu` ' +
                'declares ' + strays.map((e) => e.name).join(', ') +
                ', so the trim cannot recognise them and every project gets them ' +
                'whatever its model selects'
        });
    }
    return found;
}
//# sourceMappingURL=check.js.map