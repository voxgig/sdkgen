"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Main = void 0;
const jostraca_1 = require("jostraca");
const utility_1 = require("../utility");
const Main = (0, jostraca_1.cmp)(function Main(props) {
    const { target, ctx$ } = props;
    const { model } = ctx$;
    (0, jostraca_1.names)(model, model.name);
    console.log('MODEL name', model.name, model.Name);
    (0, jostraca_1.Copy)({
        from: 'tm/' + target.name,
        replace: {
            Name: model.Name,
            // '/"`([^"]+)`"/': '$1'
        }
    });
    const Main_sdk = require((0, utility_1.resolvePath)(ctx$, `cmp/${target.name}/Main_${target.name}`));
    Main_sdk['Main']({ model, target });
    // // TODO: make optional via target model
    // Copy({ from: 'tm/' + target.name + '/LICENSE', to: 'LICENSE' })
    // Folder({ name: 'src/utility' }, () => {
    //   Copy({
    //     from: 'tm/' + target.name + '/src/utility',
    //     // TODO: make this work for folders
    //     // to: target + '/src'
    //   })
    // })
    // Folder({ name: 'test' }, () => {
    //   Copy({
    //     from: 'tm/' + target.name + '/test',
    //   })
    // })
});
exports.Main = Main;
//# sourceMappingURL=Main.js.map