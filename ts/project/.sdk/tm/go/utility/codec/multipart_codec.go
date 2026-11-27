package codec

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"strings"

	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

const multipartMedia = "multipart/form-data"

const octetMedia = "application/octet-stream"

const crlf = "\r\n"

func multipartBoundary(_ *core.Context) string {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		panic(err)
	}
	return hex.EncodeToString(buf)
}

// Inside a quoted header parameter nothing may end the quote or the line.
var quoteEscaper = strings.NewReplacer("\\", "%5C", "\"", "%22", "\r", "%0D", "\n", "%0A")

func quoted(text string) string {
	return quoteEscaper.Replace(text)
}

// A local path never leaves: only its last segment, and nothing for an empty one.
func baseName(name string) string {
	if at := strings.LastIndexAny(name, "/\\"); 0 <= at {
		return name[at+1:]
	}
	return name
}

type multipartPart struct {
	name     string
	filename string
	mtype    string
	content  []byte
}

func filePart(ctx *core.Context, name string, field map[string]any, value any) (*multipartPart, error) {
	content := value
	part := &multipartPart{name: name}

	if src, ok := core.AsSource(value); ok {
		content = src.Data
		part.filename = baseName(src.Name)
		part.mtype = src.Type
	}

	if core.IsStream(content) {
		return nil, ctx.MakeError("binary_feature_inactive", "The multipart field \""+name+
			"\" holds a stream, which needs the binary feature: pass bytes, a Blob or a source.")
	}

	if "" == part.mtype {
		part.mtype, _ = field["media"].(string)
	}
	if "" == part.mtype {
		part.mtype = octetMedia
	}
	part.content = core.ToBytes(content)
	return part, nil
}

func textPart(name string, field map[string]any, value any) *multipartPart {
	mtype, _ := field["media"].(string)
	return &multipartPart{name: name, mtype: mtype, content: core.ToBytes(value)}
}

func EncodeMultipart(ctx *core.Context, data any, lifted map[string]any) (*core.Encoded, error) {
	body := vs.GetProp(ctx.Point, "body")
	next := ctx.Utility.MultipartBoundary
	if nil == next {
		next = multipartBoundary
	}
	boundary := next(ctx)
	var out bytes.Buffer

	for _, item := range core.BodyItems(body, data, lifted) {
		var part *multipartPart
		if item.Binary {
			var err error
			if part, err = filePart(ctx, item.Name, item.Field, item.Value); err != nil {
				return nil, err
			}
		} else {
			part = textPart(item.Name, item.Field, item.Value)
		}

		if strings.ContainsAny(part.mtype, "\r\n") {
			return nil, ctx.MakeError("binary_source_refused",
				"The media type of the multipart field \""+item.Name+"\" contains a line break.")
		}

		out.WriteString("--" + boundary + crlf +
			"Content-Disposition: form-data; name=\"" + quoted(part.name) + "\"")
		if "" != part.filename {
			out.WriteString("; filename=\"" + quoted(part.filename) + "\"")
		}
		out.WriteString(crlf)
		if "" != part.mtype {
			out.WriteString("Content-Type: " + part.mtype + crlf)
		}
		out.WriteString(crlf)
		out.Write(part.content)
		out.WriteString(crlf)
	}

	out.WriteString("--" + boundary + "--" + crlf)

	media, _ := vs.GetProp(body, "media").(string)
	declared := strings.TrimSpace(strings.SplitN(media, ";", 2)[0])
	if "" == declared {
		declared = multipartMedia
	}
	return &core.Encoded{Type: declared + "; boundary=" + boundary, Body: out.Bytes()}, nil
}
