// VENDORED: @voxgig/plugin sdk-20261016-0845-0 (go/plugin/export.go)
// Source: https://github.com/voxgig/plugin @ caa404b2dfa206d77db6c2869e5b31c2a3202b2d  [tag: sdk-20261016-0845-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
package plugin

import (
	"sort"
	"strconv"
	"strings"
)

type Exported struct {
	Ref   string
	Key   string
	Value any
}

func ResolveExport(spec string, exported []Exported) (any, error) {
	cut := strings.LastIndex(spec, "/")
	if -1 == cut {
		return nil, Fail("plugin_export_ambiguous", "export spec needs a key: "+spec,
			map[string]any{"spec": spec})
	}
	head := spec[:cut]
	key := spec[cut+1:]

	// A fully qualified ref: exactly one answer or none.
	want := canon(head)
	for _, e := range exported {
		if e.Ref == want && e.Key == key {
			return e.Value, nil
		}
	}

	// An alias: the name, not a ref. Look at every instance of it.
	byname := []Exported{}
	for _, e := range exported {
		if refname(e.Ref) == head && e.Key == key {
			byname = append(byname, e)
		}
	}
	if 0 == len(byname) {
		return nil, nil
	}

	for _, e := range byname {
		if r, err := ParseRef(e.Ref); nil == err && "" == r.Tag {
			return e.Value, nil
		}
	}

	if 1 == len(byname) {
		return byname[0].Value, nil
	}

	refs := []string{}
	for _, e := range byname {
		refs = append(refs, e.Ref)
	}
	sort.Strings(refs)
	return nil, Fail("plugin_export_ambiguous",
		"alias "+spec+" matches "+itoa(len(refs))+" instances: "+join(refs, ", "),
		map[string]any{"spec": spec, "refs": refs})
}

func itoa(n int) string { return strconv.Itoa(n) }

func join(l []string, sep string) string { return strings.Join(l, sep) }
