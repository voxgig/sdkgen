"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeIntro = void 0;
const jostraca_1 = require("jostraca");
const TARGET_INTRO = {
    ts: 'Provides a type-safe,\nentity-oriented interface with full async/await support.',
    go: 'Provides an entity-oriented interface\nusing standard Go conventions \u2014 no generics required, data flows as\n`map[string]any`.',
    js: 'Provides an entity-oriented\ninterface with full async/await support.',
};
const ReadmeIntro = (0, jostraca_1.cmp)(function ReadmeIntro(props) {
    const { target } = props;
    const { model } = props.ctx$;
    const desc = model.main.def.desc || '';
    const targetIntro = TARGET_INTRO[target.name] || 'Provides an entity-oriented interface.';
    (0, jostraca_1.Content)(`# ${model.Name} ${target.title} SDK

The ${target.title} SDK for the ${model.Name} API. ${targetIntro}

`);
});
exports.ReadmeIntro = ReadmeIntro;
//# sourceMappingURL=ReadmeIntro.js.map