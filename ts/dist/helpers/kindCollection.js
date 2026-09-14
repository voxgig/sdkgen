"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kindCollection = kindCollection;
const types_1 = require("../types");
// Physical kind names and model namespaces are independent.
function kindCollection(model, kind, create = false) {
    const kit = create ? (model.main ??= {})[types_1.KIT] ??= {} : model?.main?.[types_1.KIT];
    if (kind === 'edition') {
        const doc = create ? kit.doc ??= {} : kit?.doc;
        return create ? doc.edition ??= {} : doc?.edition ?? {};
    }
    return create ? kit[kind] ??= {} : kit?.[kind] ?? {};
}
//# sourceMappingURL=kindCollection.js.map