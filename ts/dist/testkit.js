"use strict";
/* Copyright (c) 2024-2026 Voxgig Ltd, MIT License */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SDKGEN_ROOT = exports.PLACEHOLDERS = void 0;
exports.volumeKey = volumeKey;
exports.stageConsumer = stageConsumer;
exports.generateInto = generateInto;
exports.manifestParity = manifestParity;
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
const PLACEHOLDERS = [
    'ProjectName', 'PROJECTNAME', 'PROJECTENV', 'PROJECTVERSION', 'GOMODULE',
];
exports.PLACEHOLDERS = PLACEHOLDERS;
const PLACEHOLDER_REF = /\$\$[A-Za-z_][A-Za-z0-9_.]*\$\$/;
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
function stageConsumer(opts = {}) {
    const root = opts.dir ?? node_fs_1.default.mkdtempSync(node_path_1.default.join(node_os_1.default.tmpdir(), 'sdkgen-consumer-'));
    const sdk = node_path_1.default.join(root, '.sdk');
    node_fs_1.default.mkdirSync(node_path_1.default.join(sdk, 'model', 'target'), { recursive: true });
    node_fs_1.default.mkdirSync(node_path_1.default.join(sdk, 'model', 'feature'), { recursive: true });
    node_fs_1.default.writeFileSync(node_path_1.default.join(sdk, 'model', 'target', 'target-index.aon'), '# Targets\n');
    node_fs_1.default.writeFileSync(node_path_1.default.join(sdk, 'model', 'feature', 'feature-index.aon'), '# Features\n');
    const name = opts.name ?? 'demo';
    node_fs_1.default.writeFileSync(node_path_1.default.join(sdk, 'model', 'sdk.aon'), "name: '" + name + "'\n" +
        '@"./target/target-index.aon"\n' +
        '@"./feature/feature-index.aon"\n' +
        (opts.extra ? opts.extra + '\n' : ''));
    const modules = node_path_1.default.join(sdk, 'node_modules');
    const links = [linkModule(modules, '@voxgig/sdkgen', SDKGEN_ROOT)];
    for (const dep of peerNames()) {
        const from = peerRoot(dep);
        if (null != from) {
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
        url: node_path_1.default.join(sdk, 'model', 'sdk.aon'),
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
            return action([kind, 'add', ref], actx);
        },
        bundledRef: (kind, name) => 'target' === kind ? 'node_modules/@voxgig/sdkgen/project/' + name : name,
        setModel: (model) => { actx.model = model; },
        inSdk: (fn) => {
            const prev = process.cwd();
            process.chdir(sdk);
            let out;
            try {
                out = fn();
            }
            catch (err) {
                process.chdir(prev);
                throw err;
            }
            if (null != out && 'function' === typeof out.then) {
                return out.then((v) => { process.chdir(prev); return v; }, (err) => { process.chdir(prev); throw err; });
            }
            process.chdir(prev);
            return out;
        },
        compile: (copts = {}) => compileComponents(sdk, copts.transform),
        files,
        cleanup: () => {
            if (null == opts.dir) {
                // The links go FIRST, explicitly. `rmSync` would remove them without
                // following (measured), so this is belt and braces for the walk — but
                // it is NOT redundant on Windows, where a junction refuses `unlink`
                // and `force: true` forgives only ENOENT, so leaving it to the walk
                // can throw.
                for (const link of links) {
                    unlink(link);
                }
                node_fs_1.default.rmSync(root, { recursive: true, force: true });
            }
        },
    };
}
function unlink(link) {
    let stat;
    try {
        stat = node_fs_1.default.lstatSync(link);
    }
    catch (err) {
        return;
    }
    if (stat.isSymbolicLink()) {
        try {
            node_fs_1.default.unlinkSync(link);
            return;
        }
        catch (err) { }
        try {
            node_fs_1.default.rmdirSync(link);
        }
        catch (err) { }
        return;
    }
    try {
        node_fs_1.default.rmSync(link, { recursive: true, force: true });
    }
    catch (err) { }
}
function volumeKey(p) {
    return p.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '');
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
function peerRoot(dep) {
    try {
        return node_path_1.default.dirname(require.resolve(dep + '/package.json', { paths: [SDKGEN_ROOT] }));
    }
    catch (err) {
        // Some packages restrict `exports` and refuse the package.json subpath.
        // Fall back to the entry point and climb to the directory that holds one.
        try {
            let dir = node_path_1.default.dirname(require.resolve(dep, { paths: [SDKGEN_ROOT] }));
            for (let up = 0; up < 8; up++) {
                if (node_fs_1.default.existsSync(node_path_1.default.join(dir, 'package.json')))
                    return dir;
                const parent = node_path_1.default.dirname(dir);
                if (parent === dir)
                    break;
                dir = parent;
            }
        }
        catch (err2) { }
        return undefined;
    }
}
function linkModule(modules, name, from) {
    const link = node_path_1.default.join(modules, ...name.split('/'));
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(link), { recursive: true });
    if (node_fs_1.default.existsSync(link))
        return link;
    try {
        node_fs_1.default.symlinkSync(from, link, 'junction');
    }
    catch (err) {
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
    catch (err) { }
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
    catch (err) { }
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
    const rootkey = volumeKey(consumer.root);
    const declared = (opts.outside ?? [])
        .map((dest) => ({ dest, key: volumeKey(node_path_1.default.resolve(consumer.root, dest)) }))
        .sort((a, b) => b.key.length - a.key.length);
    const files = {};
    const outside = {};
    for (const { dest } of declared) {
        outside[dest] = {};
    }
    for (const [path, content] of Object.entries(vol.toJSON())) {
        const key = volumeKey(path);
        const under = (base) => key === base || key.startsWith(base + '/');
        const rel = (base) => key === base ? '' : key.slice(base.length + 1);
        // The generator's own bookkeeping, wherever it landed. Skipped in both
        // views for the same reason: the caller is asking what package was
        // written, not what jostraca recorded about writing it.
        const junk = (p) => p.startsWith('.jostraca/') || p.includes('/.jostraca/');
        if (under(rootkey)) {
            const p = rel(rootkey);
            if (!junk(p))
                files[p] = content;
            continue;
        }
        const hit = declared.find((d) => under(d.key));
        if (null != hit) {
            const p = rel(hit.key);
            if (!junk(p))
                outside[hit.dest][p] = content;
            continue;
        }
        throw new Error('testkit: generated path is not under the consumer root or any ' +
            'declared out-of-tree destination, so the result cannot be keyed.' +
            '\n  root: ' + consumer.root +
            '\n  path: ' + path +
            '\n  compared as: ' + rootkey + '  vs  ' + key +
            (0 === declared.length
                ? '\nIf this target declares `output: path`, pass that path in the ' +
                    '`outside` option.'
                : '\n  declared: ' + declared.map((d) => d.key).join(', ')) +
            '\nThese must agree once separators and any drive letter are ' +
            'normalised — memfs stores volume keys, not OS paths.');
    }
    const allow = opts.allowPlaceholder ?? (() => false);
    const leaks = [];
    // SCANNED IN BOTH VIEWS. An out-of-tree target's output goes through the
    // same replace maps and leaks a placeholder the same way, so a scan that
    // covered only the in-tree files would report `leaks: []` for a package
    // whose whole output is external.
    const scan = (prefix, map) => {
        for (const [path, content] of Object.entries(map)) {
            if ('string' !== typeof content)
                continue;
            const label = prefix + path;
            for (const token of PLACEHOLDERS) {
                if (content.includes(token) && !allow(label, token)) {
                    leaks.push(label + ': ' + token);
                }
            }
            const ref = content.match(PLACEHOLDER_REF);
            if (null != ref && !allow(label, ref[0])) {
                leaks.push(label + ': ' + ref[0]);
            }
        }
    };
    scan('', files);
    for (const { dest } of declared) {
        scan(dest + '/', outside[dest]);
    }
    return { files, outside, leaks: leaks.sort() };
}
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
function manifestParity(pkgRoot) {
    const file = node_path_1.default.join(pkgRoot, 'sdkgen-package.json');
    if (!node_fs_1.default.existsSync(file))
        return {};
    const manifest = JSON.parse(node_fs_1.default.readFileSync(file, 'utf8'));
    return manifest.parity ?? {};
}
//# sourceMappingURL=testkit.js.map