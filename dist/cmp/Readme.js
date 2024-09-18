"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Readme = void 0;
const jostraca_1 = require("jostraca");
const ReadmeIntro_1 = require("./ReadmeIntro");
const ReadmeInstall_1 = require("./ReadmeInstall");
const ReadmeQuick_1 = require("./ReadmeQuick");
const ReadmeModel_1 = require("./ReadmeModel");
const ReadmeOptions_1 = require("./ReadmeOptions");
const ReadmeEntity_1 = require("./ReadmeEntity");
const Readme = (0, jostraca_1.cmp)(function Readme(props) {
    const { build } = props;
    const { model } = props.ctx$;
    (0, jostraca_1.File)({ name: 'README.md' }, () => {
        (0, jostraca_1.Content)(`
# ${model.Name} ${build.title} SDK
`);
        // Sections
        (0, ReadmeIntro_1.ReadmeIntro)({ build });
        (0, ReadmeInstall_1.ReadmeInstall)({ build });
        (0, ReadmeQuick_1.ReadmeQuick)({ build });
        (0, ReadmeModel_1.ReadmeModel)({ build });
        (0, ReadmeOptions_1.ReadmeOptions)({ build });
        (0, ReadmeEntity_1.ReadmeEntity)({ build });
    });
});
exports.Readme = Readme;
//# sourceMappingURL=Readme.js.map