package core

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"reflect"
	"sort"
	"strconv"
	"strings"
)

// File content a caller hands the SDK, held as given. A string is content,
// sent encoded as UTF-8: nothing here reads a path.
type BinarySource struct {
	Data []byte
	Name string
	Type string
}

func (s *BinarySource) Size() int {
	return len(s.Data)
}

// A source serialised anywhere is described, never copied.
func (s *BinarySource) MarshalJSON() ([]byte, error) {
	desc := map[string]any{"binary$": "bytes", "size": s.Size()}
	if "" != s.Type {
		desc["type"] = s.Type
	}
	return json.Marshal(desc)
}

func (s *BinarySource) String() string {
	desc, _ := s.MarshalJSON()
	return "BinarySource " + string(desc)
}

func (s *BinarySource) GoString() string {
	return s.String()
}

// BinaryMaker builds the one source core has: bytes, or a string's UTF-8.
type BinaryMaker struct{}

func (BinaryMaker) Bytes(data any, opts map[string]any) *BinarySource {
	src := &BinarySource{Data: ToBytes(data)}
	if name, ok := opts["name"].(string); ok {
		src.Name = name
	}
	if mtype, ok := opts["type"].(string); ok {
		src.Type = mtype
	}
	return src
}

// The slot and direction a binary handle moves bytes in; a read leaves them
// in Bytes.
type Transfer struct {
	Slot      string
	Direction string
	Bytes     []byte
}

// An encoder's answer: the body and the content type it was encoded for.
type Encoded struct {
	Type string
	Body any
}

// The body codecs an SDK was generated with; an absent codec is nil.
type Codec struct {
	Form      func(ctx *Context, data any, lifted map[string]any) (*Encoded, error)
	Multipart func(ctx *Context, data any, lifted map[string]any) (*Encoded, error)
	Raw       func(ctx *Context) error
}

func AsSource(value any) (*BinarySource, bool) {
	switch src := value.(type) {
	case *BinarySource:
		return src, nil != src
	case BinarySource:
		return &src, true
	}
	return nil, false
}

func IsBytes(value any) bool {
	_, ok := value.([]byte)
	return ok
}

func IsStream(value any) bool {
	_, ok := value.(io.Reader)
	return ok
}

func ToBytes(value any) []byte {
	switch v := value.(type) {
	case []byte:
		return v
	case string:
		return []byte(v)
	case nil:
		return []byte{}
	}
	return []byte(ItemText(value))
}

// A plain value as the text of a form pair or a multipart part. A map is
// compact JSON with its keys sorted, as encoding/json writes every map.
func ItemText(value any) string {
	switch v := value.(type) {
	case string:
		return v
	case bool:
		return strconv.FormatBool(v)
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return fmt.Sprint(v)
	case float32:
		return numberText(float64(v))
	case float64:
		return numberText(v)
	case json.Number:
		return v.String()
	}
	var out bytes.Buffer
	enc := json.NewEncoder(&out)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(value); err != nil {
		return fmt.Sprint(value)
	}
	return strings.TrimSuffix(out.String(), "\n")
}

// The shortest text that reads back as the number, with an exponent only
// where JavaScript would write one.
func numberText(f float64) string {
	abs := math.Abs(f)
	if 0 == f || (1e-7 <= abs && abs < 1e21) {
		return strconv.FormatFloat(f, 'f', -1, 64)
	}
	text := strconv.FormatFloat(f, 'e', -1, 64)
	mant, exp, _ := strings.Cut(text, "e")
	sign := exp[:1]
	digits := strings.TrimLeft(exp[1:], "0")
	return mant + "e" + sign + digits
}

// One value a form or multipart body carries, under its name.
type BodyItem struct {
	Name   string
	Field  map[string]any
	Value  any
	Binary bool
}

// A list the caller passed, whatever its element type; bytes are one value.
func listItems(value any) ([]any, bool) {
	if list, ok := value.([]any); ok {
		return list, true
	}
	rv := reflect.ValueOf(value)
	if !rv.IsValid() || (reflect.Slice != rv.Kind() && reflect.Array != rv.Kind()) ||
		reflect.Uint8 == rv.Type().Elem().Kind() {
		return nil, false
	}
	out := make([]any, rv.Len())
	for i := range out {
		out[i] = rv.Index(i).Interface()
	}
	return out, true
}

func isNil(value any) bool {
	if nil == value {
		return true
	}
	rv := reflect.ValueOf(value)
	switch rv.Kind() {
	case reflect.Map, reflect.Ptr, reflect.Slice, reflect.Interface, reflect.Func, reflect.Chan:
		return rv.IsNil()
	}
	return false
}

// The values a form or multipart body carries, in wire order: the fields the
// model declares, in its order, then any other key of the data, in code point
// order. A list repeats its field per item, or is one value joined by the
// field's `join`; an absent or nil value sends nothing.
func BodyItems(body any, data any, lifted map[string]any) []BodyItem {
	fields := []map[string]any{}
	if bm, ok := body.(map[string]any); ok {
		if fl, ok := bm["fields"].([]any); ok {
			for _, f := range fl {
				if fm, ok := f.(map[string]any); ok {
					if _, named := fm["name"].(string); named {
						fields = append(fields, fm)
					}
				}
			}
		}
	}
	plain, _ := data.(map[string]any)
	if nil == plain {
		plain = map[string]any{}
	}

	declared := map[string]map[string]any{}
	names := []string{}
	for _, field := range fields {
		name := field["name"].(string)
		if _, seen := declared[name]; seen {
			continue
		}
		declared[name] = field
		_, inData := plain[name]
		_, inLifted := lifted[name]
		if inData || inLifted {
			names = append(names, name)
		}
	}
	rest := []string{}
	for key := range plain {
		if _, ok := declared[key]; !ok {
			rest = append(rest, key)
		}
	}
	sort.Strings(rest)
	names = append(names, rest...)

	items := []BodyItem{}
	for _, name := range names {
		field := declared[name]
		if nil == field {
			field = map[string]any{"name": name}
		}
		value, inLifted := lifted[name]
		if !inLifted {
			value = plain[name]
		}
		file := true == field["binary"]
		if isNil(value) {
			continue
		}
		if list, ok := listItems(value); ok {
			join, joined := field["join"].(string)
			if !file && joined {
				texts := []string{}
				for _, item := range list {
					if !isNil(item) {
						texts = append(texts, ItemText(item))
					}
				}
				items = append(items, BodyItem{name, field, strings.Join(texts, join), file})
			} else {
				for _, item := range list {
					if !isNil(item) {
						items = append(items, BodyItem{name, field, item, file})
					}
				}
			}
		} else {
			items = append(items, BodyItem{name, field, value, file})
		}
	}
	return items
}
