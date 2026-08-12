type RegisterOptions = {
    export?: string;
    optional?: boolean;
};
declare function registerComponent(name: string, options?: RegisterOptions): import("jostraca").Component;
export type { RegisterOptions, };
export { registerComponent, };
