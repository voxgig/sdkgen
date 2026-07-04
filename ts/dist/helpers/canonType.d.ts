type CanonLang = 'ts' | 'js' | 'py' | 'php' | 'rb' | 'lua' | 'go';
declare const CANON_TYPE: Record<string, Record<CanonLang, string>>;
declare const CANON_ANY: Record<CanonLang, string>;
declare function canonKey(sentinel: unknown): string;
declare function canonToType(sentinel: unknown, lang: string): string;
export { canonToType, canonKey, CANON_TYPE, CANON_ANY, };
export type { CanonLang, };
