"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.repositoryStatus = repositoryStatus;
exports.main = main;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = require("node:child_process");
function command(cwd, bin, args) {
    return (0, node_child_process_1.spawnSync)(bin, args, { cwd, encoding: 'utf8', timeout: 15000, windowsHide: true, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } });
}
function git(cwd, args) {
    const result = command(cwd, 'git', args);
    return result.status === 0 ? result.stdout.trim() : null;
}
function directory(path) {
    return node_fs_1.default.existsSync(path) && node_fs_1.default.statSync(path).isDirectory();
}
function entries(value) {
    return Object.entries(value || {}).filter(([name]) => !name.includes('$')).sort(([a], [b]) => a.localeCompare(b));
}
function workingTree(folder) {
    if (!directory(folder))
        return 'missing';
    const state = git(folder, ['status', '--porcelain=v1', '--untracked-files=normal', '--', '.']);
    return state === null ? 'not a git repository' : state ? 'modified' : 'clean';
}
// Read the compiled model and working trees. Never fetch, build, test, or publish.
function repositoryStatus(root) {
    root = node_path_1.default.resolve(root);
    const sdk = node_path_1.default.join(root, '.sdk');
    if (!directory(sdk))
        throw new Error('Expected an SDK repository containing .sdk: ' + root);
    const file = node_path_1.default.join(sdk, 'model/sdk.json');
    let model, modelError;
    if (node_fs_1.default.existsSync(file)) {
        try {
            model = JSON.parse(node_fs_1.default.readFileSync(file, 'utf8'));
            if (!model?.main?.kit)
                throw new Error('missing main.kit');
        }
        catch (err) {
            modelError = 'Invalid compiled model: ' + err.message;
        }
    }
    const kit = model?.main?.kit || {};
    const upstream = git(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
    const counts = upstream && git(root, ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}']);
    const [ahead, behind] = counts ? counts.split(/\s+/).map(Number) : [null, null];
    const packages = ['sdkgen', 'apidef', 'model', 'docgen'].map(name => {
        const file = node_path_1.default.join(sdk, 'node_modules/@voxgig', name, 'package.json');
        try {
            return { name: '@voxgig/' + name, version: JSON.parse(node_fs_1.default.readFileSync(file, 'utf8')).version };
        }
        catch {
            return { name: '@voxgig/' + name, version: 'not installed' };
        }
    });
    return {
        root, name: model?.name || node_path_1.default.basename(root),
        repository: {
            branch: git(root, ['branch', '--show-current']) || 'detached or not initialised',
            commit: git(root, ['rev-parse', '--short', 'HEAD']), state: workingTree(root), upstream, ahead, behind,
        },
        model: { path: file, compiled: !!model && !modelError, error: modelError,
            generatedAt: node_fs_1.default.existsSync(file) ? node_fs_1.default.statSync(file).mtime.toISOString() : null },
        toolchain: { node: process.version, packages },
        targets: entries(kit.target).map(([name, target]) => {
            const folder = node_path_1.default.resolve(root, target.output?.path || name);
            const present = directory(folder);
            return { name, active: target.active !== false, path: folder, present,
                state: workingTree(folder), readme: node_fs_1.default.existsSync(node_path_1.default.join(folder, 'README.md')),
                version: target.publish?.version || null,
                publication: target.publish?.registry?.state || 'not recorded', };
        }),
        editions: entries(kit.doc?.edition).map(([name, edition]) => ({ name,
            active: kit.doc?.active !== false && edition.active !== false, kind: edition.kind,
            path: edition.output?.path || null,
            present: !!edition.output?.path && node_fs_1.default.existsSync(node_path_1.default.resolve(root, edition.output.path)),
        })),
    };
}
function githubStatus(root) {
    const run = (args) => {
        const result = command(root, 'gh', args);
        if (result.status !== 0)
            throw new Error(result.error?.message || result.stderr.trim() || 'GitHub query failed');
        return JSON.parse(result.stdout);
    };
    const repository = run(['repo', 'view', '--json', 'nameWithOwner,url']);
    const host = new URL(repository.url).hostname;
    const pages = command(root, 'gh', ['api', '--hostname', host, 'repos/' + repository.nameWithOwner + '/pages']);
    let site;
    try {
        site = JSON.parse(pages.stdout || '{}');
    }
    catch {
        site = {};
    }
    if (pages.status !== 0 && String(site.status) !== '404')
        throw new Error(pages.error?.message || pages.stderr.trim() || 'Pages query failed');
    return { repository: repository.nameWithOwner,
        pages: pages.status === 0 ? { url: site.html_url, status: site.status, buildType: site.build_type } : { status: 'not configured' },
        runs: run(['run', 'list', '--limit', '5', '--json', 'workflowName,status,conclusion,headBranch,url']),
    };
}
function main(args = process.argv.slice(2)) {
    const root = args.shift();
    if (args.includes('--help') || root === '--help') {
        console.log('Usage: .sdk/admin/status.sh [--json] [--github]\nRead local repository, SDK, and documentation status. --github also reads Pages and recent CI runs.\nBuild and test results are not inferred from generated files. No commands that change the repository are run.');
        return 0;
    }
    if (!root || args.some(arg => !['--json', '--github'].includes(arg)))
        throw new Error('Usage: status.sh [--json] [--github]');
    const report = repositoryStatus(root);
    let failed = !!report.model.error;
    if (args.includes('--github')) {
        try {
            report.github = githubStatus(report.root);
        }
        catch (err) {
            report.github = { error: err.message };
            failed = true;
        }
    }
    if (args.includes('--json'))
        console.log(JSON.stringify(report, null, 2));
    else {
        console.log('Repository: ' + report.root);
        console.log('Git: ' + report.repository.branch + ' | ' + report.repository.state + ' | ' + (report.repository.commit || 'no commits'));
        console.log('Upstream: ' + (report.repository.upstream ? report.repository.upstream + ' | ahead ' + report.repository.ahead + ', behind ' + report.repository.behind + ' (local tracking refs)' : 'not configured'));
        console.log('Model: ' + (report.model.error || (report.model.compiled ? 'compiled ' + report.model.generatedAt : 'not generated; run npm run generate from .sdk')));
        console.log('Toolchain: Node ' + report.toolchain.node + '; ' + report.toolchain.packages.map((p) => p.name + ' ' + p.version).join('; '));
        console.log('\nSDKs and tools (publication state comes from the model):');
        for (const t of report.targets)
            console.log('  ' + t.name + ' | ' + (t.active ? 'active' : 'inactive') + ' | ' + t.state + ' | version ' + (t.version || 'not recorded') + ' | ' + t.publication + ' | ' + t.path);
        if (!report.targets.length)
            console.log('  No targets in the compiled model.');
        console.log('\nDocumentation:');
        for (const e of report.editions)
            console.log('  ' + e.name + ' | ' + (e.active ? 'active' : 'inactive') + ' | ' + (e.present ? 'present' : 'missing') + ' | ' + (e.path || 'no output path'));
        if (!report.editions.length)
            console.log('  No editions in the compiled model.');
        console.log('\nLocal status does not run builds/tests or check registries. Use --github for remote CI and Pages status.');
        if (report.github)
            console.log('\nGitHub:\n' + JSON.stringify(report.github, null, 2));
    }
    return failed ? 1 : 0;
}
if (require.main === module) {
    try {
        process.exitCode = main();
    }
    catch (err) {
        console.error(err.message);
        process.exitCode = 1;
    }
}
//# sourceMappingURL=status.js.map