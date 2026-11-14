import type { DescEntity, DescOp, DescSymbols, Scalar, SdkDescription } from './sdkdesc';
type Ent = {
    name: string;
    Name: string;
    sym: DescSymbols;
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
    k: 'fields';
    of: Ref;
    fields: string[];
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
    wide: boolean;
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
type ResultStyle = 'throw' | 'raise' | 'pair' | 'errslot' | 'union';
type OpName = 'list' | 'load' | 'create' | 'update' | 'patch' | 'remove';
type RuntimeFacts = {
    method: Record<OpName, string>;
    named: 'call' | 'bare';
    async: boolean;
    result: ResultStyle;
    collection: string;
    record: string;
    recordType?: string;
    errVar?: string;
    errSlot?: string;
    nullValue?: string;
    ok?: string;
    err?: string;
    prints: 'record' | 'fields';
};
type MemberKind = 'options' | 'utility' | 'direct' | 'prepare' | 'tester' | 'data' | 'match' | 'dataGet' | 'dataSet' | 'matchGet' | 'matchSet' | 'make' | 'name' | 'client' | 'entopts' | 'streamIterator' | 'streamGenerator' | 'streamChannel' | 'streamList';
type Member = {
    kind: MemberKind;
    sig: string;
};
type RefFacts = {
    classes: boolean;
    noun: 'Methods' | 'Functions';
    none: string;
    keys: 'member' | 'bare';
    maps: string;
    container: string;
    valueType: Record<'STRING' | 'OBJECT' | 'ANY', string>;
    ctor: string[];
    test: {
        sig: string;
        call: string;
        args: boolean;
    }[];
    accessor: {
        sig: string;
        arg: 'data' | 'entopts';
    };
    op: Record<OpName, string>;
    client: Member[];
    entity: Member[];
    direct: {
        returns: string;
        signal?: string;
    };
    prepare: {
        returns: string;
        fails: 'style' | 'value';
    };
    body: {
        values: string;
        once?: string;
        binary?: boolean;
    };
    cancel: boolean;
};
declare function entOf(desc: SdkDescription, name: string): Ent;
declare function clientBlock(desc: SdkDescription): Stmt[];
declare function listBlock(desc: SdkDescription, facts: RuntimeFacts): Stmt[] | null;
declare function loadBlock(desc: SdkDescription, facts: RuntimeFacts): Stmt[] | null;
declare function writeOps(desc: SdkDescription): string[];
declare function writeBlock(desc: SdkDescription, facts: RuntimeFacts): Stmt[] | null;
declare function refOpBlock(desc: SdkDescription, facts: RuntimeFacts, ent: DescEntity, op: DescOp): Stmt[] | null;
declare function actionBlock(desc: SdkDescription, ent: DescEntity, a: {
    action: string;
    op: string;
}): Stmt[];
declare function featureBlock(names: string[]): Stmt[];
type Uses = {
    env: boolean;
    field: boolean;
    print: boolean;
    entities: string[];
};
declare function uses(stmts: Stmt[]): Uses;
type Scope = {
    declared: Set<string>;
    local: Set<string>;
    stmts: Stmt[];
    section: Stmt[];
};
type CallContext = {
    inAttempt: boolean;
    last: boolean;
};
type ProgramStep = {
    title: string;
    lines: string[];
};
type Syntax = {
    fence: string;
    facts: RuntimeFacts;
    client: (s: Extract<Stmt, {
        k: 'client';
    }>, desc: SdkDescription, sc: Scope) => string[];
    call: (s: Extract<Stmt, {
        k: 'call';
    }>, desc: SdkDescription, sc: Scope, cx: CallContext) => string[];
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
    program?: (steps: ProgramStep[], desc: SdkDescription, sc: Scope) => string[];
    ref?: RefSyntax;
};
type RefSyntax = {
    facts: RefFacts;
    type: (t: any) => string;
    key: (container: 'options' | 'fetchargs', path: string[]) => string;
    instance: (ent: Ent, desc: SdkDescription) => string[];
};
declare function printStmts(p: Syntax, stmts: Stmt[], desc: SdkDescription, sc: Scope, inAttempt?: boolean): string[];
declare function printBlock(p: Syntax, stmts: Stmt[], desc: SdkDescription, sc: Scope): string;
declare function printSteps(p: Syntax, steps: {
    title: string;
    stmts: Stmt[];
}[], desc: SdkDescription, sc: Scope): ProgramStep[];
declare function printProgram(p: Syntax, steps: {
    title: string;
    stmts: Stmt[];
}[], desc: SdkDescription, sc: Scope): string;
declare function printJoined(p: Syntax, steps: {
    title: string;
    stmts: Stmt[];
}[], desc: SdkDescription, sc: Scope): string;
declare function newScope(): Scope;
declare function indent(lines: string[], by: string): string[];
export type { CallContext, Member, MemberKind, RefFacts, RefSyntax, Ent, Entry, Expr, OpName, ProgramStep, Ref, ResultStyle, RuntimeFacts, Scope, Stmt, Syntax, Uses, };
export { actionBlock, clientBlock, entOf, featureBlock, refOpBlock, indent, listBlock, newScope, loadBlock, printBlock, printJoined, printProgram, printStmts, printSteps, uses, writeBlock, writeOps, };
