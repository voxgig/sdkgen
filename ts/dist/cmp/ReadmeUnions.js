"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIN_REPORTED_BRANCHES = exports.ReadmeUnions = void 0;
const jostraca_1 = require("jostraca");
const component_1 = require("../helpers/component");
const types_1 = require("../types");
const canonType_1 = require("../helpers/canonType");
const packageMeta_1 = require("../helpers/packageMeta");
const MIN_REPORTED_BRANCHES = 3;
exports.MIN_REPORTED_BRANCHES = MIN_REPORTED_BRANCHES;
const ReadmeUnions = (0, component_1.cmp)(function ReadmeUnions(props) {
    const { ctx$, target } = props;
    const { model } = ctx$;
    // Where a language cannot join a union's branches, a two-variant field is
    // an open value too, though it is below the table's threshold.
    const joins = null != canonType_1.CANON_UNION_JOIN[(0, packageMeta_1.originName)(model, target?.name)];
    const entity = (0, types_1.getModelPath)(model, `main.${types_1.KIT}.entity`);
    const rows = [];
    (0, jostraca_1.each)(entity, (ent) => {
        if (false === ent.active) {
            return;
        }
        (0, jostraca_1.each)(ent.fields, (field) => {
            const union = field?.union;
            if (null == union || union.branches < MIN_REPORTED_BRANCHES) {
                return;
            }
            rows.push({
                entity: ent.name,
                field: field.n,
                branches: union.branches,
                depth: union.depth,
            });
        });
    });
    if (0 === rows.length) {
        return;
    }
    // Widest first: the worst offender is the one a reader needs to see.
    rows.sort((a, b) => b.branches - a.branches || a.entity.localeCompare(b.entity) ||
        a.field.localeCompare(b.field));
    const plural = 1 === rows.length ? 'field is' : 'fields are';
    (0, jostraca_1.Content)(`
## Open types

${rows.length} ${plural} carried as open values rather than typed structures.
This follows from the API definition, not from a gap in this SDK: the
definition describes ${1 === rows.length ? 'it' : 'them'} with untagged unions —
\`oneOf\`/\`anyOf\` branches with no \`discriminator\` — so it never states which
variant a given value is. Nothing can select a branch reliably, so the SDK
passes the value through unchanged rather than assert a shape the API does not
guarantee.

| Entity | Field | Variants | Nesting |
| --- | --- | --- | --- |
${rows.map((r) => `| \`${r.entity}\` | \`${r.field}\` | ${r.branches} | ` +
        `${r.depth} ${1 === r.depth ? 'level' : 'levels'} |`).join('\n')}

These values round-trip unchanged — read them, modify them, send them back. If
the API adds a \`discriminator\` to the definition, regenerating will type them.
${joins ? 'Every other field is typed normally.' :
        'A field with two variants is an open value here too; every other field is\ntyped normally.'}
`);
});
exports.ReadmeUnions = ReadmeUnions;
//# sourceMappingURL=ReadmeUnions.js.map