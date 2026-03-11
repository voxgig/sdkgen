/* Copyright (c) 2025 Voxgig Ltd. MIT LICENSE. */

package sdk

import (
	"errors"
	"fmt"
	"math/rand"
	"strings"
)

// MakeContext creates a new context map from the given ctxmap and optional base context.
func MakeContext(ctxmap map[string]any, basectx ...map[string]any) map[string]any {
	var base any
	if len(basectx) > 0 && basectx[0] != nil {
		base = basectx[0]
	}

	ctx := map[string]any{
		"id":       fmt.Sprintf("C%08x", rand.Uint32()),
		"out":      map[string]any{},
		"ctrl":     GetProp(ctxmap, "ctrl", GetProp(base, "ctrl", map[string]any{})),
		"meta":     GetProp(ctxmap, "meta", GetProp(base, "meta", map[string]any{})),
		"client":   GetProp(ctxmap, "client", GetProp(base, "client")),
		"utility":  GetProp(ctxmap, "utility", GetProp(base, "utility")),
		"config":   GetProp(ctxmap, "config", GetProp(base, "config")),
		"entopts":  GetProp(ctxmap, "entopts", GetProp(base, "entopts")),
		"options":  GetProp(ctxmap, "options", GetProp(base, "options")),
		"entity":   GetProp(ctxmap, "entity", GetProp(base, "entity")),
		"shared":   GetProp(ctxmap, "shared", GetProp(base, "shared")),
		"opmap":    GetProp(ctxmap, "opmap", GetProp(base, "opmap")),
		"data":     GetProp(ctxmap, "data", map[string]any{}),
		"reqdata":  GetProp(ctxmap, "reqdata", map[string]any{}),
		"match":    GetProp(ctxmap, "match", map[string]any{}),
		"reqmatch": GetProp(ctxmap, "reqmatch", map[string]any{}),
		"target":   GetProp(ctxmap, "target", GetProp(base, "target")),
		"spec":     GetProp(ctxmap, "spec", GetProp(base, "spec")),
		"result":   GetProp(ctxmap, "result", GetProp(base, "result")),
		"response": GetProp(ctxmap, "response", GetProp(base, "response")),
	}

	// Resolve op from opname, then merge any raw op fields from ctxmap.
	rawOp := GetProp(ctxmap, "op")
	opname, _ := GetProp(ctxmap, "opname").(string)
	if opname != "" {
		resolved := resolveOp(ctx, opname)
		// Merge raw op fields (e.g. entity, resform, reqform, path, params, alias, check)
		// into the resolved op. Raw op values override empty/nil resolved values.
		if rawOpMap, ok := rawOp.(map[string]any); ok {
			for k, v := range rawOpMap {
				existing, exists := resolved[k]
				if !exists || existing == nil || existing == "" {
					resolved[k] = v
				}
			}
		}
		ctx["op"] = resolved
	} else if rawOp != nil {
		ctx["op"] = rawOp
	}

	return ctx
}

func resolveOp(ctx map[string]any, opname string) map[string]any {
	opmap, _ := GetProp(ctx, "opmap").(map[string]any)
	if opmap != nil {
		if op := GetProp(opmap, opname); op != nil {
			if opMap, ok := op.(map[string]any); ok {
				return opMap
			}
		}
	}

	if opname == "" {
		return nil
	}

	input := "match"
	if opname == "update" || opname == "create" {
		input = "data"
	}

	entity, _ := GetProp(ctx, "entity").(map[string]any)
	entname, _ := GetProp(entity, "name").(string)

	config := GetProp(ctx, "config")
	opcfg := GetPath([]string{"entity", entname, "op", opname}, config)

	var targets any
	if opcfg != nil {
		targets = GetProp(opcfg, "targets")
	}
	if targets == nil {
		targets = []any{}
	}

	op := map[string]any{
		"entity":  entname,
		"name":    opname,
		"input":   input,
		"targets": targets,
	}

	if opmap == nil {
		opmap = map[string]any{}
		ctx["opmap"] = opmap
	}
	SetProp(opmap, opname, op)

	return op
}

// PrepareMethod maps operation name to HTTP method.
func PrepareMethod(ctx map[string]any) string {
	op := GetProp(ctx, "op")
	opname, _ := GetProp(op, "name").(string)

	methodMap := map[string]string{
		"create": "POST",
		"update": "PUT",
		"load":   "GET",
		"list":   "GET",
		"remove": "DELETE",
		"patch":  "PATCH",
	}

	if method, ok := methodMap[opname]; ok {
		return method
	}
	return ""
}

// PrepareHeaders clones headers from client options.
func PrepareHeaders(ctx map[string]any) map[string]any {
	options := clientOptions(ctx)
	headers := GetProp(options, "headers", map[string]any{})
	out, _ := Clone(headers).(map[string]any)
	if out == nil {
		out = map[string]any{}
	}
	return out
}

// PrepareAuth sets the authorization header from client options.
func PrepareAuth(ctx map[string]any) (any, error) {
	spec, _ := GetProp(ctx, "spec").(map[string]any)
	if spec == nil {
		return nil, ctxError(ctx, "auth_no_spec", "Expected context spec property to be defined.")
	}

	headers, _ := GetProp(spec, "headers").(map[string]any)
	if headers == nil {
		headers = map[string]any{}
		spec["headers"] = headers
	}

	options := clientOptions(ctx)
	notFound := "__NOTFOUND__"
	apikey := GetProp(options, "apikey", notFound)

	if apikey == notFound {
		DelProp(headers, "authorization")
	} else {
		auth, _ := GetProp(options, "auth").(map[string]any)
		prefix := ""
		if auth != nil {
			prefix, _ = GetProp(auth, "prefix").(string)
		}
		apikeyStr := fmt.Sprintf("%v", apikey)
		SetProp(headers, "authorization", prefix+" "+apikeyStr)
	}

	return spec, nil
}

// PrepareParams extracts params from target definition.
func PrepareParams(ctx map[string]any) map[string]any {
	target := GetProp(ctx, "target")
	args, _ := GetProp(target, "args").(map[string]any)
	params, _ := GetProp(args, "params").([]any)

	out := map[string]any{}
	for _, pd := range params {
		val := Param(ctx, pd)
		if val != nil {
			name, _ := GetProp(pd, "name").(string)
			if name == "" {
				name, _ = pd.(string)
			}
			if name != "" {
				out[name] = val
			}
		}
	}

	return out
}

// PrepareQuery extracts query params (all reqmatch keys not in target.params).
func PrepareQuery(ctx map[string]any) map[string]any {
	target := GetProp(ctx, "target")
	params, _ := GetProp(target, "params").([]any)
	reqmatch, _ := GetProp(ctx, "reqmatch").(map[string]any)

	if reqmatch == nil {
		reqmatch = map[string]any{}
	}

	paramSet := map[string]bool{}
	for _, p := range params {
		if ps, ok := p.(string); ok {
			paramSet[ps] = true
		}
	}

	out := map[string]any{}
	for _, item := range Items(reqmatch) {
		key, _ := item[0].(string)
		val := item[1]
		if val != nil && !paramSet[key] {
			out[key] = val
		}
	}

	return out
}

// PrepareBody returns request body via TransformRequest when op input is "data".
func PrepareBody(ctx map[string]any) any {
	op := GetProp(ctx, "op")
	input, _ := GetProp(op, "input").(string)

	if input == "data" {
		return TransformRequest(ctx)
	}

	return nil
}

// PreparePath joins target parts into a path string.
func PreparePath(ctx map[string]any) string {
	target := GetProp(ctx, "target")
	parts, _ := GetProp(target, "parts").([]any)

	if parts == nil {
		return ""
	}

	return Join(parts, "/", true)
}

// Param finds a parameter value via alias lookup across reqmatch/match/reqdata/data.
func Param(ctx map[string]any, paramdef any) any {
	target := GetProp(ctx, "target")
	matchVal := GetProp(ctx, "match")
	reqmatch := GetProp(ctx, "reqmatch")
	data := GetProp(ctx, "data")
	reqdata := GetProp(ctx, "reqdata")

	pt := Typify(paramdef)
	var key string
	if 0 < (T_string & pt) {
		key, _ = paramdef.(string)
	} else {
		key, _ = GetProp(paramdef, "name").(string)
	}

	alias, _ := GetProp(target, "alias").(map[string]any)
	akey := GetProp(alias, key)

	val := GetProp(reqmatch, key)

	if val == nil {
		val = GetProp(matchVal, key)
	}

	if val == nil && akey != nil {
		akeyStr, _ := akey.(string)
		spec, _ := GetProp(ctx, "spec").(map[string]any)
		if spec != nil {
			specAlias, _ := GetProp(spec, "alias").(map[string]any)
			if specAlias == nil {
				specAlias = map[string]any{}
				spec["alias"] = specAlias
			}
			specAlias[akeyStr] = key
		}
		val = GetProp(reqmatch, akeyStr)
	}

	if val == nil {
		val = GetProp(reqdata, key)
	}

	if val == nil {
		val = GetProp(data, key)
	}

	if val == nil && akey != nil {
		akeyStr, _ := akey.(string)
		val = GetProp(reqdata, akeyStr)
		if val == nil {
			val = GetProp(data, akeyStr)
		}
	}

	return val
}

// MakeSpec orchestrates all prepare functions to build a request spec.
func MakeSpec(ctx map[string]any) (any, error) {
	out, _ := GetProp(ctx, "out").(map[string]any)
	if out != nil {
		if outSpec := GetProp(out, "spec"); outSpec != nil {
			ctx["spec"] = outSpec
			return outSpec, nil
		}
	}

	target := GetProp(ctx, "target")
	options, _ := GetProp(ctx, "options").(map[string]any)
	if options == nil {
		options = map[string]any{}
	}

	spec := map[string]any{
		"base":    GetProp(options, "base", ""),
		"prefix":  GetProp(options, "prefix", ""),
		"parts":   GetProp(target, "parts", []any{}),
		"suffix":  GetProp(options, "suffix", ""),
		"step":    "start",
		"alias":   map[string]any{},
		"headers": map[string]any{},
		"params":  map[string]any{},
		"query":   map[string]any{},
	}
	ctx["spec"] = spec

	method := PrepareMethod(ctx)
	spec["method"] = method

	allowMethod, _ := GetPath([]string{"allow", "method"}, options).(string)
	if allowMethod == "" {
		allowMethod = "GET,PUT,POST,PATCH,DELETE,OPTIONS"
	}
	if !strings.Contains(allowMethod, method) {
		return nil, ctxError(ctx, "spec_method_allow",
			fmt.Sprintf("Method \"%s\" not allowed by SDK option allow.method value: \"%s\"",
				method, allowMethod))
	}

	spec["params"] = PrepareParams(ctx)
	spec["query"] = PrepareQuery(ctx)
	spec["headers"] = PrepareHeaders(ctx)
	spec["body"] = PrepareBody(ctx)
	spec["path"] = PreparePath(ctx)

	ctrl, _ := GetProp(ctx, "ctrl").(map[string]any)
	if ctrl != nil {
		if explain, ok := GetProp(ctrl, "explain").(map[string]any); ok {
			explain["spec"] = spec
		}
	}

	authResult, err := PrepareAuth(ctx)
	if err != nil {
		return nil, err
	}
	if authMap, ok := authResult.(map[string]any); ok {
		ctx["spec"] = authMap
	}

	return authResult, nil
}

// MakeUrl substitutes params in path and joins URL parts.
func MakeUrl(ctx map[string]any) (string, error) {
	spec, _ := GetProp(ctx, "spec").(map[string]any)
	result, _ := GetProp(ctx, "result").(map[string]any)

	if spec == nil {
		return "", ctxError(ctx, "url_no_spec", "Expected context spec property to be defined.")
	}

	if result == nil {
		return "", ctxError(ctx, "url_no_result", "Expected context result property to be defined.")
	}

	base, _ := GetProp(spec, "base").(string)
	prefix, _ := GetProp(spec, "prefix").(string)
	path, _ := GetProp(spec, "path").(string)
	suffix, _ := GetProp(spec, "suffix").(string)

	url := Join([]any{base, prefix, path, suffix}, "/", true)
	resmatch := map[string]any{}

	params, _ := GetProp(spec, "params").(map[string]any)
	if params != nil {
		for _, item := range Items(params) {
			key, _ := item[0].(string)
			val := item[1]
			if val != nil {
				valStr := fmt.Sprintf("%v", val)
				url = strings.ReplaceAll(url, "{"+key+"}", EscUrl(valStr))
				resmatch[key] = val
			}
		}
	}

	// Append query parameters
	query, _ := GetProp(spec, "query").(map[string]any)
	alias, _ := GetProp(spec, "alias").(map[string]any)
	if query != nil {
		qsep := "?"
		for _, item := range Items(query) {
			key, _ := item[0].(string)
			val := item[1]
			// Skip aliased params
			if alias != nil && GetProp(alias, key) != nil {
				continue
			}
			if val != nil {
				valStr := fmt.Sprintf("%v", val)
				url += qsep + EscUrl(key) + "=" + EscUrl(valStr)
				qsep = "&"
				resmatch[key] = val
			}
		}
	}

	result["resmatch"] = resmatch
	return url, nil
}

// MakeFetchDef creates a fetch definition from the spec.
func MakeFetchDef(ctx map[string]any) (map[string]any, error) {
	spec, _ := GetProp(ctx, "spec").(map[string]any)

	if spec == nil {
		return nil, ctxError(ctx, "fetchdef_no_spec", "Expected context spec property to be defined.")
	}

	if GetProp(ctx, "result") == nil {
		ctx["result"] = map[string]any{
			"ok":         false,
			"status":     float64(-1),
			"statusText": "",
			"headers":    map[string]any{},
		}
	}

	spec["step"] = "prepare"

	url, err := MakeUrl(ctx)
	if err != nil {
		return nil, err
	}
	spec["url"] = url

	fetchdef := map[string]any{
		"url":     url,
		"method":  GetProp(spec, "method"),
		"headers": GetProp(spec, "headers"),
	}

	body := GetProp(spec, "body")
	if body != nil {
		if IsMap(body) || IsList(body) {
			fetchdef["body"] = Jsonify(body)
		} else {
			fetchdef["body"] = body
		}
	}

	return fetchdef, nil
}

// MakeRequest executes a fetch via the fetcher.
func MakeRequest(ctx map[string]any) (any, error) {
	out, _ := GetProp(ctx, "out").(map[string]any)
	if out != nil {
		if outReq := GetProp(out, "request"); outReq != nil {
			return outReq, nil
		}
	}

	spec, _ := GetProp(ctx, "spec").(map[string]any)
	if spec == nil {
		return nil, ctxError(ctx, "request_no_spec", "Expected context spec property to be defined.")
	}

	ctx["result"] = map[string]any{
		"ok":         false,
		"status":     float64(-1),
		"statusText": "",
		"headers":    map[string]any{},
	}

	fetchdef, err := MakeFetchDef(ctx)
	if err != nil {
		response := map[string]any{"err": err}
		ctx["response"] = response
		spec["step"] = "postrequest"
		return response, nil
	}

	ctrl, _ := GetProp(ctx, "ctrl").(map[string]any)
	if ctrl != nil {
		if explain, ok := GetProp(ctrl, "explain").(map[string]any); ok {
			explain["fetchdef"] = fetchdef
		}
	}

	spec["step"] = "prerequest"

	url, _ := fetchdef["url"].(string)
	fetched, fetchErr := Fetcher(ctx, url, fetchdef)

	var response map[string]any
	if fetchErr != nil {
		response = map[string]any{"err": fetchErr}
	} else if fetched == nil {
		response = map[string]any{"err": ctxError(ctx, "request_no_response", "response: undefined")}
	} else if fetchedMap, ok := fetched.(map[string]any); ok {
		response = fetchedMap
	} else {
		response = map[string]any{"err": ctxError(ctx, "request_bad_response", "response: invalid type")}
	}

	spec["step"] = "postrequest"
	ctx["response"] = response

	return response, nil
}

// MakeResponse processes response (resultBasic, resultHeaders, resultBody, transformResponse).
func MakeResponse(ctx map[string]any) (any, error) {
	out, _ := GetProp(ctx, "out").(map[string]any)
	if out != nil {
		if outResp := GetProp(out, "response"); outResp != nil {
			return outResp, nil
		}
	}

	spec, _ := GetProp(ctx, "spec").(map[string]any)
	result, _ := GetProp(ctx, "result").(map[string]any)
	response, _ := GetProp(ctx, "response").(map[string]any)

	if spec == nil {
		return nil, ctxError(ctx, "response_no_spec", "Expected context spec property to be defined.")
	}
	if response == nil {
		return nil, ctxError(ctx, "response_no_response", "Expected context response property to be defined.")
	}
	if result == nil {
		return nil, ctxError(ctx, "response_no_result", "Expected context result property to be defined.")
	}

	spec["step"] = "response"

	ResultBasic(ctx)
	ResultHeaders(ctx)
	ResultBody(ctx)
	TransformResponse(ctx)

	if GetProp(result, "err") == nil {
		result["ok"] = true
	}

	ctrl, _ := GetProp(ctx, "ctrl").(map[string]any)
	if ctrl != nil {
		if explain, ok := GetProp(ctrl, "explain").(map[string]any); ok {
			explain["result"] = result
		}
	}

	return response, nil
}

// MakeResult transforms response into final result.
func MakeResult(ctx map[string]any) (any, error) {
	out, _ := GetProp(ctx, "out").(map[string]any)
	if out != nil {
		if outResult := GetProp(out, "result"); outResult != nil {
			return outResult, nil
		}
	}

	spec, _ := GetProp(ctx, "spec").(map[string]any)
	result, _ := GetProp(ctx, "result").(map[string]any)

	if spec == nil {
		return nil, ctxError(ctx, "result_no_spec", "Expected context spec property to be defined.")
	}
	if result == nil {
		return nil, ctxError(ctx, "result_no_result", "Expected context result property to be defined.")
	}

	spec["step"] = "result"
	TransformResponse(ctx)

	ctrl, _ := GetProp(ctx, "ctrl").(map[string]any)
	if ctrl != nil {
		if explain, ok := GetProp(ctrl, "explain").(map[string]any); ok {
			explain["result"] = result
		}
	}

	return result, nil
}

// MakeTarget selects the operation target.
func MakeTarget(ctx map[string]any) (any, error) {
	out, _ := GetProp(ctx, "out").(map[string]any)
	if out != nil {
		if outTarget := GetProp(out, "target"); outTarget != nil {
			ctx["target"] = outTarget
			return outTarget, nil
		}
	}

	op, _ := GetProp(ctx, "op").(map[string]any)
	targets, _ := GetProp(op, "targets").([]any)

	if len(targets) == 1 {
		ctx["target"] = targets[0]
		return targets[0], nil
	}

	if len(targets) > 1 {
		input, _ := GetProp(op, "input").(string)
		reqselector := GetProp(ctx, "req"+input)
		selector := GetProp(ctx, input)

		var target any
		for i := 0; i < len(targets); i++ {
			target = targets[i]
			targetMap, _ := target.(map[string]any)
			selectVal, _ := GetProp(targetMap, "select").(map[string]any)
			found := true

			if selector != nil && selectVal != nil {
				existList, _ := GetProp(selectVal, "exist").([]any)
				for _, existkey := range existList {
					ekStr, _ := existkey.(string)
					if GetProp(reqselector, ekStr) == nil &&
						GetProp(selector, ekStr) == nil {
						found = false
						break
					}
				}
			}

			if found {
				reqSelMap, _ := reqselector.(map[string]any)
				if reqSelMap != nil {
					reqAction := GetProp(reqSelMap, "$action")
					selAction := GetProp(selectVal, "$action")
					if reqAction != selAction {
						found = false
					}
				}
			}

			if found {
				break
			}
		}

		ctx["target"] = target
	}

	return GetProp(ctx, "target"), nil
}

// MakeOptions validates and merges SDK options.
func MakeOptions(ctx map[string]any) map[string]any {
	options, _ := GetProp(ctx, "options").(map[string]any)
	config, _ := GetProp(ctx, "config").(map[string]any)

	if options == nil {
		options = map[string]any{}
	}
	if config == nil {
		config = map[string]any{}
	}

	cfgopts, _ := GetProp(config, "options").(map[string]any)
	if cfgopts == nil {
		cfgopts = map[string]any{}
	}

	optspec := map[string]any{
		"apikey": "",
		"base":   "http://localhost:8000",
		"prefix": "",
		"suffix": "",
		"auth": map[string]any{
			"prefix": "",
		},
		"headers": map[string]any{
			"`$CHILD`": "`$STRING`",
		},
		"allow": map[string]any{
			"method": "GET,PUT,POST,PATCH,DELETE,OPTIONS",
			"op":     "create,update,load,list,remove,command,direct",
		},
		"entity": map[string]any{
			"`$CHILD`": map[string]any{
				"`$OPEN`": true,
				"active":  false,
				"alias":   map[string]any{},
			},
		},
		"feature": map[string]any{
			"`$CHILD`": map[string]any{
				"`$OPEN`": true,
				"active":  false,
			},
		},
		"utility": map[string]any{},
		"system":  map[string]any{},
		"test": map[string]any{
			"active": false,
			"entity": map[string]any{
				"`$OPEN`": true,
			},
		},
		"clean": map[string]any{
			"keys": "key,token,id",
		},
	}

	opts, _ := Merge([]any{map[string]any{}, cfgopts, options}).(map[string]any)
	if opts == nil {
		opts = map[string]any{}
	}

	validated, _ := Validate(opts, optspec)
	if vm, ok := validated.(map[string]any); ok {
		opts = vm
	}

	return opts
}

// TransformRequest transforms request data via target.transform.req.
func TransformRequest(ctx map[string]any) any {
	spec, _ := GetProp(ctx, "spec").(map[string]any)
	target := GetProp(ctx, "target")

	if spec != nil {
		spec["step"] = "reqform"
	}

	transformDef := GetPath([]string{"transform", "req"}, target)
	reqdata := GetProp(ctx, "reqdata")

	if transformDef == nil {
		return reqdata
	}

	data := GetProp(ctx, "data")
	result := Transform(map[string]any{"reqdata": reqdata, "data": data}, transformDef)
	return result
}

// TransformResponse transforms response data via target.transform.res.
func TransformResponse(ctx map[string]any) any {
	spec, _ := GetProp(ctx, "spec").(map[string]any)
	result, _ := GetProp(ctx, "result").(map[string]any)
	target := GetProp(ctx, "target")

	if spec != nil {
		spec["step"] = "resform"
	}

	if result == nil {
		return nil
	}

	ok, _ := GetProp(result, "ok").(bool)
	if !ok {
		return nil
	}

	transformDef := GetPath([]string{"transform", "res"}, target)
	if transformDef == nil {
		resdata := GetProp(result, "body")
		result["resdata"] = resdata
		return resdata
	}

	resdata := Transform(result, transformDef)
	result["resdata"] = resdata
	return resdata
}

// ResultBasic sets result status/statusText from response.
func ResultBasic(ctx map[string]any) any {
	response, _ := GetProp(ctx, "response").(map[string]any)
	result, _ := GetProp(ctx, "result").(map[string]any)

	if result != nil && response != nil {
		status := GetProp(response, "status", float64(-1))
		statusText := GetProp(response, "statusText", "no-status")

		result["status"] = status
		result["statusText"] = statusText

		statusNum := float64(-1)
		switch s := status.(type) {
		case float64:
			statusNum = s
		case int:
			statusNum = float64(s)
		}

		if statusNum >= 400 {
			msg := fmt.Sprintf("request: %v: %v", status, statusText)
			responseErr, _ := GetProp(response, "err").(map[string]any)
			if responseErr != nil {
				prevmsg, _ := GetProp(responseErr, "message").(string)
				if prevmsg != "" {
					result["err"] = map[string]any{"message": prevmsg + ": " + msg}
				} else {
					result["err"] = map[string]any{"message": msg}
				}
			} else {
				result["err"] = map[string]any{"message": msg}
			}
		} else if GetProp(response, "err") != nil {
			result["err"] = GetProp(response, "err")
		}
	}

	return result
}

// ResultHeaders extracts headers from response into result.
func ResultHeaders(ctx map[string]any) any {
	response, _ := GetProp(ctx, "response").(map[string]any)
	result, _ := GetProp(ctx, "result").(map[string]any)

	if result != nil {
		if response != nil {
			headers, _ := GetProp(response, "headers").(map[string]any)
			if headers != nil {
				outHeaders := map[string]any{}
				for k, v := range headers {
					outHeaders[strings.ToLower(k)] = v
				}
				result["headers"] = outHeaders
			} else {
				result["headers"] = map[string]any{}
			}
		} else {
			result["headers"] = map[string]any{}
		}
	}

	return result
}

// ResultBody gets body from response.
func ResultBody(ctx map[string]any) any {
	response, _ := GetProp(ctx, "response").(map[string]any)
	result, _ := GetProp(ctx, "result").(map[string]any)

	if result != nil {
		if response != nil {
			body := GetProp(response, "body")
			if body != nil {
				result["body"] = body
			}
		}
	}

	return result
}

// MakeError creates/throws an error with the SDK prefix format.
func MakeError(ctx map[string]any, errArgs ...any) (any, error) {
	op, _ := GetProp(ctx, "op").(map[string]any)
	opname, _ := GetProp(op, "name").(string)
	if opname == "" {
		opname = "unknown operation"
	}

	result, _ := GetProp(ctx, "result").(map[string]any)
	if result == nil {
		result = map[string]any{"ok": false}
		ctx["result"] = result
	}
	result["ok"] = false

	var err error
	if len(errArgs) > 0 && errArgs[0] != nil {
		switch e := errArgs[0].(type) {
		case error:
			err = e
		case string:
			err = errors.New(e)
		case map[string]any:
			// Extract message from error-like map; skip empty maps
			if msg, ok := e["message"].(string); ok && msg != "" {
				err = errors.New(msg)
			}
			// Otherwise leave err nil to fall through to result.err or default
		default:
			err = fmt.Errorf("%v", e)
		}
	}

	if err == nil {
		if resErr := GetProp(result, "err"); resErr != nil {
			switch e := resErr.(type) {
			case error:
				err = e
			case map[string]any:
				if msg, ok := e["message"].(string); ok && msg != "" {
					err = errors.New(msg)
				}
			}
		}
	}

	if err == nil {
		err = errors.New("unknown error")
	}

	msg := fmt.Sprintf("ProjectNameSDK: %s: %s", opname, err.Error())

	ctrl, _ := GetProp(ctx, "ctrl").(map[string]any)
	if ctrl != nil {
		if throwVal := GetProp(ctrl, "throw"); throwVal == false {
			return GetProp(result, "resdata"), nil
		}
	}

	return nil, errors.New(msg)
}

// Done returns resdata or throws.
func Done(ctx map[string]any) (any, error) {
	result, _ := GetProp(ctx, "result").(map[string]any)

	if result != nil {
		ok, _ := GetProp(result, "ok").(bool)
		if ok {
			return GetProp(result, "resdata"), nil
		}
	}

	return MakeError(ctx)
}

// Clean sanitizes sensitive values (currently no-op, matching TS).
func Clean(ctx map[string]any, val any) any {
	return val
}

// Fetcher calls fetch, blocked in test mode.
func Fetcher(ctx map[string]any, fullurl string, fetchdef map[string]any) (any, error) {
	client := GetProp(ctx, "client")

	mode := ""
	if c, ok := client.(interface{ Mode() string }); ok {
		mode = c.Mode()
	}

	if mode != "live" {
		return nil, ctxError(ctx, "fetch_mode_block",
			fmt.Sprintf("Request blocked by mode: \"%s\" (URL was: \"%s\")", mode, fullurl))
	}

	options := clientOptions(ctx)
	testActive, _ := GetPath([]string{"feature", "test", "active"}, options).(bool)
	if testActive {
		return nil, ctxError(ctx, "fetch_test_block",
			fmt.Sprintf("Request blocked as test feature is active (URL was: \"%s\")", fullurl))
	}

	fetchFn := GetPath([]string{"system", "fetch"}, options)
	if fetchFn == nil {
		return nil, ctxError(ctx, "fetch_no_fn", "No fetch function available")
	}

	if fn, ok := fetchFn.(func(string, map[string]any) (any, error)); ok {
		return fn(fullurl, fetchdef)
	}

	return nil, ctxError(ctx, "fetch_bad_fn", "Fetch function has invalid type")
}

// FeatureAdd adds a feature to the client's feature list.
func FeatureAdd(ctx map[string]any, f any) {
	client := GetProp(ctx, "client")
	if client == nil {
		return
	}

	if c, ok := client.(interface {
		Features() []any
		SetFeatures([]any)
	}); ok {
		features := c.Features()
		features = append(features, f)
		c.SetFeatures(features)
	}
}

// FeatureHook calls a named hook on all features.
func FeatureHook(ctx map[string]any, name string) {
	client := GetProp(ctx, "client")
	if client == nil {
		return
	}

	if c, ok := client.(interface{ Features() []any }); ok {
		features := c.Features()
		for _, f := range features {
			fMap, _ := f.(map[string]any)
			if fMap != nil {
				if hookFn := GetProp(fMap, name); hookFn != nil {
					if fn, ok := hookFn.(func(map[string]any)); ok {
						fn(ctx)
					}
				}
			}
		}
	}
}

// FeatureInit initializes a feature if active.
func FeatureInit(ctx map[string]any, f any) {
	fMap, _ := f.(map[string]any)
	if fMap == nil {
		return
	}

	options, _ := GetProp(ctx, "options").(map[string]any)
	if options == nil {
		return
	}

	fname, _ := GetProp(fMap, "name").(string)
	fopts := GetPath([]string{"feature", fname}, options)
	foptsMap, _ := fopts.(map[string]any)

	if foptsMap != nil {
		active, _ := GetProp(foptsMap, "active").(bool)
		if active {
			if initFn := GetProp(fMap, "init"); initFn != nil {
				if fn, ok := initFn.(func(map[string]any, map[string]any)); ok {
					fn(ctx, foptsMap)
				}
			}
		}
	}
}

// clientOptions gets options from the client via interface.
func clientOptions(ctx map[string]any) map[string]any {
	client := GetProp(ctx, "client")
	if c, ok := client.(interface{ Options() map[string]any }); ok {
		return c.Options()
	}
	return map[string]any{}
}

// ctxError creates an error with the SDK prefix format.
func ctxError(ctx map[string]any, code string, msg string) error {
	op, _ := GetProp(ctx, "op").(map[string]any)
	opname, _ := GetProp(op, "name").(string)
	if opname == "" {
		opname = "unknown"
	}
	return fmt.Errorf("ProjectNameSDK: %s: %s", opname, msg)
}
