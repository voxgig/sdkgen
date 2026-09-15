
const { ENTITYSPEC } = require('../../Schema')

const { BaseFeature } = require('../base/BaseFeature')


// Payload validation against the model's own field types.
//
// The specs are NOT written here and not written in the model either: every
// entity field already carries a canonical type sentinel (`$STRING`,
// `$INTEGER`, the `$ONE` union for an OpenAPI multi-type), which is the same
// vocabulary struct.validate speaks. The generator maps them once
// (helpers/canonSpec) and emits `ENTITYSPEC` beside this file, so a field
// whose type changes in the API spec changes what this feature enforces with
// no edit anywhere.
//
// WHAT IS CHECKED
//   outbound (PreSpec)  the payload the caller asked to send, against
//                       `spec.op[<opname>]` — the operation's request shape,
//                       which is the SAME partiality policy that decides what
//                       the generated `<Name>CreateData` type requires.
//   inbound  (PreDone)  each record the operation returned, against
//                       `spec.data` — the entity's own field types.
//
// WHAT IS NOT. The model carries no array element types, no nested object
// schemas, no enums, formats or bounds (see canonSpec's note), so this checks
// the shape the model knows and nothing more. It is a guard against the
// mistakes the model CAN see — a number where a string belongs, a required
// field left out, a misspelled key under `strict` — not a substitute for the
// server's own validation.
class ValidateFeature extends BaseFeature {
  version = '0.0.1'
  name = 'validate'
  active = true

  _client
  _options = {}
  _spec = {}

  _request = true
  _response = false
  _mode = 'throw'


  init(ctx, options) {
    this._client = ctx.client
    this._options = options || {}
    this.active = options.active

    // DEFAULTS ARE APPLIED HERE, not by the option spec. The model's
    // `config.options` documents them and types them; it does not inject
    // them, because each feature entry in the spec is optional and struct
    // fills in nothing through an optional union. So every feature resolves
    // its own — and a `mode` left undefined here once meant `'throw' !==
    // undefined`, which silently turned every rejection into a no-op.
    this._request = false !== this._options.request
    this._response = true === this._options.response

    // FAIL CLOSED. Only the exact string 'report' selects report mode, so a
    // typo (`mode: 'thow'`) still rejects rather than silently turning
    // enforcement off — the failure nobody would notice. The option spec
    // rejects the typo outright; this is what happens if it ever does not.
    this._mode = 'report' === this._options.mode ? 'report' : 'throw'

    // `strict` is applied ONCE, here, by rebuilding the spec tree without the
    // `$OPEN` markers — rather than per call, which would clone a spec for
    // every request an SDK ever makes.
    this._spec = true === this._options.strict ? close(ENTITYSPEC) : ENTITYSPEC
  }


  // Outbound. `makeSpec` short-circuits on an `ctx.out.spec` that is already
  // set, so assigning the error here rejects the operation before the request
  // is built — the same seam rbac uses one stage earlier.
  PreSpec(ctx) {
    if (!this.active || !this._request) {
      return
    }

    const opname = (ctx.op && ctx.op.name) || ''
    const spec = this._entitySpec(ctx)
    const opspec = spec && spec.op ? spec.op[opname] : null

    if (null == opspec) {
      return
    }

    const errs = this._check(ctx, this._payload(ctx, opname), opspec, 'request')
    if (0 === errs.length || 'report' === this._mode) {
      return
    }

    const err = ctx.error('validate_failed',
      'Invalid ' + opname + ' request for entity "' + entname(ctx) + '": ' +
      errs.join('; '))
    ctx.out.spec = err
    return err
  }


  // Inbound. PreDone rather than PreResult: the records are extracted from
  // the response body by `makeResult`, which runs between the two, so at
  // PreResult there is nothing to check but the envelope.
  //
  // HOOK ORDER MATTERS HERE, and the default order is not the one you want.
  // PreDone hooks fire in feature ADD order, which defaults to `test` first
  // and then names sorted — and `validate` sorts last, after `audit`,
  // `cost`, `debug`, `metrics` and `telemetry`. Those observers therefore
  // record the operation as a success before this hook has looked at it.
  // Activating features as an ORDERED ARRAY fixes it:
  //
  //   feature: [{ name: 'validate', active: true, response: true },
  //             { name: 'metrics', active: true }]
  //
  // What this feature can fix from here, it does: the result is marked
  // failed and its records are cleared, so the entity absorbs nothing.
  PreDone(ctx) {
    if (!this.active || !this._response) {
      return
    }

    const spec = this._entitySpec(ctx)
    if (null == spec || null == spec.data) {
      return
    }

    const resdata = ctx.result && ctx.result.resdata
    if (null == resdata) {
      return
    }

    // A list op returns many records and a load returns one; both are checked
    // against the same record spec, because they are the same entity.
    const records = Array.isArray(resdata) ? resdata : [resdata]
    const errs = []
    for (const record of records) {
      if (null == record) {
        continue
      }

      // A NON-OBJECT IS A FAILURE, not something to skip. A load that
      // answered `42` where the entity's spec wants a record used to pass
      // this feature silently, which is the one outcome a validator must
      // never produce. struct rejects it with the field it could not find.
      for (const e of this._check(ctx, unwrap(record), spec.data, 'response')) {
        errs.push(e)
      }
    }

    if (0 === errs.length || 'report' === this._mode) {
      return
    }

    const err = ctx.error('validate_failed',
      'Invalid response for entity "' + entname(ctx) + '": ' + errs.join('; '))

    // BOTH, and `ok` is the load-bearing half: `done` returns `resdata`
    // whenever `result.ok` is true and never looks at `err`, so setting the
    // error alone handed the caller the very records that failed the spec.
    ctx.result.ok = false
    ctx.result.err = err

    // AND THE DATA GOES. The load/update fragments copy `result.resdata`
    // into the entity's own state on any non-null value, BEFORE `done`
    // raises — so rejecting the operation while leaving the records in place
    // left the caller holding an entity populated from a payload this
    // feature had just declared invalid. Clearing it is the only half of
    // that this feature owns; see the note on hook order below.
    ctx.result.resdata = undefined

    return err
  }


  // The payload an operation is about to send.
  //
  // TWO SLOTS, AND THE OP PICKS. A body op (create/update/patch) carries the
  // caller's argument in `reqdata` over the entity's `data`; a match op
  // (load/list/remove) carries it in `reqmatch` over `match`. That is what
  // the Entity*Op fragments pass to makeContext and what makePoint reads
  // (`getprop(ctx, 'req' + op.input)`) — so reading `reqdata` for every op
  // checked a `load({ id })` against the entity's STALE stored match and
  // rejected it for the id the caller had just supplied.
  _payload(ctx, opname) {
    const body = 'create' === opname || 'update' === opname || 'patch' === opname

    const base = body ? ctx.data : ctx.match
    const req = body ? ctx.reqdata : ctx.reqmatch

    const out = { ...(base || {}), ...(req || {}) }

    // `$action` SELECTS A CUSTOM ENDPOINT; it is not a field of the record.
    // makePoint reads it off this same argument and the request transformer
    // drops it before the body is built, so a spec built from the API's own
    // fields will never name it — and under `strict` every custom-action
    // call would be rejected for the one key that made it reachable.
    delete out.$action

    return out
  }


  _entitySpec(ctx) {
    return this._spec[entname(ctx)]
  }


  // One validate call. Errors are COLLECTED, never thrown: struct throws on
  // the first failure unless given an `errs` array, and a caller fixing a
  // payload wants every problem with it, not the first one.
  _check(ctx, data, spec, direction) {
    const struct = ctx.utility.struct
    const errs = []

    try {
      struct.validate(data, spec, { errs })
    }
    catch (e) {
      // A spec this port cannot run at all (rather than a payload that fails
      // it) must not take the operation down with it: report it like any
      // other failure and let `mode` decide.
      errs.push(e && e.message ? e.message : String(e))
    }

    if (0 < errs.length && 'function' === typeof this._options.onInvalid) {
      try {
        this._options.onInvalid({
          entity: entname(ctx),
          op: (ctx.op && ctx.op.name) || '',
          direction,
          errs,
          data,
        })
      }
      catch (_e) { }
    }

    return errs
  }
}


// A RESULT RECORD AS DATA.
//
// `makeResult` turns every record of a LIST into an entity instance
// (`entity.make()` then `ent.data(entry)`), so what reaches PreDone for a
// list is wrappers, not records — and a wrapper checked against a field spec
// fails on every required field while its actual data goes unchecked. A load
// returns the record itself, so this has to handle both.
function unwrap(record) {
  if (null != record && 'function' === typeof record.data) {
    const data = record.data()
    if (null != data) {
      return data
    }
  }
  return record
}


function entname(ctx) {
  return (ctx.entity && ctx.entity.name) || (ctx.op && ctx.op.entity) || ''
}


// The spec tree with every `$OPEN` marker removed, so an undeclared key is an
// error rather than a pass. Rebuilt rather than mutated: ENTITYSPEC is a
// module constant shared by every client in the process.
function close(node) {
  if (Array.isArray(node)) {
    return node.map((n) => close(n))
  }

  if (null == node || 'object' !== typeof node) {
    return node
  }

  const out = {}
  for (const key of Object.keys(node)) {
    if (OPEN === key) {
      continue
    }
    out[key] = close(node[key])
  }

  return out
}


// Built rather than written, so the backticks cannot be lost in an edit.
const OPEN = String.fromCharCode(96) + '$OPEN' + String.fromCharCode(96)


module.exports = {
  ValidateFeature
}
