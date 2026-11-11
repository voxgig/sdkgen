"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeIntro = void 0;
const jostraca_1 = require("jostraca");
const component_1 = require("../helpers/component");
const optional_1 = require("../helpers/optional");
const text_1 = require("../helpers/text");
const alongside_1 = require("../helpers/alongside");
// Every language README opens the same way: the title and tagline, the
// target's own ReadmeIntroBody, then the note naming the rest of the project.
// A component exporting a whole ReadmeIntro (a project's copy from before this
// frame, or a pack not yet moved to it) still writes its own introduction.
const ReadmeIntro = (0, component_1.cmp)(function ReadmeIntro(props) {
    const { target, ctx$ } = props;
    const { model } = ctx$;
    const intro = (0, optional_1.optionalComponent)(ctx$, target, 'ReadmeIntro');
    if (null == intro)
        return;
    if (null == intro.ReadmeIntroBody) {
        intro.ReadmeIntro({ target });
        return;
    }
    (0, jostraca_1.Content)(`# ${model.Name} ${target.title} SDK

${(0, text_1.modelText)(model).tagline || ''}

`);
    intro.ReadmeIntroBody({ target });
    (0, jostraca_1.Content)((0, alongside_1.alongsideNote)(model, target.name));
});
exports.ReadmeIntro = ReadmeIntro;
//# sourceMappingURL=ReadmeIntro.js.map