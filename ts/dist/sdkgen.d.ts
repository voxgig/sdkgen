import * as JostracaModule from 'jostraca';
import type { ActionResult } from './types';
import { SdkGenError, requirePath, isAuthActive, resolveAuthPrefix, CONFIG_DATA_THRESHOLD, CONFIG_REPR_VALUES, isConfigData, configRepr, configReprSetting, configDefinition, clean, rawStringLiteral } from './utility';
import { Main } from './cmp/Main';
import { Deploy } from './cmp/Deploy';
import { Entity } from './cmp/Entity';
import { Feature } from './cmp/Feature';
import { Readme } from './cmp/Readme';
import { ReadmeTop } from './cmp/ReadmeTop';
import { AgentGuideTop } from './cmp/AgentGuideTop';
import { AgentGuide } from './cmp/AgentGuide';
import { AgentGuideFeature } from './cmp/AgentGuideFeature';
import { License } from './cmp/License';
import { Security } from './cmp/Security';
import { Changelog } from './cmp/Changelog';
import { Test } from './cmp/Test';
import { ReadmeInstall } from './cmp/ReadmeInstall';
import { ReadmeQuick } from './cmp/ReadmeQuick';
import { ReadmeErrors } from './cmp/ReadmeErrors';
import { ReadmeIntro } from './cmp/ReadmeIntro';
import { ReadmeModel } from './cmp/ReadmeModel';
import { ReadmeOptions } from './cmp/ReadmeOptions';
import { ReadmeEntity } from './cmp/ReadmeEntity';
import { ReadmeHowto } from './cmp/ReadmeHowto';
import { ReadmeExplanation } from './cmp/ReadmeExplanation';
import { ReadmeRef } from './cmp/ReadmeRef';
import { FeatureHook } from './cmp/FeatureHook';
import { registerComponent } from './cmp/Registered';
import type { RegisterOptions } from './cmp/Registered';
import { buildIdNames } from './helpers/buildIdNames';
import { getMatchEntries } from './helpers/getMatchEntries';
import { collectDeps } from './helpers/collectDeps';
import type { DepEntry } from './helpers/collectDeps';
import { canonToType, canonToDtype, canonKey, canonScalarKey } from './helpers/canonType';
import { OP_SUFFIX, opTypeName, opParams, ownPoint, opActions, entityActions, entityPath, opRequestShape, entityIdField, entityDataIdField, entityOps, entityPrimaryOp, pickExampleEntity, entityClassName, entityTypeCollisions, warnEntityTypeCollisions, deriveEntityNames, entityCollection } from './helpers/opShape';
import { isReservedName, safeVarName, exampleVarName, phpEntityAccessor, entityCacheField, isRbCoreConstant, isRbSdkConstant, rbSafeTypeName, isSwiftSdkType, swiftSafeTypeName, isPhpReservedType, isPhpSdkClass, phpSafeTypeName, isTsReservedType, tsSafeTypeName, jsProp, jsOptProp, jsKey } from './helpers/naming';
import { serverVariables, hasServerVariables } from './helpers/serverVars';
import { primaryOpCall, idLiteral, matchArg, dataArg, litFor } from './helpers/opExample';
import type { ExampleLang } from './helpers/opExample';
import { liveStrict } from './helpers/testPolicy';
import { featureOf, availableFeatures, findFeatureSources, featureExcludes, fullsetExcludes, srcFeatureExcludes } from './helpers/featureSource';
import type { FeatureSource } from './helpers/featureSource';
import { stationLibrary } from './helpers/station';
import { definitionPath, definitionFolder, definitionNames } from './helpers/definition';
import { MANIFEST, manifestPath, readManifest, validateManifest } from './helpers/manifest';
import type { Manifest, ManifestRead } from './helpers/manifest';
import { packageName, installCommand, registryState, isPublished, registryName, vendorCommand, pkgDescription, nonAffiliation, keywords, authorInfo, contributorList, envName, envToken, goModule, goVersion, goPackageIdent, packageVersion, repoInfo, apiName, langLabel, originName, PUBLISHER, PUBLISHER_URL, SECURITY_EMAIL, GENERATOR_URL } from './helpers/packageMeta';
import type { DoctorReport } from './action/doctor';
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
    action: (args: string[], flags?: Record<string, any>) => Promise<any>;
    check: () => Promise<ActionResult>;
    docs: {
        add: (items: string[]) => Promise<ActionResult>;
    };
    target: {
        add: (targets: string[]) => Promise<ActionResult>;
    };
    feature: {
        add: (features: string[]) => Promise<ActionResult>;
    };
    package: {
        add: (refs: string[], flags?: Record<string, any>) => Promise<ActionResult>;
        list: () => Promise<ActionResult>;
        update: (names: string[], flags?: Record<string, any>) => Promise<ActionResult>;
        check: (refs?: string[]) => Promise<ActionResult>;
    };
};
declare namespace SdkGen {
    var makeBuild: (opts: SdkGenOptions) => Promise<(model: any, build: any, ctx: any) => Promise<any>>;
}
export type { SdkGenOptions, ExampleLang, DepEntry, FeatureSource, DoctorReport, RegisterOptions, Manifest, ManifestRead, };
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
export { Main, Deploy, License, Security, Changelog, Entity, Feature, Test, Readme, ReadmeTop, AgentGuideTop, AgentGuide, AgentGuideFeature, ReadmeInstall, ReadmeQuick, ReadmeErrors, ReadmeIntro, ReadmeModel, ReadmeOptions, ReadmeEntity, ReadmeHowto, ReadmeExplanation, ReadmeRef, FeatureHook, registerComponent, Jostraca, SdkGen, requirePath, isAuthActive, resolveAuthPrefix, CONFIG_DATA_THRESHOLD, CONFIG_REPR_VALUES, isConfigData, configRepr, configReprSetting, configDefinition, clean, rawStringLiteral, SdkGenError, buildIdNames, getMatchEntries, collectDeps, canonToType, canonToDtype, canonKey, canonScalarKey, OP_SUFFIX, opTypeName, opParams, ownPoint, opActions, entityActions, entityPath, opRequestShape, entityIdField, entityDataIdField, entityOps, entityPrimaryOp, pickExampleEntity, entityClassName, entityTypeCollisions, warnEntityTypeCollisions, deriveEntityNames, entityCollection, isReservedName, safeVarName, exampleVarName, phpEntityAccessor, entityCacheField, isRbCoreConstant, isRbSdkConstant, rbSafeTypeName, isSwiftSdkType, swiftSafeTypeName, isPhpReservedType, isPhpSdkClass, phpSafeTypeName, isTsReservedType, tsSafeTypeName, serverVariables, hasServerVariables, liveStrict, primaryOpCall, idLiteral, matchArg, dataArg, litFor, featureOf, availableFeatures, findFeatureSources, featureExcludes, fullsetExcludes, srcFeatureExcludes, stationLibrary, definitionPath, definitionFolder, definitionNames, MANIFEST, manifestPath, readManifest, validateManifest, jsProp, jsOptProp, jsKey, packageName, installCommand, registryState, isPublished, registryName, vendorCommand, pkgDescription, nonAffiliation, keywords, authorInfo, contributorList, envName, envToken, goModule, goVersion, goPackageIdent, packageVersion, repoInfo, apiName, langLabel, originName, PUBLISHER, PUBLISHER_URL, SECURITY_EMAIL, GENERATOR_URL, };
