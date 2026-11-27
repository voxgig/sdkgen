package codec

import (
	"GOMODULE/core"
)

// What an entity's slot moves: the action whose points carry its bytes, empty
// for the entity's own, and the operations that read and write them.
type BinarySlot struct {
	Action string
	Read   string
	Write  string
}

// An entity's named bytes. Each call is one run of the entity's own
// operation on the slot's point; in core only whole, in-memory bodies move.
type BinaryHandle struct {
	entity core.ProjectNameEntityBase
	slot   string
	def    *BinarySlot
}

func NewBinaryHandle(entity core.ProjectNameEntityBase, slots map[string]BinarySlot,
	slot string) *BinaryHandle {
	handle := &BinaryHandle{entity: entity, slot: slot}
	if def, ok := slots[slot]; ok {
		handle.def = &def
	}
	return handle
}

func (h *BinaryHandle) Name() string {
	return h.slot
}

// The whole body, within maxBuffer.
func (h *BinaryHandle) Bytes(opts map[string]any, ctrl map[string]any) ([]byte, error) {
	if _, ranged := opts["range"]; ranged {
		return nil, h.inactive("read a range")
	}
	def, err := h.direction("read")
	if err != nil {
		return nil, err
	}
	transfer := &core.Transfer{Slot: h.slot, Direction: "read"}
	if _, err := h.run(def.Read, h.selector(def), ctrl, transfer); err != nil {
		return nil, err
	}
	if nil == transfer.Bytes {
		return []byte{}, nil
	}
	return transfer.Bytes, nil
}

// Sends in-memory content as the slot's body; answers the entity.
func (h *BinaryHandle) Put(source any, ctrl map[string]any) (core.ProjectNameEntityBase, error) {
	def, err := h.direction("write")
	if err != nil {
		return nil, err
	}
	reqdata := h.selector(def)
	reqdata["$body"] = source
	transfer := &core.Transfer{Slot: h.slot, Direction: "write"}
	if _, err := h.run(def.Write, reqdata, ctrl, transfer); err != nil {
		return nil, err
	}
	return h.entity, nil
}

func (h *BinaryHandle) Save(_ ...any) error {
	return h.inactive("save")
}

func (h *BinaryHandle) Stream(_ ...any) error {
	return h.inactive("stream")
}

func (h *BinaryHandle) Open(_ ...any) error {
	return h.inactive("open")
}

func (h *BinaryHandle) run(opname string, args map[string]any, ctrl map[string]any,
	transfer *core.Transfer) (any, error) {
	withTransfer := map[string]any{}
	for k, v := range ctrl {
		withTransfer[k] = v
	}
	withTransfer["transfer"] = transfer
	switch opname {
	case "load":
		return h.entity.Load(args, withTransfer)
	case "create":
		return h.entity.Create(args, withTransfer)
	case "update":
		return h.entity.Update(args, withTransfer)
	case "patch":
		return h.entity.Patch(args, withTransfer)
	}
	return core.UnsupportedOp(opname, h.entity.GetName())
}

func (h *BinaryHandle) selector(def *BinarySlot) map[string]any {
	if "" == def.Action {
		return map[string]any{}
	}
	return map[string]any{"$action": def.Action}
}

func (h *BinaryHandle) direction(way string) (*BinarySlot, error) {
	if nil == h.def {
		return nil, core.NewProjectNameError("binary_slot_unknown", "Entity \""+
			h.entity.GetName()+"\" has no binary slot \""+h.slot+"\".", nil)
	}
	if ("read" == way && "" == h.def.Read) || ("write" == way && "" == h.def.Write) {
		what := "read"
		if "write" == way {
			what = "written"
		}
		return nil, core.NewProjectNameError("binary_slot_direction", "The binary slot \""+
			h.slot+"\" of entity \""+h.entity.GetName()+"\" cannot be "+what+".", nil)
	}
	return h.def, nil
}

func (h *BinaryHandle) inactive(what string) error {
	return core.NewProjectNameError("binary_feature_inactive", "The binary slot \""+h.slot+
		"\" of entity \""+h.entity.GetName()+"\" cannot "+what+
		" without the binary feature; in core it answers Bytes() and Put().", nil)
}
