package ProjectNamePkg

import (
	"ProjectNameModule/sdk"
)

// EntityNameEntity represents the EntityName entity.
type EntityNameEntity struct {
	name    string
	client  *ProjectNameSDK
	entopts map[string]any
	data    map[string]any
	match   map[string]any
	entctx  map[string]any
}

// NewEntityNameEntity creates a new EntityName entity.
func NewEntityNameEntity(client *ProjectNameSDK, entopts map[string]any) *EntityNameEntity {
	if entopts == nil {
		entopts = map[string]any{}
	}

	e := &EntityNameEntity{
		name:    "entityname",
		client:  client,
		entopts: entopts,
		data:    map[string]any{},
		match:   map[string]any{},
	}

	e.entctx = sdk.MakeContext(map[string]any{
		"entity":  e,
		"entopts": entopts,
	}, client.rootctx)

	sdk.FeatureHook(e.entctx, "PostConstructEntity")

	return e
}

// EntOpts returns the entity options.
func (e *EntityNameEntity) EntOpts() map[string]any {
	out, _ := sdk.Clone(e.entopts).(map[string]any)
	return out
}

// Client returns the SDK client.
func (e *EntityNameEntity) Client() *ProjectNameSDK {
	return e.client
}

// Make creates a new entity instance.
func (e *EntityNameEntity) Make() *EntityNameEntity {
	return NewEntityNameEntity(e.client, e.EntOpts())
}

// Data gets or sets entity data.
func (e *EntityNameEntity) Data(data ...map[string]any) map[string]any {
	if len(data) > 0 && data[0] != nil {
		e.data, _ = sdk.Clone(data[0]).(map[string]any)
		sdk.FeatureHook(e.entctx, "SetData")
	}

	sdk.FeatureHook(e.entctx, "GetData")
	out, _ := sdk.Clone(e.data).(map[string]any)
	return out
}

// Match gets or sets entity match criteria.
func (e *EntityNameEntity) Match(match ...map[string]any) map[string]any {
	if len(match) > 0 && match[0] != nil {
		e.match, _ = sdk.Clone(match[0]).(map[string]any)
		sdk.FeatureHook(e.entctx, "SetMatch")
	}

	sdk.FeatureHook(e.entctx, "GetMatch")
	out, _ := sdk.Clone(e.match).(map[string]any)
	return out
}

// Name returns the entity name.
func (e *EntityNameEntity) Name() string {
	return e.name
}

// #LoadOp

// #ListOp

// #CreateOp

// #UpdateOp

// #RemoveOp
