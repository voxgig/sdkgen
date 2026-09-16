# ProjectName SDK validate feature

from __future__ import annotations

from projectname_sdk.feature.base_feature import ProjectNameBaseFeature
from projectname_sdk.schema import ENTITYSPEC
from projectname_sdk.utility.voxgig_struct import voxgig_struct as vs


# Built rather than written, so the backticks cannot be lost in an edit.
_OPEN = chr(96) + "$OPEN" + chr(96)


# Payload validation against the model's own field types. The python port of
# tm/ts/src/feature/validate/ValidateFeature.ts.
#
# The specs are NOT written here and not written in the model either: every
# entity field already carries a canonical type sentinel (`$STRING`,
# `$INTEGER`, the `$ONE` union for an OpenAPI multi-type), which is the same
# vocabulary struct.validate speaks. The generator maps them once
# (helpers/canonSpec) and emits `ENTITYSPEC` into schema.py, so a field whose
# type changes in the API spec changes what this feature enforces with no edit
# anywhere.
#
# WHAT IS CHECKED
#   outbound (PreSpec)  the payload the caller asked to send, against
#                       `spec["op"][opname]` - the operation's request shape.
#   inbound  (PreDone)  each record the operation returned, against
#                       `spec["data"]` - the entity's own field types.
#
# WHAT IS NOT. The model carries no array element types, no nested object
# schemas, no enums, formats or bounds, so this checks the shape the model
# knows and nothing more.
class ProjectNameValidateFeature(ProjectNameBaseFeature):
    def __init__(self):
        super().__init__()
        self.version = "0.0.1"
        self.name = "validate"
        self.active = True
        self.client = None
        self.options = {}
        self.spec = {}
        self.request = True
        self.response = False
        self.mode = "throw"

    def init(self, ctx, options):
        self.client = ctx.client
        self.options = options if isinstance(options, dict) else {}
        self.active = self.options.get("active") is True

        # DEFAULTS ARE APPLIED HERE, not by the option spec. The model's
        # `config.options` documents them and types them; it does not inject
        # them, because each feature entry in the spec is optional and struct
        # fills in nothing through an optional union.
        self.request = self.options.get("request") is not False
        self.response = self.options.get("response") is True

        # FAIL CLOSED. Only the exact string "report" selects report mode, so
        # a typo (`mode: "thow"`) still rejects rather than silently turning
        # enforcement off. The option spec rejects the typo outright; this is
        # what happens if it ever does not.
        self.mode = "report" if self.options.get("mode") == "report" else "throw"

        # `strict` is applied ONCE, here, by rebuilding the spec tree without
        # the `$OPEN` markers - rather than per call, which would clone a spec
        # for every request an SDK ever makes.
        self.spec = _close(ENTITYSPEC) if self.options.get("strict") is True else ENTITYSPEC

    # Outbound. make_spec short-circuits on a `ctx.out["spec"]` that is
    # already set, so assigning the error here rejects the operation before
    # the request is built - the same seam rbac uses one stage earlier.
    def PreSpec(self, ctx):
        if not self.active or not self.request:
            return

        opname = self._opname(ctx)
        espec = self._entity_spec(ctx)
        opspec = (espec.get("op") or {}).get(opname) if isinstance(espec, dict) else None

        if opspec is None:
            return

        errs = self._check(ctx, self._payload(ctx, opname), opspec, "request")
        if len(errs) == 0 or self.mode == "report":
            return

        err = ctx.make_error("validate_failed",
            "Invalid " + opname + ' request for entity "' + _entname(ctx) + '": ' +
            "; ".join(errs))
        ctx.out["spec"] = err
        return err

    # Inbound. PreDone rather than PreResult: the records are extracted from
    # the response body by make_result, which runs between the two, so at
    # PreResult there is nothing to check but the envelope.
    #
    # HOOK ORDER MATTERS HERE, and the default order is not the one you want.
    # PreDone hooks fire in feature ADD order, which defaults to `test` first
    # and then names sorted - and `validate` sorts last, after audit, cost,
    # debug, metrics and telemetry. Those observers therefore record the
    # operation as a success before this hook has looked at it. Activating
    # features as an ORDERED LIST fixes it.
    def PreDone(self, ctx):
        if not self.active or not self.response:
            return

        espec = self._entity_spec(ctx)
        if not isinstance(espec, dict):
            return

        dataspec = espec.get("data")
        if dataspec is None:
            return

        result = getattr(ctx, "result", None)
        resdata = getattr(result, "resdata", None) if result is not None else None
        if resdata is None:
            return

        # A list op returns many records and a load returns one; both are
        # checked against the same record spec, because they are the same
        # entity.
        records = resdata if isinstance(resdata, list) else [resdata]

        errs = []
        for record in records:
            if record is None:
                continue

            # A NON-OBJECT IS A FAILURE, not something to skip. A load that
            # answered `42` where the entity's spec wants a record must not
            # pass this feature silently - struct rejects it with the field it
            # could not find.
            errs.extend(self._check(ctx, _unwrap(record), dataspec, "response"))

        if len(errs) == 0 or self.mode == "report":
            return

        err = ctx.make_error("validate_failed",
            'Invalid response for entity "' + _entname(ctx) + '": ' + "; ".join(errs))

        # BOTH, and `ok` is the load-bearing half: done returns resdata
        # whenever result.ok is true and never looks at err, so setting the
        # error alone would hand the caller the very records that failed the
        # spec.
        result.ok = False
        result.err = err

        # AND THE DATA GOES. The load/update paths copy result.resdata into
        # the entity's own state on any non-None value, BEFORE done raises -
        # so rejecting the operation while leaving the records in place would
        # leave the caller holding an entity populated from a payload this
        # feature had just declared invalid.
        result.resdata = None

        return err

    # The payload an operation is about to send.
    #
    # TWO SLOTS, AND THE OP PICKS. A body op (create/update/patch) carries the
    # caller's argument in `reqdata` over the entity's `data`; a match op
    # (load/list/remove) carries it in `reqmatch` over `match`. That is what
    # the entity operations pass to make_context and what make_point reads -
    # so reading `reqdata` for every op would check a `load({id})` against the
    # entity's STALE stored match and reject it for the id the caller had just
    # supplied.
    def _payload(self, ctx, opname):
        body = opname in ("create", "update", "patch")

        base = getattr(ctx, "data", None) if body else getattr(ctx, "match", None)
        req = getattr(ctx, "reqdata", None) if body else getattr(ctx, "reqmatch", None)

        out = {}
        if isinstance(base, dict):
            out.update(base)
        if isinstance(req, dict):
            out.update(req)

        # `$action` SELECTS A CUSTOM ENDPOINT; it is not a field of the
        # record. make_point reads it off this same argument and the request
        # transformer drops it before the body is built, so a spec built from
        # the API's own fields will never name it - and under `strict` every
        # custom-action call would be rejected for the one key that made it
        # reachable.
        out.pop("$action", None)

        return out

    def _entity_spec(self, ctx):
        if not isinstance(self.spec, dict):
            return None
        return self.spec.get(_entname(ctx))

    def _opname(self, ctx):
        op = getattr(ctx, "op", None)
        name = getattr(op, "name", None) if op is not None else None
        return name if isinstance(name, str) else ""

    # One validate call. Errors are COLLECTED, never raised: struct raises on
    # the first failure unless given an `errs` list, and a caller fixing a
    # payload wants every problem with it, not the first one.
    def _check(self, ctx, data, spec, direction):
        errs = []

        try:
            vs.validate(data, spec, {"errs": errs})
        except Exception as e:  # noqa: BLE001
            # A spec this port cannot run at all (rather than a payload that
            # fails it) must not take the operation down with it: report it
            # like any other failure and let `mode` decide.
            if len(errs) == 0:
                errs.append(str(e))

        errs = [str(e) for e in errs]

        if len(errs) > 0:
            on_invalid = self.options.get("onInvalid")
            if callable(on_invalid):
                try:
                    on_invalid({
                        "entity": _entname(ctx),
                        "op": self._opname(ctx),
                        "direction": direction,
                        "errs": errs,
                        "data": data,
                    })
                except Exception:  # noqa: BLE001
                    pass

        return errs


# A RESULT RECORD AS DATA.
#
# make_result turns every record of a LIST into an entity instance, so what
# reaches PreDone for a list is wrappers, not records - and a wrapper checked
# against a field spec fails on every required field while its actual data
# goes unchecked. A load returns the record itself, so this handles both.
def _unwrap(record):
    data_fn = getattr(record, "data", None)
    if callable(data_fn):
        try:
            data = data_fn()
        except Exception:  # noqa: BLE001
            return record
        if data is not None:
            return data
    return record


def _entname(ctx):
    entity = getattr(ctx, "entity", None)
    name = getattr(entity, "name", None) if entity is not None else None
    if isinstance(name, str) and name != "":
        return name

    op = getattr(ctx, "op", None)
    entname = getattr(op, "entity", None) if op is not None else None
    return entname if isinstance(entname, str) else ""


# The spec tree with every `$OPEN` marker removed, so an undeclared key is an
# error rather than a pass. Rebuilt rather than mutated: ENTITYSPEC is a
# module constant shared by every client in the process.
def _close(node):
    if isinstance(node, list):
        return [_close(n) for n in node]

    if isinstance(node, dict):
        return {k: _close(v) for k, v in node.items() if k != _OPEN}

    return node
