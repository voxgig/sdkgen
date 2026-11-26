package sdktest

// A templated base URL takes each {name} from the `server` option. A missing
// or empty value refuses construction; test mode fills in test-<name>.

import (
	"strings"
	"testing"

	sdk "GOMODULE"
)

// A variable no API declares, so the API's own server defaults cannot fill it.
const serverVarBase = "https://api.example.test/bot{zzvar}"

func TestServerVariableMissingOrEmptyRefusesConstruction(t *testing.T) {
	for _, server := range []map[string]any{{}, {"zzvar": ""}} {
		client, err := sdk.NewProjectNameSDK(map[string]any{"base": serverVarBase, "server": server})
		if nil != client || nil == err {
			t.Fatalf("construction should refuse without a value for zzvar: %v", server)
		}
		perr, ok := err.(*sdk.ProjectNameError)
		if !ok || "server_var_required" != perr.Code {
			t.Fatalf("expected a server_var_required error, got %#v", err)
		}
		if !strings.Contains(perr.Msg, "the server variable 'zzvar' is required") ||
			!strings.Contains(perr.Msg, serverVarBase) {
			t.Fatalf("the error should name the variable and quote the base URL: %s", perr.Msg)
		}
	}
}

func TestServerVariableFillsTheBase(t *testing.T) {
	client := newClient(map[string]any{"base": serverVarBase, "server": map[string]any{"zzvar": "T1"}})
	if base := client.OptionsMap()["base"]; "https://api.example.test/botT1" != base {
		t.Fatalf("a server value should fill the base: %v", base)
	}
}

func TestServerVariableTestModeFillsTheBase(t *testing.T) {
	client := newClient(map[string]any{"base": serverVarBase, "test": map[string]any{"active": true}})
	if base := client.OptionsMap()["base"]; "https://api.example.test/bottest-zzvar" != base {
		t.Fatalf("the test option should fill test-<name>: %v", base)
	}

	mock := sdk.TestSDK(nil, map[string]any{"base": serverVarBase})
	if base := mock.OptionsMap()["base"]; "https://api.example.test/bottest-zzvar" != base {
		t.Fatalf("the test feature should fill test-<name>: %v", base)
	}
}
