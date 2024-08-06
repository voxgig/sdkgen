"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const code_1 = require("@hapi/code");
const aontu_1 = require("aontu");
const memfs_1 = require("memfs");
const jostraca_1 = require("jostraca");
const __1 = require("../");
(0, node_test_1.describe)('sdkgen', () => {
    (0, node_test_1.test)('happy', async () => {
        (0, code_1.expect)(__1.SdkGen).exist();
        const { fs, vol } = (0, memfs_1.memfs)({});
        const sdkgen = (0, __1.SdkGen)({
            fs, folder: '/top'
        });
        (0, code_1.expect)(sdkgen).exist();
        const root = makeRoot();
        const model = makeModel();
        // console.log('MODEL', model)
        const spec = {
            model,
            root
        };
        sdkgen.generate(spec);
        (0, code_1.expect)(vol.toJSON()).equal({
            '/top/js/README.md': '\n# foo js SDK\n  ',
            '/top/python/README.md': '\n# foo python SDK\n  ',
            '/top/java/README.md': '\n# foo java SDK\n  '
        });
    });
    function makeModel() {
        return (0, aontu_1.Aontu)(`
name: 'foo'

main: sdk: &: { name: .$KEY }

main: sdk: js: {}

main: sdk: python: {}

main: sdk: java: {}
`).gen();
    }
    function makeRoot() {
        return (0, jostraca_1.cmp)(function Root(props) {
            const { model } = props;
            (0, jostraca_1.Project)({ model }, () => {
                (0, jostraca_1.each)(model.main.sdk, (sdk) => {
                    (0, jostraca_1.Folder)({ name: sdk.name }, () => {
                        (0, jostraca_1.File)({ name: 'README.md' }, () => {
                            (0, jostraca_1.Code)(`
# ${model.name} ${sdk.name} SDK
  `);
                        });
                    });
                });
            });
        });
    }
});
//# sourceMappingURL=sdkgen.test.js.map