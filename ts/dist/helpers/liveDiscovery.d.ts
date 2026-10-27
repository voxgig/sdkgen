type LiveDiscovery = {
    param: string;
    field: string;
};
declare function liveDirectDiscovery(entity: any, loadParams: any[], listPoint: any): LiveDiscovery | undefined;
export type { LiveDiscovery };
export { liveDirectDiscovery };
