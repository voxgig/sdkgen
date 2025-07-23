"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Top = void 0;
const jostraca_1 = require("jostraca");
const utility_1 = require("../utility");
const Top = (0, jostraca_1.cmp)(function Top(props) {
    const { ctx$ } = props;
    const { model, stdrep, log } = ctx$;
    //  TOOD: copy non-target items, suck as LICENSE
    /*
    Copy({
      from,
      replace: {
        ...stdrep,
      }
    })
    */
    const Top_sdk = (0, utility_1.requirePath)(ctx$, `Top`);
    Top_sdk['Top']({ model, stdrep });
    log.info({ point: 'generate-top' });
});
exports.Top = Top;
//# sourceMappingURL=Top.js.map