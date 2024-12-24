"use strict";
/* Copyright (c) 2024 Richard Rodger, MIT License */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePath = exports.Jostraca = exports.FeatureHook = exports.ReadmeEntity = exports.ReadmeOptions = exports.ReadmeInstall = exports.Readme = exports.Feature = exports.Entity = exports.Main = exports.List = exports.Slot = exports.Line = exports.Inject = exports.Fragment = exports.Copy = exports.Content = exports.File = exports.Folder = exports.Project = exports.omap = exports.deep = exports.template = exports.getx = exports.get = exports.vmap = exports.cmap = exports.select = exports.kebabify = exports.camelify = exports.snakify = exports.each = exports.names = exports.cmp = void 0;
exports.SdkGen = SdkGen;
const Fs = __importStar(require("node:fs"));
const util_1 = require("@voxgig/util");
const jsonic_1 = require("jsonic");
const JostracaModule = __importStar(require("jostraca"));
const aontu_1 = require("aontu");
const utility_1 = require("./utility");
Object.defineProperty(exports, "requirePath", { enumerable: true, get: function () { return utility_1.requirePath; } });
const Main_1 = require("./cmp/Main");
Object.defineProperty(exports, "Main", { enumerable: true, get: function () { return Main_1.Main; } });
const Entity_1 = require("./cmp/Entity");
Object.defineProperty(exports, "Entity", { enumerable: true, get: function () { return Entity_1.Entity; } });
const Feature_1 = require("./cmp/Feature");
Object.defineProperty(exports, "Feature", { enumerable: true, get: function () { return Feature_1.Feature; } });
const Readme_1 = require("./cmp/Readme");
Object.defineProperty(exports, "Readme", { enumerable: true, get: function () { return Readme_1.Readme; } });
const ReadmeInstall_1 = require("./cmp/ReadmeInstall");
Object.defineProperty(exports, "ReadmeInstall", { enumerable: true, get: function () { return ReadmeInstall_1.ReadmeInstall; } });
const ReadmeOptions_1 = require("./cmp/ReadmeOptions");
Object.defineProperty(exports, "ReadmeOptions", { enumerable: true, get: function () { return ReadmeOptions_1.ReadmeOptions; } });
const ReadmeEntity_1 = require("./cmp/ReadmeEntity");
Object.defineProperty(exports, "ReadmeEntity", { enumerable: true, get: function () { return ReadmeEntity_1.ReadmeEntity; } });
const FeatureHook_1 = require("./cmp/FeatureHook");
Object.defineProperty(exports, "FeatureHook", { enumerable: true, get: function () { return FeatureHook_1.FeatureHook; } });
const target_1 = require("./action/target");
const feature_1 = require("./action/feature");
const { Jostraca } = JostracaModule;
exports.Jostraca = Jostraca;
const ACTION_MAP = {
    target: target_1.action_target,
    feature: feature_1.action_feature,
};
function SdkGen(opts) {
    const fs = opts.fs || Fs;
    const folder = opts.folder || '../';
    const jostraca = Jostraca();
    const pino = (0, util_1.prettyPino)('sdkgen', opts);
    const log = pino.child({ cmp: 'sdkgen' });
    async function generate(spec) {
        const start = Date.now();
        const { model, config } = spec;
        log.info({ point: 'generate-start', start });
        log.debug({ point: 'generate-spec', spec });
        let Root = spec.root;
        if (null == Root && null != config.root) {
            clear(config.root);
            const rootModule = require(config.root);
            Root = rootModule.Root;
        }
        const jopts = {
            fs: () => fs,
            folder,
            log: log.child({ cmp: 'jostraca' }),
            meta: { spec },
            debug: opts.debug,
        };
        await jostraca.generate(jopts, () => Root({ model }));
        log.info({ point: 'generate-end' });
        return { ok: true, name: 'sdkgen' };
    }
    async function action(args) {
        const pargs = args.map(arg => (0, jsonic_1.Jsonic)(arg));
        const actname = args[0];
        const action = ACTION_MAP[actname];
        if (null == action) {
            throw new utility_1.SdkGenError('Unknown action: ' + actname);
        }
        const { model, tree } = resolveModel();
        const ctx = {
            fs: () => fs,
            log,
            folder: '.', // The `generate` folder,
            model,
            tree,
        };
        await action(pargs, ctx);
    }
    function resolveModel() {
        const path = './model/sdk.jsonic';
        const aopts = { path };
        const src = fs.readFileSync(path, 'utf8');
        const tree = (0, aontu_1.Aontu)(src, aopts);
        const hasErr = tree.err && 0 < tree.err.length;
        if (hasErr) {
            for (let serr of tree.err) {
                let err = new utility_1.SdkGenError('Model Error: ' + serr.msg);
                err.cause$ = [serr];
                if ('syntax' === serr.why) {
                    err.uxmsg$ = true;
                }
                // log.error({ fail: 'parse', point: 'guide-parse', file: path, err })
                err.rooterrs$ = tree.err;
                throw err;
            }
        }
        let genctx = new aontu_1.Context({ root: tree });
        const model = tree.gen(genctx);
        // TODO: collect all errors
        if (genctx.err && 0 < genctx.err.length) {
            const err = new utility_1.SdkGenError('Model Error:\n' +
                (genctx.err.map((pe) => pe.msg)).join('\n'));
            // log.error({ fail: 'build', what: 'guide', file: path, err })
            err.errs = () => genctx.err;
            throw err;
        }
        // TODO: FIX: This is a hack to set the correct src file
        // aontu bug: url is empty
        tree.url = path;
        model.const = { name: model.name };
        (0, exports.names)(model.const, model.name);
        model.const.year = new Date().getFullYear();
        return {
            model,
            tree,
        };
    }
    return {
        pino,
        generate,
        action,
    };
}
SdkGen.makeBuild = async function (opts) {
    let sdkgen = undefined;
    // let apidef: any = undefined
    const config = {
        root: opts.root,
        def: opts.def || 'no-def',
        kind: 'openapi-3',
        model: opts.model ? (opts.model.folder + '/api.jsonic') : 'no-model',
        meta: opts.meta || {},
    };
    return async function build(model, build, ctx) {
        if (null == sdkgen) {
            sdkgen = SdkGen({
                ...opts,
                pino: build.log,
                debug: build.spec.debug,
            });
        }
        // await apidef.generate({ model, build, config })
        return await sdkgen.generate({ model, build, config });
    };
};
// Adapted from https://github.com/sindresorhus/import-fresh - Thanks!
function clear(path) {
    if (null == path) {
        return;
    }
    let filePath = require.resolve(path);
    if (require.cache[filePath]) {
        const children = require.cache[filePath].children.map(child => child.id);
        // Delete module from cache
        delete require.cache[filePath];
        for (const id of children) {
            clear(id);
        }
    }
    if (require.cache[filePath] && require.cache[filePath].parent) {
        let i = require.cache[filePath].parent.children.length;
        while (i--) {
            if (require.cache[filePath].parent.children[i].id === filePath) {
                require.cache[filePath].parent.children.splice(i, 1);
            }
        }
    }
}
// Prevents TS2742
exports.cmp = JostracaModule.cmp;
exports.names = JostracaModule.names;
exports.each = JostracaModule.each;
exports.snakify = JostracaModule.snakify;
exports.camelify = JostracaModule.camelify;
exports.kebabify = JostracaModule.kebabify;
exports.select = JostracaModule.select;
exports.cmap = JostracaModule.cmap;
exports.vmap = JostracaModule.vmap;
exports.get = JostracaModule.get;
exports.getx = JostracaModule.getx;
exports.template = JostracaModule.template;
exports.deep = JostracaModule.deep;
exports.omap = JostracaModule.omap;
exports.Project = JostracaModule.Project;
exports.Folder = JostracaModule.Folder;
exports.File = JostracaModule.File;
exports.Content = JostracaModule.Content;
exports.Copy = JostracaModule.Copy;
exports.Fragment = JostracaModule.Fragment;
exports.Inject = JostracaModule.Inject;
exports.Line = JostracaModule.Line;
exports.Slot = JostracaModule.Slot;
exports.List = JostracaModule.List;
//# sourceMappingURL=sdkgen.js.map