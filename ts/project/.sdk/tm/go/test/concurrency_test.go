package sdktest

import (
	"fmt"
	"sync"
	"testing"

	sdk "GOMODULE"
)

// Requests in flight at once on one client. Each resolves its operation
// through the cache the client's root context shares with every request.

const concurrencyRounds = 200
const concurrencyWidth = 8
const concurrencyOps = 32

// concurrencyClient is a live client whose transport answers at once.
func concurrencyClient() *sdk.ProjectNameSDK {
	return sdk.NewProjectNameSDK(map[string]any{
		"base":  "http://concurrency.test/api",
		"allow": map[string]any{"op": "direct"},
		"system": map[string]any{
			"fetch": func(url string, fetchdef map[string]any) (map[string]any, error) {
				return map[string]any{
					"status":     200,
					"statusText": "OK",
					"headers":    map[string]any{},
					"json":       func() any { return map[string]any{"ok": true} },
				}, nil
			},
		},
	})
}

// atOnce runs body on concurrencyWidth goroutines released together.
func atOnce(body func(n int)) {
	var ready, done sync.WaitGroup
	start := make(chan struct{})
	ready.Add(concurrencyWidth)
	done.Add(concurrencyWidth)
	for i := 0; i < concurrencyWidth; i++ {
		go func(n int) {
			defer done.Done()
			ready.Done()
			<-start
			body(n)
		}(i)
	}
	ready.Wait()
	close(start)
	done.Wait()
}

func TestConcurrentFirstRequests(t *testing.T) {
	for round := 0; round < concurrencyRounds; round++ {
		// A fresh client each round, so every request in it is a first request.
		client := concurrencyClient()
		results := make([]map[string]any, concurrencyWidth)
		errs := make([]error, concurrencyWidth)
		atOnce(func(n int) {
			results[n], errs[n] = client.Direct(map[string]any{"path": fmt.Sprintf("p%d", n)})
		})
		for n := range results {
			if errs[n] != nil || results[n]["ok"] != true {
				t.Fatalf("round %d, request %d failed: %v %v", round, n, errs[n], results[n])
			}
		}
	}
}

func TestConcurrentOperationResolution(t *testing.T) {
	for round := 0; round < concurrencyRounds; round++ {
		client := concurrencyClient()
		utility := client.GetUtility()
		root := client.GetRootCtx()
		ops := make([][]*sdk.Operation, concurrencyWidth)
		atOnce(func(n int) {
			ops[n] = make([]*sdk.Operation, concurrencyOps)
			for k := range ops[n] {
				ops[n][k] = utility.MakeContext(map[string]any{"opname": fmt.Sprintf("op%d", k)}, root).Op
			}
		})
		for k := 0; k < concurrencyOps; k++ {
			cached := utility.MakeContext(map[string]any{"opname": fmt.Sprintf("op%d", k)}, root).Op
			for n := range ops {
				if ops[n][k] != cached {
					t.Fatalf("round %d: op%d resolved to more than one Operation", round, k)
				}
			}
		}
	}
}
