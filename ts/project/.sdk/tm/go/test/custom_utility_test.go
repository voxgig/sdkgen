package sdktest

import (
	"testing"

	sdk "GOMODULE"
)

func TestCustomUtility(t *testing.T) {
	t.Run("basic", func(t *testing.T) {
		client := sdk.TestSDK(nil, map[string]any{
			"apikey": "APIKEY01",
			"utility": map[string]any{
				"auth":       func() map[string]any { return map[string]any{"util": "AUTH"} },
				"body":       func() map[string]any { return map[string]any{"util": "BODY"} },
				"contextify": func() map[string]any { return map[string]any{"util": "CONTEXTIFY"} },
				"done":       func() map[string]any { return map[string]any{"util": "DONE"} },
				"error":      func() map[string]any { return map[string]any{"util": "ERROR"} },
				"findparam":  func() map[string]any { return map[string]any{"util": "FINDPARAM"} },
				"fullurl":    func() map[string]any { return map[string]any{"util": "FULLURL"} },
				"headers":    func() map[string]any { return map[string]any{"util": "HEADERS"} },
				"method":     func() map[string]any { return map[string]any{"util": "METHOD"} },
				"operator":   func() map[string]any { return map[string]any{"util": "OPERATOR"} },
				"params":     func() map[string]any { return map[string]any{"util": "PARAMS"} },
				"query":      func() map[string]any { return map[string]any{"util": "QUERY"} },
				"reqform":    func() map[string]any { return map[string]any{"util": "REQFORM"} },
				"request":    func() map[string]any { return map[string]any{"util": "REQUEST"} },
				"resbasic":   func() map[string]any { return map[string]any{"util": "RESBASIC"} },
				"resbody":    func() map[string]any { return map[string]any{"util": "RESBODY"} },
				"resform":    func() map[string]any { return map[string]any{"util": "RESFORM"} },
				"resheaders": func() map[string]any { return map[string]any{"util": "RESHEADERS"} },
				"response":   func() map[string]any { return map[string]any{"util": "RESPONSE"} },
				"result":     func() map[string]any { return map[string]any{"util": "RESULT"} },
				"spec":       func() map[string]any { return map[string]any{"util": "SPEC"} },
			},
		})

		u := client.GetUtility()

		checks := map[string]string{
			"auth":       "AUTH",
			"body":       "BODY",
			"contextify": "CONTEXTIFY",
			"done":       "DONE",
			"error":      "ERROR",
			"findparam":  "FINDPARAM",
			"fullurl":    "FULLURL",
			"headers":    "HEADERS",
			"method":     "METHOD",
			"operator":   "OPERATOR",
			"params":     "PARAMS",
			"query":      "QUERY",
			"reqform":    "REQFORM",
			"request":    "REQUEST",
			"resbasic":   "RESBASIC",
			"resbody":    "RESBODY",
			"resform":    "RESFORM",
			"resheaders": "RESHEADERS",
			"response":   "RESPONSE",
			"result":     "RESULT",
			"spec":       "SPEC",
		}

		for key, expected := range checks {
			fn, ok := u.Custom[key]
			if !ok {
				t.Errorf("expected custom utility %q to exist", key)
				continue
			}
			if f, ok := fn.(func() map[string]any); ok {
				result := f()
				if result["util"] != expected {
					t.Errorf("custom utility %q: got %v, want %v", key, result["util"], expected)
				}
			} else {
				t.Errorf("custom utility %q: expected func() map[string]any, got %T", key, fn)
			}
		}
	})

	// The half the subtest above cannot see. Those keys are ALIASES - `auth`,
	// `body`, `spec` - and no utility member has those names, so landing in
	// Custom is the right outcome for them and the assertion passes whether or
	// not overriding works at all.
	//
	// A key that DOES name a member must replace it. That is the documented
	// contract, it is what ts does, and it was silently absent here: every
	// entry went to Custom, which nothing reads, so `utility: {"fetcher": ...}`
	// did nothing while ts honoured it.
	t.Run("a real utility member is replaced, not shelved", func(t *testing.T) {
		reached := 0
		scripted := func(ctx *sdk.Context, fullurl string, fetchdef map[string]any) (any, error) {
			reached++
			return map[string]any{
				"status":     200,
				"statusText": "OK",
				"headers":    map[string]any{},
				"body":       map[string]any{"ok": true},
			}, nil
		}

		// NewDemoSDK, not TestSDK. The `test` feature is transport: 'base' - it
		// REPLACES the transport by design - so a client in test mode would
		// shadow the scripted fetcher and this would assert nothing.
		client := sdk.NewDemoSDK(map[string]any{
			"utility": map[string]any{"fetcher": sdk.FetcherFunc(scripted)},
		})

		u := client.GetUtility()

		if u.Fetcher == nil {
			t.Fatal("Fetcher is nil")
		}
		if _, shelved := u.Custom["fetcher"]; shelved {
			t.Error("fetcher was shelved in Custom instead of replacing the member")
		}

		// Behaviour, not identity: a func value cannot be compared, so drive it.
		ctx := u.MakeContext(map[string]any{}, client.GetRootCtx())
		if _, err := u.Fetcher(ctx, "http://example.test/probe", map[string]any{}); err != nil {
			t.Fatalf("scripted fetcher returned an error: %v", err)
		}
		if reached != 1 {
			t.Errorf("the scripted fetcher was not installed: reached %d times, want 1", reached)
		}
	})

	// An unknown key must still be attached rather than dropped, so the two
	// halves cannot be satisfied by a switch that also swallows extras.
	t.Run("an unknown key is still attached", func(t *testing.T) {
		client := sdk.NewDemoSDK(map[string]any{
			"utility": map[string]any{
				"notAUtilityMember": func() string { return "EXTRA" },
			},
		})
		if _, ok := client.GetUtility().Custom["notAUtilityMember"]; !ok {
			t.Error("an unknown utility key was dropped instead of kept in Custom")
		}
	})
}
