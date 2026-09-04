// Behavioural tests for the secrets feature (vendored @voxgig/sekreto) -
// the go port of tm/ts/test/feature/secrets/Secrets.test.ts.
//
// The contract under test: the `apikey` OPTION keeps its exact old meaning
// and always wins, because SecretsFeature places it FIRST in the provider
// chain (a `memory` store named `options`) - explicit-beats-lookup falls
// out of sekreto's first-hit rule rather than from special-case logic.
// With the feature inactive nothing changes at all. With it active and the
// option unset, the chain (env, a custom provider, a vault) supplies the
// credential instead.
//
// This file lives in the test `feature/` container on purpose: `target
// add` trims it, along with the feature source and the vendored library,
// for a project whose model does not select `secrets`.
//
// The feature is CONSTRUCTED DIRECTLY and handed in through the
// `extend` option, so these tests hold in any generated tree - whether or
// not the project's model activated the feature (activation only changes
// whether config.go registers a constructor for it). The credential is
// asserted ON THE WIRE: a live-mode client with a recording system.fetch,
// driven through a real entity operation, which is what exercises the
// PreSpec resolution seam. (See the migration guide: an options-level
// assertion passes for a port that never consults the value.)

package secretstest

import (
	"fmt"
	"os"
	"reflect"
	"strings"
	"sync"
	"testing"
	"unicode"

	sdk "GOMODULE"
	feat "GOMODULE/feature"
)

const envprefix = "PROJECTENV_TEST_SECRETS_"

// ---------------------------------------------------------------------
// The recording transport: system.fetch for a LIVE client, scripting one
// status per API call (the last repeating) and a token endpoint for the
// exchange tests.

type wirecall struct {
	url  string
	auth string
	has  bool
	body string
}

type wire struct {
	mu        sync.Mutex
	calls     []wirecall
	apistatus []int
	tokens    []string
	tokenpath string
	respfield string
	issued    int
	apicalls  int
}

func makewire() *wire {
	return &wire{
		apistatus: []int{200},
		tokens:    []string{"ACCESS01", "ACCESS02", "ACCESS03"},
		tokenpath: "auth/token",
		respfield: "access_token",
	}
}

func (w *wire) fetch(url string, fetchdef map[string]any) (map[string]any, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	auth := ""
	has := false
	if headers, is := fetchdef["headers"].(map[string]any); is {
		if v, found := headers["authorization"]; found {
			auth, _ = v.(string)
			has = true
		}
	}
	body, _ := fetchdef["body"].(string)
	w.calls = append(w.calls, wirecall{url: url, auth: auth, has: has, body: body})

	if strings.HasSuffix(url, "/"+w.tokenpath) {
		token := w.tokens[min(w.issued, len(w.tokens)-1)]
		w.issued++
		payload := map[string]any{w.respfield: token}
		return map[string]any{
			"status": 200, "statusText": "OK",
			"headers": map[string]any{},
			"json":    (func() any)(func() any { return payload }),
		}, nil
	}

	status := w.apistatus[min(w.apicalls, len(w.apistatus)-1)]
	w.apicalls++
	payload := map[string]any{"ok": status < 400}
	return map[string]any{
		"status": status, "statusText": "X",
		"headers": map[string]any{},
		"json":    (func() any)(func() any { return payload }),
	}, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// api returns the recorded calls that did NOT go to the token endpoint.
func (w *wire) api() []wirecall {
	w.mu.Lock()
	defer w.mu.Unlock()
	out := []wirecall{}
	for _, c := range w.calls {
		if !strings.HasSuffix(c.url, "/"+w.tokenpath) {
			out = append(out, c)
		}
	}
	return out
}

func (w *wire) token() []wirecall {
	w.mu.Lock()
	defer w.mu.Unlock()
	out := []wirecall{}
	for _, c := range w.calls {
		if strings.HasSuffix(c.url, "/"+w.tokenpath) {
			out = append(out, c)
		}
	}
	return out
}

// ---------------------------------------------------------------------
// Support.

// The Authorization header carries the SPEC's credential prefix, which a
// TEMPLATE cannot know - so assert on the CREDENTIAL and let the prefix be
// whatever this SDK's API declares.
func credentialIs(t *testing.T, header string, token string) {
	t.Helper()
	if header != token && !strings.HasSuffix(header, " "+token) {
		t.Fatalf("expected the authorization header to carry %s, got: %q", token, header)
	}
}

// secretsClient builds a LIVE client carrying the secrets feature via the
// `extend` seam, wired to the recording transport.
func secretsClient(w *wire, sdkopts map[string]any) *sdk.ProjectNameSDK {
	opts := map[string]any{
		"base":   "http://secrets.test/api",
		"system": map[string]any{"fetch": w.fetch},
		"extend": []any{feat.NewSecretsFeature()},
	}
	for k, v := range sdkopts {
		opts[k] = v
	}
	return sdk.NewProjectNameSDK(opts)
}

func secretsOpts(extra map[string]any) map[string]any {
	fopts := map[string]any{
		"active": true,
		"providers": []any{
			map[string]any{"kind": "env", "prefix": envprefix},
		},
	}
	for k, v := range extra {
		fopts[k] = v
	}
	return map[string]any{"secrets": fopts}
}

// secretsFeatureOf digs the live feature back out of the client, for
// assertions against its Sekreto instance.
func secretsFeatureOf(client *sdk.ProjectNameSDK) *feat.SecretsFeature {
	for _, f := range client.Features {
		if sf, is := f.(*feat.SecretsFeature); is {
			return sf
		}
	}
	return nil
}

// driveEntityOpUntil performs real entity operations - which is what runs
// the PreSpec hook - until `stop` reports the observable state a test is
// waiting for. Each op's own outcome is irrelevant (no seeded data, a
// scripted response); an op the API does not define fails BEFORE the
// PreSpec hook, which is why several may need driving. Entity names come
// from the SDK's own config, because this file is a TEMPLATE and no
// project's entity names are known here.
func driveEntityOpUntil(t *testing.T, client *sdk.ProjectNameSDK, what string, stop func() bool) {
	t.Helper()

	entities, _ := client.OptionsMap()["entity"].(map[string]any)
	clientval := reflect.ValueOf(client)

	for name := range entities {
		runes := []rune(name)
		runes[0] = unicode.ToUpper(runes[0])
		accessor := clientval.MethodByName(string(runes))
		if !accessor.IsValid() || 1 != accessor.Type().NumIn() {
			continue
		}

		ent := accessor.Call([]reflect.Value{
			reflect.Zero(accessor.Type().In(0)),
		})[0]

		for _, opname := range []string{"List", "Load"} {
			op := ent.MethodByName(opname)
			if !op.IsValid() {
				continue
			}
			in := make([]reflect.Value, op.Type().NumIn())
			for i := range in {
				in[i] = reflect.Zero(op.Type().In(i))
			}
			op.Call(in)

			if stop() {
				return
			}
		}
	}

	t.Fatalf("no entity operation %s - nothing to assert on", what)
}

// driveEntityOp drives ops until one request reached the recorder.
func driveEntityOp(t *testing.T, client *sdk.ProjectNameSDK, w *wire) {
	t.Helper()
	before := len(w.api())
	driveEntityOpUntil(t, client, "reached the transport", func() bool {
		return before < len(w.api())
	})
}

// ---------------------------------------------------------------------
// The feature-inactive baseline: bit-identical behaviour.

func TestSecretsInactive(t *testing.T) {

	t.Run("apikey option behaves exactly as before", func(t *testing.T) {
		client := sdk.TestSDK(nil, map[string]any{"apikey": "OPTKEY01"})
		fetchdef, err := client.Prepare(map[string]any{"path": "/"})
		if err != nil {
			t.Fatalf("prepare failed: %v", err)
		}
		headers, _ := fetchdef["headers"].(map[string]any)
		auth, _ := headers["authorization"].(string)
		credentialIs(t, auth, "OPTKEY01")

		if nil != secretsFeatureOf(client) {
			t.Fatal("no model activation, no extend: the feature must not be installed")
		}
	})

	t.Run("no apikey means no authorization header", func(t *testing.T) {
		client := sdk.TestSDK(nil, nil)
		fetchdef, err := client.Prepare(map[string]any{"path": "/"})
		if err != nil {
			t.Fatalf("prepare failed: %v", err)
		}
		headers, _ := fetchdef["headers"].(map[string]any)
		if _, has := headers["authorization"]; has {
			t.Fatalf("unexpected authorization header: %v", headers["authorization"])
		}
	})
}

// ---------------------------------------------------------------------
// Active: the provider chain, driven through real entity operations.

func TestSecretsChain(t *testing.T) {

	t.Run("apikey option still wins over the chain", func(t *testing.T) {
		os.Setenv(envprefix+"APIKEY", "ENVKEY01")
		defer os.Unsetenv(envprefix + "APIKEY")

		w := makewire()
		client := secretsClient(w, map[string]any{
			"apikey":  "OPTKEY01",
			"feature": secretsOpts(nil),
		})

		driveEntityOp(t, client, w)
		call := w.api()[0]
		credentialIs(t, call.auth, "OPTKEY01")

		// The explicit option is a real store, not a special case: a
		// directed read names it like any other.
		sf := secretsFeatureOf(client)
		if nil == sf {
			t.Fatal("the extend seam did not install the feature")
		}
		found, err := sf.Sekreto().GetFrom("options", "apikey")
		if err != nil || "OPTKEY01" != found {
			t.Fatalf("directed read of the options store: %q, %v", found, err)
		}
	})

	t.Run("an omitted apikey defers to the chain via PreSpec", func(t *testing.T) {
		os.Setenv(envprefix+"APIKEY", "ENVKEY02")
		defer os.Unsetenv(envprefix + "APIKEY")

		w := makewire()
		client := secretsClient(w, map[string]any{"feature": secretsOpts(nil)})

		// Before any op, nothing has been resolved.
		if v, _ := client.OptionsMap()["apikey"].(string); "" != v {
			t.Fatalf("apikey resolved before any operation: %q", v)
		}

		driveEntityOp(t, client, w)

		// The awaited PreSpec seam ran before the spec was built: the
		// credential is on the wire, not merely in the options.
		credentialIs(t, w.api()[0].auth, "ENVKEY02")
		if v, _ := client.OptionsMap()["apikey"].(string); "ENVKEY02" != v {
			t.Fatalf("the entity op did not resolve the secret through PreSpec: %q", v)
		}
	})

	t.Run("custom provider objects are accepted verbatim", func(t *testing.T) {
		asked := []string{}
		w := makewire()
		client := secretsClient(w, map[string]any{
			"feature": map[string]any{"secrets": map[string]any{
				"active": true,
				"providers": []any{
					&customProvider{
						lookup: func(name string) (string, bool, error) {
							asked = append(asked, name)
							return "CUSTOM01", true, nil
						},
					},
				},
			}},
		})

		driveEntityOp(t, client, w)
		credentialIs(t, w.api()[0].auth, "CUSTOM01")
		if 1 > len(asked) || "apikey" != asked[0] {
			t.Fatalf("the custom provider was asked %v, want [apikey ...]", asked)
		}
	})

	t.Run("a miss everywhere leaves the header off", func(t *testing.T) {
		os.Unsetenv(envprefix + "APIKEY")

		w := makewire()
		client := secretsClient(w, map[string]any{"feature": secretsOpts(nil)})

		driveEntityOp(t, client, w)
		call := w.api()[0]
		if call.has {
			t.Fatalf("a chain MISS must fall through to an unauthenticated request, got header %q", call.auth)
		}
	})

	t.Run("a provider ERROR fails the op and nothing reaches the wire", func(t *testing.T) {
		asked := false
		w := makewire()
		client := secretsClient(w, map[string]any{
			"feature": map[string]any{"secrets": map[string]any{
				"active": true,
				"providers": []any{
					&customProvider{
						lookup: func(name string) (string, bool, error) {
							asked = true
							return "", false, fmt.Errorf("vault unreachable")
						},
					},
				},
			}},
		})

		driveEntityOpUntil(t, client, "consulted the chain", func() bool {
			return asked
		})

		if 0 != len(w.api()) {
			t.Fatalf("a broken vault must never yield a request: %d calls went out", len(w.api()))
		}
	})

	t.Run("a provider recovers after a transient failure", func(t *testing.T) {
		calls := 0
		w := makewire()
		client := secretsClient(w, map[string]any{
			"feature": map[string]any{"secrets": map[string]any{
				"active": true,
				"providers": []any{
					&customProvider{
						lookup: func(name string) (string, bool, error) {
							calls++
							if 1 == calls {
								return "", false, fmt.Errorf("vault unreachable")
							}
							return "RECOVERED01", true, nil
						},
					},
				},
			}},
		})

		// First op fails closed; a failed resolution is never cached, so
		// the second op asks the chain again and succeeds.
		driveEntityOpUntil(t, client, "consulted the chain", func() bool {
			return 0 < calls
		})
		if 0 != len(w.api()) {
			t.Fatal("the first op must not reach the wire")
		}

		driveEntityOp(t, client, w)
		credentialIs(t, w.api()[0].auth, "RECOVERED01")
	})

	t.Run("auth nil suppresses the credential, chain or no chain", func(t *testing.T) {
		os.Setenv(envprefix+"APIKEY", "ENVKEY03")
		defer os.Unsetenv(envprefix + "APIKEY")

		w := makewire()
		client := secretsClient(w, map[string]any{
			"auth":    nil,
			"apikey":  "OPTKEY01",
			"feature": secretsOpts(nil),
		})

		driveEntityOp(t, client, w)

		// Nothing on the wire, even though the chain would have resolved:
		// go's vendored struct treats a stored null as "no value"
		// (fail-OPEN class), and makeOptions captures suppliedness before
		// validate and restores the null after - the guard this pins.
		call := w.api()[0]
		if call.has {
			t.Fatalf("auth nil must suppress the credential, got header %q", call.auth)
		}

		// The suppression survives option validation rather than being
		// replaced by the optspec's default auth map.
		opts := client.OptionsMap()
		authval, authgiven := opts["auth"]
		if !authgiven || nil != authval {
			t.Fatalf("options.auth must stay a present null, got (%v, present=%v)", authval, authgiven)
		}
	})
}

// customProvider is a sekreto.Provider built in code (the interface is
// structural: Lookup + Describe).
type customProvider struct {
	lookup func(name string) (string, bool, error)
}

func (p *customProvider) Lookup(name string) (string, bool, error) {
	return p.lookup(name)
}

func (p *customProvider) Describe() string { return "custom:test" }

// ---------------------------------------------------------------------
// The access-token exchange.

func TestSecretsExchange(t *testing.T) {

	t.Run("the refresh token buys an access token, and a spent one is rebought once", func(t *testing.T) {
		os.Setenv(envprefix+"REFRESH_TOKEN", "REFRESH01")
		defer os.Unsetenv(envprefix + "REFRESH_TOKEN")

		// First API call is refused, the retry succeeds.
		w := makewire()
		w.apistatus = []int{401, 200}

		client := secretsClient(w, map[string]any{
			"feature": secretsOpts(map[string]any{
				"name":     "refresh_token",
				"exchange": map[string]any{"active": true},
			}),
		})

		driveEntityOp(t, client, w)

		if 2 != len(w.token()) {
			t.Fatalf("expected the initial purchase plus one rebuy, got %d", len(w.token()))
		}
		if !strings.Contains(w.token()[0].body, "REFRESH01") {
			t.Fatalf("the refresh token is sent in the request body, got %q", w.token()[0].body)
		}

		api := w.api()
		if 2 != len(api) {
			t.Fatalf("expected the request to be retried exactly once, got %d calls", len(api))
		}
		credentialIs(t, api[0].auth, "ACCESS01")
		// The retry must carry the NEW token, not the spent one.
		credentialIs(t, api[1].auth, "ACCESS02")
	})

	t.Run("test mode buys nothing and needs no token endpoint", func(t *testing.T) {
		os.Setenv(envprefix+"REFRESH_TOKEN", "REFRESH01")
		defer os.Unsetenv(envprefix + "REFRESH_TOKEN")

		w := makewire()
		client := sdk.TestSDK(nil, map[string]any{
			"system": map[string]any{"fetch": w.fetch},
			"extend": []any{feat.NewSecretsFeature()},
			"feature": secretsOpts(map[string]any{
				"name":     "refresh_token",
				"exchange": map[string]any{"active": true},
			}),
		})

		driveEntityOpUntil(t, client, "resolved the fake token", func() bool {
			v, _ := client.OptionsMap()["apikey"].(string)
			return "" != v
		})

		if 0 != len(w.calls) {
			t.Fatalf("test mode must not do IO, saw %d calls", len(w.calls))
		}
		// A deterministic placeholder, so offline suites need no
		// configuration.
		if v, _ := client.OptionsMap()["apikey"].(string); "test-access_token" != v {
			t.Fatalf("expected the fake test token, got %q", v)
		}
	})
}
