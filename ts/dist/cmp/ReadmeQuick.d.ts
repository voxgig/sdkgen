import type { SdkDescription } from '../helpers/sdkdesc';
import type { Syntax } from '../helpers/example';
declare const ReadmeQuick: import("jostraca").Component<any, never, never>;
declare function describeTarget(ctx$: any, target: any): SdkDescription;
declare function quickText(p: Syntax, desc: SdkDescription): string;
declare function topQuickText(p: Syntax, desc: SdkDescription): string;
export { ReadmeQuick, describeTarget, quickText, topQuickText, };
