"use strict";
/* Copyright (c) 2024-2025 Richard Rodger, MIT License */
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePath = exports.Jostraca = exports.FeatureHook = exports.ReadmeRef = exports.ReadmeExplanation = exports.ReadmeHowto = exports.ReadmeEntity = exports.ReadmeOptions = exports.ReadmeModel = exports.ReadmeIntro = exports.ReadmeErrors = exports.ReadmeQuick = exports.ReadmeInstall = exports.AgentGuideFeature = exports.AgentGuide = exports.AgentGuideTop = exports.ReadmeTop = exports.Readme = exports.Test = exports.Feature = exports.Entity = exports.Changelog = exports.Security = exports.License = exports.Deploy = exports.Main = exports.List = exports.Slot = exports.Line = exports.Inject = exports.Fragment = exports.Copy = exports.Content = exports.File = exports.Folder = exports.Project = exports.omap = exports.deep = exports.indent = exports.template = exports.getx = exports.get = exports.vmap = exports.cmap = exports.kebabify = exports.camelify = exports.snakify = exports.each = exports.names = exports.cmp = void 0;
exports.GENERATOR_URL = exports.SECURITY_EMAIL = exports.PUBLISHER_URL = exports.PUBLISHER = exports.langLabel = exports.apiName = exports.repoInfo = exports.envName = exports.keywords = exports.nonAffiliation = exports.pkgDescription = exports.vendorCommand = exports.registryName = exports.isPublished = exports.registryState = exports.installCommand = exports.packageName = exports.safeVarName = exports.isReservedName = exports.entityClassName = exports.pickExampleEntity = exports.entityPrimaryOp = exports.entityOps = exports.entityDataIdField = exports.entityIdField = exports.opRequestShape = exports.opParams = exports.opTypeName = exports.OP_SUFFIX = exports.canonKey = exports.canonToType = exports.collectDeps = exports.getMatchEntries = exports.buildIdNames = exports.resolveAuthPrefix = exports.isAuthActive = void 0;
exports.SdkGen = SdkGen;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const util_1 = require("@voxgig/util");
const jsonic_1 = require("jsonic");
const JostracaModule = __importStar(require("jostraca"));
const aontu_1 = require("aontu");
const util_2 = require("@voxgig/util");
const utility_1 = require("./utility");
Object.defineProperty(exports, "requirePath", { enumerable: true, get: function () { return utility_1.requirePath; } });
Object.defineProperty(exports, "isAuthActive", { enumerable: true, get: function () { return utility_1.isAuthActive; } });
Object.defineProperty(exports, "resolveAuthPrefix", { enumerable: true, get: function () { return utility_1.resolveAuthPrefix; } });
const Main_1 = require("./cmp/Main");
Object.defineProperty(exports, "Main", { enumerable: true, get: function () { return Main_1.Main; } });
const Deploy_1 = require("./cmp/Deploy");
Object.defineProperty(exports, "Deploy", { enumerable: true, get: function () { return Deploy_1.Deploy; } });
const Entity_1 = require("./cmp/Entity");
Object.defineProperty(exports, "Entity", { enumerable: true, get: function () { return Entity_1.Entity; } });
const Feature_1 = require("./cmp/Feature");
Object.defineProperty(exports, "Feature", { enumerable: true, get: function () { return Feature_1.Feature; } });
const Readme_1 = require("./cmp/Readme");
Object.defineProperty(exports, "Readme", { enumerable: true, get: function () { return Readme_1.Readme; } });
const ReadmeTop_1 = require("./cmp/ReadmeTop");
Object.defineProperty(exports, "ReadmeTop", { enumerable: true, get: function () { return ReadmeTop_1.ReadmeTop; } });
const AgentGuideTop_1 = require("./cmp/AgentGuideTop");
Object.defineProperty(exports, "AgentGuideTop", { enumerable: true, get: function () { return AgentGuideTop_1.AgentGuideTop; } });
const AgentGuide_1 = require("./cmp/AgentGuide");
Object.defineProperty(exports, "AgentGuide", { enumerable: true, get: function () { return AgentGuide_1.AgentGuide; } });
const AgentGuideFeature_1 = require("./cmp/AgentGuideFeature");
Object.defineProperty(exports, "AgentGuideFeature", { enumerable: true, get: function () { return AgentGuideFeature_1.AgentGuideFeature; } });
const License_1 = require("./cmp/License");
Object.defineProperty(exports, "License", { enumerable: true, get: function () { return License_1.License; } });
const Security_1 = require("./cmp/Security");
Object.defineProperty(exports, "Security", { enumerable: true, get: function () { return Security_1.Security; } });
const Changelog_1 = require("./cmp/Changelog");
Object.defineProperty(exports, "Changelog", { enumerable: true, get: function () { return Changelog_1.Changelog; } });
const Test_1 = require("./cmp/Test");
Object.defineProperty(exports, "Test", { enumerable: true, get: function () { return Test_1.Test; } });
const ReadmeInstall_1 = require("./cmp/ReadmeInstall");
Object.defineProperty(exports, "ReadmeInstall", { enumerable: true, get: function () { return ReadmeInstall_1.ReadmeInstall; } });
const ReadmeQuick_1 = require("./cmp/ReadmeQuick");
Object.defineProperty(exports, "ReadmeQuick", { enumerable: true, get: function () { return ReadmeQuick_1.ReadmeQuick; } });
const ReadmeErrors_1 = require("./cmp/ReadmeErrors");
Object.defineProperty(exports, "ReadmeErrors", { enumerable: true, get: function () { return ReadmeErrors_1.ReadmeErrors; } });
const ReadmeIntro_1 = require("./cmp/ReadmeIntro");
Object.defineProperty(exports, "ReadmeIntro", { enumerable: true, get: function () { return ReadmeIntro_1.ReadmeIntro; } });
const ReadmeModel_1 = require("./cmp/ReadmeModel");
Object.defineProperty(exports, "ReadmeModel", { enumerable: true, get: function () { return ReadmeModel_1.ReadmeModel; } });
const ReadmeOptions_1 = require("./cmp/ReadmeOptions");
Object.defineProperty(exports, "ReadmeOptions", { enumerable: true, get: function () { return ReadmeOptions_1.ReadmeOptions; } });
const ReadmeEntity_1 = require("./cmp/ReadmeEntity");
Object.defineProperty(exports, "ReadmeEntity", { enumerable: true, get: function () { return ReadmeEntity_1.ReadmeEntity; } });
const ReadmeHowto_1 = require("./cmp/ReadmeHowto");
Object.defineProperty(exports, "ReadmeHowto", { enumerable: true, get: function () { return ReadmeHowto_1.ReadmeHowto; } });
const ReadmeExplanation_1 = require("./cmp/ReadmeExplanation");
Object.defineProperty(exports, "ReadmeExplanation", { enumerable: true, get: function () { return ReadmeExplanation_1.ReadmeExplanation; } });
const ReadmeRef_1 = require("./cmp/ReadmeRef");
Object.defineProperty(exports, "ReadmeRef", { enumerable: true, get: function () { return ReadmeRef_1.ReadmeRef; } });
const FeatureHook_1 = require("./cmp/FeatureHook");
Object.defineProperty(exports, "FeatureHook", { enumerable: true, get: function () { return FeatureHook_1.FeatureHook; } });
const buildIdNames_1 = require("./helpers/buildIdNames");
Object.defineProperty(exports, "buildIdNames", { enumerable: true, get: function () { return buildIdNames_1.buildIdNames; } });
const getMatchEntries_1 = require("./helpers/getMatchEntries");
Object.defineProperty(exports, "getMatchEntries", { enumerable: true, get: function () { return getMatchEntries_1.getMatchEntries; } });
const collectDeps_1 = require("./helpers/collectDeps");
Object.defineProperty(exports, "collectDeps", { enumerable: true, get: function () { return collectDeps_1.collectDeps; } });
const canonType_1 = require("./helpers/canonType");
Object.defineProperty(exports, "canonToType", { enumerable: true, get: function () { return canonType_1.canonToType; } });
Object.defineProperty(exports, "canonKey", { enumerable: true, get: function () { return canonType_1.canonKey; } });
const opShape_1 = require("./helpers/opShape");
Object.defineProperty(exports, "OP_SUFFIX", { enumerable: true, get: function () { return opShape_1.OP_SUFFIX; } });
Object.defineProperty(exports, "opTypeName", { enumerable: true, get: function () { return opShape_1.opTypeName; } });
Object.defineProperty(exports, "opParams", { enumerable: true, get: function () { return opShape_1.opParams; } });
Object.defineProperty(exports, "opRequestShape", { enumerable: true, get: function () { return opShape_1.opRequestShape; } });
Object.defineProperty(exports, "entityIdField", { enumerable: true, get: function () { return opShape_1.entityIdField; } });
Object.defineProperty(exports, "entityDataIdField", { enumerable: true, get: function () { return opShape_1.entityDataIdField; } });
Object.defineProperty(exports, "entityOps", { enumerable: true, get: function () { return opShape_1.entityOps; } });
Object.defineProperty(exports, "entityPrimaryOp", { enumerable: true, get: function () { return opShape_1.entityPrimaryOp; } });
Object.defineProperty(exports, "pickExampleEntity", { enumerable: true, get: function () { return opShape_1.pickExampleEntity; } });
Object.defineProperty(exports, "entityClassName", { enumerable: true, get: function () { return opShape_1.entityClassName; } });
const naming_1 = require("./helpers/naming");
Object.defineProperty(exports, "isReservedName", { enumerable: true, get: function () { return naming_1.isReservedName; } });
Object.defineProperty(exports, "safeVarName", { enumerable: true, get: function () { return naming_1.safeVarName; } });
const packageMeta_1 = require("./helpers/packageMeta");
Object.defineProperty(exports, "packageName", { enumerable: true, get: function () { return packageMeta_1.packageName; } });
Object.defineProperty(exports, "installCommand", { enumerable: true, get: function () { return packageMeta_1.installCommand; } });
Object.defineProperty(exports, "registryState", { enumerable: true, get: function () { return packageMeta_1.registryState; } });
Object.defineProperty(exports, "isPublished", { enumerable: true, get: function () { return packageMeta_1.isPublished; } });
Object.defineProperty(exports, "registryName", { enumerable: true, get: function () { return packageMeta_1.registryName; } });
Object.defineProperty(exports, "vendorCommand", { enumerable: true, get: function () { return packageMeta_1.vendorCommand; } });
Object.defineProperty(exports, "pkgDescription", { enumerable: true, get: function () { return packageMeta_1.pkgDescription; } });
Object.defineProperty(exports, "nonAffiliation", { enumerable: true, get: function () { return packageMeta_1.nonAffiliation; } });
Object.defineProperty(exports, "keywords", { enumerable: true, get: function () { return packageMeta_1.keywords; } });
Object.defineProperty(exports, "envName", { enumerable: true, get: function () { return packageMeta_1.envName; } });
Object.defineProperty(exports, "repoInfo", { enumerable: true, get: function () { return packageMeta_1.repoInfo; } });
Object.defineProperty(exports, "apiName", { enumerable: true, get: function () { return packageMeta_1.apiName; } });
Object.defineProperty(exports, "langLabel", { enumerable: true, get: function () { return packageMeta_1.langLabel; } });
Object.defineProperty(exports, "PUBLISHER", { enumerable: true, get: function () { return packageMeta_1.PUBLISHER; } });
Object.defineProperty(exports, "PUBLISHER_URL", { enumerable: true, get: function () { return packageMeta_1.PUBLISHER_URL; } });
Object.defineProperty(exports, "SECURITY_EMAIL", { enumerable: true, get: function () { return packageMeta_1.SECURITY_EMAIL; } });
Object.defineProperty(exports, "GENERATOR_URL", { enumerable: true, get: function () { return packageMeta_1.GENERATOR_URL; } });
const target_1 = require("./action/target");
const feature_1 = require("./action/feature");
const { Jostraca } = JostracaModule;
exports.Jostraca = Jostraca;
const ACTION_MAP = {
    target: target_1.action_target,
    feature: feature_1.action_feature,
};
const dlog = (0, util_2.getdlog)('sdkgen', __filename);
function SdkGen(opts) {
    const fs = opts.fs || node_fs_1.default;
    const folder = opts.folder || '../';
    const now = opts.now || (() => Date.now());
    // Per-instance cache of the Aontu model loader. Previously a module-level
    // global, which leaked the (relative) preload across SdkGen instances.
    let aontu = null;
    const jopts = {
        now,
        control: {
            dryrun: opts.dryrun
        },
        // Generated SDK output is fully model-derived and never hand-edited, so
        // OVERWRITE existing files on regenerate (jostraca's default). Do NOT enable
        // the 3-way `merge` here: it merges against a `.jostraca` base that drifts
        // from the toolchain, which (a) silently KEEPS a stale generated file when a
        // template adds a field a newer component references (-> `undefined: X`
        // compile errors, e.g. Control.Actor / Result.Stream), and (b) injects
        // `<<<<<<<` conflict markers when a generated/index file is touched, which
        // then break downstream parsers (aontu) and compilers. Overwrite makes
        // generation deterministic: same model -> byte-stable output.
        // See docs/explanation/regeneration-overwrite.md.
        existing: {
            txt: {
                write: true,
                merge: false
            }
        }
    };
    const jostraca = Jostraca(jopts);
    const pino = (0, util_1.prettyPino)('sdkgen', opts);
    const log = pino.child({ cmp: 'sdkgen' });
    async function generate(spec) {
        const start = Date.now();
        const { model, config } = spec;
        log.info({ point: 'generate-start', start, note: opts.dryrun ? '** DRY RUN **' : '' });
        log.debug({ point: 'generate-spec', spec });
        let Root = spec.root;
        if (null == Root && null != config?.root) {
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
            // Respect the caller's `existing` policy (the .sdk/build/sdkgen.js action
            // config). SDK output should be OVERWRITE, not 3-way merge — that is set
            // at the scaffold source (create-sdkgen build/sdkgen.js: existing.txt =
            // { write:true, merge:false }); see docs/explanation/regeneration-overwrite.md.
            existing: opts.existing,
        };
        const jres = await jostraca.generate(jopts, () => Root({ model }));
        (0, util_2.showChanges)(jopts.log, 'generate-result', jres, node_path_1.default.dirname(process.cwd()));
        const dlogs = dlog.log();
        if (0 < dlogs.length) {
            for (let dlogentry of dlogs) {
                log.debug({ point: 'generate-warning', dlogentry, note: String(dlogentry) });
            }
        }
        log.info({ point: 'generate-end' });
        return { ok: true, name: 'sdkgen' };
    }
    async function action(args) {
        const pargs = args.map(arg => (0, jsonic_1.Jsonic)(arg));
        const actname = args[0];
        const actionFunc = ACTION_MAP[actname];
        if (null == actionFunc) {
            throw new utility_1.SdkGenError('Unknown action: ' + actname);
        }
        const ctx = resolveActionContext();
        await actionFunc(pargs, ctx);
    }
    function resolveActionContext() {
        // TODO: use AsyncLocalStorage to avoid reloading model
        const { model, url } = resolveModel();
        const ctx = {
            fs: () => fs,
            log,
            folder: '.', // The `generate` folder,
            model,
            url,
            jostraca,
            opts,
        };
        return ctx;
    }
    function resolveModel() {
        const path = './model/sdk.aontu';
        const errs = [];
        if (null == aontu) {
            aontu = new aontu_1.Aontu();
        }
        const aopts = { path, errs };
        const src = fs.readFileSync(path, 'utf8');
        const model = aontu.generate(src, aopts);
        if (0 < errs.length) {
            const serr = errs[0];
            const err = new utility_1.SdkGenError('Model Error: ' + serr.msg);
            err.cause$ = [serr];
            if ('syntax' === serr.why) {
                err.uxmsg$ = true;
            }
            err.rooterrs$ = errs;
            throw err;
        }
        model.const = { name: model.name };
        (0, exports.names)(model.const, model.name);
        model.const.year = new Date().getFullYear();
        return {
            model,
            url: path,
        };
    }
    const target = {
        add: async (targets) => {
            const ctx = resolveActionContext();
            return (0, target_1.target_add)(targets, ctx);
        }
    };
    const feature = {
        add: async (features) => {
            const ctx = resolveActionContext();
            return (0, feature_1.feature_add)(features, ctx);
        }
    };
    return {
        pino: pino,
        generate,
        action,
        target,
        feature,
    };
}
SdkGen.makeBuild = async function (opts) {
    let sdkgen = undefined;
    // let apidef: any = undefined
    const config = {
        root: opts.root,
        def: opts.def || 'no-def',
        kind: 'openapi-3',
        model: opts.model ? (opts.model.folder + '/api.aontu') : 'no-model',
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
exports.cmap = JostracaModule.cmap;
exports.vmap = JostracaModule.vmap;
exports.get = JostracaModule.get;
exports.getx = JostracaModule.getx;
exports.template = JostracaModule.template;
exports.indent = JostracaModule.indent;
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