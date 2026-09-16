type RegisterOptions = {
    export?: string;
    optional?: boolean;
};
declare function registerComponent(name: string, options?: RegisterOptions): import("jostraca").Component<any, never, never>;
export type { RegisterOptions, };
export { registerComponent, };
