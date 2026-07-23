declare function isReservedName(name: string, lang: string): boolean;
declare function safeVarName(name: string, lang: string): string;
declare function exampleVarName(name: string, lang: string): string;
declare function jsProp(obj: string, name: string): string;
declare function jsKey(name: string): string;
declare function jsOptProp(obj: string, name: string): string;
export { isReservedName, safeVarName, exampleVarName, jsProp, jsOptProp, jsKey, };
