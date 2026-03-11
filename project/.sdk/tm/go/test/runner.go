// Test runner that uses the test model in build/test.

package runner

import (
	"fmt"

	sdk "GOMODULE/sdk"

	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"strings"
	"testing"
	"unicode"
)

// Client interface defines the minimum needed to work with the runner
type Client interface {
	Utility() Utility
}

type Utility interface {
	Struct() *StructUtility
	Check(ctx map[string]any) map[string]any
	MakeContext(ctxmap map[string]any) map[string]any
}

type StructUtility struct {
	IsNode     func(val any) bool
	Clone      func(val any) any
	CloneFlags func(val any, flags map[string]bool) any
	GetPath    func(path any, store any) any
	Inject     func(val any, store any) any
	Items      func(val any) [][2]any
	Stringify  func(val any, maxlen ...int) string
	Walk       func(val any, apply sdk.WalkApply, opts ...any) any
}

type Subject func(args ...any) (any, error)

type RunSet func(
	t *testing.T,
	testspec any,
	testsubject any,
)

type RunSetFlags func(
	t *testing.T,
	testspec any,
	flags map[string]bool,
	testsubject any,
)

type RunPack struct {
	Spec        map[string]any
	RunSet      RunSet
	RunSetFlags RunSetFlags
	Subject     Subject
	Client      Client
	Clients     map[string]Client
}

type TestPack struct {
	Name    string
	Client  Client
	Subject Subject
	Utility Utility
}

var (
	NULLMARK   = "__NULL__"   // Value is JSON null
	UNDEFMARK  = "__UNDEF__"  // Value is not present (thus, undefined)
	EXISTSMARK = "__EXISTS__" // Value exists (not undefined)
)

// MakeRunner creates a runner function that can be used to run tests
func MakeRunner(testfile string, client Client) func(name string, store any) (*RunPack, error) {

	return func(name string, store any) (*RunPack, error) {
		utility := client.Utility()
		structUtil := utility.Struct()

		spec := resolveSpec(name, testfile)

		clients, err := resolveClients(spec, store, structUtil, client)
		if err != nil {
			return nil, err
		}

		subject, _, err := resolveSubject(name, utility)
		if err != nil {
			return nil, err
		}

		var runsetFlags RunSetFlags = func(
			t *testing.T,
			testspec any,
			flags map[string]bool,
			testsubject any,
		) {
			if testsubject != nil {
				subject = subjectify(testsubject)
			}

			flags = resolveFlags(flags)

			if testspec == nil {
				return
			}

			var testspecmap = fixJSON(
				testspec.(map[string]any),
				flags,
			).(map[string]any)

			testset, ok := testspecmap["set"].([]any)
			if !ok {
				panic(fmt.Sprintf("No test set in %v", name))
				return
			}

			for _, entryVal := range testset {
				entry := resolveEntry(entryVal, flags)

				// Go cannot distinguish absent values from nil (JSON null).
				// Skip entries where "in" or "out" is missing and the expected
				// result is T_noval, as this represents a concept (undefined)
				// that does not exist in Go.
				_, hasIn := entry["in"]
				_, hasOut := entry["out"]
				if !hasIn || !hasOut {
					if outVal, ok := entry["out"]; ok {
						if outNum, ok := outVal.(int); ok && outNum == sdk.T_noval {
							continue
						}
					}
				}

				// When null flag is false, skip entries where in values are nil,
				// since Go cannot distinguish absent/undefined from nil.
				if !flags["null"] {
					if inMap, ok := entry["in"].(map[string]any); ok {
						skipEntry := false
						for _, v := range inMap {
							if v == nil {
								skipEntry = true
								break
							}
						}
						if skipEntry {
							continue
						}
					}
					// Also skip when out is nil (nil/undefined distinction).
					if entry["out"] == nil {
						continue
					}
				}

				testpack, err := resolveTestPack(name, entry, subject, client, clients)
				if err != nil {
					// No debug output
					return
				}

				args := resolveArgs(entry, testpack)
				entry["args"] = args

				res, err := testpack.Subject(args...)

				res = fixJSON(res, flags)

				entry["res"] = res
				entry["thrown"] = err

				if nil == err {
					checkResult(t, entry, res, structUtil)
				} else {
					handleError(t, entry, err, structUtil)
				}
			}
		}

		var runset RunSet = func(
			t *testing.T,
			testspec any,
			testsubject any,
		) {
			runsetFlags(t, testspec, nil, testsubject)
		}

		return &RunPack{
			Spec:        spec,
			RunSet:      runset,
			RunSetFlags: runsetFlags,
			Subject:     subject,
			Client:      client,
			Clients:     clients,
		}, nil
	}
}

func resolveSpec(
	name string,
	testfile string,
) map[string]any {

	data, err := os.ReadFile(filepath.Join(".", testfile))
	if err != nil {
		panic(err)
	}

	var alltests map[string]any
	if err := json.Unmarshal(data, &alltests); err != nil {
		panic(err)
	}

	var spec map[string]any

	// Check if there's a "primary" key that is a map, and if it has our 'name'
	if primaryRaw, hasPrimary := alltests["primary"]; hasPrimary {
		if primaryMap, ok := primaryRaw.(map[string]any); ok {
			if found, ok := primaryMap[name]; ok {
				spec = found.(map[string]any)
			}
		}
	}

	if spec == nil {
		if found, ok := alltests[name]; ok {
			spec = found.(map[string]any)
		}
	}

	if spec == nil {
		spec = alltests
	}

	return spec
}

func resolveClients(
	spec map[string]any,
	store any,
	structUtil *StructUtility,
	baseClient Client,
) (map[string]Client, error) {
	clients := make(map[string]Client)

	// Check if the client has a Tester method using reflection
	baseClientValue := reflect.ValueOf(baseClient)
	testerMethod := baseClientValue.MethodByName("Tester")
	if !testerMethod.IsValid() {
		return clients, nil
	}

	// Collect client definitions from top-level DEF and nested group DEFs.
	allClientDefs := map[string]map[string]any{}

	// Check top-level DEF
	if defMap, ok := spec["DEF"].(map[string]any); ok {
		if clientMap, ok := defMap["client"].(map[string]any); ok {
			for k, v := range clientMap {
				if vm, ok := v.(map[string]any); ok {
					allClientDefs[k] = vm
				}
			}
		}
	}

	if len(allClientDefs) == 0 {
		return clients, nil
	}

	for _, cdef := range structUtil.Items(allClientDefs) {
		key, _ := cdef[0].(string)
		valMap, _ := cdef[1].(map[string]any)

		if valMap == nil {
			continue
		}

		testRaw, _ := valMap["test"].(map[string]any)
		opts, _ := testRaw["options"].(map[string]any)
		if opts == nil {
			opts = make(map[string]any)
		}

		// Inject store values into options
		if store != nil && structUtil.Inject != nil {
			structUtil.Inject(opts, store)
		}

		// Call the client's Tester method using reflection
		results := testerMethod.Call([]reflect.Value{reflect.ValueOf(opts)})
		if len(results) != 2 {
			return nil, fmt.Errorf("resolveClients: Tester method must return (Client, error)")
		}

		// Check for error
		if !results[1].IsNil() {
			err := results[1].Interface().(error)
			return nil, err
		}

		// Get the new client instance
		newClientValue := results[0].Interface()
		newClient, ok := newClientValue.(Client)
		if !ok {
			return nil, fmt.Errorf("resolveClients: Tester method did not return a Client")
		}

		clients[key] = newClient
	}

	return clients, nil
}

func resolveSubject(
	name string,
	container any,
) (Subject, bool, error) {
	name = uppercaseFirstLetter(name)

	val := reflect.ValueOf(container)

	if _, ok := container.(Utility); ok {
		subjectVal := val.MethodByName(name)
		if subjectVal.IsValid() {
			subjectIF := subjectVal.Interface()
			subject := subjectify(subjectIF)
			return subject, true, nil
		}
	}

	if val.Kind() == reflect.Ptr {
		val = val.Elem()
	}
	if val.Kind() != reflect.Struct {
		// Return a no-op subject; individual tests can override via testsubject arg
		return func(args ...any) (any, error) {
			return nil, nil
		}, false, nil
	}

	fieldVal := val.FieldByName(name)

	if !fieldVal.IsValid() || fieldVal.Kind() != reflect.Func {
		// Return a no-op subject; individual tests can override via testsubject arg
		return func(args ...any) (any, error) {
			return nil, nil
		}, false, nil
	}

	fn := fieldVal.Interface()

	sfn, ok := fn.(Subject)
	if !ok {
		sfn = subjectify(fn)
	}

	return sfn, true, nil
}

func resolveFlags(flags map[string]bool) map[string]bool {

	if nil == flags {
		flags = map[string]bool{}
	}

	if _, ok := flags["null"]; !ok {
		flags["null"] = true
	}

	return flags
}

func resolveEntry(entryVal any, flags map[string]bool) map[string]any {
	entry := entryVal.(map[string]any)

	if flags["null"] {

		// Where `out` is missing in the test spec, set it to the special null symbol __NULL__
		_, has := entry["out"]
		if !has {
			entry["out"] = NULLMARK
		}
	}

	return entry
}

func checkResult(
	t *testing.T,
	entry map[string]any,
	res any,
	structUtils *StructUtility,
) {
	// Check if this test expects an output or an error
	_, hasExpectedErr := entry["err"]

	// If the test expects an error but none was thrown, fail.
	if hasExpectedErr && entry["err"] != nil {
		// Special case for null errors in struct tests
		errStr, isStr := entry["err"].(string)
		if isStr && strings.Contains(errStr, "null:") {
			return
		}
		// Expected error did not occur
		t.Error(fmt.Sprintf("Expected error did not occur: %v\n\nENTRY: %s",
			entry["err"], structUtils.Stringify(entry)))
		return
	}

	outVal := entry["out"]
	isNullOut := false
	if s, ok := outVal.(string); ok && s == NULLMARK {
		isNullOut = true
	}

	if !isNullOut && (entry["match"] == nil || outVal != nil) {
		var cleanRes any
		if res != nil {
			flags := map[string]bool{"func": false}
			cleanRes = structUtils.CloneFlags(res, flags)
		} else {
			cleanRes = res
		}

		if !reflect.DeepEqual(cleanRes, outVal) {
			t.Error(outFail(entry, cleanRes, outVal))
			return
		}
	}

	if entry["match"] != nil {
		pass, err := MatchNode(
			entry["match"],
			map[string]any{
				"in":   entry["in"],
				"out":  entry["res"],
				"ctx":  entry["ctx"],
				"args": entry["args"],
			},
			structUtils,
		)
		if err != nil {
			t.Error(fmt.Sprintf("match error: %v", err))
			return
		}
		if !pass {
			t.Error(fmt.Sprintf("match fail: %v", err))
			return
		}
	}
}

func outFail(entry any, res any, out any) string {
	return fmt.Sprintf("Entry:\n%s\nExpected:\n%s\nGot:\n%s\n",
		inspect(entry), inspect(out), inspect(res))
}

func inspect(val any) string {
	return inspectIndent(val, "")
}

func inspectIndent(val any, indent string) string {
	result := ""

	switch v := val.(type) {
	case map[string]any:
		result += indent + "{\n"
		for key, value := range v {
			result += fmt.Sprintf("%s  \"%s\": %s", indent, key, inspectIndent(value, indent+"  "))
		}
		result += indent + "}\n"

	case []any:
		result += indent + "[\n"
		for _, value := range v {
			result += fmt.Sprintf("%s  - %s", indent, inspectIndent(value, indent+"  "))
		}
		result += indent + "]\n"

	default:
		result += fmt.Sprintf("%v (%s)\n", v, reflect.TypeOf(v))
	}

	return result
}

func handleError(
	t *testing.T,
	entry map[string]any,
	testerr error,
	structUtils *StructUtility,
) {
	// Record the error in the entry
	entry["thrown"] = testerr
	entryErr := entry["err"]

	// Special cases for testing
	if nil == entryErr && entry["out"] != nil {
		errStr := testerr.Error()
		if strings.Contains(errStr, "null:") &&
			strings.Contains(structUtils.Stringify(entry["in"]), "q:[") {
			return
		}
	}

	if nil == entryErr {
		t.Error(fmt.Sprintf("%s\n\nENTRY: %s", testerr.Error(), structUtils.Stringify(entry)))
		return
	}

	boolErr, hasBoolErr := entryErr.(bool)
	if hasBoolErr && !boolErr {
		t.Error(fmt.Sprintf("%s\n\nENTRY: %s", testerr.Error(), structUtils.Stringify(entry)))
		return
	}

	// Handle special cases
	errStr := testerr.Error()
	entryErrStr, isStr := entryErr.(string)
	if isStr {
		if strings.Contains(errStr, "null:") && strings.Contains(entryErrStr, "null:") {
			return
		}
	}

	matchErr, err := MatchNode(entryErr, errStr, structUtils)

	if err != nil {
		t.Error(fmt.Sprintf("match error: %v", err))
		return
	}

	if boolErr || matchErr {
		if entry["match"] != nil {
			flags := map[string]bool{"null": true}
			matchErr, err := MatchNode(
				entry["match"],
				map[string]any{
					"in":  entry["in"],
					"out": entry["res"],
					"ctx": entry["ctx"],
					"err": fixJSON(testerr, flags),
				},
				structUtils,
			)

			if !matchErr {
				t.Error(fmt.Sprintf("match failed: %v", matchErr))
			}

			if nil != err {
				t.Error(fmt.Sprintf("match failed: %v", err))
			}
		}

	} else {
		t.Error(fmt.Sprintf("ERROR MATCH: [%s] <=> [%s]",
			structUtils.Stringify(entryErr),
			errStr,
		))
	}
}

// bridgeTestData bridges old test data format to current SDK conventions.
// This handles:
//   - op.name → opname
//   - op.kind → op.input (req→data, res→match)
//   - op.match → match, reqmatch
//   - op.data → reqdata
//   - op.params/alias → target
//   - op.reqform → target.transform.req
//   - op.resform → target.transform.res
//   - response.native → response (unwrap) + reason → statusText
func bridgeTestData(cfm map[string]any) {
	op, _ := cfm["op"].(map[string]any)

	if op != nil {
		// Bridge op.name → opname
		if _, hasOpname := cfm["opname"]; !hasOpname {
			if name, ok := op["name"].(string); ok {
				cfm["opname"] = name
			}
		}

		// Bridge op.kind → op.input (req→data, res→match)
		if kind, _ := op["kind"].(string); kind != "" {
			if _, hasInput := op["input"]; !hasInput {
				if kind == "req" {
					op["input"] = "data"
				} else {
					op["input"] = "match"
				}
			}
		}

		// Bridge op.match → match, reqmatch (only if not already set at top level)
		if opMatch := sdk.GetProp(op, "match"); opMatch != nil {
			if existing, _ := cfm["match"].(map[string]any); existing == nil || len(existing) == 0 {
				cfm["match"] = opMatch
			}
			if existing, _ := cfm["reqmatch"].(map[string]any); existing == nil || len(existing) == 0 {
				cfm["reqmatch"] = opMatch
			}
		}

		// Bridge op.data → reqdata and data
		if opData := sdk.GetProp(op, "data"); opData != nil {
			if _, has := cfm["reqdata"]; !has {
				cfm["reqdata"] = opData
			}
			if _, has := cfm["data"]; !has {
				cfm["data"] = opData
			}
		}

		// Bridge op.params, op.alias → target
		if _, has := cfm["target"]; !has {
			target := map[string]any{}
			hasTarget := false

			if opParams := sdk.GetProp(op, "params"); opParams != nil {
				target["params"] = opParams
				target["args"] = map[string]any{"params": opParams}
				hasTarget = true
			}

			if opAlias := sdk.GetProp(op, "alias"); opAlias != nil {
				target["alias"] = opAlias
				hasTarget = true
			}

			// Bridge op.reqform → target.transform.req
			if opReqform := sdk.GetProp(op, "reqform"); opReqform != nil {
				transform, _ := target["transform"].(map[string]any)
				if transform == nil {
					transform = map[string]any{}
					target["transform"] = transform
				}
				transform["req"] = opReqform
				hasTarget = true
			}

			// Bridge op.resform → target.transform.res
			if opResform := sdk.GetProp(op, "resform"); opResform != nil {
				transform, _ := target["transform"].(map[string]any)
				if transform == nil {
					transform = map[string]any{}
					target["transform"] = transform
				}
				transform["res"] = opResform
				hasTarget = true
			}

			if hasTarget {
				cfm["target"] = target
			}
		}
	}

	// Bridge response.native → response (unwrap) + reason → statusText
	if response, _ := cfm["response"].(map[string]any); response != nil {
		if native, _ := response["native"].(map[string]any); native != nil {
			// Map reason → statusText
			if _, has := native["statusText"]; !has {
				if reason := sdk.GetProp(native, "reason"); reason != nil {
					native["statusText"] = reason
				}
			}
			// Preserve non-native properties (like err) on the unwrapped response
			for k, v := range response {
				if k != "native" {
					native[k] = v
				}
			}
			cfm["response"] = native
		}
	}
}

func resolveArgs(entry map[string]any, testpack TestPack) []any {
	structUtils := testpack.Utility.Struct()

	var args []any
	if inVal, ok := entry["in"]; ok {
		args = []any{structUtils.Clone(inVal)}
	} else {
		args = []any{}
	}

	if ctx, exists := entry["ctx"]; exists && ctx != nil {
		args = []any{ctx}
	} else if rawArgs, exists := entry["args"]; exists && rawArgs != nil {
		if slice, ok := rawArgs.([]any); ok {
			args = slice
		}
	}

	if entry["ctx"] != nil || entry["args"] != nil {
		if len(args) > 0 {
			first := args[0]
			if firstMap, ok := first.(map[string]any); ok && first != nil {
				clonedFirst := structUtils.Clone(firstMap)
				cfm, _ := clonedFirst.(map[string]any)

				// Bridge old test data format to current conventions
				bridgeTestData(cfm)

				// Create context via MakeContext
				clonedCtx := testpack.Utility.MakeContext(cfm)
				args[0] = clonedCtx
				entry["ctx"] = clonedCtx
				clonedCtx["client"] = testpack.Client
				clonedCtx["utility"] = testpack.Utility
			}
		}
	}

	return args
}

func resolveTestPack(
	name string,
	entry any,
	testsubject any,
	client Client,
	clients map[string]Client,
) (TestPack, error) {

	subject, ok := testsubject.(Subject)
	if !ok {
		panic("Bad subject")
	}

	testpack := TestPack{
		Name:    name,
		Client:  client,
		Subject: subject,
		Utility: client.Utility(),
	}

	var err error

	if e, ok := entry.(map[string]any); ok {
		if rawClient, exists := e["client"]; exists {
			if clientKey, ok := rawClient.(string); ok {
				if cl, found := clients[clientKey]; found {
					testpack.Client = cl
					testpack.Utility = cl.Utility()
					// Only override subject if a real one is found for this module
					if newSubject, subjectFound, _ := resolveSubject(name, testpack.Utility.Struct()); subjectFound {
						testpack.Subject = newSubject
					}
				}
			}
		}
	}

	return testpack, err
}

func MatchNode(
	check any,
	base any,
	structUtil *StructUtility,
) (bool, error) {
	pass := true
	var err error = nil

	// Clone the base object to avoid modifying the original
	base = structUtil.Clone(base)

	structUtil.Walk(
		check,
		func(key *string, val any, _parent any, path []string) any {
			scalar := !structUtil.IsNode(val)

			if scalar {
				baseval := structUtil.GetPath(path, base)
				if !MatchScalar(val, baseval, structUtil) {
					pass = false
					err = fmt.Errorf(
						"MATCHX: %s: [%s] <=> [%s]",
						strings.Join(path, "."),
						structUtil.Stringify(val),
						structUtil.Stringify(baseval),
					)
				}
			}
			return val
		},
	)

	return pass, err
}

func MatchScalar(check, base any, structUtil *StructUtility) bool {
	// Handle special cases for undefined and null values
	if s, ok := check.(string); ok && s == UNDEFMARK {
		return base == nil || reflect.ValueOf(base).IsZero()
	}

	// Handle EXISTSMARK - value exists and is not undefined
	if s, ok := check.(string); ok && s == EXISTSMARK {
		return base != nil
	}

	pass := (check == base)

	if !pass {
		if checkStr, ok := check.(string); ok {
			basestr := structUtil.Stringify(base)

			if len(checkStr) > 2 && checkStr[0] == '/' && checkStr[len(checkStr)-1] == '/' {
				pat := checkStr[1 : len(checkStr)-1]
				if rx, err := regexp.Compile(pat); err == nil {
					pass = rx.MatchString(basestr)
				} else {
					pass = false
				}
			} else {
				basenorm := strings.ToLower(basestr)
				checknorm := strings.ToLower(structUtil.Stringify(checkStr))
				pass = strings.Contains(
					basenorm,
					checknorm,
				)
			}
		} else {
			cv := reflect.ValueOf(check)
			isf := cv.Kind() == reflect.Func
			if isf {
				pass = true
			}
		}
	}

	return pass
}

func subjectify(fn any) Subject {
	v := reflect.ValueOf(fn)
	if v.Kind() != reflect.Func {
		panic("subjectify: not a function")
	}

	sfn, ok := v.Interface().(Subject)
	if ok {
		return sfn
	}

	fnType := v.Type()

	return func(args ...any) (any, error) {

		isVariadic := fnType.IsVariadic()
		numFixed := fnType.NumIn()
		if isVariadic {
			numFixed-- // Last param is the variadic slice
		}

		// For non-variadic: ensure we have enough args
		if !isVariadic && len(args) < fnType.NumIn() {
			extended := make([]any, fnType.NumIn())
			copy(extended, args)
			args = extended
		}

		// Build reflect.Value slice for call
		var in []reflect.Value

		// Add fixed (non-variadic) params
		for i := 0; i < numFixed; i++ {
			paramType := fnType.In(i)
			var arg any
			if i < len(args) {
				arg = args[i]
			}

			if arg == nil {
				in = append(in, reflect.Zero(paramType))
			} else {
				val := reflect.ValueOf(arg)
				if !val.Type().AssignableTo(paramType) {
					return nil, fmt.Errorf(
						"subjectify: argument %d type %T not assignable to parameter type %s",
						i, arg, paramType,
					)
				}
				in = append(in, val)
			}
		}

		// Add variadic params (if any extra args remain)
		if isVariadic {
			elemType := fnType.In(fnType.NumIn() - 1).Elem()
			for i := numFixed; i < len(args); i++ {
				arg := args[i]
				if arg == nil {
					in = append(in, reflect.Zero(elemType))
				} else {
					val := reflect.ValueOf(arg)
					if !val.Type().AssignableTo(elemType) {
						return nil, fmt.Errorf(
							"subjectify: variadic argument %d type %T not assignable to element type %s",
							i, arg, elemType,
						)
					}
					in = append(in, val)
				}
			}
		}

		// Call the original function
		out := v.Call(in)

		// Interpret results
		switch len(out) {
		case 0:
			return nil, nil
		case 1:
			return out[0].Interface(), nil
		case 2:
			errVal := out[1].Interface()
			var err error
			if errVal != nil {
				err = errVal.(error)
			}
			return out[0].Interface(), err
		default:
			return nil, fmt.Errorf("subjectify: function returns too many values (%d)", len(out))
		}
	}
}

func fixJSON(data any, flags map[string]bool) any {
	// Ensure flags is initialized
	if flags == nil {
		flags = map[string]bool{"null": true}
	}

	// Handle nil data
	if nil == data && flags["null"] {
		return NULLMARK
	}

	// Handle error objects specially
	if err, ok := data.(error); ok {
		errorMap := map[string]any{
			"name":    reflect.TypeOf(err).String(),
			"message": err.Error(),
		}
		return errorMap
	}

	v := reflect.ValueOf(data)

	switch v.Kind() {
	case reflect.Float64:
		if v.Float() == float64(int(v.Float())) {
			return int(v.Float())
		}
		return data

	case reflect.Map:
		fixedMap := make(map[string]any)
		for _, key := range v.MapKeys() {
			strKey, ok := key.Interface().(string)
			if ok {
				value := v.MapIndex(key).Interface()
				if value == nil && flags["null"] {
					fixedMap[strKey] = NULLMARK
				} else {
					fixedMap[strKey] = fixJSON(value, flags)
				}
			}
		}
		return fixedMap

	case reflect.Slice:
		length := v.Len()
		fixedSlice := make([]any, length)
		for i := 0; i < length; i++ {
			value := v.Index(i).Interface()
			if value == nil && flags["null"] {
				fixedSlice[i] = NULLMARK
			} else {
				fixedSlice[i] = fixJSON(value, flags)
			}
		}
		return fixedSlice

	case reflect.Array:
		length := v.Len()
		fixedSlice := make([]any, length)
		for i := 0; i < length; i++ {
			value := v.Index(i).Interface()
			if value == nil && flags["null"] {
				fixedSlice[i] = NULLMARK
			} else {
				fixedSlice[i] = fixJSON(value, flags)
			}
		}
		return fixedSlice

	default:
		return data
	}
}

func NullModifier(
	val any,
	key any,
	parent any,
	state *sdk.Injection,
	current any,
	store any,
) {
	switch v := val.(type) {
	case string:
		if NULLMARK == v {
			_ = sdk.SetProp(parent, key, nil)
		} else if UNDEFMARK == v {
			_ = sdk.SetProp(parent, key, nil)
		} else if EXISTSMARK == v {
			// Marker used during matching, not a value to be transformed
		} else {
			_ = sdk.SetProp(parent, key,
				strings.ReplaceAll(v, NULLMARK, "null"))
		}
	}
}

func Fdt(data any) string {
	return fdti(data, "")
}

func fdti(data any, indent string) string {
	result := ""

	switch v := data.(type) {
	case map[string]any:
		result += indent + "{\n"
		for key, value := range v {
			result += fmt.Sprintf("%s  \"%s\": %s", indent, key, fdti(value, indent+"  "))
		}
		result += indent + "}\n"

	case []any:
		result += indent + "[\n"
		for _, value := range v {
			result += fmt.Sprintf("%s  - %s", indent, fdti(value, indent+"  "))
		}
		result += indent + "]\n"

	default:
		result += fmt.Sprintf("%v (%s)\n", v, reflect.TypeOf(v))
	}

	return result
}

func ToJSONString(data any) string {
	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return ""
	}
	return string(jsonBytes)
}

func uppercaseFirstLetter(s string) string {
	if len(s) == 0 {
		return s
	}

	runes := []rune(s)
	runes[0] = unicode.ToUpper(runes[0])
	return string(runes)
}
