"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeQuick = void 0;
const jostraca_1 = require("jostraca");
const component_1 = require("../helpers/component");
const utility_1 = require("../utility");
const ReadmeQuick = (0, component_1.cmp)(function ReadmeQuick(props) {
    const { target, ctx$ } = props;
    const placement = (0, utility_1.credentialPlacement)(ctx$.model);
    (0, jostraca_1.Content)(`
## Tutorial: your first API call

This tutorial walks through creating a client, listing entities, and
loading a specific record.${'' === placement ? '' : ' ' + placement}

`);
    const t = target.name;
    // A target's own component still wins: a project override, an older copy,
    // or a packaged target that has not moved to a provider.
    const own = (0, utility_1.loadOptional)(ctx$, `./cmp/${t}/ReadmeQuick_${t}`);
    if (own) {
        own['ReadmeQuick']({ target });
        return;
    }
    const syntax = (0, utility_1.loadOptional)(ctx$, `./cmp/${t}/Syntax_${t}`)?.Syntax;
    (0, jostraca_1.Content)(`<!-- shared-quick provider=${null == syntax ? 'none' : syntax.lang} -->
SHARED QUICK START for ${t}: ${null == syntax ? '(no syntax provider)' :
        syntax.call('client', 'Entity', '')}

`);
});
exports.ReadmeQuick = ReadmeQuick;
//# sourceMappingURL=ReadmeQuick.js.map