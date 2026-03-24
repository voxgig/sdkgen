"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeOptions = void 0;
const jostraca_1 = require("jostraca");
const ReadmeOptions = (0, jostraca_1.cmp)(function ReadmeOptions(props) {
    const { target } = props;
    const { model } = props.ctx$;
    const publishedOptions = (0, jostraca_1.each)(target.options)
        .filter((option) => option.publish);
    if (0 === publishedOptions.length) {
        return;
    }
    (0, jostraca_1.Content)(`

## Options

Pass options when creating a client instance:

\`\`\`ts
const client = new ${model.Name}SDK({
`);
    publishedOptions.map((option) => {
        if ('apikey' === option.name) {
            (0, jostraca_1.Content)(`  ${option.name}: process.env.${model.NAME}_APIKEY,
`);
        }
        else {
            (0, jostraca_1.Content)(`  // ${option.name}: ${option.kind === 'string' ? "'...'" : '...'},
`);
        }
    });
    (0, jostraca_1.Content)(`})
\`\`\`

| Option | Type | Description |
| --- | --- | --- |
`);
    publishedOptions.map((option) => {
        (0, jostraca_1.Content)(`| \`${option.name}\` | \`${option.kind}\` | ${option.short} |
`);
    });
    (0, jostraca_1.Content)(`
`);
});
exports.ReadmeOptions = ReadmeOptions;
//# sourceMappingURL=ReadmeOptions.js.map