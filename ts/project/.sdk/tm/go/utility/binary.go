package utility

import (
	"reflect"
	"sort"
	"strconv"

	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

const binaryMaxDepth = 32

// The path of the first source in a value, or "" with false.
func sourceAt(value any, path string, depth int, seen []uintptr) (string, bool) {
	if nil == value || binaryMaxDepth <= depth {
		return "", false
	}
	if _, ok := core.AsSource(value); ok {
		return path, true
	}
	if core.IsBytes(value) || core.IsStream(value) {
		return "", false
	}
	rv := reflect.ValueOf(value)
	for reflect.Ptr == rv.Kind() || reflect.Interface == rv.Kind() {
		if rv.IsNil() {
			return "", false
		}
		rv = rv.Elem()
	}
	at := func(key string) string {
		if "" == path {
			return key
		}
		return path + "." + key
	}
	switch rv.Kind() {
	case reflect.Map:
		if rv.IsNil() {
			return "", false
		}
		id := rv.Pointer()
		for _, s := range seen {
			if s == id {
				return "", false
			}
		}
		seen = append(seen, id)
		keys := []string{}
		byname := map[string]reflect.Value{}
		for _, key := range rv.MapKeys() {
			name := vs.Stringify(key.Interface())
			keys = append(keys, name)
			byname[name] = rv.MapIndex(key)
		}
		sort.Strings(keys)
		for _, key := range keys {
			if found, ok := sourceAt(byname[key].Interface(), at(key), depth+1, seen); ok {
				return found, true
			}
		}
	case reflect.Slice, reflect.Array:
		if reflect.Slice == rv.Kind() {
			if rv.IsNil() {
				return "", false
			}
			id := rv.Pointer()
			for _, s := range seen {
				if s == id {
					return "", false
				}
			}
			seen = append(seen, id)
		}
		for i := 0; i < rv.Len(); i++ {
			if found, ok := sourceAt(rv.Index(i).Interface(), at(strconv.Itoa(i)), depth+1, seen); ok {
				return found, true
			}
		}
	}
	return "", false
}

// The data keys whose values are file content: a multipart or form body's
// binary fields, and the whole of a raw body.
func binaryNames(point map[string]any) []string {
	body, _ := vs.GetProp(point, "body").(map[string]any)
	kind, _ := body["kind"].(string)
	if "raw" == kind {
		return []string{rawBodyKey}
	}
	names := []string{}
	if "multipart" == kind || "form" == kind {
		fields, _ := body["fields"].([]any)
		for _, f := range fields {
			fm, _ := f.(map[string]any)
			if name, ok := fm["name"].(string); ok && true == fm["binary"] {
				names = append(names, name)
			}
		}
	}
	return names
}

// Moves the values of binary fields out of the request data, before a hook,
// a transform, validation or clean reads it. A source anywhere else is refused.
func liftSources(ctx *core.Context) error {
	if nil != ctx.Sources {
		return nil
	}

	lifted := map[string]any{}
	reqdata := ctx.Reqdata
	names := binaryNames(ctx.Point)

	present := false
	for _, name := range names {
		if _, ok := reqdata[name]; ok {
			present = true
		}
	}
	if present {
		copied := make(map[string]any, len(reqdata))
		for k, v := range reqdata {
			copied[k] = v
		}
		for _, name := range names {
			if val, ok := copied[name]; ok {
				lifted[name] = val
				delete(copied, name)
			}
		}
		reqdata = copied
	}

	stray, found := sourceAt(reqdata, "", 0, nil)
	if !found {
		stray, found = sourceAt(ctx.Reqmatch, "", 0, nil)
	}
	if found {
		return ctx.MakeError("binary_source_refused", "A binary source was passed in \""+stray+
			"\", which is not a field the operation declares binary.")
	}

	ctx.Reqdata = reqdata
	ctx.Sources = lifted
	return nil
}

// A response the model declares to be bytes is read only through the entity's
// binary handle, never into its data.
func bytesRefused(ctx *core.Context) error {
	response := vs.GetProp(ctx.Point, "response")
	if "raw" != vs.GetProp(response, "kind") || true != vs.GetProp(response, "binary") ||
		(nil != ctx.Ctrl && nil != ctx.Ctrl.Transfer) {
		return nil
	}
	call := "Binary()"
	if action, ok := vs.GetPath(ctx.Point, []any{"select", "$action"}).(string); ok {
		call = "Binary(\"" + action + "\")"
	}
	opname, entname := "", ""
	if nil != ctx.Op {
		opname, entname = ctx.Op.Name, ctx.Op.Entity
	}
	return ctx.MakeError("binary_sink_required", "Operation \""+opname+"\" on entity \""+
		entname+"\" answers bytes, which never enter the entity's data: read them with "+
		"entity."+call+".Bytes(nil, nil).")
}
