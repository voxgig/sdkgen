"use strict";
/* Copyright (c) 2026 Voxgig Ltd, MIT License */
Object.defineProperty(exports, "__esModule", { value: true });
exports.assess = assess;
exports.main = main;
exports.npmFailure = npmFailure;
exports.npmTrustScript = npmTrustScript;
exports.parseArgs = parseArgs;
exports.parseTrustList = parseTrustList;
exports.run = run;
exports.trustCommand = trustCommand;
const node_child_process_1 = require("node:child_process");
const USAGE = 'usage: npm-trust --repository <owner/repo> ' +
    '--publish <package>=<workflow.yml> [--publish ...] ' +
    '[--check | --dry-run] [--replace] [--otp <code>]';
const REPOSITORY_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const WORKFLOW_RE = /^[A-Za-z0-9_.-]+\.ya?ml$/;
const PACKAGE_RE = /^(@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/;
function parseArgs(argv) {
    const spec = { repository: '', publish: [], mode: 'setup', replace: false };
    const modes = [];
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        const value = () => {
            const v = argv[++i];
            if (null == v || v.startsWith('--')) {
                throw new Error(`${arg} needs a value\n${USAGE}`);
            }
            return v;
        };
        if ('--repository' === arg) {
            if ('' !== spec.repository) {
                throw new Error('--repository is given twice; the generated script already names it');
            }
            spec.repository = value();
        }
        else if ('--publish' === arg) {
            const v = value();
            const eq = v.indexOf('=');
            spec.publish.push({ pkg: v.slice(0, eq < 0 ? v.length : eq), file: eq < 0 ? '' : v.slice(eq + 1) });
        }
        else if ('--check' === arg || '--dry-run' === arg) {
            modes.push(arg.slice(2));
        }
        else if ('--replace' === arg) {
            spec.replace = true;
        }
        else if ('--otp' === arg) {
            spec.otp = value();
        }
        else {
            throw new Error(`unknown argument: ${arg}\n${USAGE}`);
        }
    }
    if (1 < modes.length) {
        throw new Error(`--check and --dry-run are alternatives\n${USAGE}`);
    }
    spec.mode = modes[0] || 'setup';
    if ('check' === spec.mode && spec.replace) {
        throw new Error('--check changes nothing, so it cannot --replace');
    }
    if (!REPOSITORY_RE.test(spec.repository)) {
        throw new Error(`--repository must be owner/repo, got: ${spec.repository || '(none)'}\n${USAGE}`);
    }
    if (0 === spec.publish.length) {
        throw new Error(`at least one --publish is required\n${USAGE}`);
    }
    const seen = new Set();
    for (const { pkg, file } of spec.publish) {
        if (!PACKAGE_RE.test(pkg)) {
            throw new Error(`not an npm package name: ${pkg}`);
        }
        if (!WORKFLOW_RE.test(file)) {
            throw new Error(`${pkg}: the workflow must be a .yml file name, not a path, got: ${file || '(none)'}`);
        }
        if (seen.has(pkg)) {
            throw new Error(`${pkg} is named twice`);
        }
        seen.add(pkg);
    }
    return spec;
}
// `npm trust list --json` prints one pretty-printed object per configuration
// rather than an array, so the objects are split out by brace depth.
function parseTrustList(text) {
    const src = text.trim();
    if ('' === src) {
        return [];
    }
    try {
        const whole = JSON.parse(src);
        return Array.isArray(whole) ? whole : [whole];
    }
    catch {
        // Not a single JSON value: fall through to the object stream.
    }
    const entries = [];
    let depth = 0;
    let start = -1;
    let inString = false;
    let escaped = false;
    for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (inString) {
            if (escaped) {
                escaped = false;
            }
            else if ('\\' === c) {
                escaped = true;
            }
            else if ('"' === c) {
                inString = false;
            }
        }
        else if ('"' === c) {
            inString = true;
        }
        else if ('{' === c) {
            if (0 === depth) {
                start = i;
            }
            depth++;
        }
        else if ('}' === c) {
            depth--;
            if (0 === depth) {
                entries.push(JSON.parse(src.slice(start, i + 1)));
            }
        }
    }
    if (0 !== depth) {
        throw new Error('could not read the output of `npm trust list --json`');
    }
    return entries;
}
// The generated workflows declare no GitHub environment, so a configuration
// that names one would never match the job's OIDC token.
function assess(pub, repository, entries) {
    const matches = (e) => 'github' === e.type &&
        repository.toLowerCase() === String(e.repository || '').toLowerCase() &&
        pub.file === e.file &&
        null == e.environment &&
        (null == e.permissions || e.permissions.includes('createPackage'));
    const match = entries.find(matches);
    return { match, extra: entries.filter((e) => e !== match) };
}
function describe(e) {
    return [
        e.type || '?',
        e.repository || '?',
        e.file || '?',
        ...(null == e.environment ? [] : ['environment ' + e.environment]),
        ...(null == e.permissions ? [] : ['[' + e.permissions.join(', ') + ']']),
        ...(null == e.id ? [] : ['id ' + e.id]),
    ].join(' ');
}
function trustCommand(repository, pub) {
    return `npm trust github ${pub.pkg} --repository ${repository} ` +
        `--file ${pub.file} --allow-publish`;
}
function run(spec, npm, out) {
    if ('dry-run' === spec.mode) {
        for (const pub of spec.publish) {
            out(`${pub.pkg}: ${trustCommand(spec.repository, pub)}`);
        }
        if (spec.replace) {
            out('--replace would also revoke any other trusted publisher of these packages.');
        }
        return 0;
    }
    let drift = false;
    // Nothing is created beside a configuration this repository did not ask
    // for, so a replacement revokes first and creates after.
    for (const pub of spec.publish) {
        const { match, extra } = assess(pub, spec.repository, npm.list(pub.pkg));
        const wanted = `github ${spec.repository} ${pub.file}`;
        let kept = 0;
        for (const e of extra) {
            if ('setup' === spec.mode && spec.replace && null != e.id) {
                npm.revoke(pub.pkg, e.id);
                out(`${pub.pkg}: revoked: ${describe(e)}`);
            }
            else {
                kept++;
                out(`${pub.pkg}: also trusted, and not by this repository's workflows: ${describe(e)}` +
                    ('setup' === spec.mode ? ' (--replace revokes it)' : ''));
            }
        }
        const create = null == match && 'setup' === spec.mode && 0 === kept;
        if (null != match) {
            out(`${pub.pkg}: trusted: ${wanted}`);
        }
        else if (create) {
            npm.create(pub.pkg, spec.repository, pub.file);
            out(`${pub.pkg}: now trusted: ${wanted}`);
        }
        else {
            out(`${pub.pkg}: NOT trusted: ${wanted}`);
        }
        drift = drift || 0 < kept || (null == match && !create);
    }
    return drift ? 1 : 0;
}
function npmFailure(action, stderr) {
    if (/EOTP|one-time pass/i.test(stderr)) {
        return `${action} needs a one-time password: run again with --otp <code>`;
    }
    if (/E404|not found/i.test(stderr)) {
        return `${action}: the package is not on npm yet. Publish its first version ` +
            'by hand, then set up trusted publishing';
    }
    if (/E401|ENEEDAUTH/.test(stderr)) {
        return `${action}: not logged in to npm with publish rights. Run \`npm login\` first`;
    }
    return `${action} failed:\n${stderr.trim()}`;
}
// An npm without the command still exits 0 from `npm trust --help`, printing
// "Unknown command", so only the usage text tells a capable npm apart.
function trustCapableNpm() {
    const shell = 'win32' === process.platform;
    const probe = (0, node_child_process_1.spawnSync)('npm', ['trust', '--help'], { encoding: 'utf8', shell });
    return /npm trust github/.test(String(probe.stdout || '') + String(probe.stderr || '')) ?
        ['npm'] : ['npx', '--yes', 'npm@latest'];
}
// A captured call has no terminal, so npm raises EOTP instead of prompting;
// the mutating calls keep the terminal and can prompt.
function npmPort(otp) {
    const npm = trustCapableNpm();
    const shell = 'win32' === process.platform;
    const otpArgs = null == otp ? [] : ['--otp', otp];
    const call = (args, capture) => {
        const res = (0, node_child_process_1.spawnSync)(npm[0], [...npm.slice(1), ...args, ...otpArgs], {
            encoding: 'utf8',
            stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
            shell,
        });
        if (null != res.error) {
            throw new Error(`could not run ${npm[0]}: ${res.error.message}`);
        }
        if (0 !== res.status) {
            throw new Error(npmFailure(`npm ${args.slice(0, 3).join(' ')}`, String(res.stderr || '')));
        }
        return String(res.stdout || '');
    };
    return {
        list: (pkg) => parseTrustList(call(['trust', 'list', pkg, '--json'], true)),
        create: (pkg, repository, file) => {
            call(['trust', 'github', pkg, '--repository', repository,
                '--file', file, '--allow-publish', '--yes'], false);
        },
        revoke: (pkg, id) => {
            call(['trust', 'revoke', pkg, '--id=' + id], false);
        },
    };
}
function shellQuote(value) {
    return "'" + value.replace(/'/g, "'\\''") + "'";
}
// A null repository still writes the script, so one generated while the
// repository was on github.com cannot outlive the move.
function npmTrustScript(repository, publish) {
    if (null == repository) {
        return `#!/usr/bin/env bash
# Generated by @voxgig/sdkgen. npm trusts GitHub Actions only for a repository
# on github.com, and this project's repository is elsewhere.
echo 'npm trusted publishing needs the repository on github.com; see .sdk/PUBLISHING.md.' >&2
exit 1
`;
    }
    const args = [
        '--repository ' + shellQuote(repository),
        ...publish.map((p) => '--publish ' + shellQuote(`${p.pkg}=${p.file}`)),
        '"$@"',
    ];
    return `#!/usr/bin/env bash
# Generated by @voxgig/sdkgen. Registers this repository's npm publish
# workflows as trusted publishers; --check reports drift, --dry-run changes nothing.
set -euo pipefail
sdk_dir="$(cd -- "$(dirname -- "\${BASH_SOURCE[0]}")/.." && pwd)"
trust="$sdk_dir/node_modules/@voxgig/sdkgen/dist/admin/npm-trust.js"
if [[ ! -f "$trust" ]]; then
  echo 'Install or update the .sdk dependencies to configure npm trusted publishing.' >&2
  exit 1
fi
exec node "$trust" \\
  ${args.join(' \\\n  ')}
`;
}
const OFFLINE = {
    list() { throw new Error('--dry-run does not contact npm'); },
    create() { throw new Error('--dry-run does not contact npm'); },
    revoke() { throw new Error('--dry-run does not contact npm'); },
};
function main(argv) {
    try {
        const spec = parseArgs(argv);
        const npm = 'dry-run' === spec.mode ? OFFLINE : npmPort(spec.otp);
        return run(spec, npm, (line) => console.log(line));
    }
    catch (err) {
        console.error(err.message);
        return 2;
    }
}
if (require.main === module) {
    process.exitCode = main(process.argv.slice(2));
}
//# sourceMappingURL=npm-trust.js.map