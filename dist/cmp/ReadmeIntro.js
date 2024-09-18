"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeIntro = void 0;
const jostraca_1 = require("jostraca");
const ReadmeIntro = (0, jostraca_1.cmp)(function ReadmeIntro(props) {
    const { ctx$: { model } } = props;
    (0, jostraca_1.Content)(`
## Introduction

${model.main.def.desc}

`);
});
exports.ReadmeIntro = ReadmeIntro;
//# sourceMappingURL=ReadmeIntro.js.map