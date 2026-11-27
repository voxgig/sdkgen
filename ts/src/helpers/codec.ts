
import { modelCodecs } from './opShape'


// A target's body codec sources live in a directory named `codec`, one file
// per codec, its stem the codec's name with an optional `codec` suffix. The
// suite that drives them through a generated SDK is named for them too.
const CODEC_DIR = 'codec'

const CODECS = ['form', 'multipart', 'raw', 'handle'] as const

type CodecName = typeof CODECS[number]


// What a target has reached in moving bodies: in order, none, `encoded`,
// `streamed`, `resumable`. Declared in the target's model as `codec.tier`.
const CODEC_TIERS = ['none', 'encoded', 'streamed', 'resumable'] as const

type CodecTier = typeof CODEC_TIERS[number]


function codecTier(target: any): CodecTier {
  const tier = target?.codec?.tier
  return CODEC_TIERS.includes(tier) ? tier : 'none'
}


function atTier(target: any, tier: CodecTier): boolean {
  return CODEC_TIERS.indexOf(codecTier(target)) >= CODEC_TIERS.indexOf(tier)
}


function codecsUsed(model: any): Record<CodecName, boolean> {
  const used = modelCodecs(model)
  return { form: used.form, multipart: used.multipart, raw: used.raw, handle: used.slots }
}


const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')


// The codec sources a model does not use, and the suite when it uses none.
function codecExcludes(model: any): RegExp[] {
  const used = codecsUsed(model)
  const out = CODECS.filter((name) => !used[name]).map((name) => new RegExp(
    '(^|/)' + CODEC_DIR + '/' + esc(name) + '([_-]?codec)?(\\.[^/.]+)+$', 'i'))
  if (!CODECS.some((name) => used[name])) {
    out.push(/(^|\/)(test_?codec|codec[._-]?test)(\.[^/.]+)+$/i)
  }
  return out
}


export type {
  CodecName,
  CodecTier,
}

export {
  CODECS,
  CODEC_DIR,
  CODEC_TIERS,
  atTier,
  codecExcludes,
  codecTier,
  codecsUsed,
}
