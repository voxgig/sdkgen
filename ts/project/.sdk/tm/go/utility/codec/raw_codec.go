package codec

import (
	"fmt"
	"io"
	"regexp"
	"strconv"
	"strings"

	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

const defaultMaxBuffer = 16777216

var digitsRe = regexp.MustCompile(`^\d+$`)

func maxBuffer(ctx *core.Context) int64 {
	for _, val := range []any{vs.GetProp(ctx.Options, "maxBuffer"), core.OPTSPEC["maxBuffer"]} {
		switch n := val.(type) {
		case int:
			if 0 <= n {
				return int64(n)
			}
		case int64:
			if 0 <= n {
				return n
			}
		case float64:
			if 0 <= n {
				return int64(n)
			}
		}
	}
	return defaultMaxBuffer
}

func cancel(body any) {
	if closer, ok := body.(io.Closer); ok {
		closer.Close()
	}
}

func tooLarge(ctx *core.Context, code string, max int64, declared int64) error {
	what := "is longer than"
	if 0 <= declared {
		what = "of " + strconv.FormatInt(declared, 10) + " bytes exceeds"
	}
	return ctx.MakeError(code, fmt.Sprintf("response: body %s maxBuffer (%d bytes)", what, max))
}

// The whole body, refused past the bound: by its declared length before a
// byte is read, else by the count as it arrives.
func readBounded(ctx *core.Context, response *core.Response, max int64, code string) ([]byte, error) {
	body := response.Body
	length := strings.TrimSpace(core.HeaderValue(response.Headers, "content-length"))
	if digitsRe.MatchString(length) {
		if declared, err := strconv.ParseInt(length, 10, 64); err != nil || max < declared {
			cancel(body)
			if err != nil {
				declared = max + 1
			}
			return nil, tooLarge(ctx, code, max, declared)
		}
	}

	var data []byte
	switch b := body.(type) {
	case nil:
		data = []byte{}
	case []byte:
		data = b
	case string:
		data = []byte(b)
	case io.Reader:
		defer cancel(b)
		read, err := io.ReadAll(io.LimitReader(b, max+1))
		if err != nil {
			return nil, err
		}
		data = read
	default:
		data = core.ToBytes(b)
	}

	if max < int64(len(data)) {
		return nil, tooLarge(ctx, code, max, -1)
	}
	return data, nil
}

// A raw success body: text into the record under `$body`; bytes only into a
// binary handle's read, never into the record.
func ReadRaw(ctx *core.Context) error {
	response := ctx.Response
	result := ctx.Result
	max := maxBuffer(ctx)

	var transfer *core.Transfer
	if nil != ctx.Ctrl {
		transfer = ctx.Ctrl.Transfer
	}

	if true == vs.GetPath(ctx.Point, []any{"response", "binary"}) {
		result.Body = nil
		if nil != transfer && "read" == transfer.Direction {
			data, err := readBounded(ctx, response, max, "binary_too_large")
			if err != nil {
				return err
			}
			transfer.Bytes = data
		} else {
			cancel(response.Body)
		}
		return nil
	}

	data, err := readBounded(ctx, response, max, "response_too_large")
	if err != nil {
		return err
	}
	result.Body = map[string]any{"$body": strings.ToValidUTF8(string(data), "�")}
	return nil
}
