declare function isRbCoreConstant(Name: string): boolean;
declare function isRbSdkConstant(Name: string): boolean;
declare function rbSafeTypeName(Name: string): string;
declare function isSwiftSdkType(Name: string): boolean;
declare function swiftSafeTypeName(Name: string): string;
declare function isPhpReservedType(Name: string): boolean;
declare function isPhpSdkClass(Name: string): boolean;
declare function phpSafeTypeName(Name: string): string;
declare function isTsReservedType(Name: string): boolean;
declare function tsSafeTypeName(Name: string): string;
declare function isReservedName(name: string, lang: string): boolean;
declare function safeVarName(name: string, lang: string): string;
/** The PHP accessor method for an entity: `$client-><Name>()`. */
declare function phpEntityAccessor(Name: string): string;
/**
 * The backing field for an entity accessor's cache slot (`$this->_<name>`,
 * `self._<name>`). Target-neutral: the colliding names are the SDK's own
 * fields, which the targets share.
 */
declare function entityCacheField(name: string): string;
declare function exampleVarName(name: string, lang: string): string;
declare function jsProp(obj: string, name: string): string;
declare function jsKey(name: string): string;
declare function jsOptProp(obj: string, name: string): string;
export { isReservedName, safeVarName, exampleVarName, phpEntityAccessor, entityCacheField, isRbCoreConstant, isRbSdkConstant, rbSafeTypeName, isSwiftSdkType, swiftSafeTypeName, isPhpReservedType, isPhpSdkClass, phpSafeTypeName, isTsReservedType, tsSafeTypeName, jsProp, jsOptProp, jsKey, };
