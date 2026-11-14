import type { DescEntity, DescOp, DescSymbols, Scalar, SdkDescription } from './sdkdesc';
type Ent = {
    name: string;
    Name: string;
    sym: DescSymbols;
};
type Ref = {
    role: 'many' | 'item' | 'one' | 'created';
    entity: Ent;
    name: string;
    list?: string;
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
    type?: Scalar;
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
    note?: string;
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
type ResultStyle = 'throw' | 'raise' | 'die' | 'pair' | 'errslot' | 'union' | 'wrapped';
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
    pairForm?: string;
    unwrap?: string;
    unusedError?: boolean;
    listOf?: string;
    prints: 'record' | 'fields';
};
type MemberKind = 'options' | 'utility' | 'utilityBase' | 'direct' | 'prepare' | 'tester' | 'data' | 'match' | 'dataGet' | 'dataSet' | 'matchGet' | 'matchSet' | 'dataArg' | 'matchArg' | 'make' | 'name' | 'client' | 'entopts' | 'stream' | 'streamIterator' | 'streamGenerator' | 'streamList' | 'streamLazy';
type Member = {
    kind: MemberKind;
    sig: string;
    returns?: string;
};
type RefFacts = {
    entityBy: 'class' | 'Name' | 'module';
    noun: string;
    entityNoun?: string;
    heading?: string;
    none: string;
    lits?: {
        true: string;
        false: string;
    };
    setArg?: string;
    keys: 'member' | 'bare';
    maps: string;
    container: string;
    valueType: Record<'STRING' | 'OBJECT' | 'ANY', string>;
    ctor: string[];
    ctorAlts?: {
        call: string;
        kind: CtorKind;
    }[];
    test: {
        sig: string;
        call: string;
        args: boolean;
        alts?: {
            call: string;
            kind: CtorKind;
        }[];
    }[];
    accessor: {
        sig: string;
        arg: 'data' | 'entopts';
    };
    op: Record<OpName, string>;
    opMatched?: Partial<Record<OpName, string>>;
    client: Member[];
    entity: Member[];
    direct: {
        returns: string;
        signal?: string;
    };
    prepare: {
        returns: string;
        fails: 'style' | 'value' | 'note';
    };
    body: {
        values: string;
        once?: string;
        binary?: boolean;
    };
    cancel: boolean;
};
type CtorKind = 'defaults' | 'explicit';
declare function entOf(desc: SdkDescription, name: string): Ent;
declare function clientBlock(desc: SdkDescription): Stmt[];
declare function listBlock(desc: SdkDescription, facts: RuntimeFacts): Stmt[] | null;
declare function loadBlock(desc: SdkDescription, facts: RuntimeFacts): Stmt[] | null;
declare function writeOps(desc: SdkDescription): string[];
declare function writeBlock(desc: SdkDescription, facts: RuntimeFacts): Stmt[] | null;
declare function refOpBlock(desc: SdkDescription, facts: RuntimeFacts, ent: DescEntity, op: DescOp): Stmt[] | null;
declare function actionBlock(desc: SdkDescription, ent: DescEntity, action: {
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
    standalone: boolean;
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
    }>, inner: (body: Stmt[]) => string[], sc: Scope, desc: SdkDescription, cx: CallContext) => string[];
    print: (s: Extract<Stmt, {
        k: 'print';
    }>, sc: Scope, desc: SdkDescription) => string[];
    attempt: (s: Extract<Stmt, {
        k: 'attempt';
    }>, inner: (body: Stmt[]) => string[], sc: Scope, desc: SdkDescription) => string[];
    comment: (text: string) => string;
    expr: (e: Expr, sc: Scope, desc: SdkDescription) => string;
    imports?: (desc: SdkDescription, used: Uses) => string[];
    notes?: Partial<Record<NoteSlot, string>>;
    before?: (stmts: Stmt[], desc: SdkDescription, sc: Scope) => string[];
    program?: (steps: ProgramStep[], desc: SdkDescription, sc: Scope) => string[];
    ref?: RefSyntax;
};
type RefSyntax = {
    facts: RefFacts;
    type: (t: any) => string;
    key: (container: 'options' | 'fetchargs', path: string[]) => string;
    instance: (ent: Ent, desc: SdkDescription) => string[];
    read: (value: string, key: string) => string;
};
type NoteSlot = `member:${MemberKind}` | 'ctor' | 'test' | 'instance' | 'entity' | 'operations' | 'features' | 'tutorial' | 'tutorial:list' | 'tutorial:load' | 'tutorial:write' | 'top';
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
declare function newScope(standalone?: boolean): Scope;
declare function note(p: Syntax, slot: NoteSlot): string;
declare function indent(lines: string[], by: string): string[];
export type { CallContext, CtorKind, NoteSlot, Member, MemberKind, RefFacts, RefSyntax, Ent, Entry, Expr, OpName, ProgramStep, Ref, ResultStyle, RuntimeFacts, Scope, Stmt, Syntax, Uses, };
export { actionBlock, clientBlock, entOf, featureBlock, refOpBlock, indent, listBlock, newScope, note, loadBlock, printBlock, printJoined, printProgram, printStmts, printSteps, uses, writeBlock, writeOps, };
