package log

import (
	"fmt"
)

// LogFeature provides logging for SDK operations.
type LogFeature struct {
	Version string
	Name    string
	Active  bool
	client  any
	options map[string]any
	level   string
}

// NewLogFeature creates a new LogFeature.
func NewLogFeature() *LogFeature {
	return &LogFeature{
		Version: "0.0.1",
		Name:    "log",
		Active:  true,
		level:   "info",
	}
}

// Init initializes the log feature.
func (f *LogFeature) Init(ctx map[string]any, options map[string]any) {
	f.client = ctx["client"]
	f.options = options

	if level, ok := options["level"].(string); ok {
		f.level = level
	}
}

func (f *LogFeature) loghook(hook string, ctx map[string]any) {
	if f.Active {
		fmt.Printf("[%s] %s\n", f.level, hook)
	}
}

// PostConstruct is called after SDK construction.
func (f *LogFeature) PostConstruct(ctx map[string]any) { f.loghook("PostConstruct", ctx) }

// PostConstructEntity is called after entity construction.
func (f *LogFeature) PostConstructEntity(ctx map[string]any) {
	f.loghook("PostConstructEntity", ctx)
}

// SetData is called when entity data is set.
func (f *LogFeature) SetData(ctx map[string]any) { f.loghook("SetData", ctx) }

// GetData is called when entity data is retrieved.
func (f *LogFeature) GetData(ctx map[string]any) { f.loghook("GetData", ctx) }

// GetMatch is called when entity match is retrieved.
func (f *LogFeature) GetMatch(ctx map[string]any) { f.loghook("GetMatch", ctx) }

// PreTarget is called before target resolution.
func (f *LogFeature) PreTarget(ctx map[string]any) { f.loghook("PreTarget", ctx) }

// PreSpec is called before spec construction.
func (f *LogFeature) PreSpec(ctx map[string]any) { f.loghook("PreSpec", ctx) }

// PreRequest is called before request construction.
func (f *LogFeature) PreRequest(ctx map[string]any) { f.loghook("PreRequest", ctx) }

// PreResponse is called before response processing.
func (f *LogFeature) PreResponse(ctx map[string]any) { f.loghook("PreResponse", ctx) }

// PreResult is called before result construction.
func (f *LogFeature) PreResult(ctx map[string]any) { f.loghook("PreResult", ctx) }

// PostOperation is called after operation completes.
func (f *LogFeature) PostOperation(ctx map[string]any) { f.loghook("PostOperation", ctx) }
