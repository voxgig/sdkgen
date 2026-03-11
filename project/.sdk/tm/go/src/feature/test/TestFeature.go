package test

import (
	"fmt"
	"math/rand"
)

// TestFeature provides a mock fetcher for testing.
type TestFeature struct {
	Version string
	Name    string
	Active  bool
	client  any
	options map[string]any
}

// NewTestFeature creates a new TestFeature.
func NewTestFeature() *TestFeature {
	return &TestFeature{
		Version: "0.0.1",
		Name:    "test",
		Active:  true,
	}
}

// Init initializes the test feature with a mock fetcher.
func (f *TestFeature) Init(ctx map[string]any, options map[string]any) {
	f.client = ctx["client"]
	f.options = options

	entity, _ := options["entity"].(map[string]any)
	if entity == nil {
		entity = map[string]any{}
	}

	// Mock fetcher that simulates CRUD operations.
	mockFetcher := func(ctx map[string]any, fullurl string, fetchdef map[string]any) (any, error) {
		op, _ := ctx["op"].(map[string]any)
		if op == nil {
			return map[string]any{"status": float64(500)}, nil
		}

		opname, _ := op["name"].(string)
		opentity, _ := op["entity"].(string)
		entmap, _ := entity[opentity].(map[string]any)
		if entmap == nil {
			entmap = map[string]any{}
		}

		switch opname {
		case "load":
			reqmatch, _ := ctx["reqmatch"].(map[string]any)
			id, _ := reqmatch["id"].(string)
			if ent, ok := entmap[id]; ok {
				return map[string]any{
					"status":     float64(200),
					"statusText": "OK",
					"body":       ent,
				}, nil
			}
			return map[string]any{
				"status":     float64(404),
				"statusText": "Not found",
			}, nil

		case "list":
			results := []any{}
			for _, v := range entmap {
				results = append(results, v)
			}
			return map[string]any{
				"status":     float64(200),
				"statusText": "OK",
				"body":       results,
			}, nil

		case "create":
			reqdata, _ := ctx["reqdata"].(map[string]any)
			if reqdata == nil {
				reqdata = map[string]any{}
			}
			id, _ := reqdata["id"].(string)
			if id == "" {
				id = fmt.Sprintf("%04x%04x%04x%04x",
					rand.Intn(0x10000), rand.Intn(0x10000),
					rand.Intn(0x10000), rand.Intn(0x10000))
			}
			reqdata["id"] = id
			entmap[id] = reqdata
			return map[string]any{
				"status":     float64(200),
				"statusText": "OK",
				"body":       reqdata,
			}, nil

		case "update":
			reqdata, _ := ctx["reqdata"].(map[string]any)
			if reqdata == nil {
				reqdata = map[string]any{}
			}
			id, _ := reqdata["id"].(string)
			if ent, ok := entmap[id].(map[string]any); ok {
				for k, v := range reqdata {
					ent[k] = v
				}
				return map[string]any{
					"status":     float64(200),
					"statusText": "OK",
					"body":       ent,
				}, nil
			}
			return map[string]any{
				"status":     float64(404),
				"statusText": "Not found",
			}, nil

		case "remove":
			reqmatch, _ := ctx["reqmatch"].(map[string]any)
			id, _ := reqmatch["id"].(string)
			if _, ok := entmap[id]; ok {
				delete(entmap, id)
				return map[string]any{
					"status":     float64(200),
					"statusText": "OK",
				}, nil
			}
			return map[string]any{
				"status":     float64(404),
				"statusText": "Not found",
			}, nil
		}

		return map[string]any{"status": float64(400)}, nil
	}

	ctx["fetcher"] = mockFetcher
}

// PostConstruct is called after SDK construction.
func (f *TestFeature) PostConstruct(ctx map[string]any) {}

// PostConstructEntity is called after entity construction.
func (f *TestFeature) PostConstructEntity(ctx map[string]any) {}

// SetData is called when entity data is set.
func (f *TestFeature) SetData(ctx map[string]any) {}

// GetData is called when entity data is retrieved.
func (f *TestFeature) GetData(ctx map[string]any) {}

// GetMatch is called when entity match is retrieved.
func (f *TestFeature) GetMatch(ctx map[string]any) {}

// PreTarget is called before target resolution.
func (f *TestFeature) PreTarget(ctx map[string]any) {}

// PreSpec is called before spec construction.
func (f *TestFeature) PreSpec(ctx map[string]any) {}

// PreRequest is called before request construction.
func (f *TestFeature) PreRequest(ctx map[string]any) {}

// PreResponse is called before response processing.
func (f *TestFeature) PreResponse(ctx map[string]any) {}

// PreResult is called before result construction.
func (f *TestFeature) PreResult(ctx map[string]any) {}

// PostOperation is called after operation completes.
func (f *TestFeature) PostOperation(ctx map[string]any) {}
