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
const ReadmeHowto_1 = require("./ReadmeHowto");
const ReadmeExplanation_1 = require("./ReadmeExplanation");
const ReadmeRef_1 = require("./ReadmeRef");
const Readme = (0, jostraca_1.cmp)(function Readme(props) {
    const { target } = props;
    const { model } = props.ctx$;
    (0, jostraca_1.File)({ name: 'README.md' }, () => {
        (0, ReadmeIntro_1.ReadmeIntro)({ target });
        (0, ReadmeInstall_1.ReadmeInstall)({ target });
        (0, ReadmeQuick_1.ReadmeQuick)({ target });
        (0, ReadmeHowto_1.ReadmeHowto)({ target });
        (0, ReadmeModel_1.ReadmeModel)({ target });
        (0, ReadmeOptions_1.ReadmeOptions)({ target });
        (0, ReadmeEntity_1.ReadmeEntity)({ target });
        (0, ReadmeExplanation_1.ReadmeExplanation)({ target });
        (0, jostraca_1.Content)(`
## Full Reference

See [REFERENCE.md](REFERENCE.md) for complete API reference
documentation including all method signatures, entity field schemas,
and detailed usage examples.
`);
    });
    // Generate separate reference documentation
    (0, ReadmeRef_1.ReadmeRef)({ target });
});
exports.Readme = Readme;
//# sourceMappingURL=Readme.js.map