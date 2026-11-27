"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CODEC_TIERS = exports.CODEC_DIR = exports.CODECS = void 0;
exports.atTier = atTier;
exports.codecExcludes = codecExcludes;
exports.codecTier = codecTier;
exports.codecsUsed = codecsUsed;
const opShape_1 = require("./opShape");
// A target's body codec sources live in a directory named `codec`, one file
// per codec, its stem the codec's name with an optional `codec` suffix. The
// suite that drives them through a generated SDK is named for them too.
const CODEC_DIR = 'codec';
exports.CODEC_DIR = CODEC_DIR;
const CODECS = ['form', 'multipart', 'raw', 'handle'];
exports.CODECS = CODECS;
// What a target has reached in moving bodies: in order, none, `encoded`,
// `streamed`, `resumable`. Declared in the target's model as `codec.tier`.
const CODEC_TIERS = ['none', 'encoded', 'streamed', 'resumable'];
exports.CODEC_TIERS = CODEC_TIERS;
function codecTier(target) {
    const tier = target?.codec?.tier;
    return CODEC_TIERS.includes(tier) ? tier : 'none';
}
function atTier(target, tier) {
    return CODEC_TIERS.indexOf(codecTier(target)) >= CODEC_TIERS.indexOf(tier);
}
function codecsUsed(model) {
    const used = (0, opShape_1.modelCodecs)(model);
    return { form: used.form, multipart: used.multipart, raw: used.raw, handle: used.slots };
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// The codec sources a model does not use, and the suite when it uses none.
function codecExcludes(model) {
    const used = codecsUsed(model);
    const out = CODECS.filter((name) => !used[name]).map((name) => new RegExp('(^|/)' + CODEC_DIR + '/' + esc(name) + '([_-]?codec)?(\\.[^/.]+)+$', 'i'));
    if (!CODECS.some((name) => used[name])) {
        out.push(/(^|\/)(test_?codec|codec[._-]?test)(\.[^/.]+)+$/i);
    }
    return out;
}
//# sourceMappingURL=codec.js.map