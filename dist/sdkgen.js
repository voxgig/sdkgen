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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Jostraca = exports.ReadmeEntity = exports.ReadmeOptions = exports.ReadmeInstall = exports.Readme = exports.Feature = exports.Entity = exports.Main = exports.Inject = exports.Fragment = exports.Copy = exports.Content = exports.File = exports.Folder = exports.Project = exports.getx = exports.get = exports.vmap = exports.cmap = exports.select = exports.kebabify = exports.camelify = exports.snakify = exports.each = exports.names = exports.cmp = void 0;
exports.SdkGen = SdkGen;
const Fs = __importStar(require("node:fs"));
const JostracaModule = __importStar(require("jostraca"));
const pino_1 = __importDefault(require("pino"));
const pino_pretty_1 = __importDefault(require("pino-pretty"));
const apidef_1 = require("@voxgig/apidef");
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
const prepare_openapi_1 = require("./prepare-openapi");
const { Jostraca } = JostracaModule;
exports.Jostraca = Jostraca;
function SdkGen(opts) {
    const fs = opts.fs || Fs;
    const folder = opts.folder || '.';
    const def = opts.def || 'def.yml';
    const jostraca = Jostraca();
    let pino = opts.pino;
    if (null == pino) {
        let pretty = (0, pino_pretty_1.default)({ sync: true });
        const level = null == opts.debug ? 'info' :
            true === opts.debug ? 'debug' :
                'string' == typeof opts.debug ? opts.debug :
                    'info';
        pino = (0, pino_1.default)({
            name: 'sdkgen',
            level,
        }, pretty);
    }
    const log = pino.child({ cmp: 'sdkgen' });
    async function generate(spec) {
        const start = Date.now();
        const { model, config } = spec;
        log.info({ point: 'generate-start', start });
        log.debug({ point: 'generate-spec', spec });
        // console.log('SDKGEN.config', config)
        let Root = spec.root;
        if (null == Root) {
            clear(config.root);
            const rootModule = require(config.root);
            Root = rootModule.Root;
        }
        /*
        if (await prepare(spec, { fs, folder, def })) {
          return
        }
        */
        // console.log('OPTIONS', opts)
        const opts = { fs, folder, meta: { spec } };
        try {
            await jostraca.generate(opts, () => Root({ model }));
        }
        catch (err) {
            console.log('SDKGEN ERROR: ', err);
            throw err;
        }
    }
    async function prepare(spec, ctx) {
        return await (0, prepare_openapi_1.PrepareOpenAPI)(spec, ctx);
    }
    return {
        pino,
        generate,
    };
}
SdkGen.makeBuild = async function (opts) {
    const sdkgen = SdkGen(opts);
    const apidef = (0, apidef_1.ApiDef)({
        pino: sdkgen.pino,
    });
    const config = {
        def: opts.def,
        kind: 'openapi-3',
        model: opts.model ? (opts.model.folder + '/api.jsonic') : undefined,
        meta: opts.meta || {},
    };
    await apidef.watch(config);
    return async function build(model, build) {
        // TODO: voxgig model needs to handle errors from here
        return sdkgen.generate({ model, build, config });
    };
};
// Adapted from https://github.com/sindresorhus/import-fresh - Thanks!
function clear(path) {
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
exports.Project = JostracaModule.Project;
exports.Folder = JostracaModule.Folder;
exports.File = JostracaModule.File;
exports.Content = JostracaModule.Content;
exports.Copy = JostracaModule.Copy;
exports.Fragment = JostracaModule.Fragment;
exports.Inject = JostracaModule.Inject;
//# sourceMappingURL=sdkgen.js.map