"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Entity = void 0;
const jostraca_1 = require("jostraca");
const utility_1 = require("../utility");
const Entity = (0, jostraca_1.cmp)(function Entity(props) {
    const { target, entity, ctx$ } = props;
    const entitySDK = ctx$.model.main.sdk.entity[entity.name];
    const Entity_sdk = (0, utility_1.requirePath)(ctx$, `./cmp/${target.name}/Entity_${target.name}`);
    Entity_sdk['Entity']({ target, entity, entitySDK });
});
exports.Entity = Entity;
//# sourceMappingURL=Entity.js.map