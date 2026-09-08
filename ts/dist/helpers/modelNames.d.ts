type Rename = {
    from: string;
    to: string;
    key: string;
};
declare function guardModelNames(model: any, log?: any): Rename[];
export { guardModelNames, };
