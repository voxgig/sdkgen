// VENDORED: @voxgig/plugin sdk-20261016-0845-0 (go/plugin/resolve.go)
// Source: https://github.com/voxgig/plugin @ caa404b2dfa206d77db6c2869e5b31c2a3202b2d  [tag: sdk-20261016-0845-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
package plugin

import "strings"

type Source struct {
	Kind   string   `json:"kind"`
	Prefix []string `json:"prefix,omitempty"`
	Dir    string   `json:"dir,omitempty"`
}

func ResolveCandidates(name string, sources []Source) []string {
	out := []string{}

	// A SCOPED NAME RESOLVES VERBATIM ONLY (§10.2). `@acme/thing` is
	// already a package id; prefixing it produces
	// `@voxgig/plugin-@acme/thing`, which is not a thing that can exist.
	if strings.HasPrefix(name, "@") {
		return []string{name}
	}

	list := sources
	if 0 == len(list) {
		list = defaultSources
	}

	for _, src := range list {
		if "module" == src.Kind {
			prefixes := src.Prefix
			if 0 == len(prefixes) {
				prefixes = []string{""}
			}
			for _, p := range prefixes {
				if id := p + name; !hasstring(out, id) {
					out = append(out, id)
				}
			}
		} else if "path" == src.Kind {
			if id := strings.TrimRight(src.Dir, "/") + "/" + name; !hasstring(out, id) {
				out = append(out, id)
			}
		}
	}

	return out
}

var defaultSources = []Source{
	{Kind: "module", Prefix: []string{"@voxgig/plugin-", "voxgig-plugin-", "plugin-", ""}},
}

func ResolveFrom(from string) []string {
	return []string{from}
}
