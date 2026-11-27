# ProjectName SDK body codec: an entity's binary handle

from __future__ import annotations

from projectname_sdk.utility.media import RAW_BODY


# An entity's named bytes. Each call is one run of the entity's own
# operation on the slot's point; in core only whole, in-memory bodies move.
# A slot, as the entity component derived it from the model, is the action
# whose points move its bytes ('' for the entity's own) and the operations
# that read and write them: `{"action", "read"?, "write"?}`.
class BinaryHandle:

    def __init__(self, entity, slots, slot=None):
        self._entity = entity
        self._slot = "" if slot is None else str(slot)
        self._def = slots.get(self._slot) if isinstance(slots, dict) else None

    @property
    def name(self):
        return self._slot

    # The whole body, within maxBuffer.
    def bytes(self, opts=None, ctrl=None):
        if isinstance(opts, dict) and opts.get("range") is not None:
            raise self._inactive("a range")
        slot = self._direction("read")
        transfer = {"slot": self._slot, "direction": "read"}
        getattr(self._entity, slot["read"])(self._select(slot),
                                             dict(ctrl or {}, transfer=transfer))
        out = transfer.get("bytes")
        return b"" if out is None else out

    # Sends in-memory content as the slot's body; answers the entity.
    def put(self, source, ctrl=None):
        slot = self._direction("write")
        transfer = {"slot": self._slot, "direction": "write"}
        getattr(self._entity, slot["write"])(dict(self._select(slot), **{RAW_BODY: source}),
                                              dict(ctrl or {}, transfer=transfer))
        return self._entity

    def save(self, *args, **kwargs):
        raise self._inactive("save")

    def stream(self, *args, **kwargs):
        raise self._inactive("stream")

    def open(self, *args, **kwargs):
        raise self._inactive("open")

    def _select(self, slot):
        return {} if "" == slot.get("action", "") else {"$action": slot["action"]}

    def _direction(self, way):
        slot = self._def
        name = self._entity.get_name()
        if slot is None:
            raise self._error("binary_slot_unknown", 'Entity "' + name +
                                   '" has no binary slot "' + self._slot + '".')
        if slot.get(way) is None:
            raise self._error("binary_slot_direction", 'The binary slot "' + self._slot +
                                   '" of entity "' + name + '" cannot be ' +
                                   ("read" if "read" == way else "written") + ".")
        return slot

    def _inactive(self, what):
        return self._error("binary_feature_inactive", 'The binary slot "' + self._slot +
                                '" of entity "' + self._entity.get_name() + '" cannot ' +
                                ("read a range" if "a range" == what else what) +
                                " without the binary feature; in core it answers bytes() and put().")

    def _error(self, code, msg):
        return self._entity._entctx.make_error(code, msg)
