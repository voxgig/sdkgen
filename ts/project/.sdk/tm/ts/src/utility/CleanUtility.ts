
import { Context } from '../types'
import { OPTSPEC } from '../Schema'


// Everything that leaves the pipeline passes through clean: the error, the
// explain record, the serialised context, and whatever a feature emits.
// Two layers: every registered secret VALUE (and its encoded forms) is
// replaced wherever it appears in a string, and every value under a
// sensitive KEY name is masked whatever it holds. Inside the pipeline data
// stays raw, so a hook can still read the header it must add to.

const MAXDEPTH = 32
const CIRCULAR = '[circular]'


type CleanConfig = {
  active: boolean
  keys: string[]
  values: string[]
  mask: string
  hint: number
  min: number
}


function normkey(key: any): string {
  return String(key).toLowerCase().replace(/[-_]/g, '')
}


function splitkeys(keys: any): string[] {
  return String(null == keys ? '' : keys)
    .split(/\s*,\s*/)
    .map(normkey)
    .filter((k: string) => '' !== k)
}


// The comma-separated literal values a caller registers; a list is taken
// as-is for a caller that has one.
function splitvalues(values: any): string[] {
  if (Array.isArray(values)) {
    return values.filter((v: any) => 'string' === typeof v)
  }
  return String(null == values ? '' : values)
    .split(/\s*,\s*/)
    .filter((v: string) => '' !== v)
}


// The spec carries numbers as strings, so every target reads it alike.
function count(val: any, dflt: number): number {
  const n = Math.floor(Number(val))
  return Number.isFinite(n) && 0 <= n ? n : dflt
}


// The derived block makeOptions builds; a context without options (makeError
// is reached with a bare one) falls back to the schema defaults, so nothing
// leaves raw for want of a constructor.
function cleanConfig(ctx: any): CleanConfig {
  const derived = ctx?.options?.__derived__?.clean
  if (null != derived) {
    return derived
  }
  return makeCleanConfig((OPTSPEC as any)?.clean)
}


function makeCleanConfig(cleanopts: any): CleanConfig {
  const opts = cleanopts || {}
  return {
    active: false !== opts.active,
    keys: splitkeys(opts.keys),
    values: [],
    mask: 'string' === typeof opts.mask ? opts.mask : '[redacted]',
    hint: count(opts.hint, 0),
    min: Math.max(1, count(opts.min, 4)),
  }
}


// The encoded forms a value travels in: Basic and Bearer both carry base64,
// a query credential is percent-encoded, and a JSON dump escapes it.
function forms(value: string): string[] {
  const out = [value]
  const add = (s: string) => { if ('' !== s && !out.includes(s)) out.push(s) }
  try { add(Buffer.from(value, 'utf8').toString('base64')) } catch (_e) { }
  try { add(encodeURIComponent(value)) } catch (_e) { }
  try { add(JSON.stringify(value).slice(1, -1)) } catch (_e) { }
  return out
}


// Register a secret value. Idempotent; shorter than `min` is not a secret
// the SDK can mask without blanking ordinary text.
function cleanAdd(ctx: Context, value: any): void {
  const cfg = cleanConfig(ctx)
  if ('string' !== typeof value || value.length < cfg.min) {
    return
  }
  let changed = false
  for (const form of forms(value)) {
    if (form.length >= cfg.min && !cfg.values.includes(form)) {
      cfg.values.push(form)
      changed = true
    }
  }
  if (changed) {
    cfg.values.sort((a, b) => b.length - a.length)
  }
}


function maskValue(cfg: CleanConfig, value: string): string {
  if (0 < cfg.hint && value.length > 2 * cfg.hint) {
    return cfg.mask + value.slice(-cfg.hint)
  }
  return cfg.mask
}


function cleanString(cfg: CleanConfig, text: string): string {
  let out = text
  for (const value of cfg.values) {
    if (out.includes(value)) {
      out = out.split(value).join(maskValue(cfg, value))
    }
  }
  return out
}


function sensitiveKey(cfg: CleanConfig, key: any): boolean {
  if (null == key || 'number' === typeof key) {
    return false
  }
  const nk = normkey(key)
  for (const k of cfg.keys) {
    if (nk.includes(k)) {
      return true
    }
  }
  return false
}


// A plain-data copy of what is about to leave: toJSON is honoured (an entity
// serialises as its data, a context as its record), functions are dropped,
// cycles are cut, and no live object is shared with the copy - masking the
// copy must never mask the pipeline's own spec.
function snapshot(cfg: CleanConfig, val: any, key: any, depth: number, seen: any[]): any {
  if (null == val) {
    return val
  }

  const t = typeof val

  if ('string' === t) {
    return sensitiveKey(cfg, key) ? maskValue(cfg, val) : cleanString(cfg, val)
  }

  if ('function' === t) {
    return undefined
  }

  if ('object' !== t) {
    return sensitiveKey(cfg, key) ? cfg.mask : val
  }

  if (MAXDEPTH <= depth || seen.includes(val)) {
    return CIRCULAR
  }

  if (sensitiveKey(cfg, key)) {
    return cfg.mask
  }

  seen.push(val)
  try {
    if (Array.isArray(val)) {
      const out: any[] = []
      for (let i = 0; i < val.length; i++) {
        out.push(snapshot(cfg, val[i], i, depth + 1, seen))
      }
      return out
    }

    if (val instanceof Error) {
      const out: any = {
        message: cleanString(cfg, String(val.message)),
        stack: cleanString(cfg, String(val.stack || '')),
      }
      for (const k of Object.keys(val)) {
        const v = snapshot(cfg, (val as any)[k], k, depth + 1, seen)
        if (undefined !== v) out[k] = v
      }
      return out
    }

    if ('function' === typeof (val as any).toJSON) {
      const json = (val as any).toJSON()
      return json === val ? plain(cfg, val, depth, seen) : snapshot(cfg, json, key, depth + 1, seen)
    }

    return plain(cfg, val, depth, seen)
  }
  finally {
    seen.pop()
  }
}


function plain(cfg: CleanConfig, val: any, depth: number, seen: any[]): any {
  const out: any = {}
  for (const k of Object.keys(val)) {
    const v = snapshot(cfg, val[k], k, depth + 1, seen)
    if (undefined !== v) out[k] = v
  }
  return out
}


// Clean a value on its way out. A string is redacted; an Error is redacted
// IN PLACE (it is about to be thrown, and its identity matters to the
// caller); anything else comes back as a masked plain-data copy.
function clean(ctx: Context, val: any) {
  const cfg = cleanConfig(ctx)

  if (false === cfg.active) {
    return val
  }

  if ('string' === typeof val) {
    return cleanString(cfg, val)
  }

  if (val instanceof Error) {
    val.message = cleanString(cfg, String(val.message))
    if ('string' === typeof val.stack) {
      val.stack = cleanString(cfg, val.stack)
    }
    for (const k of Object.keys(val)) {
      const v = (val as any)[k]
      if ('string' === typeof v) {
        (val as any)[k] = sensitiveKey(cfg, k) ? maskValue(cfg, v) : cleanString(cfg, v)
      }
      else if (null != v && 'object' === typeof v) {
        (val as any)[k] = snapshot(cfg, v, k, 1, [])
      }
    }
    return val
  }

  return snapshot(cfg, val, undefined, 0, [])
}


// Is this key name sensitive under the context's clean configuration?
function cleanKey(ctx: Context, key: any): boolean {
  return sensitiveKey(cleanConfig(ctx), key)
}


export {
  clean,
  cleanAdd,
  cleanKey,
  makeCleanConfig,
  splitvalues,
}
