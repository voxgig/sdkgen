"use strict";
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
exports.cmp = exports.COMPONENT = void 0;
const Jostraca = __importStar(require("jostraca"));
// The node meta key naming the component that made the node, by which
// helpers/generated traces a generated file to the component that produced it.
const COMPONENT = 'cmp';
exports.COMPONENT = COMPONENT;
// jostraca's cmp, labelling each node it makes with the component's name.
const cmp = ((component) => {
    const labelled = (props, children) => {
        if (null != props?.ctx$?.node?.meta) {
            props.ctx$.node.meta[COMPONENT] = component.name;
        }
        return component(props, children);
    };
    Object.defineProperty(labelled, 'name', { value: component.name });
    return Jostraca.cmp(labelled);
});
exports.cmp = cmp;
//# sourceMappingURL=component.js.map