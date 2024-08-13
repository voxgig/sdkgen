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
exports.SdkGen = SdkGen;
const Fs = __importStar(require("node:fs"));
const jostraca_1 = require("jostraca");
function SdkGen(opts) {
    const fs = opts.fs || Fs;
    const folder = opts.folder || '.';
    const jostraca = (0, jostraca_1.Jostraca)();
    // const { cmp, each, Project, Folder, File, Code } = jostraca
    function generate(spec) {
        const { model, root } = spec;
        jostraca.generate({ fs, folder }, () => root({ model }));
    }
    return {
        generate,
        // cmp, each,
        // Project, Folder, File, Code
    };
}
SdkGen.makeBuild = function (root, opts) {
    const sdkgen = SdkGen(opts);
    return function build(model, build) {
        return sdkgen.generate({ model, build, root });
    };
};
//# sourceMappingURL=sdkgen.js.map