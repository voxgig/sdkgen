package codec

import (
	"strings"

	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

const formMedia = "application/x-www-form-urlencoded"

const formHex = "0123456789ABCDEF"

// application/x-www-form-urlencoded byte serialisation: alphanumerics and
// `*-._` as they are, a space as `+`, every other byte as %HH.
func formEscape(data []byte) string {
	var out strings.Builder
	for _, b := range data {
		switch {
		case ('0' <= b && b <= '9') || ('A' <= b && b <= 'Z') || ('a' <= b && b <= 'z') ||
			'*' == b || '-' == b || '.' == b || '_' == b:
			out.WriteByte(b)
		case ' ' == b:
			out.WriteByte('+')
		default:
			out.WriteByte('%')
			out.WriteByte(formHex[b>>4])
			out.WriteByte(formHex[b&15])
		}
	}
	return out.String()
}

func formValue(ctx *core.Context, name string, value any) ([]byte, error) {
	content := value
	if src, ok := core.AsSource(value); ok {
		content = src.Data
	}
	if core.IsStream(content) {
		return nil, ctx.MakeError("binary_source_refused", "The form field \""+name+
			"\" holds a Blob or a stream, which a form body cannot carry: pass its bytes.")
	}
	if data, ok := content.([]byte); ok {
		return data, nil
	}
	return []byte(core.ItemText(content)), nil
}

func EncodeForm(ctx *core.Context, data any, lifted map[string]any) (*core.Encoded, error) {
	body := vs.GetProp(ctx.Point, "body")
	pairs := []string{}

	for _, item := range core.BodyItems(body, data, lifted) {
		value, err := formValue(ctx, item.Name, item.Value)
		if err != nil {
			return nil, err
		}
		pairs = append(pairs, formEscape([]byte(item.Name))+"="+formEscape(value))
	}

	media, _ := vs.GetProp(body, "media").(string)
	if "" == media {
		media = formMedia
	}
	return &core.Encoded{Type: media, Body: strings.Join(pairs, "&")}, nil
}
