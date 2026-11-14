import type { Scalar, SdkDescription } from './sdkdesc';
type Ent = {
    name: string;
    Name: string;
};
type Ref = {
    role: 'many' | 'item' | 'one' | 'created';
    entity: Ent;
};
type Expr = {
    k: 'lit';
    type: Scalar;
    text: string;
} | {
    k: 'str';
    text: string;
} | {
    k: 'env';
    name: string;
} | {
    k: 'record';
    of: Ref;
} | {
    k: 'field';
    of: Ref;
    field: string;
} | {
    k: 'map';
    entries: Entry[];
};
type Entry = {
    key: string;
    value: Expr;
};
type Stmt = {
    k: 'client';
    options: Entry[];
} | {
    k: 'call';
    entity: Ent;
    op: string;
    arg: Entry[] | null;
    bind: Ref | null;
} | {
    k: 'each';
    item: Ref;
    of: Ref;
    body: Stmt[];
} | {
    k: 'print';
    what: Expr;
} | {
    k: 'attempt';
    what: string;
    body: Stmt[];
} | {
    k: 'comment';
    text: string;
} | {
    k: 'gap';
};
declare function clientBlock(desc: SdkDescription): Stmt[];
declare function listBlock(desc: SdkDescription): Stmt[] | null;
declare function loadBlock(desc: SdkDescription): Stmt[] | null;
declare function writeOps(desc: SdkDescription): string[];
declare function writeBlock(desc: SdkDescription): Stmt[] | null;
type Uses = {
    env: boolean;
    field: boolean;
    entities: string[];
};
declare function uses(stmts: Stmt[]): Uses;
type Scope = {
    declared: Set<string>;
    local: Set<string>;
    stmts: Stmt[];
    section: Stmt[];
};
type RuntimeWords = {
    op: (name: string) => string;
    many: string;
    fails: string;
    data: string;
};
type Syntax = {
    fence: string;
    words: RuntimeWords;
    client: (s: Extract<Stmt, {
        k: 'client';
    }>, desc: SdkDescription, sc: Scope) => string[];
    call: (s: Extract<Stmt, {
        k: 'call';
    }>, desc: SdkDescription, sc: Scope) => string[];
    each: (s: Extract<Stmt, {
        k: 'each';
    }>, inner: (body: Stmt[]) => string[], sc: Scope) => string[];
    print: (s: Extract<Stmt, {
        k: 'print';
    }>, sc: Scope) => string[];
    attempt: (s: Extract<Stmt, {
        k: 'attempt';
    }>, inner: (body: Stmt[]) => string[], sc: Scope) => string[];
    comment: (text: string) => string;
    expr: (e: Expr, sc: Scope) => string;
    before?: (stmts: Stmt[], desc: SdkDescription, sc: Scope) => string[];
};
declare function printStmts(p: Syntax, stmts: Stmt[], desc: SdkDescription, sc: Scope): string[];
declare function printBlock(p: Syntax, stmts: Stmt[], desc: SdkDescription, sc: Scope): string;
declare function newScope(): Scope;
declare function indent(lines: string[], by: string): string[];
export type { Ent, Entry, Expr, Ref, RuntimeWords, Scope, Stmt, Syntax, Uses, };
export { clientBlock, indent, listBlock, newScope, loadBlock, printBlock, printStmts, uses, writeBlock, writeOps, };
