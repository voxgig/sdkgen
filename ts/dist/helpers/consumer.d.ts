type Consumed = {
    name: string;
    path: string;
    dir: string;
    away: boolean;
    url: string;
};
declare function consumedTarget(model: any, target: any, sdkrel: string): Consumed;
export type { Consumed, };
export { consumedTarget, };
