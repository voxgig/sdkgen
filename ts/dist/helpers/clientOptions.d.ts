type OptionKind = 'string' | 'map' | 'list';
type ClientOption = {
    name: string;
    kind: OptionKind;
    desc: string;
};
declare function clientOptions(model: any): ClientOption[];
export type { ClientOption, OptionKind, };
export { clientOptions, };
