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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Jostraca = exports.ReadmeEntity = exports.ReadmeOptions = exports.ReadmeInstall = exports.Readme = exports.Entity = exports.Main = exports.Copy = exports.Code = exports.File = exports.Folder = exports.Project = exports.getx = exports.get = exports.vmap = exports.cmap = exports.select = exports.kebabify = exports.camelify = exports.snakify = exports.each = exports.names = exports.cmp = void 0;
exports.SdkGen = SdkGen;
const Fs = __importStar(require("node:fs"));
const JostracaModule = __importStar(require("jostraca"));
const apidef_1 = require("@voxgig/apidef");
const Main_1 = require("./cmp/Main");
Object.defineProperty(exports, "Main", { enumerable: true, get: function () { return Main_1.Main; } });
const Entity_1 = require("./cmp/Entity");
Object.defineProperty(exports, "Entity", { enumerable: true, get: function () { return Entity_1.Entity; } });
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
    async function generate(spec) {
        const { model, root } = spec;
        /*
        if (await prepare(spec, { fs, folder, def })) {
          return
        }
        */
        // console.log('OPTIONS', opts)
        const ctx$ = { fs, folder, meta: { spec } };
        try {
            jostraca.generate(ctx$, () => root({ model }));
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
        generate,
        // cmp, each,
        // Project, Folder, File, Code
    };
}
SdkGen.makeBuild = async function (root, opts) {
    console.log('SdkGen.makeBuild', opts);
    const sdkgen = SdkGen(opts);
    const apidef = (0, apidef_1.ApiDef)();
    const spec = {
        def: opts.def,
        kind: 'openapi-3',
        model: opts.model ? (opts.model.folder + '/api.jsonic') : undefined,
        meta: opts.meta || {},
        entity: opts.model ? opts.model.entity : undefined,
    };
    await apidef.watch(spec);
    return async function build(model, build) {
        // TODO: voxgig model needs to handle errors from here
        console.log('SDK GENERATE');
        return sdkgen.generate({ model, build, root });
    };
};
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
exports.Code = JostracaModule.Code;
exports.Copy = JostracaModule.Copy;
//# sourceMappingURL=sdkgen.js.map