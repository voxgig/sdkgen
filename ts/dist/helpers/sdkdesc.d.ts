import type { BodyFacts } from './media';
type Scalar = string;
type DescServerVar = {
    name: string;
    required: boolean;
    dflt: string;
};
type DescOption = {
    name: 'apikey';
    env: string;
} | {
    name: 'secret';
    env: string;
} | {
    name: 'server';
    vars: {
        name: string;
        placeholder: string;
    }[];
};
type DescArg = {
    name: string;
    type: Scalar;
    placeholder: string;
} | {
    name: string;
    fromCreated: string;
};
type DescLayout = {
    module: string;
    client: string;
    ctor: string;
    names?: Record<string, string>;
    vars?: Record<string, string>;
};
type DescSymbols = {
    accessor: string;
    var: string;
    plural: string;
    module?: string;
    alias?: string;
    fields?: Record<string, string>;
};
type Naming = (model: any, target: any, tm: (name: string) => string) => {
    layout: DescLayout;
    symbols: (entity: any) => Omit<DescSymbols, 'plural'>;
    ident?: (name: string) => string;
};
type DescField = {
    name: string;
    type: any;
    required: boolean;
    text: string;
    ops: string[];
};
type DescOp = {
    name: string;
    action: boolean;
    args: DescArg[];
    needs: string[];
    idInData: string | null;
    body: BodyFacts | null;
};
type DescEntity = {
    name: string;
    Name: string;
    className: string;
    sym: DescSymbols;
    text: string;
    ops: string[];
    id: string | null;
    dataId: string | null;
    parents: string[];
    fields: DescField[];
    fieldOps: boolean;
    refOps: DescOp[];
    actions: DescAction[];
    show: string[];
};
type DescAction = {
    action: string;
    op: string;
    path: string;
    params: DescArg[];
};
type DescOptionRow = {
    path: string[];
    type: 'STRING' | 'OBJECT' | 'ANY';
    text: string;
};
type DescFeature = {
    name: string;
    title: string;
    version: string;
};
type DescRef = {
    title: string;
    test: boolean;
    optionRows: DescOptionRow[];
    features: DescFeature[];
};
type DescQuick = {
    entity: string;
    list: DescArg[] | null;
    load: {
        entity: string;
        args: DescArg[];
        nested: null | {
            parent: string;
            param: string;
        };
    } | null;
    create: DescArg[] | null;
    update: DescArg[] | null;
    patch: DescArg[] | null;
    remove: DescArg[] | null;
    chainsId: boolean;
};
type SdkDescription = {
    target: string;
    template: Record<string, string>;
    name: string;
    Name: string;
    package: string;
    layout: DescLayout;
    env: {
        prefix: string;
    };
    auth: {
        active: boolean;
        in: string;
        name: string;
        basic: boolean;
        secret: boolean;
    };
    options: DescOption[];
    server: DescServerVar[];
    entities: DescEntity[];
    quick: DescQuick | null;
    ref: DescRef;
};
declare function readsSecret(model: any): boolean;
declare function sdkDescription(model: any, target: any, naming?: Naming, stdrep?: Record<string, string>): SdkDescription;
declare function templateName(map: Record<string, string>, name: string): string;
export type { DescAction, DescField, DescFeature, DescOp, DescOptionRow, DescRef, Naming, SdkDescription, DescLayout, DescSymbols, DescArg, DescEntity, DescOption, DescQuick, DescServerVar, Scalar, };
export { templateName, sdkDescription, readsSecret, };
