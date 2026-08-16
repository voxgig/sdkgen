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
exports.Jostraca = exports.registerComponent = exports.FeatureHook = exports.ReadmeRef = exports.ReadmeExplanation = exports.ReadmeHowto = exports.ReadmeEntity = exports.ReadmeOptions = exports.ReadmeModel = exports.ReadmeIntro = exports.ReadmeErrors = exports.ReadmeQuick = exports.ReadmeInstall = exports.AgentGuideFeature = exports.AgentGuide = exports.AgentGuideTop = exports.ReadmeTop = exports.Readme = exports.Test = exports.Feature = exports.Entity = exports.Changelog = exports.Security = exports.License = exports.Deploy = exports.Main = exports.List = exports.Slot = exports.Line = exports.Inject = exports.Fragment = exports.Copy = exports.Content = exports.File = exports.Folder = exports.Project = exports.omap = exports.deep = exports.indent = exports.template = exports.getx = exports.get = exports.vmap = exports.cmap = exports.kebabify = exports.camelify = exports.snakify = exports.each = exports.names = exports.cmp = void 0;
exports.matchArg = exports.idLiteral = exports.primaryOpCall = exports.liveStrict = exports.hasServerVariables = exports.serverVariables = exports.swiftSafeTypeName = exports.isSwiftSdkType = exports.rbSafeTypeName = exports.isRbCoreConstant = exports.entityCacheField = exports.phpEntityAccessor = exports.exampleVarName = exports.safeVarName = exports.isReservedName = exports.entityCollection = exports.deriveEntityNames = exports.warnEntityTypeCollisions = exports.entityTypeCollisions = exports.entityClassName = exports.pickExampleEntity = exports.entityPrimaryOp = exports.entityOps = exports.entityDataIdField = exports.entityIdField = exports.opRequestShape = exports.entityPath = exports.entityActions = exports.opActions = exports.opParams = exports.opTypeName = exports.OP_SUFFIX = exports.canonKey = exports.canonToDtype = exports.canonToType = exports.collectDeps = exports.getMatchEntries = exports.buildIdNames = exports.SdkGenError = exports.rawStringLiteral = exports.clean = exports.configDefinition = exports.configReprSetting = exports.configRepr = exports.isConfigData = exports.CONFIG_REPR_VALUES = exports.CONFIG_DATA_THRESHOLD = exports.resolveAuthPrefix = exports.isAuthActive = exports.requirePath = void 0;
exports.GENERATOR_URL = exports.SECURITY_EMAIL = exports.PUBLISHER_URL = exports.PUBLISHER = exports.langLabel = exports.apiName = exports.repoInfo = exports.packageVersion = exports.goPackageIdent = exports.goVersion = exports.goModule = exports.envToken = exports.envName = exports.contributorList = exports.authorInfo = exports.keywords = exports.nonAffiliation = exports.pkgDescription = exports.vendorCommand = exports.registryName = exports.isPublished = exports.registryState = exports.installCommand = exports.packageName = exports.jsKey = exports.jsOptProp = exports.jsProp = exports.validateManifest = exports.readManifest = exports.manifestPath = exports.MANIFEST = exports.definitionNames = exports.definitionFolder = exports.definitionPath = exports.srcFeatureExcludes = exports.fullsetExcludes = exports.featureExcludes = exports.findFeatureSources = exports.availableFeatures = exports.featureOf = exports.litFor = exports.dataArg = void 0;
exports.SdkGen = SdkGen;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const util_1 = require("@voxgig/util");
const JostracaModule = __importStar(require("jostraca"));
const aontu_1 = require("aontu");
const util_2 = require("@voxgig/util");
const utility_1 = require("./utility");
Object.defineProperty(exports, "SdkGenError", { enumerable: true, get: function () { return utility_1.SdkGenError; } });
Object.defineProperty(exports, "requirePath", { enumerable: true, get: function () { return utility_1.requirePath; } });
Object.defineProperty(exports, "isAuthActive", { enumerable: true, get: function () { return utility_1.isAuthActive; } });
Object.defineProperty(exports, "resolveAuthPrefix", { enumerable: true, get: function () { return utility_1.resolveAuthPrefix; } });
Object.defineProperty(exports, "CONFIG_DATA_THRESHOLD", { enumerable: true, get: function () { return utility_1.CONFIG_DATA_THRESHOLD; } });
Object.defineProperty(exports, "CONFIG_REPR_VALUES", { enumerable: true, get: function () { return utility_1.CONFIG_REPR_VALUES; } });
Object.defineProperty(exports, "isConfigData", { enumerable: true, get: function () { return utility_1.isConfigData; } });
Object.defineProperty(exports, "configRepr", { enumerable: true, get: function () { return utility_1.configRepr; } });
Object.defineProperty(exports, "configReprSetting", { enumerable: true, get: function () { return utility_1.configReprSetting; } });
Object.defineProperty(exports, "configDefinition", { enumerable: true, get: function () { return utility_1.configDefinition; } });
Object.defineProperty(exports, "clean", { enumerable: true, get: function () { return utility_1.clean; } });
Object.defineProperty(exports, "rawStringLiteral", { enumerable: true, get: function () { return utility_1.rawStringLiteral; } });
const Main_1 = require("./cmp/Main");
Object.defineProperty(exports, "Main", { enumerable: true, get: function () { return Main_1.Main; } });
const ExternalTarget_1 = require("./cmp/ExternalTarget");
const apidef_1 = require("@voxgig/apidef");
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
const Registered_1 = require("./cmp/Registered");
Object.defineProperty(exports, "registerComponent", { enumerable: true, get: function () { return Registered_1.registerComponent; } });
const buildIdNames_1 = require("./helpers/buildIdNames");
Object.defineProperty(exports, "buildIdNames", { enumerable: true, get: function () { return buildIdNames_1.buildIdNames; } });
const getMatchEntries_1 = require("./helpers/getMatchEntries");
Object.defineProperty(exports, "getMatchEntries", { enumerable: true, get: function () { return getMatchEntries_1.getMatchEntries; } });
const collectDeps_1 = require("./helpers/collectDeps");
Object.defineProperty(exports, "collectDeps", { enumerable: true, get: function () { return collectDeps_1.collectDeps; } });
const canonType_1 = require("./helpers/canonType");
Object.defineProperty(exports, "canonToType", { enumerable: true, get: function () { return canonType_1.canonToType; } });
Object.defineProperty(exports, "canonToDtype", { enumerable: true, get: function () { return canonType_1.canonToDtype; } });
Object.defineProperty(exports, "canonKey", { enumerable: true, get: function () { return canonType_1.canonKey; } });
const opShape_1 = require("./helpers/opShape");
Object.defineProperty(exports, "OP_SUFFIX", { enumerable: true, get: function () { return opShape_1.OP_SUFFIX; } });
Object.defineProperty(exports, "opTypeName", { enumerable: true, get: function () { return opShape_1.opTypeName; } });
Object.defineProperty(exports, "opParams", { enumerable: true, get: function () { return opShape_1.opParams; } });
Object.defineProperty(exports, "opActions", { enumerable: true, get: function () { return opShape_1.opActions; } });
Object.defineProperty(exports, "entityActions", { enumerable: true, get: function () { return opShape_1.entityActions; } });
Object.defineProperty(exports, "entityPath", { enumerable: true, get: function () { return opShape_1.entityPath; } });
Object.defineProperty(exports, "opRequestShape", { enumerable: true, get: function () { return opShape_1.opRequestShape; } });
Object.defineProperty(exports, "entityIdField", { enumerable: true, get: function () { return opShape_1.entityIdField; } });
Object.defineProperty(exports, "entityDataIdField", { enumerable: true, get: function () { return opShape_1.entityDataIdField; } });
Object.defineProperty(exports, "entityOps", { enumerable: true, get: function () { return opShape_1.entityOps; } });
Object.defineProperty(exports, "entityPrimaryOp", { enumerable: true, get: function () { return opShape_1.entityPrimaryOp; } });
Object.defineProperty(exports, "pickExampleEntity", { enumerable: true, get: function () { return opShape_1.pickExampleEntity; } });
Object.defineProperty(exports, "entityClassName", { enumerable: true, get: function () { return opShape_1.entityClassName; } });
Object.defineProperty(exports, "entityTypeCollisions", { enumerable: true, get: function () { return opShape_1.entityTypeCollisions; } });
Object.defineProperty(exports, "warnEntityTypeCollisions", { enumerable: true, get: function () { return opShape_1.warnEntityTypeCollisions; } });
Object.defineProperty(exports, "deriveEntityNames", { enumerable: true, get: function () { return opShape_1.deriveEntityNames; } });
Object.defineProperty(exports, "entityCollection", { enumerable: true, get: function () { return opShape_1.entityCollection; } });
const naming_1 = require("./helpers/naming");
Object.defineProperty(exports, "isReservedName", { enumerable: true, get: function () { return naming_1.isReservedName; } });
Object.defineProperty(exports, "safeVarName", { enumerable: true, get: function () { return naming_1.safeVarName; } });
Object.defineProperty(exports, "exampleVarName", { enumerable: true, get: function () { return naming_1.exampleVarName; } });
Object.defineProperty(exports, "phpEntityAccessor", { enumerable: true, get: function () { return naming_1.phpEntityAccessor; } });
Object.defineProperty(exports, "entityCacheField", { enumerable: true, get: function () { return naming_1.entityCacheField; } });
Object.defineProperty(exports, "isRbCoreConstant", { enumerable: true, get: function () { return naming_1.isRbCoreConstant; } });
Object.defineProperty(exports, "rbSafeTypeName", { enumerable: true, get: function () { return naming_1.rbSafeTypeName; } });
Object.defineProperty(exports, "isSwiftSdkType", { enumerable: true, get: function () { return naming_1.isSwiftSdkType; } });
Object.defineProperty(exports, "swiftSafeTypeName", { enumerable: true, get: function () { return naming_1.swiftSafeTypeName; } });
Object.defineProperty(exports, "jsProp", { enumerable: true, get: function () { return naming_1.jsProp; } });
Object.defineProperty(exports, "jsOptProp", { enumerable: true, get: function () { return naming_1.jsOptProp; } });
Object.defineProperty(exports, "jsKey", { enumerable: true, get: function () { return naming_1.jsKey; } });
const serverVars_1 = require("./helpers/serverVars");
Object.defineProperty(exports, "serverVariables", { enumerable: true, get: function () { return serverVars_1.serverVariables; } });
Object.defineProperty(exports, "hasServerVariables", { enumerable: true, get: function () { return serverVars_1.hasServerVariables; } });
const opExample_1 = require("./helpers/opExample");
Object.defineProperty(exports, "primaryOpCall", { enumerable: true, get: function () { return opExample_1.primaryOpCall; } });
Object.defineProperty(exports, "idLiteral", { enumerable: true, get: function () { return opExample_1.idLiteral; } });
Object.defineProperty(exports, "matchArg", { enumerable: true, get: function () { return opExample_1.matchArg; } });
Object.defineProperty(exports, "dataArg", { enumerable: true, get: function () { return opExample_1.dataArg; } });
Object.defineProperty(exports, "litFor", { enumerable: true, get: function () { return opExample_1.litFor; } });
const testPolicy_1 = require("./helpers/testPolicy");
Object.defineProperty(exports, "liveStrict", { enumerable: true, get: function () { return testPolicy_1.liveStrict; } });
const featureSource_1 = require("./helpers/featureSource");
Object.defineProperty(exports, "featureOf", { enumerable: true, get: function () { return featureSource_1.featureOf; } });
Object.defineProperty(exports, "availableFeatures", { enumerable: true, get: function () { return featureSource_1.availableFeatures; } });
Object.defineProperty(exports, "findFeatureSources", { enumerable: true, get: function () { return featureSource_1.findFeatureSources; } });
Object.defineProperty(exports, "featureExcludes", { enumerable: true, get: function () { return featureSource_1.featureExcludes; } });
Object.defineProperty(exports, "fullsetExcludes", { enumerable: true, get: function () { return featureSource_1.fullsetExcludes; } });
Object.defineProperty(exports, "srcFeatureExcludes", { enumerable: true, get: function () { return featureSource_1.srcFeatureExcludes; } });
const definition_1 = require("./helpers/definition");
Object.defineProperty(exports, "definitionPath", { enumerable: true, get: function () { return definition_1.definitionPath; } });
Object.defineProperty(exports, "definitionFolder", { enumerable: true, get: function () { return definition_1.definitionFolder; } });
Object.defineProperty(exports, "definitionNames", { enumerable: true, get: function () { return definition_1.definitionNames; } });
const manifest_1 = require("./helpers/manifest");
Object.defineProperty(exports, "MANIFEST", { enumerable: true, get: function () { return manifest_1.MANIFEST; } });
Object.defineProperty(exports, "manifestPath", { enumerable: true, get: function () { return manifest_1.manifestPath; } });
Object.defineProperty(exports, "readManifest", { enumerable: true, get: function () { return manifest_1.readManifest; } });
Object.defineProperty(exports, "validateManifest", { enumerable: true, get: function () { return manifest_1.validateManifest; } });
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
Object.defineProperty(exports, "authorInfo", { enumerable: true, get: function () { return packageMeta_1.authorInfo; } });
Object.defineProperty(exports, "contributorList", { enumerable: true, get: function () { return packageMeta_1.contributorList; } });
Object.defineProperty(exports, "envName", { enumerable: true, get: function () { return packageMeta_1.envName; } });
Object.defineProperty(exports, "envToken", { enumerable: true, get: function () { return packageMeta_1.envToken; } });
Object.defineProperty(exports, "goModule", { enumerable: true, get: function () { return packageMeta_1.goModule; } });
Object.defineProperty(exports, "goVersion", { enumerable: true, get: function () { return packageMeta_1.goVersion; } });
Object.defineProperty(exports, "goPackageIdent", { enumerable: true, get: function () { return packageMeta_1.goPackageIdent; } });
Object.defineProperty(exports, "packageVersion", { enumerable: true, get: function () { return packageMeta_1.packageVersion; } });
Object.defineProperty(exports, "repoInfo", { enumerable: true, get: function () { return packageMeta_1.repoInfo; } });
Object.defineProperty(exports, "apiName", { enumerable: true, get: function () { return packageMeta_1.apiName; } });
Object.defineProperty(exports, "langLabel", { enumerable: true, get: function () { return packageMeta_1.langLabel; } });
Object.defineProperty(exports, "PUBLISHER", { enumerable: true, get: function () { return packageMeta_1.PUBLISHER; } });
Object.defineProperty(exports, "PUBLISHER_URL", { enumerable: true, get: function () { return packageMeta_1.PUBLISHER_URL; } });
Object.defineProperty(exports, "SECURITY_EMAIL", { enumerable: true, get: function () { return packageMeta_1.SECURITY_EMAIL; } });
Object.defineProperty(exports, "GENERATOR_URL", { enumerable: true, get: function () { return packageMeta_1.GENERATOR_URL; } });
const target_1 = require("./action/target");
const feature_1 = require("./action/feature");
const doctor_1 = require("./action/doctor");
const package_1 = require("./action/package");
const check_1 = require("./action/check");
// The verbs, built from the kind registry — see action/dispatch.
const dispatch_1 = require("./action/dispatch");
const { Jostraca } = JostracaModule;
exports.Jostraca = Jostraca;
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
            // Per-call, for the same reason the actions pass it: jostraca applies
            // OptionsShape to `generate`'s own options first, so its
            // `control.dryrun: false` default wins over the instance-level flag.
            control: {
                dryrun: !!opts.dryrun
            },
        };
        // Targets that write OUTSIDE the SDK repo (`output: path`) are generated
        // by their own pass, rooted at that path — see cmp/ExternalTarget for why
        // a folder name cannot do this. The in-tree pass must not see them, or
        // the consumer Root would also emit them into `<sdk-repo>/<target>/`.
        //
        // `folder` may be relative (a consumer's build passes '..' from `.sdk`),
        // so resolve it ONCE: every destination is compared against it, and a
        // comparison between a relative and an absolute path is meaningless.
        const root = node_path_1.default.resolve(folder);
        const external = externalTargets(model, root);
        // Before ANY file is written, in-tree included: a destination that turns
        // out to be wrong must abort the whole generation, not leave half of it
        // done. See checkExternalFolders.
        checkExternalFolders(external, root, fs);
        const jres = await jostraca.generate(jopts, () => Root({ model: 0 === external.length ? model : withoutTargets(model, external) }));
        (0, util_2.showChanges)(jopts.log, 'generate-result', jres, node_path_1.default.dirname(process.cwd()));
        for (const ext of external) {
            // `active: false` is the project's only lever to stop the generator
            // writing into a repo it does not own, so it has to be honoured HERE —
            // the consumer Root iterates targets raw and does not check it. The
            // target is still removed from the in-tree model above (withoutTargets
            // takes every `output: path` target, active or not), so switching one
            // off generates it nowhere rather than relocating it into
            // `<sdk-repo>/<target>/`.
            if (!ext.active) {
                log.info({
                    point: 'generate-external-skip', target: ext.name, folder: ext.folder,
                    note: ext.name + ' inactive, not generated'
                });
                continue;
            }
            log.info({
                point: 'generate-external', target: ext.name, folder: ext.folder,
                note: ext.name + ' -> ' + ext.folder
            });
            const eres = await jostraca.generate({ ...jopts, folder: ext.folder }, () => (0, ExternalTarget_1.ExternalTarget)({
                model, target: ext.target, cmpfolder: folder,
                // How to walk BACK to the SDK project from the destination. A
                // target generating out of tree usually sits beside the SDK in a
                // known layout, and its own docs, scripts and live tests need to
                // name that path.
                sdkrelpath: externalSdkRel(ext, root, log),
            }));
            (0, util_2.showChanges)(jopts.log, 'generate-result', eres, node_path_1.default.dirname(process.cwd()));
        }
        const dlogs = dlog.log();
        if (0 < dlogs.length) {
            for (let dlogentry of dlogs) {
                log.debug({ point: 'generate-warning', dlogentry, note: String(dlogentry) });
            }
        }
        log.info({ point: 'generate-end' });
        return { ok: true, name: 'sdkgen' };
    }
    // Action arguments are PATHS AND NAMES, and they reach the actions as the
    // raw strings the shell gave us.
    //
    // They used to be mapped through `Jsonic(arg)` first, which parses each one
    // as relaxed JSON — so a Windows absolute ref arrived as an OBJECT:
    // `Jsonic('C:\\pkg\\go')` is `{ C: '\\pkg\\go' }`, and every downstream path
    // join then missed. (`ts,py` also became `['ts','py']`, which is why
    // parseAddNames still carries a non-string branch; it splits on commas
    // itself, so nothing is lost by handing it strings.)
    //
    // Nothing here wants structured arguments: every action takes names and
    // refs. Parsing them was pure loss.
    //
    // `flags` is the second parameter because `--only` and `--alias` are
    // arguments to ONE command, not generator configuration: passing them
    // through `SdkGen({…})` like `debug`/`dryrun` would make a later
    // `action()` call on the same instance silently inherit them.
    async function action(args, flags) {
        const actname = args[0];
        const actionFunc = dispatch_1.ACTION_MAP[actname];
        if (null == actionFunc) {
            throw new utility_1.SdkGenError('Unknown action: ' + actname +
                ' (expected: ' + (0, dispatch_1.actionNames)().join(', ') + ')');
        }
        const ctx = resolveActionContext(flags, (0, dispatch_1.needsModel)(args));
        return await actionFunc(args, ctx);
    }
    function resolveActionContext(flags, wantmodel) {
        // TODO: use AsyncLocalStorage to avoid reloading model
        const { model, url } = resolveModel(false !== wantmodel);
        const ctx = {
            fs: () => fs,
            log,
            folder: '.', // The `generate` folder,
            model,
            url,
            jostraca,
            opts,
            flags: flags ?? {},
        };
        return ctx;
    }
    function resolveModel(wanted) {
        const path = './model/sdk.aontu';
        const errs = [];
        // A verb that does not act on a project (see `needsModel`) is run where
        // there is no project model, so its absence is not an error there. Its
        // PRESENCE still is compiled — an author checking a package from inside a
        // project should get the same model every other verb gets.
        if (!wanted && !fs.existsSync(path)) {
            return { model: { main: {} }, url: path };
        }
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
    // The whole-package verbs. `flags` mirrors the CLI's `--only` / `--alias`,
    // for the same reason they are `action`'s second parameter rather than
    // constructor options: they are arguments to one call.
    const packages = {
        add: async (refs, flags) => {
            const ctx = resolveActionContext(flags);
            return (0, package_1.package_add)(refs, ctx);
        },
        list: async () => {
            const ctx = resolveActionContext();
            return (0, package_1.action_package)(['package', 'list'], ctx);
        },
        update: async (names, flags) => {
            const ctx = resolveActionContext(flags);
            return (0, package_1.package_update)(names, ctx);
        },
        // Validate a package being AUTHORED — see action/check. The only verb
        // here that does not need a project model, because it does not act on a
        // project; `false` says so to `resolveActionContext`.
        check: async (refs) => {
            const ctx = resolveActionContext(undefined, false);
            return (0, check_1.cmd_package_check)(['package', 'check', ...(refs ?? [])], ctx);
        },
    };
    // Has this project's `.sdk/` drifted from the scaffold? See action/doctor.
    const check = async () => {
        const ctx = resolveActionContext();
        return (0, doctor_1.doctor)(ctx);
    };
    return {
        pino: pino,
        generate,
        action,
        check,
        target,
        feature,
        // `package` is a reserved word in a strict-mode object shorthand, so the
        // local binding is `packages` and the PUBLIC name matches the CLI verb.
        package: packages,
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
// Targets declaring `output: path` — generated into their own repo rather
// than into `<sdk-repo>/<target>/`.
//
// A relative path resolves against the SDK repo root, so a sibling checkout
// is '../<repo>'. That is deliberately the SAME base the generator writes
// everything else against: a path in the model should not depend on the
// directory the command happened to be run from.
//
// An INACTIVE target is still listed: it must be taken out of the in-tree
// model (see withoutTargets) so that switching it off does not silently
// relocate it into `<sdk-repo>/<target>/`. The generate loop skips it.
function externalTargets(model, folder) {
    const targets = model?.main?.[apidef_1.KIT]?.target || {};
    return Object.keys(targets).sort()
        .map((name) => ({ name, target: targets[name] }))
        .filter((t) => {
        const path = t.target?.output?.path;
        return null != path && '' !== path;
    })
        .map((t) => ({
        ...t,
        folder: node_path_1.default.resolve(folder, String(t.target.output.path)),
        active: false !== t.target.active,
    }));
}
// The `.jostraca` bookkeeping tree (meta log + a duplicate of the last
// generated output) that jostraca leaves at an output root. It is the only
// on-disk evidence that this toolchain has generated into a directory
// before, so it doubles as the OWNERSHIP MARKER: a destination carrying one
// has been generated into already, whoever set it up.
const EXTERNAL_MARKER = '.jostraca';
// Entries that do not count as content when deciding whether a destination
// is empty. A `git init` (or a clone of an empty repo) leaves only `.git`,
// and that is exactly the destination a FIRST generation is aimed at.
const EXTERNAL_EMPTY = ['.git', '.DS_Store'];
// Refuse a destination the project cannot have meant.
//
// The external pass is the one code path that writes outside the repo it was
// pointed at, at a filesystem path taken verbatim from the model — and
// generation is overwrite, not merge, while jostraca's ensureDir creates
// missing parents. So a mistyped `output: path` does not fail: it fabricates
// a package tree at an arbitrary location, or overwrites an unrelated repo's
// package.json, README.md, LICENSE and CI workflow in place. The only trace
// was one INFO line naming the resolved folder.
//
// A destination must therefore be:
//   - outside the SDK project, in BOTH directions — inside it is what a
//     typo like '.' or 'ts' produces (and the external pass runs SECOND, so
//     it wins over what the in-tree pass just wrote), while a destination
//     that CONTAINS the project is what '..' produces;
//   - claimed by no other target;
//   - and either absent, empty, or carrying the marker a previous
//     generation left there.
//
// Anything else is refused with both paths named. NOT skipped: a project
// generating somewhere other than it believes must be told. A destination
// that legitimately holds other content first (a repo seeded with a README
// and LICENCE) says so once in the model, with `output: adopt: true`.
function checkExternalFolders(external, root, fs) {
    const claimed = {};
    for (const ext of external) {
        // An inactive target writes nothing, so its destination is not a hazard —
        // and switching a target off must not require keeping its now-unused
        // path valid.
        if (!ext.active)
            continue;
        const where = 'Target "' + ext.name + '" has output path "' +
            ext.target.output.path + '", which resolves to: ' + ext.folder +
            '\n  (SDK project: ' + root + ')';
        if (ext.folder === root || folderContains(root, ext.folder)) {
            throw new utility_1.SdkGenError('External target output path is inside the SDK project.\n  ' + where +
                '\n  A target generating into the SDK project must leave `output: ' +
                'path` unset — it is then generated in-tree, as <sdk-project>/' +
                ext.name + '/.');
        }
        if (folderContains(ext.folder, root)) {
            throw new utility_1.SdkGenError('External target output path contains the SDK project.\n  ' + where +
                '\n  Generation would write this package over the directory holding ' +
                'the SDK project itself.');
        }
        if (null != claimed[ext.folder]) {
            throw new utility_1.SdkGenError('External target output path is already claimed by target "' +
                claimed[ext.folder] + '".\n  ' + where +
                '\n  Two targets generating into the same folder overwrite each ' +
                'other, in target-name order.');
        }
        claimed[ext.folder] = ext.name;
        if (!fs.existsSync(ext.folder))
            continue;
        if (!fs.statSync(ext.folder).isDirectory()) {
            throw new utility_1.SdkGenError('External target output path is not a folder.\n  ' + where);
        }
        if (true === ext.target.output.adopt)
            continue;
        const entries = fs.readdirSync(ext.folder)
            .map((entry) => String(entry));
        if (entries.includes(EXTERNAL_MARKER))
            continue;
        const content = entries.filter((entry) => !EXTERNAL_EMPTY.includes(entry));
        if (0 < content.length) {
            throw new utility_1.SdkGenError('External target output folder already holds content this generator ' +
                'did not write.\n  ' + where +
                '\n  Found: ' + content.slice(0, 8).join(', ') +
                (8 < content.length ? ', ...' : '') +
                '\n  Generation OVERWRITES, so this would replace that content. ' +
                'Check the path;\n  if the folder is right, declare it: `main: kit: ' +
                'target: \'' + ext.name + '\': output: adopt: true`.');
        }
    }
}
// Is `path` inside `folder`? Both must already be resolved. Path.relative
// rather than a string prefix, so that a sibling whose name merely STARTS
// with the folder's ('/x/sdk' vs '/x/sdk-provider') is not read as nested.
function folderContains(folder, path) {
    const rel = node_path_1.default.relative(folder, path);
    return '' !== rel && !rel.startsWith('..' + node_path_1.default.sep) && '..' !== rel &&
        !node_path_1.default.isAbsolute(rel);
}
// The path from the destination back to the SDK project, which the target's
// own docs, scripts and live tests name (the companion test server lives in
// the SDK repo and is not published).
//
// It is DERIVED from the two resolved folders by default, which is only
// honest while the walk back crosses nothing the model does not name. It
// does not for `output: path: '../<repo>'`; it does for anything ascending
// further. voxgig-solardemo-sdk declares '../../seneca/solardemo-provider'
// and the derived inverse came out as '../../voxgig-sdk/voxgig-solardemo-sdk'
// — where `voxgig-sdk` is the name of the WORKSPACE DIRECTORY holding the SDK
// checkout on one machine, no part of the model. That string is committed
// into the destination's README.md and three test files, so a second
// developer with the same two repos under a differently named parent
// regenerates a spurious diff in tracked files and an instruction path that
// is wrong on the first machine.
//
// So a project that ascends further declares the walk back explicitly, as
// `output: sdkrel`, and is warned until it does.
function externalSdkRel(ext, root, log) {
    const declared = String(ext.target.output?.sdkrel || '');
    if ('' !== declared)
        return declared;
    const derived = node_path_1.default.relative(ext.folder, root).split(node_path_1.default.sep).join('/');
    // Every segment that is not '..' is a real directory name on the way back
    // down to the SDK project. The LAST is the project's own folder; any
    // earlier one is a directory ABOVE it, which nothing in the model declares.
    const named = derived.split('/').filter((seg) => '..' !== seg);
    if (1 < named.length) {
        log.warn({
            point: 'external-sdkrel-derived', target: ext.name, sdkrel: derived,
            note: ext.name + ': path back to the SDK project derived as \'' +
                derived + '\', which names ' + (named.length - 1) +
                ' directory(s) above the SDK project that the model does not ' +
                'declare — this machine\'s layout will be committed to the ' +
                'generated files. Declare `output: sdkrel` instead.'
        });
    }
    return derived;
}
// The model the IN-TREE pass sees: the same model with the out-of-tree
// targets taken out.
//
// A shallow clone down to `target` only — the model is large, entities and
// features are shared with the external pass, and a deep copy would both
// cost and quietly break identity comparisons.
function withoutTargets(model, external) {
    const drop = new Set(external.map((e) => e.name));
    const targets = model?.main?.[apidef_1.KIT]?.target || {};
    const kept = {};
    for (const name of Object.keys(targets)) {
        if (!drop.has(name)) {
            kept[name] = targets[name];
        }
    }
    return {
        ...model,
        main: {
            ...model.main,
            [apidef_1.KIT]: { ...model.main[apidef_1.KIT], target: kept },
        },
    };
}
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