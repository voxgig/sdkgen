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
};
type DescSymbols = {
    accessor: string;
    var: string;
    vars: string;
    module?: string;
    alias?: string;
    fields?: Record<string, string>;
};
type Naming = (model: any, target: any) => {
    layout: DescLayout;
    symbols: (entity: any) => DescSymbols;
};
type DescEntity = {
    name: string;
    Name: string;
    sym: DescSymbols;
    ops: string[];
    id: string | null;
    dataId: string | null;
    parents: string[];
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
    show: string[];
};
type SdkDescription = {
    target: string;
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
};
declare function sdkDescription(model: any, target: any, naming?: Naming): SdkDescription;
export type { Naming, SdkDescription, DescLayout, DescSymbols, DescArg, DescEntity, DescOption, DescQuick, DescServerVar, Scalar, };
export { sdkDescription, };
