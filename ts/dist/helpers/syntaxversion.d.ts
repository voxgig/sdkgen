declare const SYNTAX_INTERFACE: '3.3';
declare const SYNTAX_PREVIOUS: '3.2';
declare const SYNTAX_CHANGES: {
    to: string;
    change: string;
}[];
declare function servedInterface(target: string, declared: unknown, log?: any): string;
declare function serveSyntax(target: string, module: any, log?: any): any;
declare function checkSyntaxInterface(target: string, declared: unknown): never | string;
export { SYNTAX_INTERFACE, SYNTAX_PREVIOUS, servedInterface, serveSyntax, SYNTAX_CHANGES, checkSyntaxInterface, };
