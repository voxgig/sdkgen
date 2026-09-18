"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEST_CONTROL_EXCLUDE = exports.TEST_CONTROL_FILE = exports.TestControl = void 0;
const node_path_1 = __importDefault(require("node:path"));
const jostraca_1 = require("jostraca");
const TEST_CONTROL_FILE = 'sdk-test-control.json';
exports.TEST_CONTROL_FILE = TEST_CONTROL_FILE;
// Keep the blanket per-target `Copy({ from: 'tm/<lang>' })` from restoring the
// template default over a project's edited control file. One regex for every
// target: the file sits under `test/`, `t/`, `tests/` or `sdktest/` depending
// on the language, and the name is what identifies it either way.
const TEST_CONTROL_EXCLUDE = new RegExp('(^|/)' + TEST_CONTROL_FILE + '$');
exports.TEST_CONTROL_EXCLUDE = TEST_CONTROL_EXCLUDE;
const TestControl = (0, jostraca_1.cmp)(function TestControl(props) {
    const { target, dir } = props;
    (0, jostraca_1.File)({ name: TEST_CONTROL_FILE, exclude: true }, () => {
        (0, jostraca_1.Fragment)({
            from: node_path_1.default.resolve('tm', target.name, dir, TEST_CONTROL_FILE)
        });
    });
});
exports.TestControl = TestControl;
//# sourceMappingURL=TestControl.js.map