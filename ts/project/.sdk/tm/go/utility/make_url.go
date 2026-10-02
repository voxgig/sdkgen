package utility

import (
	"regexp"
	"strings"

	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

var placeholderRe = regexp.MustCompile(`\{[^{}/]+\}`)

func makeUrlUtil(ctx *core.Context) (string, error) {
	spec := ctx.Spec
	result := ctx.Result

	if spec == nil {
		return "", ctx.MakeError("url_no_spec",
			"Expected context spec property to be defined.")
	}
	if result == nil {
		return "", ctx.MakeError("url_no_result",
			"Expected context result property to be defined.")
	}

	url := vs.Join([]any{spec.Base, spec.Prefix, spec.Path, spec.Suffix}, "/", true)
	resmatch := map[string]any{}

	// A route the definition ends with a slash keeps it: a server such as a
	// Django REST one redirects or refuses the route without it.
	if orig, _ := vs.GetProp(ctx.Point, "orig").(string); strings.HasSuffix(orig, "/") &&
		spec.Suffix == "" && !strings.HasSuffix(url, "/") {
		url += "/"
	}

	params := spec.Params
	for _, item := range vs.Items(params) {
		key, _ := item[0].(string)
		val := item[1]
		if val != nil {
			re := regexp.MustCompile("\\{" + vs.EscRe(key) + "\\}")
			url = re.ReplaceAllString(url, vs.EscUrl(vs.Stringify(val)))
			resmatch[key] = val
		}
	}

	// A placeholder left in the path would send the request to the wrong route.
	if unfilled := placeholderRe.FindAllString(url, -1); 0 < len(unfilled) {
		return "", ctx.MakeError("url_param_missing",
			"URL path has no value for "+strings.Join(unfilled, ", ")+".")
	}

	// Append query string from spec.Query.
	qsep := "?"
	for _, item := range vs.Items(spec.Query) {
		key, _ := item[0].(string)
		val := item[1]
		if val != nil {
			url += qsep + vs.EscUrl(key) + "=" + vs.EscUrl(vs.Stringify(val))
			qsep = "&"
			resmatch[key] = val
		}
	}

	result.Resmatch = resmatch

	return url, nil
}
