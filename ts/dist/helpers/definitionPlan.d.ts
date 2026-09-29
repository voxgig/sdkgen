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
    query: string[];
    auth: Credential[][] | null;
    status: number;
    sample: any;
    idField: string;
};
declare function definitionPlan(ctx$: any): DefinitionPoint[];
export type { DefinitionPoint, };
export { definitionPlan, };
