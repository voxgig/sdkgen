"use strict";
/* Copyright (c) 2024-2026 Voxgig Ltd, MIT License */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SDKGEN_ROOT = exports.PLACEHOLDERS = void 0;
exports.stageConsumer = stageConsumer;
exports.generateInto = generateInto;
exports.manifestParity = manifestParity;
// THE TEST KIT: `@voxgig/sdkgen/testkit`.
//
// See §14 of docs/design/sdkgen-packages.md.
//
// WHY THIS EXISTS
//
// sdkgen's own suites are CLOSED. `parity.test.ts` and `featuremodel.test.ts`
// derive their sets from `ts/project/.sdk` listings; `generate.test.ts` runs
// the per-language components out of a staged copy of that same tree. All of
// it is excellent coverage that an external package gets exactly none of —
// and an external package is where the coverage is needed most, because its
// content reaches a consumer through the same add pipeline with none of the
// same review.
//
// So the machinery is parameterised rather than reimplemented: this module is
// the staging in `build/scaffold-stage.js` and the generation harness in
// `ts/test/generateharness.ts`, with the paths taken as arguments instead of
// hardcoded to the bundled scaffold.
//
// WHAT A PACKAGE AUTHOR DOES WITH IT
//
//   const consumer = stageConsumer()
//   await consumer.addPackage(__dirname + '/..')   // the package under test
//   consumer.compile()                             // as a consumer's build does
//   const { files, leaks } = await generateInto(consumer, { model })
//
// That runs the REAL add pipeline and the REAL generation, so provenance,
// index handling, the feature fan-out and the trim catalogue are all exercised
// against the package as published rather than as described.
//
// NO RUNTIME DEPENDENCIES. This package has none and the test kit does not
// introduce any: `compile()` reaches for a transpiler at call time and says
// which ones it looked for if it finds none.
const node_fs_1 = __importDefault(require("node:fs"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const jostraca_1 = require("jostraca");
const sdkgen_1 = require("./sdkgen");
const package_1 = require("./action/package");
const dispatch_1 = require("./action/dispatch");
const types_1 = require("./types");
// This package's own root — `<...>/node_modules/@voxgig/sdkgen` for a
// consumer, or the checkout when sdkgen tests itself. Computed from this
// module's location rather than by `require.resolve`, which would go through
// the `exports` map and answer with `dist/sdkgen.js` instead of the root.
const SDKGEN_ROOT = node_path_1.default.resolve(__dirname, '..');
exports.SDKGEN_ROOT = SDKGEN_ROOT;
// The placeholder tokens template substitution is supposed to replace. One
// surviving into generated output means a replace map did not reach a file —
// the failure mode `generate.test.ts` scans the bundled targets for, made
// available to packages that ship template trees of their own.
const PLACEHOLDERS = ['ProjectName', 'PROJECTNAME', 'GOMODULE', 'PROJECTENV'];
exports.PLACEHOLDERS = PLACEHOLDERS;
const noop = () => { };
function makeLog(lines) {
    const push = (level) => (entry) => {
        if (lines)
            lines.push({ level, ...entry });
    };
    const log = {
        lines,
        info: push('info'), debug: push('debug'), warn: push('warn'),
        error: push('error'), trace: push('trace'), fatal: push('fatal'),
    };
    log.child = () => log;
    return log;
}
// A CONSUMER PROJECT ON REAL DISK, not in memfs.
//
// It has to be real: `requirePath` resolves a component with an actual Node
// `require` against `<root>/.sdk/dist/cmp/...`, and components read sibling
// fragment files off disk relative to their own `__dirname`. A memfs project
// can exercise the add pipeline (sdkgen's own action suites do) but can never
// RUN what it installed, which is the half a package author most needs.
function stageConsumer(opts = {}) {
    const root = opts.dir ?? node_fs_1.default.mkdtempSync(node_path_1.default.join(node_os_1.default.tmpdir(), 'sdkgen-consumer-'));
    const sdk = node_path_1.default.join(root, '.sdk');
    node_fs_1.default.mkdirSync(node_path_1.default.join(sdk, 'model', 'target'), { recursive: true });
    node_fs_1.default.mkdirSync(node_path_1.default.join(sdk, 'model', 'feature'), { recursive: true });
    node_fs_1.default.writeFileSync(node_path_1.default.join(sdk, 'model', 'target', 'target-index.aontu'), '# Targets\n');
    node_fs_1.default.writeFileSync(node_path_1.default.join(sdk, 'model', 'feature', 'feature-index.aontu'), '# Features\n');
    const name = opts.name ?? 'demo';
    // The project's OWN model, written once by create-sdkgen at init. It
    // includes the indexes of the kinds that existed THEN — which is why a
    // consumer staged here can show what an existing project does when a new
    // kind arrives, rather than assuming every index is already wired.
    node_fs_1.default.writeFileSync(node_path_1.default.join(sdk, 'model', 'sdk.aontu'), "name: '" + name + "'\n" +
        '@"target/target-index.aontu"\n' +
        '@"feature/feature-index.aontu"\n' +
        (opts.extra ? opts.extra + '\n' : ''));
    // `@voxgig/sdkgen` has to be resolvable FROM THE CONSUMER, because the
    // feature fan-out reads the bundled feature models through the path a
    // consumer sees them at (`node_modules/@voxgig/sdkgen/...`, relative to the
    // project) and scaffold components `require('@voxgig/sdkgen')` by name.
    //
    // 'junction' is the portable spelling: on Windows it creates a directory
    // junction, which needs no elevation, and on POSIX the type argument is
    // ignored and an ordinary symlink results. A copy would work too and costs
    // the whole 27-target template tree per staged consumer.
    // NODE_MODULES LIVES INSIDE `.sdk`, NOT BESIDE IT.
    //
    // A generated SDK's `.sdk` is itself an npm package root — it has its own
    // package.json and its own install — so that is where a consumer's
    // `@voxgig/sdkgen` actually sits. It matters because the feature fan-out
    // composes the path from the ACTION FOLDER (`<.sdk>/node_modules/...`)
    // rather than resolving it upward; put the link one level too high and
    // every bundled feature reports `feature-source-unresolved` while
    // `require('@voxgig/sdkgen')` from a component keeps working, because
    // Node's upward search finds either. One of the two readers is forgiving
    // and the other is not.
    const modules = node_path_1.default.join(sdk, 'node_modules');
    const links = [linkModule(modules, '@voxgig/sdkgen', SDKGEN_ROOT)];
    // ...and sdkgen's PEERS, because the base model schema a consumer compiles
    // against pulls in `@voxgig/apidef/model/apidef.aontu` by package name. A
    // consumer that really installed sdkgen has these; a staged one has to be
    // given them, or every model compile here fails on an include that resolves
    // fine everywhere else.
    for (const dep of peerNames()) {
        const from = node_path_1.default.join(SDKGEN_ROOT, 'node_modules', dep);
        if (node_fs_1.default.existsSync(from)) {
            links.push(linkModule(modules, dep, from));
        }
    }
    const lines = [];
    const log = makeLog(opts.recordLog ? lines : undefined);
    const actx = {
        fs: () => node_fs_1.default,
        log,
        folder: sdk,
        model: {
            const: { name, Name: name.charAt(0).toUpperCase() + name.slice(1) },
            main: {
                [types_1.KIT]: { feature: {}, entity: {}, target: {} },
            },
        },
        url: node_path_1.default.join(sdk, 'model', 'sdk.aontu'),
        jostraca: (0, jostraca_1.Jostraca)({ existing: { txt: { write: true, merge: false } } }),
        opts: { dryrun: false },
    };
    const files = () => walk(sdk)
        .map((p) => node_path_1.default.relative(sdk, p).split(node_path_1.default.sep).join('/'))
        .filter((p) => !p.startsWith('.jostraca/') && !p.includes('/.jostraca/'))
        .sort();
    return {
        root, sdk, actx, log,
        addPackage: async (ref, flags = {}) => {
            actx.flags = flags;
            return (0, package_1.package_add)([ref], actx);
        },
        // Through `ACTION_MAP`, which is the SAME dispatch the CLI uses — so a
        // kind registered later is installable here with no change to the kit,
        // and a kind whose action is missing fails the way the CLI fails.
        add: async (kind, ref, flags = {}) => {
            const action = dispatch_1.ACTION_MAP[kind];
            if (null == action) {
                throw new Error('testkit: no such kind: ' + kind +
                    ' (known: ' + Object.keys(dispatch_1.ACTION_MAP).sort().join(', ') + ')');
            }
            actx.flags = flags;
            // `[kind, cmd, ...refs]` — the CLI's own argv shape, which is what
            // `action_<kind>` parses (it reads the verb at args[1]).
            return action([kind, 'add', ref], actx);
        },
        // CONSUMER-RELATIVE, not absolute, and that is not a stylistic choice.
        //
        // `target add` records `base` as the resolved source folder, so an
        // absolute ref writes THIS MACHINE'S path into the installed model. Two
        // things then go wrong at once: the copy is not reproducible across
        // machines, and the feature fan-out compares the target's own tm folder
        // against the one it reaches through `node_modules` — textually different
        // paths for the same tree, which it reports as a shadowing overlay. Both
        // disappear when the ref is spelled the way a consumer spells it.
        bundledRef: (kind, name) => 'target' === kind ? 'node_modules/@voxgig/sdkgen/project/' + name : name,
        inSdk: (fn) => {
            const prev = process.cwd();
            process.chdir(sdk);
            try {
                return fn();
            }
            finally {
                process.chdir(prev);
            }
        },
        compile: (copts = {}) => compileComponents(sdk, copts.transform),
        files,
        cleanup: () => {
            if (null == opts.dir) {
                // The symlinks go FIRST. `rmSync` does not follow them, so this is
                // belt and braces — but the thing on the other end is the sdkgen
                // checkout (or a real node_modules tree), and the cost of being wrong
                // about that once is unbounded.
                for (const link of links) {
                    try {
                        node_fs_1.default.unlinkSync(link);
                    }
                    catch (err) { /* a shim dir, not a link */ }
                }
                node_fs_1.default.rmSync(root, { recursive: true, force: true });
            }
        },
    };
}
// The peer packages a consumer necessarily has installed alongside sdkgen.
// Read from the manifest rather than listed here, so a peer added later is
// linked without anyone remembering to.
function peerNames() {
    try {
        const pkg = JSON.parse(node_fs_1.default.readFileSync(node_path_1.default.join(SDKGEN_ROOT, 'package.json'), 'utf8'));
        return Object.keys(pkg.peerDependencies ?? {});
    }
    catch (err) {
        return [];
    }
}
// One `node_modules/<name>` entry pointing at an existing package directory.
//
// 'junction' is the portable spelling: on Windows it creates a directory
// junction, which needs no elevation, and on POSIX the type argument is
// ignored and an ordinary symlink results. A copy would work too and costs the
// whole 27-target template tree per staged consumer.
function linkModule(modules, name, from) {
    const link = node_path_1.default.join(modules, ...name.split('/'));
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(link), { recursive: true });
    if (node_fs_1.default.existsSync(link))
        return link;
    try {
        node_fs_1.default.symlinkSync(from, link, 'junction');
    }
    catch (err) {
        // Last resort: a re-export shim. It satisfies `require('<name>')` but NOT
        // deep file reads under the package, so a model include would still fail
        // — which is why this is the fallback and not the mechanism.
        node_fs_1.default.mkdirSync(link, { recursive: true });
        node_fs_1.default.writeFileSync(node_path_1.default.join(link, 'package.json'), JSON.stringify({ name, version: '0.0.0', main: 'index.js' }) + '\n');
        node_fs_1.default.writeFileSync(node_path_1.default.join(link, 'index.js'), 'module.exports = require(' + JSON.stringify(from) + ')\n');
    }
    return link;
}
function walk(dir) {
    if (!node_fs_1.default.existsSync(dir))
        return [];
    const out = [];
    for (const entry of node_fs_1.default.readdirSync(dir, { withFileTypes: true })) {
        const full = node_path_1.default.join(dir, entry.name);
        if (entry.isDirectory())
            out.push(...walk(full));
        else
            out.push(full);
    }
    return out;
}
// TRANSPILE, DO NOT TYPE-CHECK.
//
// Type-checking a package's components is a BUILD-time gate (the package runs
// `tsc --noEmit` over its own `src/cmp/**`, the way this repo's
// `check-scaffold` does). Doing it again per staged consumer would add seconds
// to every test for an answer the build already has. What the kit needs here
// is only executable JS at the path `requirePath` reads.
//
// Neither transpiler is a dependency of this package, which has none. They are
// looked up at call time, and if neither is present the error names both
// rather than failing later as a missing module inside `requirePath`.
function compileComponents(sdk, transform) {
    const srcdir = node_path_1.default.join(sdk, 'src', 'cmp');
    const outdir = node_path_1.default.join(sdk, 'dist', 'cmp');
    if (!node_fs_1.default.existsSync(srcdir))
        return 0;
    const xform = transform ?? defaultTransform();
    let count = 0;
    for (const file of walk(srcdir)) {
        const rel = node_path_1.default.relative(srcdir, file);
        // Fragments are template source carrying placeholder tokens, not valid
        // standalone modules — the same exclusion `tsconfig.scaffold.json` makes.
        if (rel.split(node_path_1.default.sep).includes('fragment'))
            continue;
        const out = node_path_1.default.join(outdir, rel.replace(/\.ts$/, '.js'));
        node_fs_1.default.mkdirSync(node_path_1.default.dirname(out), { recursive: true });
        if (!file.endsWith('.ts')) {
            // Components read sibling non-TS files (fragments, docs) relative to
            // their own __dirname, so those have to arrive in dist too.
            node_fs_1.default.copyFileSync(file, node_path_1.default.join(outdir, rel));
            continue;
        }
        node_fs_1.default.writeFileSync(out, xform(node_fs_1.default.readFileSync(file, 'utf8'), file));
        count++;
    }
    return count;
}
function defaultTransform() {
    const tried = [];
    try {
        tried.push('sucrase');
        const sucrase = require('sucrase');
        return (src, file) => sucrase.transform(src, {
            transforms: ['typescript', 'imports'],
            filePath: file,
        }).code;
    }
    catch (err) { /* fall through to typescript */ }
    try {
        tried.push('typescript');
        const ts = require('typescript');
        return (src, file) => ts.transpileModule(src, {
            fileName: file,
            compilerOptions: {
                target: ts.ScriptTarget.ES2021,
                module: ts.ModuleKind.CommonJS,
                esModuleInterop: true,
            },
        }).outputText;
    }
    catch (err) { /* fall through to the error */ }
    throw new Error('testkit: no TypeScript transpiler found (looked for: ' +
        tried.join(', ') + '). Add one as a devDependency, or pass ' +
        '`compile({ transform })` with your own.');
}
// GENERATE INTO MEMORY, from a consumer staged on disk.
//
// The split matters: the project (components, templates, model) is real,
// because that is what generation READS; the output is a memfs volume,
// because a test wants to assert on it rather than clean it up.
async function generateInto(consumer, opts) {
    // memfs is a devDependency of whoever is testing, not of this package.
    let memfs;
    try {
        memfs = require('memfs').memfs;
    }
    catch (err) {
        throw new Error('testkit: generateInto needs `memfs` — add it as a devDependency');
    }
    const { fs, vol } = memfs({});
    const sdkgen = (0, sdkgen_1.SdkGen)({
        fs: layeredFs(fs),
        folder: consumer.root,
        root: '',
        pino: consumer.log,
    });
    // GENERATION RUNS FROM `.sdk`.
    //
    // Components copy their template tree with a CWD-RELATIVE path
    // (`Copy({ from: 'tm/<lang>' })`), because that is how a consumer runs it —
    // `npm run generate` from the `.sdk` directory. Run it from anywhere else
    // and the first feature copy fails on a `tm/...` path that does not exist
    // relative to the caller's cwd, naming the template rather than the reason.
    //
    // The chdir is restored even when generation throws, because a test runner
    // shares one process across suites and a leaked cwd breaks whatever runs
    // next, somewhere else entirely.
    const prevcwd = process.cwd();
    process.chdir(consumer.sdk);
    let res;
    try {
        res = await sdkgen.generate({
            model: opts.model,
            root: opts.root ?? defaultRoot(),
        });
    }
    finally {
        process.chdir(prevcwd);
    }
    if (true !== res.ok) {
        throw new Error('testkit: generation failed: ' + JSON.stringify(res));
    }
    const files = {};
    for (const [path, content] of Object.entries(vol.toJSON())) {
        const rel = node_path_1.default.relative(consumer.root, path).split(node_path_1.default.sep).join('/');
        if (rel.startsWith('.jostraca/') || rel.includes('/.jostraca/'))
            continue;
        files[rel] = content;
    }
    const allow = opts.allowPlaceholder ?? (() => false);
    const leaks = [];
    for (const [path, content] of Object.entries(files)) {
        if ('string' !== typeof content)
            continue;
        for (const token of PLACEHOLDERS) {
            if (content.includes(token) && !allow(path, token)) {
                leaks.push(path + ': ' + token);
            }
        }
    }
    return { files, leaks: leaks.sort() };
}
// Write to memfs, read through to the real project.
function layeredFs(mem) {
    const readThrough = (name) => (path, ...rest) => {
        const target = mem.existsSync(path) ? mem : node_fs_1.default;
        return target[name](path, ...rest);
    };
    return {
        ...mem,
        existsSync: (path) => mem.existsSync(path) || node_fs_1.default.existsSync(path),
        readFileSync: readThrough('readFileSync'),
        readdirSync: readThrough('readdirSync'),
        statSync: readThrough('statSync'),
        realpathSync: readThrough('realpathSync'),
    };
}
// The Root a create-sdkgen consumer has: per target, a folder holding the
// entity, feature, main, readme, agentguide and test phases.
//
// Deliberately minimal. A package author testing their own target wants to
// know that THEIR components ran, not to re-test the scaffold's Root — and a
// kit that shipped an elaborate Root would make its own behaviour part of
// every package's test result.
function defaultRoot() {
    const { cmp, each, names, Project, Folder } = require('jostraca');
    const { Main, Entity, Feature, Test, Readme, AgentGuide } = require('./sdkgen');
    return cmp(function Root(props) {
        const { model, ctx$ } = props;
        model.const = model.const || { name: model.name };
        names(model.const, model.name);
        if (null == model.const.year)
            model.const.year = new Date().getFullYear();
        names(model, model.name);
        ctx$.model = model;
        ctx$.stdrep = ctx$.stdrep || {};
        names(ctx$.stdrep, model.Name, 'Project' + 'Name');
        const target = model.main[types_1.KIT].target || {};
        const feature = model.main[types_1.KIT].feature || {};
        const entity = model.main[types_1.KIT].entity || {};
        Project({}, () => {
            each(target)
                .filter((t) => t && false !== t.active)
                .map((t) => {
                names(t, t.name);
                const phase = t.phase || {};
                const on = (n) => false !== (phase[n] && phase[n].active);
                Folder({ name: t.name }, () => {
                    if (on('entity')) {
                        each(entity)
                            .filter((e) => e && false !== e.active)
                            .map((e) => {
                            names(e, e.name);
                            Entity({ target: t, entity: e });
                        });
                    }
                    if (on('feature')) {
                        each(feature)
                            .filter((f) => f && f.active)
                            .map((f) => {
                            names(f, f.name);
                            Feature({ target: t, feature: f });
                        });
                    }
                    Main({ target: t });
                    if (on('readme'))
                        Readme({ target: t });
                    if (on('agentguide'))
                        AgentGuide({ target: t });
                    if (on('test'))
                        Test({ target: t });
                });
            });
        });
    });
}
// THE PARITY TIER A PACKAGE DECLARES, from its manifest.
//
// `ts/test/parity.test.ts` owns the tier declaration for BUNDLED targets, and
// §18.4a refused to duplicate that map into the bundled manifest for exactly
// the reason this function exists to eventually resolve: the manifest should
// become the source and the parity suite should read it, not the reverse. For
// an EXTERNAL package there is no such conflict — its manifest is the only
// place its tier can live, so reading it here is the whole mechanism.
function manifestParity(pkgRoot) {
    const file = node_path_1.default.join(pkgRoot, 'sdkgen-package.json');
    if (!node_fs_1.default.existsSync(file))
        return {};
    const manifest = JSON.parse(node_fs_1.default.readFileSync(file, 'utf8'));
    return manifest.parity ?? {};
}
//# sourceMappingURL=testkit.js.map