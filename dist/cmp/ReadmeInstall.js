"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeInstall = void 0;
const jostraca_1 = require("jostraca");
const ReadmeInstall = (0, jostraca_1.cmp)(function ReadmeInstall(props) {
    const { build } = props;
    (0, jostraca_1.Code)(`
## Install
`);
    (0, jostraca_1.select)(build.name, {
        js: () => (0, jostraca_1.Code)(`
\`\`\`

npm install ${build.name}SDK

\`\`\`
`),
        python: () => (0, jostraca_1.Code)(`
\`\`\`

pip install ${build.name}SDK

\`\`\`
`),
        java: () => (0, jostraca_1.Code)(`
\`\`\`

maven install ${build.name}SDK

\`\`\`
`),
        go: () => (0, jostraca_1.Code)(`
\`\`\`

go get ${build.name}SDK

\`\`\`
`),
        ruby: () => (0, jostraca_1.Code)(`
\`\`\`

gem install ${build.name}SDK

\`\`\`
`)
    });
});
exports.ReadmeInstall = ReadmeInstall;
//# sourceMappingURL=ReadmeInstall.js.map