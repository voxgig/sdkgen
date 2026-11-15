declare const SYNTAX_INTERFACE: '3.3';
declare const SYNTAX_CHANGES: {
    to: string;
    change: string;
}[];
declare function checkSyntaxInterface(target: string, declared: unknown): void;
export { SYNTAX_INTERFACE, SYNTAX_CHANGES, checkSyntaxInterface, };
