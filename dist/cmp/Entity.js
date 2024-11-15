"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Entity = void 0;
const jostraca_1 = require("jostraca");
const utility_1 = require("../utility");
const Entity = (0, jostraca_1.cmp)(function Entity(props) {
    const { build, entity, ctx$ } = props;
    const Entity_sdk = (0, utility_1.requirePath)(ctx$, `./${build.name}/Entity_${build.name}`);
    Entity_sdk['Entity']({ build, entity });
});
exports.Entity = Entity;
//# sourceMappingURL=Entity.js.map