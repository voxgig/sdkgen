import { Pino } from '@voxgig/util';
import * as JostracaModule from 'jostraca';
import type { ActionResult } from './types';
import { requirePath } from './utility';
import { Main } from './cmp/Main';
import { Entity } from './cmp/Entity';
import { Feature } from './cmp/Feature';
import { Readme } from './cmp/Readme';
import { ReadmeInstall } from './cmp/ReadmeInstall';
import { ReadmeOptions } from './cmp/ReadmeOptions';
import { ReadmeEntity } from './cmp/ReadmeEntity';
import { FeatureHook } from './cmp/FeatureHook';
type SdkGenOptions = {
    folder: string;
    fs: any;
    root?: string;
    def?: string;
    model?: {
        folder: string;
        entity: any;
    };
    meta?: {
        name: string;
    };
    debug?: boolean | string;
    pino?: ReturnType<typeof Pino>;
    now?: () => number;
    existing?: {
        txt?: any;
        bin?: any;
    };
    dryrun?: boolean;
};
declare const Jostraca: typeof JostracaModule.Jostraca;
declare function SdkGen(opts: SdkGenOptions): {
    pino: import("pino").Logger<string, boolean>;
    generate: (spec: any) => Promise<{
        ok: boolean;
        name: string;
    }>;
    action: (args: string[]) => Promise<void>;
    target: {
        add: (targets: string[]) => Promise<ActionResult>;
    };
    feature: {
        add: (features: string[]) => Promise<ActionResult>;
    };
};
declare namespace SdkGen {
    var makeBuild: (opts: SdkGenOptions) => Promise<(model: any, build: any, ctx: any) => Promise<any>>;
}
export type { SdkGenOptions, };
type Component = (props: any, children?: any) => void;
export declare const cmp: (component: Function) => Component;
export declare const names: (base: any, name: string, prop?: string) => any;
export declare const each: (subject?: any, apply?: any) => any;
export declare const snakify: (input: any[] | string) => string;
export declare const camelify: (input: any[] | string) => string;
export declare const kebabify: (input: any[] | string) => string;
export declare const cmap: (o: any, p: any) => any;
export declare const vmap: (o: any, p: any) => any;
export declare const get: (root: any, path: string | string[]) => any;
export declare const getx: (root: any, path: string | string[]) => any;
export declare const template: (root: any, path: string | string[]) => any;
export declare const indent: (src: string, indent: string | number | undefined) => any;
export declare const deep: (...args: any[]) => any;
export declare const omap: (...args: any[]) => any;
export declare const Project: Component;
export declare const Folder: Component;
export declare const File: Component;
export declare const Content: Component;
export declare const Copy: Component;
export declare const Fragment: Component;
export declare const Inject: Component;
export declare const Line: Component;
export declare const Slot: Component;
export declare const List: Component;
export { Main, Entity, Feature, Readme, ReadmeInstall, ReadmeOptions, ReadmeEntity, FeatureHook, Jostraca, SdkGen, requirePath, };
