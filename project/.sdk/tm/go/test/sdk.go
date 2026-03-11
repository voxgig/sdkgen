package runner

import (
	"fmt"

	sdk "GOMODULE/sdk"
)

// testConfig provides default SDK configuration for tests.
var testConfig = map[string]any{
	"options": map[string]any{
		"headers": map[string]any{
			"content-type": "application/json",
			"accept":       "application/json",
		},
		"auth": map[string]any{
			"prefix": "Bearer",
		},
	},
}

// SDK is a Go implementation of the TypeScript SDK class
type SDK struct {
	opts     map[string]any
	mode     string
	features []any
	utility  *SDKUtility
	rootctx  map[string]any
}

// SDKUtility implements the Utility interface and provides all SDK utility functions
type SDKUtility struct {
	sdk     *SDK
	structu *StructUtility
}

// Struct returns the StructUtility
func (u *SDKUtility) Struct() *StructUtility {
	return u.structu
}

// MakeContext creates a new context from the given ctxmap.
func (u *SDKUtility) MakeContext(ctxmap map[string]any) map[string]any {
	return sdk.MakeContext(ctxmap)
}

// Check implements the check function for struct tests.
func (u *SDKUtility) Check(ctx map[string]any) map[string]any {
	zed := "ZED"
	if u.sdk.opts != nil {
		if foo, ok := u.sdk.opts["foo"]; ok && foo != nil {
			zed += fmt.Sprint(foo)
		}
	}
	zed += "_"

	if ctx == nil {
		zed += "0"
	} else if meta, ok := ctx["meta"].(map[string]any); ok && meta != nil {
		if bar, ok := meta["bar"]; ok && bar != nil {
			zed += fmt.Sprint(bar)
		} else {
			zed += "0"
		}
	} else {
		zed += "0"
	}

	return map[string]any{
		"zed": zed,
	}
}

// PrimaryUtility methods - these delegate to the sdk package functions.

func (u *SDKUtility) PrepareMethod(ctx map[string]any) string {
	return sdk.PrepareMethod(ctx)
}

func (u *SDKUtility) PrepareHeaders(ctx map[string]any) map[string]any {
	return sdk.PrepareHeaders(ctx)
}

func (u *SDKUtility) PrepareAuth(ctx map[string]any) (any, error) {
	return sdk.PrepareAuth(ctx)
}

func (u *SDKUtility) PrepareParams(ctx map[string]any) map[string]any {
	return sdk.PrepareParams(ctx)
}

func (u *SDKUtility) PrepareQuery(ctx map[string]any) map[string]any {
	return sdk.PrepareQuery(ctx)
}

func (u *SDKUtility) PrepareBody(ctx map[string]any) any {
	return sdk.PrepareBody(ctx)
}

func (u *SDKUtility) PreparePath(ctx map[string]any) string {
	return sdk.PreparePath(ctx)
}

func (u *SDKUtility) Param(ctx map[string]any, paramdef any) any {
	return sdk.Param(ctx, paramdef)
}

func (u *SDKUtility) MakeSpec(ctx map[string]any) (any, error) {
	return sdk.MakeSpec(ctx)
}

func (u *SDKUtility) MakeUrl(ctx map[string]any) (string, error) {
	return sdk.MakeUrl(ctx)
}

func (u *SDKUtility) MakeFetchDef(ctx map[string]any) (map[string]any, error) {
	return sdk.MakeFetchDef(ctx)
}

func (u *SDKUtility) MakeRequest(ctx map[string]any) (any, error) {
	return sdk.MakeRequest(ctx)
}

func (u *SDKUtility) MakeResponse(ctx map[string]any) (any, error) {
	return sdk.MakeResponse(ctx)
}

func (u *SDKUtility) MakeResult(ctx map[string]any) (any, error) {
	return sdk.MakeResult(ctx)
}

func (u *SDKUtility) MakeTarget(ctx map[string]any) (any, error) {
	return sdk.MakeTarget(ctx)
}

func (u *SDKUtility) MakeOptions(ctx map[string]any) map[string]any {
	return sdk.MakeOptions(ctx)
}

func (u *SDKUtility) MakeError(ctx map[string]any, errArgs ...any) (any, error) {
	return sdk.MakeError(ctx, errArgs...)
}

func (u *SDKUtility) Done(ctx map[string]any) (any, error) {
	return sdk.Done(ctx)
}

func (u *SDKUtility) Clean(ctx map[string]any, val any) any {
	return sdk.Clean(ctx, val)
}

func (u *SDKUtility) TransformRequest(ctx map[string]any) any {
	return sdk.TransformRequest(ctx)
}

func (u *SDKUtility) TransformResponse(ctx map[string]any) any {
	return sdk.TransformResponse(ctx)
}

func (u *SDKUtility) ResultBasic(ctx map[string]any) any {
	return sdk.ResultBasic(ctx)
}

func (u *SDKUtility) ResultBody(ctx map[string]any) any {
	return sdk.ResultBody(ctx)
}

func (u *SDKUtility) ResultHeaders(ctx map[string]any) any {
	return sdk.ResultHeaders(ctx)
}

func (u *SDKUtility) Fetcher(ctx map[string]any, url string, fetchdef map[string]any) (any, error) {
	return sdk.Fetcher(ctx, url, fetchdef)
}

func (u *SDKUtility) FeatureAdd(ctx map[string]any, f any) {
	sdk.FeatureAdd(ctx, f)
}

func (u *SDKUtility) FeatureHook(ctx map[string]any, name string) {
	sdk.FeatureHook(ctx, name)
}

func (u *SDKUtility) FeatureInit(ctx map[string]any, f any) {
	sdk.FeatureInit(ctx, f)
}

// NewSDK creates a new SDK instance with the given options
func NewSDK(opts map[string]any) *SDK {
	if opts == nil {
		opts = map[string]any{}
	}

	s := &SDK{
		opts:     opts,
		mode:     "live",
		features: []any{},
	}

	// Create the StructUtility
	structUtil := &StructUtility{
		IsNode:     sdk.IsNode,
		Clone:      sdk.Clone,
		CloneFlags: sdk.CloneFlags,
		GetPath:    sdk.GetPath,
		Inject:     sdk.Inject,
		Items:      sdk.Items,
		Stringify:  sdk.Stringify,
		Walk:       sdk.Walk,
	}

	// Create the utility
	s.utility = &SDKUtility{
		sdk:     s,
		structu: structUtil,
	}

	// Create root context with config for defaults
	s.rootctx = sdk.MakeContext(map[string]any{
		"client":  s,
		"utility": s.utility,
		"options": opts,
		"config":  testConfig,
	})

	// Process options through MakeOptions to apply defaults from config
	s.opts = sdk.MakeOptions(s.rootctx)
	s.rootctx["options"] = s.opts

	return s
}

// TestSDK creates a new SDK instance in test mode
func TestSDK(opts map[string]any) (*SDK, error) {
	s := NewSDK(opts)
	s.mode = "test"
	return s, nil
}

// Tester creates a new SDK instance with options or default options
func (s *SDK) Tester(opts map[string]any) (*SDK, error) {
	if opts == nil {
		opts = s.opts
	}
	return TestSDK(opts)
}

// Options returns the SDK options
func (s *SDK) Options() map[string]any {
	return s.opts
}

// Mode returns the SDK mode (live or test)
func (s *SDK) Mode() string {
	return s.mode
}

// Features returns the SDK features
func (s *SDK) Features() []any {
	return s.features
}

// SetFeatures sets the SDK features
func (s *SDK) SetFeatures(f []any) {
	s.features = f
}

// Utility returns the utility object
func (s *SDK) Utility() Utility {
	return s.utility
}
