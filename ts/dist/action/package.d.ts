import type { ActionContext, ActionResult } from '../types';
import type { Manifest } from '../helpers/manifest';
declare function action_package(args: string[], actx: ActionContext): Promise<ActionResult>;
type PackageSource = {
    ref: string;
    root: string;
    sdk: string;
    manifest: Manifest;
};
declare function resolvePackage(ref: string, actx: ActionContext): PackageSource;
declare const SDKGEN_VERSION: string;
declare function selectItems(src: PackageSource, only: string | undefined, log: any): Record<string, string[]>;
declare function parseAliases(alias: string | undefined, wanted: Record<string, string[]>): Record<string, string>;
declare function package_add(refs: string[], actx: ActionContext): Promise<ActionResult>;
declare function registerAdder(kind: string, add: (refs: string[], actx: ActionContext) => Promise<any>): void;
export { action_package, package_add, resolvePackage, selectItems, parseAliases, registerAdder, SDKGEN_VERSION, };
