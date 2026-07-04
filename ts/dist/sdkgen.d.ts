import * as JostracaModule from 'jostraca';
import type { ActionResult } from './types';
import { requirePath, isAuthActive } from './utility';
import { Main } from './cmp/Main';
import { Deploy } from './cmp/Deploy';
import { Entity } from './cmp/Entity';
import { Feature } from './cmp/Feature';
import { Readme } from './cmp/Readme';
import { ReadmeTop } from './cmp/ReadmeTop';
import { License } from './cmp/License';
import { Security } from './cmp/Security';
import { Changelog } from './cmp/Changelog';
import { Test } from './cmp/Test';
import { ReadmeInstall } from './cmp/ReadmeInstall';
import { ReadmeQuick } from './cmp/ReadmeQuick';
import { ReadmeIntro } from './cmp/ReadmeIntro';
import { ReadmeModel } from './cmp/ReadmeModel';
import { ReadmeOptions } from './cmp/ReadmeOptions';
import { ReadmeEntity } from './cmp/ReadmeEntity';
import { ReadmeHowto } from './cmp/ReadmeHowto';
import { ReadmeExplanation } from './cmp/ReadmeExplanation';
import { ReadmeRef } from './cmp/ReadmeRef';
import { FeatureHook } from './cmp/FeatureHook';
import { buildIdNames } from './helpers/buildIdNames';
import { getMatchEntries } from './helpers/getMatchEntries';
import { collectDeps } from './helpers/collectDeps';
import type { DepEntry } from './helpers/collectDeps';
import { packageName, installCommand, registryState, isPublished, registryName, vendorCommand, pkgDescription, nonAffiliation, keywords, envName, repoInfo, apiName, langLabel, PUBLISHER, PUBLISHER_URL, SECURITY_EMAIL, GENERATOR_URL } from './helpers/packageMeta';
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
    pino?: any;
    now?: () => number;
    existing?: {
        txt?: any;
        bin?: any;
    };
    dryrun?: boolean;
};
declare const Jostraca: typeof JostracaModule.Jostraca;
declare function SdkGen(opts: SdkGenOptions): {
    pino: any;
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
export type { SdkGenOptions, DepEntry, };
export type { SdkModel, ModelKit, ModelTarget, ModelFeature, ModelEntity, ModelDep, ModelHook, } from './types';
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
export { Main, Deploy, License, Security, Changelog, Entity, Feature, Test, Readme, ReadmeTop, ReadmeInstall, ReadmeQuick, ReadmeIntro, ReadmeModel, ReadmeOptions, ReadmeEntity, ReadmeHowto, ReadmeExplanation, ReadmeRef, FeatureHook, Jostraca, SdkGen, requirePath, isAuthActive, buildIdNames, getMatchEntries, collectDeps, packageName, installCommand, registryState, isPublished, registryName, vendorCommand, pkgDescription, nonAffiliation, keywords, envName, repoInfo, apiName, langLabel, PUBLISHER, PUBLISHER_URL, SECURITY_EMAIL, GENERATOR_URL, };
