import {
  cmp,
  File,
  Content,
  isAuthSuppressed,
  isHttpBasicAuth,
  resolveAuthIn,
  resolveAuthName,
} from '@voxgig/sdkgen'


// The canary sweep: every credential slot holds a distinctive value, every
// diagnostic feature this SDK ships is switched on with a capturing sink, a
// real operation runs through every outcome, and every string that leaves
// the SDK is searched for the canaries and their encoded forms. It also
// proves its own sensitivity: with clean switched off the canary MUST show.
const TestClean = cmp(function TestClean(props: any) {
  const { model } = props.ctx$
  const { target, gomodule } = props

  const auth = {
    suppressed: isAuthSuppressed(model),
    where: resolveAuthIn(model),
    name: 'header' === resolveAuthIn(model)
      ? resolveAuthName(model).toLowerCase() : resolveAuthName(model),
    basic: isHttpBasicAuth(model),
  }

  File({ name: 'clean_test.' + target.ext }, () => Content(render(gomodule, model.const.Name, auth)))
})


function render(gomodule: string, Name: string, auth: {
  suppressed: boolean, where: string, name: string, basic: boolean
}): string {
  return `package sdktest

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/url"
	"reflect"
	"sort"
	"strings"
	"testing"

	sdk "${gomodule}"
	"${gomodule}/core"
)

// Generated: the credential's wire placement is fixed when the SDK is built.
var cleanAuth = struct {
	suppressed bool
	where      string
	name       string
	basic      bool
}{${auth.suppressed}, ${JSON.stringify(auth.where)}, ${JSON.stringify(auth.name)}, ${auth.basic}}

var cleanCanary = map[string]string{
	"apikey": "CANARY-APIKEY-k9x2m7q4p1",
	"secret": "CANARY-SECRET-w3e8r5t2y6",
	"header": "CANARY-HEADER-z1x4c7v0b3",
	"value":  "CANARY-VALUE-n5m8b2v9c4",
}

const cleanMask = "[redacted]"

// Every form a canary can travel in.
var cleanForms = func() []string {
	out := []string{}
	for _, k := range []string{"apikey", "secret", "header", "value"} {
		v := cleanCanary[k]
		out = append(out, v, base64.StdEncoding.EncodeToString([]byte(v)), url.QueryEscape(v))
	}
	return append(out, base64.StdEncoding.EncodeToString(
		[]byte(cleanCanary["apikey"]+":"+cleanCanary["secret"])))
}()

type cleanSink struct {
	name string
	text string
}

// Header maps keep the caller's spelling; the assertion should not care.
func cleanHeader(m any, name string) any {
	hm, _ := m.(map[string]any)
	for k, v := range hm {
		if strings.EqualFold(k, name) {
			return v
		}
	}
	return nil
}

func cleanLeaks(text string) []string {
	found := []string{}
	for _, f := range cleanForms {
		if strings.Contains(text, f) {
			found = append(found, f)
		}
	}
	return found
}

// The default prints and the JSON form of a value: what a log line, a panic
// message or a structured logger would carry.
func cleanSurfaces(name string, val any) []cleanSink {
	out := []cleanSink{}
	if raw, err := json.Marshal(val); err == nil {
		out = append(out, cleanSink{name + ":json", string(raw)})
	}
	out = append(out,
		cleanSink{name + ":v", fmt.Sprintf("%v", val)},
		cleanSink{name + ":+v", fmt.Sprintf("%+v", val)},
		cleanSink{name + ":#v", fmt.Sprintf("%#v", val)},
	)
	if err, ok := val.(error); ok {
		out = append(out, cleanSink{name + ":message", err.Error()})
	}
	return out
}

// Captures the serialised context from inside the pipeline: what a hook
// author would hand to a logger.
type cleanCapture struct {
	sdk.BaseFeature
	sinks *[]cleanSink
}

func newCleanCapture(sinks *[]cleanSink) *cleanCapture {
	return &cleanCapture{
		BaseFeature: sdk.BaseFeature{Version: "0.0.1", Name: "capture", Active: true},
		sinks:       sinks,
	}
}

func (f *cleanCapture) take(name string, ctx *sdk.Context) {
	*f.sinks = append(*f.sinks, cleanSurfaces(name, ctx)...)
}

func (f *cleanCapture) PreRequest(ctx *sdk.Context)    { f.take("ctx@PreRequest", ctx) }
func (f *cleanCapture) PreResponse(ctx *sdk.Context)   { f.take("ctx@PreResponse", ctx) }
func (f *cleanCapture) PreUnexpected(ctx *sdk.Context) { f.take("ctx@PreUnexpected", ctx) }

// A slog handler that keeps every record, attributes included.
type cleanLogHandler struct {
	name  string
	sinks *[]cleanSink
	attrs []slog.Attr
}

func (h *cleanLogHandler) Enabled(context.Context, slog.Level) bool { return true }

func (h *cleanLogHandler) Handle(_ context.Context, r slog.Record) error {
	rec := map[string]any{"msg": r.Message}
	for _, a := range h.attrs {
		rec[a.Key] = a.Value.Any()
	}
	r.Attrs(func(a slog.Attr) bool {
		rec[a.Key] = a.Value.Any()
		return true
	})
	*h.sinks = append(*h.sinks,
		cleanSurfaces(h.name+"."+strings.ToLower(r.Level.String()), rec)...)
	return nil
}

func (h *cleanLogHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &cleanLogHandler{
		name:  h.name,
		sinks: h.sinks,
		attrs: append(append([]slog.Attr{}, h.attrs...), attrs...),
	}
}

func (h *cleanLogHandler) WithGroup(string) slog.Handler { return h }

type cleanScenario struct {
	name    string
	respond func(url string, fetchdef map[string]any) (any, error)
}

func cleanResponse(status int, data any, headers map[string]any) map[string]any {
	h := map[string]any{"content-type": "application/json"}
	for k, v := range headers {
		h[k] = v
	}
	statusText := "OK"
	if status >= 400 {
		statusText = "ERR"
	}
	raw, _ := json.Marshal(data)
	return map[string]any{
		"status":     status,
		"statusText": statusText,
		"headers":    h,
		"json":       (func() any)(func() any { return data }),
		"body":       string(raw),
	}
}

var cleanScenarios = []cleanScenario{
	{"ok", func(string, map[string]any) (any, error) {
		return cleanResponse(200, map[string]any{"id": "i1", "name": "n1"},
			map[string]any{"x-session-token": "RESP-TOKEN-a1b2c3d4e5"}), nil
	}},
	{"notfound", func(string, map[string]any) (any, error) {
		return cleanResponse(404, map[string]any{"error": "no such record"}, nil), nil
	}},
	{"server", func(string, map[string]any) (any, error) {
		return cleanResponse(500, map[string]any{"error": "boom"}, nil), nil
	}},
	{"transport", func(url string, _ map[string]any) (any, error) {
		return nil, fmt.Errorf("socket hang up (URL was: %q)", url)
	}},
	{"notjson", func(string, map[string]any) (any, error) {
		return map[string]any{
			"status":     200,
			"statusText": "OK",
			"headers":    map[string]any{},
			"json":       (func() any)(func() any { return nil }),
			"body":       "<html>",
		}, nil
	}},
}

func cleanMakeSdk(scenario cleanScenario, sinks *[]cleanSink, cleanopts map[string]any) *sdk.${Name}SDK {
	capture := func(name string) func(map[string]any) {
		return func(rec map[string]any) {
			*sinks = append(*sinks, cleanSurfaces(name, rec)...)
		}
	}

	feature := map[string]any{}
	if fhHasFeature("log") {
		feature["log"] = map[string]any{
			"active": true,
			"logger": slog.New(&cleanLogHandler{name: "log", sinks: sinks}),
		}
	}
	if fhHasFeature("debug") {
		feature["debug"] = map[string]any{"active": true, "onEntry": capture("debug")}
	}
	if fhHasFeature("audit") {
		feature["audit"] = map[string]any{"active": true, "sink": capture("audit")}
	}
	if fhHasFeature("telemetry") {
		feature["telemetry"] = map[string]any{"active": true, "exporter": capture("telemetry")}
	}
	if fhHasFeature("cost") {
		feature["cost"] = map[string]any{"active": true, "sink": capture("cost")}
	}
	if fhHasFeature("metrics") {
		feature["metrics"] = map[string]any{"active": true}
	}
	if fhHasFeature("clienttrack") {
		feature["clienttrack"] = map[string]any{"active": true}
	}

	clean := map[string]any{"values": cleanCanary["value"]}
	for k, v := range cleanopts {
		clean[k] = v
	}

	return sdk.New${Name}SDK(map[string]any{
		"apikey":  cleanCanary["apikey"],
		"secret":  cleanCanary["secret"],
		"headers": map[string]any{"X-Custom-Token": cleanCanary["header"]},
		"clean":   clean,
		"feature": feature,
		"extend":  []any{newCleanCapture(sinks)},
		"utility": map[string]any{
			"fetcher": sdk.FetcherFunc(func(_ *sdk.Context, url string, fetchdef map[string]any) (any, error) {
				return scenario.respond(url, fetchdef)
			}),
		},
	})
}

// One operation this SDK can perform: the client method returning the
// entity, and the op method on it.
type cleanOp struct {
	accessor string
	method   string
}

func cleanEntity(client *sdk.${Name}SDK, accessor string) reflect.Value {
	return reflect.ValueOf(client).MethodByName(accessor).
		Call([]reflect.Value{reflect.ValueOf(map[string]any(nil))})[0]
}

func cleanInvoke(client *sdk.${Name}SDK, op cleanOp, ctrl map[string]any) (any, error) {
	rets := cleanEntity(client, op.accessor).MethodByName(op.method).Call([]reflect.Value{
		reflect.ValueOf(map[string]any{}),
		reflect.ValueOf(ctrl),
	})
	var err error
	if e, ok := rets[1].Interface().(error); ok {
		err = e
	}
	return rets[0].Interface(), err
}

// The first operation that completes against a plain 200 with no arguments
// (a required path parameter would fail before the request is built). An
// entity accessor is a client method taking one options map and returning
// something that answers GetName().
func cleanUsableOp() (cleanOp, bool) {
	plain := func() *sdk.${Name}SDK {
		return sdk.New${Name}SDK(map[string]any{
			"apikey": cleanCanary["apikey"],
			"utility": map[string]any{
				"fetcher": sdk.FetcherFunc(func(*sdk.Context, string, map[string]any) (any, error) {
					return cleanResponse(200, map[string]any{"id": "i1"}, nil), nil
				}),
			},
		})
	}

	probe := plain()
	cv := reflect.ValueOf(probe)
	ct := cv.Type()
	mapType := reflect.TypeOf(map[string]any{})

	accessors := []string{}
	for i := 0; i < ct.NumMethod(); i++ {
		m := ct.Method(i)
		if m.Type.NumIn() != 2 || m.Type.NumOut() != 1 || m.Type.In(1) != mapType {
			continue
		}
		ent := cleanEntity(probe, m.Name)
		if !ent.IsValid() || (ent.Kind() == reflect.Ptr && ent.IsNil()) {
			continue
		}
		gn := ent.MethodByName("GetName")
		if !gn.IsValid() || gn.Type().NumIn() != 0 || gn.Type().NumOut() != 1 ||
			gn.Type().Out(0).Kind() != reflect.String {
			continue
		}
		accessors = append(accessors, m.Name)
	}
	sort.Strings(accessors)

	for _, accessor := range accessors {
		for _, method := range []string{"List", "Load", "Create", "Update", "Remove"} {
			om := cleanEntity(probe, accessor).MethodByName(method)
			if !om.IsValid() || om.Type().NumIn() != 2 || om.Type().NumOut() != 2 {
				continue
			}
			op := cleanOp{accessor: accessor, method: method}
			if _, err := cleanInvoke(plain(), op, map[string]any{}); err == nil {
				return op, true
			}
		}
	}
	return cleanOp{}, false
}

func cleanDrive(client *sdk.${Name}SDK, op cleanOp, ctrl map[string]any, sinks *[]cleanSink) error {
	out, err := cleanInvoke(client, op, ctrl)
	if err != nil {
		*sinks = append(*sinks, cleanSurfaces("error", err)...)
	}
	if out != nil {
		*sinks = append(*sinks, cleanSurfaces("result", out)...)
	}
	if explain, ok := ctrl["explain"].(map[string]any); ok {
		*sinks = append(*sinks, cleanSurfaces("explain", explain)...)
	}
	return err
}

func TestCleanSweep(t *testing.T) {
	op, found := cleanUsableOp()
	if !found {
		t.Fatal("no operation completes without arguments; nothing to sweep")
	}

	sinks := []cleanSink{}
	errs := map[string]error{}
	explains := map[string]map[string]any{}

	variants := []struct {
		name string
		ctrl func() map[string]any
	}{
		{"throw", func() map[string]any { return map[string]any{} }},
		{"explain", func() map[string]any { return map[string]any{"explain": map[string]any{}} }},
		{"nothrow", func() map[string]any {
			return map[string]any{"throw": false, "explain": map[string]any{}}
		}},
	}

	for _, scenario := range cleanScenarios {
		for _, variant := range variants {
			client := cleanMakeSdk(scenario, &sinks, nil)
			ctrl := variant.ctrl()
			err := cleanDrive(client, op, ctrl, &sinks)
			key := scenario.name + "/" + variant.name
			if err != nil {
				errs[key] = err
			}
			if explain, ok := ctrl["explain"].(map[string]any); ok {
				explains[key] = explain
			}
			sinks = append(sinks, cleanSurfaces("sdk", client)...)
			sinks = append(sinks, cleanSink{"sdk:value", fmt.Sprintf("%+v", *client)})
		}
	}

	leaked := []string{}
	for _, s := range sinks {
		if found := cleanLeaks(s.text); 0 < len(found) {
			leaked = append(leaked, s.name+" ["+strings.Join(found, ", ")+"]")
		}
	}

	fmt.Printf("clean: swept %d surface(s), %d leak(s)\\n", len(sinks), len(leaked))

	if 0 < len(leaked) {
		t.Fatalf("credential leaked through: %s", strings.Join(leaked, "; "))
	}

	// The positive half: the slot the credential travelled in is masked,
	// and an unregistered token in a response header is masked by name.
	notfound, _ := errs["notfound/throw"].(*sdk.${Name}Error)
	if notfound == nil {
		t.Fatalf("the 404 scenario must return the SDK error, got %v", errs["notfound/throw"])
	}
	result, _ := notfound.Result.(map[string]any)
	if core.ToInt(result["status"]) != 404 {
		t.Fatalf("expected status 404 on the error, got %v", result["status"])
	}
	spec, _ := notfound.Spec.(map[string]any)
	if !cleanAuth.suppressed {
		switch cleanAuth.where {
		case "query":
			if got := cleanHeader(spec["query"], cleanAuth.name); got != cleanMask {
				t.Errorf("%s: expected the mask, got %v", cleanAuth.name, got)
			}
		case "cookie":
			got := fmt.Sprintf("%v", cleanHeader(spec["headers"], "cookie"))
			if !strings.Contains(got, cleanMask) {
				t.Errorf("cookie: expected the mask, got %v", got)
			}
		default:
			got := fmt.Sprintf("%v", cleanHeader(spec["headers"], cleanAuth.name))
			if !strings.HasSuffix(got, cleanMask) {
				t.Errorf("%s: expected the mask, got %v", cleanAuth.name, got)
			}
		}
	}
	if got := cleanHeader(spec["headers"], "x-custom-token"); got != cleanMask {
		t.Errorf("x-custom-token: expected the mask, got %v", got)
	}

	explained := explains["ok/explain"]
	explainedResult, _ := explained["result"].(map[string]any)
	if explainedResult == nil {
		t.Fatalf("the explain record should carry the result, got %v", explained)
	}
	if got := cleanHeader(explainedResult["headers"], "x-session-token"); got != cleanMask {
		t.Errorf("x-session-token: expected the mask, got %v", got)
	}
}

func TestCleanSensitivity(t *testing.T) {
	op, found := cleanUsableOp()
	if !found {
		t.Fatal("no operation completes without arguments; nothing to sweep")
	}

	sinks := []cleanSink{}
	client := cleanMakeSdk(cleanScenarios[1], &sinks, map[string]any{"active": false})
	err := cleanDrive(client, op, map[string]any{}, &sinks)
	if err == nil {
		t.Fatal("the 404 scenario must fail")
	}

	leaked := 0
	for _, s := range sinks {
		if 0 < len(cleanLeaks(s.text)) {
			leaked++
		}
	}
	if leaked == 0 {
		t.Fatal("with clean off, nothing showed the canary: the sweep is blind")
	}

	if !cleanAuth.suppressed {
		sdkerr, _ := err.(*sdk.${Name}Error)
		if sdkerr == nil {
			t.Fatalf("expected the SDK error, got %v", err)
		}
		raw, _ := json.Marshal(sdkerr.Spec)
		text := string(raw)
		composite := base64.StdEncoding.EncodeToString(
			[]byte(cleanCanary["apikey"] + ":" + cleanCanary["secret"]))
		if !strings.Contains(text, cleanCanary["apikey"]) && !strings.Contains(text, composite) {
			t.Errorf("the raw spec should carry the credential when clean is off, got %s", text)
		}
	}
}
`
}


export {
  TestClean
}
