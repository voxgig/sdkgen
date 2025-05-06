"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const code_1 = require("@hapi/code");
const aontu_1 = require("aontu");
const memfs_1 = require("memfs");
const jostraca_1 = require("jostraca");
const __1 = require("../");
// 2025-01-01T00:00:00.000Z
const START_TIME = 1735689600000;
(0, node_test_1.describe)('sdkgen', () => {
    (0, node_test_1.test)('merge', async () => {
        let nowI = 0;
        const now = () => START_TIME + (++nowI * (60 * 1000));
        (0, code_1.expect)(__1.SdkGen).exist();
        const { fs, vol } = (0, memfs_1.memfs)({});
        const sdkgen = (0, __1.SdkGen)({
            now, fs, folder: '/top', root: '',
            existing: { txt: { merge: true } }
        });
        (0, code_1.expect)(sdkgen).exist();
        const root = makeRoot();
        const model = makeModel();
        // console.log('MODEL', model)
        const spec = {
            model,
            root,
        };
        let res0 = await sdkgen.generate(spec);
        (0, code_1.expect)(res0).includes({ ok: true });
        const voljson = vol.toJSON();
        (0, code_1.expect)(voljson).equals({
            '/top/foo/js/README.md': '\n# foo js SDK\n# index=0\n',
            '/top/foo/python/README.md': '\n# foo python SDK\n# index=0\n',
            '/top/foo/java/README.md': '\n# foo java SDK\n# index=0\n',
            '/top/.jostraca/generated/top/foo/js/README.md': '\n# foo js SDK\n# index=0\n',
            '/top/.jostraca/generated/top/foo/python/README.md': '\n# foo python SDK\n# index=0\n',
            '/top/.jostraca/generated/top/foo/java/README.md': '\n# foo java SDK\n# index=0\n',
            '/top/.jostraca/jostraca.meta.log': '{\n' +
                '  "foldername": ".jostraca",\n' +
                '  "filename": "jostraca.meta.log",\n' +
                '  "last": 1735690140000,\n' +
                '  "hlast": 2025010100090000,\n' +
                '  "files": {\n' +
                '    "/top/foo/js/README.md": {\n' +
                '      "action": "write",\n' +
                '      "path": "/top/foo/js/README.md",\n' +
                '      "exists": false,\n' +
                '      "actions": [\n' +
                '        "write"\n' +
                '      ],\n' +
                '      "protect": false,\n' +
                '      "conflict": false,\n' +
                '      "when": 1735689840000,\n' +
                '      "hwhen": 2025010100040000\n' +
                '    },\n' +
                '    "/top/foo/python/README.md": {\n' +
                '      "action": "write",\n' +
                '      "path": "/top/foo/python/README.md",\n' +
                '      "exists": false,\n' +
                '      "actions": [\n' +
                '        "write"\n' +
                '      ],\n' +
                '      "protect": false,\n' +
                '      "conflict": false,\n' +
                '      "when": 1735689960000,\n' +
                '      "hwhen": 2025010100060000\n' +
                '    },\n' +
                '    "/top/foo/java/README.md": {\n' +
                '      "action": "write",\n' +
                '      "path": "/top/foo/java/README.md",\n' +
                '      "exists": false,\n' +
                '      "actions": [\n' +
                '        "write"\n' +
                '      ],\n' +
                '      "protect": false,\n' +
                '      "conflict": false,\n' +
                '      "when": 1735690080000,\n' +
                '      "hwhen": 2025010100080000\n' +
                '    }\n' +
                '  }\n' +
                '}'
        });
        // Modify a generated file
        fs.writeFileSync('/top/foo/js/README.md', '\n# foo js SDK\n# EXTRA\n# index=0\n');
        let res1 = await sdkgen.generate(spec);
        // console.log('RES1', res1)
        (0, code_1.expect)(res1).includes({ ok: true });
        const voljson1 = vol.toJSON();
        (0, code_1.expect)(voljson1).equals({
            '/top/foo/js/README.md': '\n# foo js SDK\n# EXTRA\n# index=0\n',
            '/top/foo/python/README.md': '\n# foo python SDK\n# index=0\n',
            '/top/foo/java/README.md': '\n# foo java SDK\n# index=0\n',
            '/top/.jostraca/generated/top/foo/js/README.md': '\n# foo js SDK\n# index=0\n',
            '/top/.jostraca/generated/top/foo/python/README.md': '\n# foo python SDK\n# index=0\n',
            '/top/.jostraca/generated/top/foo/java/README.md': '\n# foo java SDK\n# index=0\n',
            '/top/.jostraca/jostraca.meta.log': '{\n' +
                '  "foldername": ".jostraca",\n' +
                '  "filename": "jostraca.meta.log",\n' +
                '  "last": 1735690980000,\n' +
                '  "hlast": 2025010100230000,\n' +
                '  "files": {\n' +
                '    "/top/foo/js/README.md": {\n' +
                '      "action": "merge",\n' +
                '      "path": "/top/foo/js/README.md",\n' +
                '      "exists": true,\n' +
                '      "actions": [\n' +
                '        "merge"\n' +
                '      ],\n' +
                '      "protect": false,\n' +
                '      "conflict": false,\n' +
                '      "when": 1735690800000,\n' +
                '      "hwhen": 2025010100200000\n' +
                '    },\n' +
                '    "/top/foo/python/README.md": {\n' +
                '      "action": "init",\n' +
                '      "path": "/top/foo/python/README.md",\n' +
                '      "exists": true,\n' +
                '      "actions": [],\n' +
                '      "protect": false,\n' +
                '      "conflict": false\n' +
                '    },\n' +
                '    "/top/foo/java/README.md": {\n' +
                '      "action": "init",\n' +
                '      "path": "/top/foo/java/README.md",\n' +
                '      "exists": true,\n' +
                '      "actions": [],\n' +
                '      "protect": false,\n' +
                '      "conflict": false\n' +
                '    }\n' +
                '  }\n' +
                '}'
        });
        // generate again
        let res2 = await sdkgen.generate(spec);
        (0, code_1.expect)(res2).includes({ ok: true });
        const voljson2 = vol.toJSON();
        (0, code_1.expect)(voljson2).equals({
            '/top/foo/js/README.md': '\n# foo js SDK\n# EXTRA\n# index=0\n',
            '/top/foo/python/README.md': '\n# foo python SDK\n# index=0\n',
            '/top/foo/java/README.md': '\n# foo java SDK\n# index=0\n',
            '/top/.jostraca/generated/top/foo/js/README.md': '\n# foo js SDK\n# index=0\n',
            '/top/.jostraca/generated/top/foo/python/README.md': '\n# foo python SDK\n# index=0\n',
            '/top/.jostraca/generated/top/foo/java/README.md': '\n# foo java SDK\n# index=0\n',
            '/top/.jostraca/jostraca.meta.log': '{\n' +
                '  "foldername": ".jostraca",\n' +
                '  "filename": "jostraca.meta.log",\n' +
                '  "last": 1735691820000,\n' +
                '  "hlast": 2025010100370000,\n' +
                '  "files": {\n' +
                '    "/top/foo/js/README.md": {\n' +
                '      "action": "merge",\n' +
                '      "path": "/top/foo/js/README.md",\n' +
                '      "exists": true,\n' +
                '      "actions": [\n' +
                '        "merge"\n' +
                '      ],\n' +
                '      "protect": false,\n' +
                '      "conflict": false,\n' +
                '      "when": 1735691640000,\n' +
                '      "hwhen": 2025010100340000\n' +
                '    },\n' +
                '    "/top/foo/python/README.md": {\n' +
                '      "action": "init",\n' +
                '      "path": "/top/foo/python/README.md",\n' +
                '      "exists": true,\n' +
                '      "actions": [],\n' +
                '      "protect": false,\n' +
                '      "conflict": false\n' +
                '    },\n' +
                '    "/top/foo/java/README.md": {\n' +
                '      "action": "init",\n' +
                '      "path": "/top/foo/java/README.md",\n' +
                '      "exists": true,\n' +
                '      "actions": [],\n' +
                '      "protect": false,\n' +
                '      "conflict": false\n' +
                '    }\n' +
                '  }\n' +
                '}'
        });
        // update model
        model.zed.a = 1;
        let res3 = await sdkgen.generate(spec);
        (0, code_1.expect)(res3).includes({ ok: true });
        const voljson3 = vol.toJSON();
        (0, code_1.expect)(voljson3).equals({
            '/top/foo/js/README.md': '\n' +
                '# foo js SDK\n' +
                '<<<<<<< EXISTING: 2025-01-01T00:37:00.000Z\n' +
                '# EXTRA\n' +
                '# index=0\n' +
                '=======\n' +
                '# index=1\n' +
                '>>>>>>> GENERATED: 2025-01-01T00:40:00.000Z\n',
            '/top/foo/python/README.md': '\n# foo python SDK\n# index=1\n',
            '/top/foo/java/README.md': '\n# foo java SDK\n# index=1\n',
            '/top/.jostraca/generated/top/foo/js/README.md': '\n# foo js SDK\n# index=1\n',
            '/top/.jostraca/generated/top/foo/python/README.md': '\n# foo python SDK\n# index=1\n',
            '/top/.jostraca/generated/top/foo/java/README.md': '\n# foo java SDK\n# index=1\n',
            '/top/.jostraca/jostraca.meta.log': '{\n' +
                '  "foldername": ".jostraca",\n' +
                '  "filename": "jostraca.meta.log",\n' +
                '  "last": 1735693140000,\n' +
                '  "hlast": 2025010100590000,\n' +
                '  "files": {\n' +
                '    "/top/foo/js/README.md": {\n' +
                '      "action": "merge",\n' +
                '      "path": "/top/foo/js/README.md",\n' +
                '      "exists": true,\n' +
                '      "actions": [\n' +
                '        "merge"\n' +
                '      ],\n' +
                '      "protect": false,\n' +
                '      "conflict": true,\n' +
                '      "when": 1735692480000,\n' +
                '      "hwhen": 2025010100480000\n' +
                '    },\n' +
                '    "/top/foo/python/README.md": {\n' +
                '      "action": "merge",\n' +
                '      "path": "/top/foo/python/README.md",\n' +
                '      "exists": true,\n' +
                '      "actions": [\n' +
                '        "merge"\n' +
                '      ],\n' +
                '      "protect": false,\n' +
                '      "conflict": false,\n' +
                '      "when": 1735692780000,\n' +
                '      "hwhen": 2025010100530000\n' +
                '    },\n' +
                '    "/top/foo/java/README.md": {\n' +
                '      "action": "merge",\n' +
                '      "path": "/top/foo/java/README.md",\n' +
                '      "exists": true,\n' +
                '      "actions": [\n' +
                '        "merge"\n' +
                '      ],\n' +
                '      "protect": false,\n' +
                '      "conflict": false,\n' +
                '      "when": 1735693080000,\n' +
                '      "hwhen": 2025010100580000\n' +
                '    }\n' +
                '  }\n' +
                '}'
        });
        // Modify a generated file
        fs.writeFileSync('/top/foo/js/README.md', '\n# foo js SDK\n# EXTRA\n# index=A\n');
        let res4 = await sdkgen.generate(spec);
        (0, code_1.expect)(res4).includes({ ok: true });
        const voljson4 = vol.toJSON();
        (0, code_1.expect)(voljson4).equals({
            '/top/foo/js/README.md': '\n# foo js SDK\n# EXTRA\n# index=A\n',
            '/top/foo/python/README.md': '\n# foo python SDK\n# index=1\n',
            '/top/foo/java/README.md': '\n# foo java SDK\n# index=1\n',
            '/top/.jostraca/generated/top/foo/js/README.md': '\n# foo js SDK\n# index=1\n',
            '/top/.jostraca/generated/top/foo/python/README.md': '\n# foo python SDK\n# index=1\n',
            '/top/.jostraca/generated/top/foo/java/README.md': '\n# foo java SDK\n# index=1\n',
            '/top/.jostraca/jostraca.meta.log': '{\n' +
                '  "foldername": ".jostraca",\n' +
                '  "filename": "jostraca.meta.log",\n' +
                '  "last": 1735693980000,\n' +
                '  "hlast": 2025010101130000,\n' +
                '  "files": {\n' +
                '    "/top/foo/js/README.md": {\n' +
                '      "action": "merge",\n' +
                '      "path": "/top/foo/js/README.md",\n' +
                '      "exists": true,\n' +
                '      "actions": [\n' +
                '        "merge"\n' +
                '      ],\n' +
                '      "protect": false,\n' +
                '      "conflict": false,\n' +
                '      "when": 1735693800000,\n' +
                '      "hwhen": 2025010101100000\n' +
                '    },\n' +
                '    "/top/foo/python/README.md": {\n' +
                '      "action": "init",\n' +
                '      "path": "/top/foo/python/README.md",\n' +
                '      "exists": true,\n' +
                '      "actions": [],\n' +
                '      "protect": false,\n' +
                '      "conflict": false\n' +
                '    },\n' +
                '    "/top/foo/java/README.md": {\n' +
                '      "action": "init",\n' +
                '      "path": "/top/foo/java/README.md",\n' +
                '      "exists": true,\n' +
                '      "actions": [],\n' +
                '      "protect": false,\n' +
                '      "conflict": false\n' +
                '    }\n' +
                '  }\n' +
                '}'
        });
        // generate again
        let res5 = await sdkgen.generate(spec);
        (0, code_1.expect)(res5).includes({ ok: true });
        const voljson5 = vol.toJSON();
        (0, code_1.expect)(voljson5).equals({
            '/top/foo/js/README.md': '\n# foo js SDK\n# EXTRA\n# index=A\n',
            '/top/foo/python/README.md': '\n# foo python SDK\n# index=1\n',
            '/top/foo/java/README.md': '\n# foo java SDK\n# index=1\n',
            '/top/.jostraca/generated/top/foo/js/README.md': '\n# foo js SDK\n# index=1\n',
            '/top/.jostraca/generated/top/foo/python/README.md': '\n# foo python SDK\n# index=1\n',
            '/top/.jostraca/generated/top/foo/java/README.md': '\n# foo java SDK\n# index=1\n',
            '/top/.jostraca/jostraca.meta.log': '{\n' +
                '  "foldername": ".jostraca",\n' +
                '  "filename": "jostraca.meta.log",\n' +
                '  "last": 1735694820000,\n' +
                '  "hlast": 2025010101270000,\n' +
                '  "files": {\n' +
                '    "/top/foo/js/README.md": {\n' +
                '      "action": "merge",\n' +
                '      "path": "/top/foo/js/README.md",\n' +
                '      "exists": true,\n' +
                '      "actions": [\n' +
                '        "merge"\n' +
                '      ],\n' +
                '      "protect": false,\n' +
                '      "conflict": false,\n' +
                '      "when": 1735694640000,\n' +
                '      "hwhen": 2025010101240000\n' +
                '    },\n' +
                '    "/top/foo/python/README.md": {\n' +
                '      "action": "init",\n' +
                '      "path": "/top/foo/python/README.md",\n' +
                '      "exists": true,\n' +
                '      "actions": [],\n' +
                '      "protect": false,\n' +
                '      "conflict": false\n' +
                '    },\n' +
                '    "/top/foo/java/README.md": {\n' +
                '      "action": "init",\n' +
                '      "path": "/top/foo/java/README.md",\n' +
                '      "exists": true,\n' +
                '      "actions": [],\n' +
                '      "protect": false,\n' +
                '      "conflict": false\n' +
                '    }\n' +
                '  }\n' +
                '}'
        });
    });
    function makeModel() {
        return (0, aontu_1.Aontu)(`
name: 'foo'

zed: a: 0

main: sdk: &: { name: .$KEY }

main: sdk: js: {}

main: sdk: python: {}

main: sdk: java: {}
`).gen();
    }
    function makeRoot() {
        return (0, jostraca_1.cmp)(function Root(props) {
            const { model } = props;
            (0, jostraca_1.Project)({ model, folder: model.name }, () => {
                (0, jostraca_1.each)(model.main.sdk, (sdk) => {
                    (0, jostraca_1.Folder)({ name: sdk.name }, () => {
                        (0, jostraca_1.File)({ name: 'README.md' }, () => {
                            (0, jostraca_1.Content)(`
# ${model.name} ${sdk.name} SDK
# index=${model.zed.a}
`);
                        });
                    });
                });
            });
        });
    }
});
//# sourceMappingURL=sdkgen.test.js.map