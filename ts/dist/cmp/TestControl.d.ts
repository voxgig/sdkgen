declare const TEST_CONTROL_FILE = "sdk-test-control.json";
declare const TEST_CONTROL_EXCLUDE: RegExp;
declare const TestControl: import("jostraca").Component<{
    target: {
        name: string;
    };
    dir: string;
    ctx$?: any;
}, never, never>;
export { TestControl, TEST_CONTROL_FILE, TEST_CONTROL_EXCLUDE, };
