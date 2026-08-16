"use strict";
// KINDS: the things an `add` can install.
//
// `target` and `feature` are two of them, `docs` and others are meant to
// follow (docs/design/sdkgen-packages.md §8). They were two hand-written
// pipelines that had already drifted apart — only one took path refs, only
// one applied a replace map, only one recorded provenance — and a third kind
// would have been a third copy of the same drift.
//
// What every kind shares is declared here and executed once:
//
//   - the ref grammar and resolution, including the fallback to what the
//     model already records for a bare name;
//   - whether the kind may be installed under a different name (`~alias`);
//   - the definition file: `model/<kind>/<name>.aontu`, stamped with
//     provenance and landing under the INSTALLED name;
//   - the include list: `model/<kind>/<kind>-index.aontu`.
//
// What a kind adds on top — a target's component and template trees, a
// feature's per-target source fan-out — stays in that kind's own action. Those
// are genuinely different work, not the same work with different strings, and
// pretending otherwise would buy generality nobody can use.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KINDS = void 0;
exports.recordedRef = recordedRef;
exports.aliasModelKey = aliasModelKey;
exports.kindTrees = kindTrees;
exports.escapeRe = escapeRe;
exports.kindDef = kindDef;
exports.resolveKind = resolveKind;
exports.kindModel = kindModel;
exports.isBare = isBare;
const node_path_1 = __importDefault(require("node:path"));
const jostraca_1 = require("jostraca");
const types_1 = require("../types");
const utility_1 = require("../utility");
const stdrep_1 = require("../helpers/stdrep");
const resolve_1 = require("./resolve");
const action_1 = require("./action");
// Rewrite the ITEM KEY in a copied model file, for an aliased install.
//
// Parameterised by kind because `main: kit: docs: <n>:` is the same rewrite
// with a different word, and a second copy of this regex is exactly the
// same-rule-written-twice defect the registry exists to prevent.
//
// Two forms are in use across the shipped models — bare (`target: go:`) and
// quoted (`target: 'go-cli':`) — and two paths carry the key: the item
// block itself (`main: kit: target: <t>:`) and the per-target feature-deps
// slot every target model declares
// (`main: kit: feature: &: target: <t>: deps: &:`). Both belong to the
// installed item, so both move. Matching on `<kind>: ` rather than on the
// bare name is what keeps the rewrite off the item's own values — `ext: go`
// and `module: name: '$$name$$'` must not change.
//
// ONE regex, with the quote optional and captured, rather than two entries in
// jostraca's `replace` map: that map canonicalises each key into a regex
// group NAME, and the bare and quoted spellings of the same key reduce to the
// same name — so one silently overwrote the other and `go-cli~cli2` came out
// as the BARE `target: cli2:`, losing the quoting a hyphenated key needs.
//
// The alias may also NEED quoting when the origin did not: aontu rejects a
// bare key containing a hyphen (`unexpected character(s): -`), so
// `target add go~go-alt` emitting the origin's unquoted style produced a
// model that could not compile at all. Quote when the origin was quoted OR
// the alias is not a bare identifier.
const BARE_KEY_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
function aliasModelKey(kind) {
    return function aliasModelText(src, origname, name) {
        const mustQuote = !BARE_KEY_RE.test(name);
        return src.replace(new RegExp(kind + ":(\\s*)('?)" + escapeRe(origname) + "\\2:", 'g'), (_m, gap, quote) => {
            const q = ('' !== quote || mustQuote) ? "'" : '';
            return kind + ':' + gap + q + name + q + ':';
        });
    };
}
function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const KINDS = Object.assign(Object.create(null), {
    target: {
        name: 'target', alias: true, ownedWhenAliased: true,
        rename: aliasModelKey('target'),
        // Components are dispatched by the convention `cmp/<t>/Main_<t>`, and the
        // template tree is what `target add` copies — a target missing either is
        // not installable, however complete its model file looks.
        trees: [
            { path: 'src/cmp/{name}', replace: 'none', required: true },
            { path: 'tm/{name}', replace: 'template', required: true },
        ],
    },
    feature: { name: 'feature', alias: false },
    // DOCS — the third kind. See docs/design/sdkgen-packages.md §20.
    //
    // Its trees are NESTED under the kind name (`src/cmp/docs/<n>`, not
    // `src/cmp/<n>`) so a docs item and a target may share a name without
    // sharing a directory. Everything that composes those paths takes them
    // from here.
    //
    // `tm/docs/{name}` is NOT required: a docs item whose every emitted byte
    // depends on the API — a catalogue entry, a config file — legitimately
    // ships no template tree, while a static site needs one. So it is
    // copy-if-present, and `package check` does not demand it.
    docs: {
        name: 'docs', alias: true, ownedWhenAliased: true,
        rename: aliasModelKey('docs'),
        trees: [
            { path: 'src/cmp/docs/{name}', replace: 'none', required: true },
            { path: 'tm/docs/{name}', replace: 'template', required: false },
        ],
    },
});
exports.KINDS = KINDS;
// The trees a kind's add copies, with `{name}` resolved. ONE composition of
// these paths, read by the add, by doctor's drift walk and (through
// `requires`) by manifest validation — three readers that must agree about
// where an item's content lives, and previously would each have spelled it.
function kindTrees(kind, name) {
    return (kindDef(kind).trees ?? []).map((t) => ({
        ...t,
        path: t.path.split('{name}').join(name),
    }));
}
function kindDef(kind) {
    const def = KINDS[kind];
    if (null == def) {
        throw new utility_1.SdkGenError('Unknown kind: ' + kind);
    }
    return def;
}
// Resolve one ref for a kind, applying that kind's alias policy.
//
// A BARE name resolves against what the model already RECORDS. Without that,
// provenance would be write-only: the add actions re-run with the model's own
// keys (`circuitbreaker`, not the ref it was installed from), a bare name
// falls back to the bundled scaffold — whose `.sdk` folder exists, so
// resolution SUCCEEDS — and the copy then throws on a definition that is not
// there. An explicit ref always wins: that is how something is moved to a new
// source.
function resolveKind(ref, kind, ctx$) {
    const def = kindDef(kind);
    const model = ctx$.model;
    const declared = model?.main?.[types_1.KIT]?.[kind]?.[ref];
    const recorded = (isBare(ref) && recordedRef(declared, ref)) || ref;
    const source = (0, resolve_1.resolveSource)(recorded, kind, ctx$);
    // Asked of the RESOLVER rather than by re-reading the ref. `~` separates an
    // alias only in the last segment, and a check that looked for one anywhere
    // rejected every ref whose PATH contains a tilde — a Windows 8.3 short name
    // like `C:\Users\RUNNER~1\...` is one. Parsing the ref in two places is what
    // let that defect come back after it was fixed.
    if (!def.alias && source.name !== source.origname) {
        throw new utility_1.SdkGenError(capitalise(kind) + ' aliasing is not supported: ' + ref +
            '\n  A ' + kind + ' name is part of the generated config ' +
            '(options.' + kind + '.<name>) and of the hook wiring in every target, ' +
            'so it cannot be renamed at install time.');
    }
    // The DEFINITION has to be there, not just the folder that would hold it.
    //
    // Resolution stops at the `.sdk` folder, and a bare name resolves to the
    // bundled scaffold — whose folder always exists — so a name with no
    // definition anywhere resolved "successfully" and then failed much later
    // inside jostraca's Copy, as a shape validation error naming a path the
    // caller never wrote.
    //
    // Where that bites is the fan-out: `target add` re-runs `feature add` for
    // every feature key in the model, and a key with no definition installed
    // aborted the ENTIRE target add — no templates, no components, nothing —
    // over one feature. A plain Error, not an SdkGenError, so the fan-out's
    // per-item guard skips it with a warning; the add path for an explicit ref
    // does not catch, so `feature add nosuch` still fails, now saying what is
    // actually missing.
    if (!ctx$.fs().existsSync(source.model)) {
        throw new Error(capitalise(kind) + ' definition not found: ' + source.model);
    }
    return source;
}
// Emit the kind's definition file and its index entry.
//
// Called inside a `Folder({ name: 'model/<kind>' })`, so both land together.
// `names` is every INSTALLED name seen so far in this run: the index File is
// re-rendered per item and the last render wins, so each render has to carry
// all of them.
function kindModel(props) {
    const { ctx$, kind, source, names, content } = props;
    const def = kindDef(kind);
    const fs = ctx$.fs();
    const log = ctx$.log;
    const aliased = source.name !== source.origname;
    const replace = (0, stdrep_1.provenanceReplace)({
        base: source.base,
        origname: source.origname,
        name: source.name,
        package: source.package,
    });
    if (aliased) {
        // The copy lands under the INSTALLED name AND declares it. Left alone it
        // kept the origin basename (jostraca defaults a single-file Copy's
        // destination to the source's), so the index named a file that does not
        // exist — which fails the whole model compile, not just the alias.
        //
        // `exclude: true` — CREATE, never overwrite, for a kind whose aliased
        // definition is project-owned: an alias exists to be differentiated,
        // which is why doctor reports its diffs as informational and why
        // add-a-target tells the project to edit it.
        const owned = true === def.ownedWhenAliased;
        if (owned) {
            const dest = node_path_1.default.join(ctx$.folder ?? '.', 'model', kind, source.name + '.aontu');
            if (fs.existsSync(dest)) {
                log.info({
                    point: kind + '-alias-model-kept', [kind]: source.name, file: dest,
                    note: source.name + ': keeping the existing aliased ' + kind +
                        ' model (project-owned — an alias is differentiated by editing it)'
                });
            }
        }
        const src = fs.readFileSync(source.model, 'utf8');
        const text = null == def.rename ? src :
            def.rename(src, source.origname, source.name);
        (0, jostraca_1.File)({ name: source.name + '.aontu', exclude: owned }, () => (0, jostraca_1.Content)((0, jostraca_1.template)(text, ctx$.model, { replace })));
    }
    else {
        (0, jostraca_1.Copy)({ from: source.model, replace });
    }
    (0, jostraca_1.File)({ name: def.name + '-index.aontu' }, () => (0, action_1.UpdateIndex)({
        content,
        names,
    }));
}
// The ref that reinstalls what the model already records — `base` says which
// `.sdk` folder, `origname` says what it is called there.
//
// The ALIAS has to be carried back through. Rebuilding only `<base>/../<orig>`
// resolves to the ORIGIN name, so `target add go2` (after installing
// `go~go2`) would refresh and index a new `go` target and leave `go2` stale —
// losing the differentiated identity the alias exists for, and the
// project-owned model file with it.
//
// ONE definition, used by the add actions and by doctor. This reconstruction
// was written twice and the two copies had already diverged on exactly this
// point, which is the drift the kind spine exists to end.
function recordedRef(declared, name) {
    if (null == declared?.base || '' === declared.base) {
        return undefined;
    }
    const origname = declared.origname || name;
    return node_path_1.default.join(declared.base, '..', origname) +
        (origname === name ? '' : '~' + name);
}
// A bare NAME, as opposed to a ref that locates a source.
function isBare(ref) {
    return !ref.includes('/') && !ref.includes(node_path_1.default.sep);
}
function capitalise(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
//# sourceMappingURL=kind.js.map