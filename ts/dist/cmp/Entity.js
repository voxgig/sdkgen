"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Entity = void 0;
const jostraca_1 = require("jostraca");
const utility_1 = require("../utility");
const stdrep_1 = require("../helpers/stdrep");
const types_1 = require("../types");
const Entity = (0, jostraca_1.cmp)(function Entity(props) {
    const { target, entity, ctx$ } = props;
    const { log } = ctx$;
    // Entity_<lang> components pull stdrep off ctx$ for their fragments, and
    // Entity is the FIRST phase Root runs — so the generator-owned keys have to
    // exist by here, not just by Main.
    (0, stdrep_1.ensureStdrep)(ctx$);
    const entitySDK = (0, types_1.getModelPath)(ctx$.model, `main.${types_1.KIT}.entity.${entity.name}`);
    const Entity_sdk = (0, utility_1.requirePath)(ctx$, `./cmp/${target.name}/Entity_${target.name}`);
    Entity_sdk['Entity']({ target, entity, entitySDK });
    // Log identifiers, not the model subtrees. `target` and `entity` are large
    // aontu nodes and this fires once per entity per target (thousands of times
    // for a big API x 22 targets), so passing them serialised the whole model
    // fragment each time at default log level.
    log.info({
        point: 'generate-entity', target: target.name, entity: entity.name,
        note: 'target:' + target.name + ', ' + 'entity: ' + entity.name
    });
});
exports.Entity = Entity;
//# sourceMappingURL=Entity.js.map