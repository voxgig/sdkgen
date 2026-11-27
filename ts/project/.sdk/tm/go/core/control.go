package core

type Control struct {
	Throw   *bool
	Err     error
	Explain map[string]any
	Actor   string
	Paging  map[string]any
	// Set by an entity's binary handle: the slot and the direction its bytes move.
	Transfer *Transfer
}
