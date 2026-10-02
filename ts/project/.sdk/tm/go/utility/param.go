package utility

import (
	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

func paramUtil(ctx *core.Context, paramdef any) any {
	point := ctx.Point
	spec := ctx.Spec
	match := ctx.Match
	reqmatch := ctx.Reqmatch
	data := ctx.Data
	reqdata := ctx.Reqdata

	pt := vs.Typify(paramdef)

	var key string
	if 0 < (vs.T_string & pt) {
		key, _ = paramdef.(string)
	} else {
		k := vs.GetProp(paramdef, "name")
		key, _ = k.(string)
	}

	var akey string
	if point != nil {
		alias := core.ToMapAny(vs.GetProp(point, "alias"))
		if alias != nil {
			if ak := vs.GetProp(alias, key); ak != nil {
				akey, _ = ak.(string)
			}
		}
	}

	val := vs.GetProp(reqmatch, key)

	if val == nil {
		val = vs.GetProp(match, key)
	}

	if val == nil && akey != "" {
		if spec != nil {
			spec.Alias[akey] = key
		}
		val = vs.GetProp(reqmatch, akey)
	}

	if val == nil {
		val = vs.GetProp(reqdata, key)
	}

	if val == nil {
		val = vs.GetProp(data, key)
	}

	if val == nil && akey != "" {
		val = vs.GetProp(reqdata, akey)
		if val == nil {
			val = vs.GetProp(data, akey)
		}
	}

	return val
}

// One argument a point declares, with the name it travels under and the
// value the call passes for it.
type callArg struct {
	name string
	wire string
	val  any
}

// The arguments a point declares in one location, query or header, each with
// the name it travels under and the value this call passes in its match or
// else its data. Unlike a path parameter, the entity's stored match and data
// never supply one.
func callArgs(ctx *core.Context, kind string) []callArg {
	out := []callArg{}
	if al, ok := vs.GetPath(ctx.Point, []any{"args", kind}).([]any); ok {
		for _, ad := range al {
			name, _ := vs.GetProp(ad, "name").(string)
			if "" == name {
				continue
			}
			wire, _ := vs.GetProp(ad, "orig").(string)
			if "" == wire {
				wire = name
			}
			val := vs.GetProp(ctx.Reqmatch, name)
			if val == nil {
				val = vs.GetProp(ctx.Reqdata, name)
			}
			out = append(out, callArg{name: name, wire: wire, val: val})
		}
	}
	return out
}
