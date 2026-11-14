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
type DescEntity = {
    name: string;
    Name: string;
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
};
type SdkDescription = {
    target: string;
    name: string;
    Name: string;
    package: string;
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
declare function sdkDescription(model: any, targetName: string): SdkDescription;
export type { SdkDescription, DescArg, DescEntity, DescOption, DescQuick, DescServerVar, Scalar, };
export { sdkDescription, };
