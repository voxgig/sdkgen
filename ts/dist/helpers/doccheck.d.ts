type DocFinding = {
    point: 'doc-link-dangling' | 'doc-table-broken';
    file: string;
    line: number;
    note: string;
};
declare function slug(heading: string): string;
declare function anchors(text: string): Set<string>;
declare function docFindings(root: any, folder: string, onDisk: (path: string) => boolean, dryrun?: boolean): DocFinding[];
export { anchors, docFindings, slug, };
export type { DocFinding };
