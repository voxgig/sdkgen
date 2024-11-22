"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.action_lang = action_lang;
const jostraca_1 = require("jostraca");
const utility_1 = require("../utility");
const CMD_MAP = {
    add: cmd_lang_add
};
async function action_lang(args, ctx) {
    const cmdname = args[1];
    const cmd = CMD_MAP[cmdname];
    if (null == cmd) {
        throw new utility_1.SdkGenError('Unknown lang cmd: ' + cmdname);
    }
    await cmd(args, ctx);
}
async function cmd_lang_add(args, ctx) {
    let langs = args[2];
    langs = 'string' === typeof langs ? [langs] : langs;
    const jostraca = (0, jostraca_1.Jostraca)();
    const opts = {
        fs: ctx.fs,
        folder: ctx.folder,
        log: ctx.log.child({ cmp: 'jostraca' }),
        meta: { model: ctx.model, tree: ctx.tree }
    };
    await jostraca.generate(opts, () => LangRoot({ langs }));
}
const LangRoot = (0, jostraca_1.cmp)(function LangRoot(props) {
    const { ctx$, langs } = props;
    // TODO: model should be a top level ctx property
    ctx$.model = ctx$.meta.model;
    (0, jostraca_1.Project)({}, () => {
        (0, jostraca_1.Folder)({ name: 'model/lang' }, () => {
            (0, jostraca_1.each)(langs, (n) => {
                const lang = n.val$;
                // TODO: validate lang is a-z0-9-_. only
                (0, jostraca_1.Copy)({
                    from: 'node_modules/@voxgig/sdkgen/tm/generate/model/lang/' + lang + '.jsonic',
                    exclude: true
                });
            });
        });
    });
    modifyModel({
        langs,
        model: ctx$.meta.model,
        tree: ctx$.meta.tree,
        fs: ctx$.fs
    });
});
async function modifyModel({ langs, model, tree, fs }) {
    // TODO: This is a kludge.
    // Aontu should provide option for as-is AST so that can be used
    // to find injection point more reliably
    const path = tree.url;
    let src = fs.readFileSync(path, 'utf8');
    // Inject lang file references into model
    langs.sort().map((lang) => {
        const lineRE = new RegExp(`main:\\s+sdk:\\s+lang:\\s+${lang}:\\s+@"lang/${lang}.jsonic"`);
        if (!src.match(lineRE)) {
            src = src.replace(/(main:\s+sdk:\s+lang:\s+\{\s*\}\n)/, '$1' +
                `main: sdk: lang: ${lang}: @"lang/${lang}.jsonic"\n`);
        }
    });
    fs.writeFileSync(path, src);
}
//# sourceMappingURL=lang.js.map