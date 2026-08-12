declare function isRbCoreConstant(Name: string): boolean;
declare function rbSafeTypeName(Name: string): string;
declare function isSwiftSdkType(Name: string): boolean;
declare function swiftSafeTypeName(Name: string): string;
declare function isReservedName(name: string, lang: string): boolean;
declare function safeVarName(name: string, lang: string): string;
/** The PHP accessor method for an entity: `$client-><Name>()`. */
declare function phpEntityAccessor(Name: string): string;
/** The PHP backing field for an entity accessor: `$this->_<name>`. */
declare function phpEntityField(name: string): string;
declare function exampleVarName(name: string, lang: string): string;
declare function jsProp(obj: string, name: string): string;
declare function jsKey(name: string): string;
declare function jsOptProp(obj: string, name: string): string;
export { isReservedName, safeVarName, exampleVarName, phpEntityAccessor, phpEntityField, isRbCoreConstant, rbSafeTypeName, isSwiftSdkType, swiftSafeTypeName, jsProp, jsOptProp, jsKey, };
