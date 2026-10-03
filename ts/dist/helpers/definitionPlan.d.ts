type Credential = {
    in: string;
    name: string;
    scheme?: string;
};
type DefinitionPoint = {
    entity: string;
    accessor: string;
    op: string;
    method: string;
    path: string;
    action?: string;
    args: {
        name: string;
        wire: string;
        value: any;
    }[];
    select: Record<string, any>;
    headers: {
        name: string;
        wire: string;
        value: any;
    }[];
    cookies: {
        name: string;
        wire: string;
        value: any;
    }[];
    query: string[];
    queryArgs: {
        name: string;
        wire: string;
    }[];
    auth: Credential[][] | null;
    status: number;
    sample: any;
    idField: string;
    ownQuery?: string;
    responseMedia?: string[];
    rawBody?: {
        media: string[];
        text: boolean;
    };
};
declare function definitionPlan(ctx$: any): DefinitionPoint[];
export type { DefinitionPoint, };
export { definitionPlan, };
