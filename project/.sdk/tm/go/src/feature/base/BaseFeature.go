package base

// BaseFeature provides base feature hooks for the SDK.
type BaseFeature struct {
	Version string
	Name    string
	Active  bool
}

// NewBaseFeature creates a new BaseFeature.
func NewBaseFeature() *BaseFeature {
	return &BaseFeature{
		Version: "0.0.1",
		Name:    "base",
		Active:  true,
	}
}

// Init initializes the feature.
func (f *BaseFeature) Init(ctx map[string]any, options map[string]any) {}

// PostConstruct is called after SDK construction.
func (f *BaseFeature) PostConstruct(ctx map[string]any) {}

// PostConstructEntity is called after entity construction.
func (f *BaseFeature) PostConstructEntity(ctx map[string]any) {}

// SetData is called when entity data is set.
func (f *BaseFeature) SetData(ctx map[string]any) {}

// GetData is called when entity data is retrieved.
func (f *BaseFeature) GetData(ctx map[string]any) {}

// GetMatch is called when entity match is retrieved.
func (f *BaseFeature) GetMatch(ctx map[string]any) {}

// PreTarget is called before target resolution.
func (f *BaseFeature) PreTarget(ctx map[string]any) {}

// PreSpec is called before spec construction.
func (f *BaseFeature) PreSpec(ctx map[string]any) {}

// PreRequest is called before request construction.
func (f *BaseFeature) PreRequest(ctx map[string]any) {}

// PreResponse is called before response processing.
func (f *BaseFeature) PreResponse(ctx map[string]any) {}

// PreResult is called before result construction.
func (f *BaseFeature) PreResult(ctx map[string]any) {}

// PostOperation is called after operation completes.
func (f *BaseFeature) PostOperation(ctx map[string]any) {}
