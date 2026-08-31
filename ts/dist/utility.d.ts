declare function resolvePath(ctx$: any, path: string): any;
declare function isAuthActive(model: any): boolean;
declare function resolveAuthPrefix(model: any): string;
declare function isHttpBasicAuth(model: any): boolean;
declare function resolveAuthExchange(model: any): Record<string, any> | null;
declare function requirePath(ctx$: any, path: string, flags?: {
    ignore?: boolean;
}): any;
declare class SdkGenError extends Error {
    constructor(...args: any[]);
}
export { resolvePath, requirePath, isAuthActive, resolveAuthPrefix, resolveAuthExchange, isHttpBasicAuth, SdkGenError, CONFIG_DATA_THRESHOLD, CONFIG_REPR_VALUES, isConfigData, configRepr, configReprSetting, configDefinition, clean, rawStringLiteral, };
declare const CONFIG_DATA_THRESHOLD: number;
declare const CONFIG_REPR_VALUES: string[];
declare function isConfigData(configJson: string, repr?: string): boolean;
declare function configRepr(configJson: string, repr?: string): string;
declare function configReprSetting(model: any): string;
declare function clean(o: any, dropDefaults?: boolean): any;
declare function rawStringLiteral(s: string): string;
declare function configDefinition(model: any, targetname?: string): {
    def: any;
    json: string;
};
