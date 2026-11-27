package sdktest

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"reflect"
	"regexp"
	"sort"
	"strings"
	"sync"
	"testing"

	sdk "GOMODULE"
)

// Every form, multipart and raw point this SDK has, driven through a real
// entity operation against a local listener that decodes what arrives. The
// cases come from the client's own config, so no case names an entity.

type codecArrival struct {
	method  string
	url     string
	headers http.Header
	body    []byte
}

type codecAnswer struct {
	status int
	mtype  string
	body   []byte
}

type codecNet struct {
	mu       sync.Mutex
	answer   codecAnswer
	arrivals []codecArrival
}

func (n *codecNet) answerWith(mtype string, body []byte) {
	n.mu.Lock()
	defer n.mu.Unlock()
	n.answer = codecAnswer{mtype: mtype, body: body}
}

func (n *codecNet) arrived(t *testing.T) codecArrival {
	n.mu.Lock()
	defer n.mu.Unlock()
	if 0 == len(n.arrivals) {
		t.Fatal("nothing arrived")
	}
	return n.arrivals[len(n.arrivals)-1]
}

type codecPart struct {
	name     string
	value    string
	file     bool
	filename string
	mtype    string
}

type codecCase struct {
	name string
	run  func(t *testing.T, client *sdk.ProjectNameSDK, net *codecNet)
}

type codecHandle interface {
	Bytes(opts map[string]any, ctrl map[string]any) ([]byte, error)
	Put(source any, ctrl map[string]any) (sdk.ProjectNameEntityBase, error)
}

// The entity accessors of a client, by entity name.
func codecAccessors(client *sdk.ProjectNameSDK) map[string]string {
	out := map[string]string{}
	cv := reflect.ValueOf(client)
	ct := cv.Type()
	mapType := reflect.TypeOf(map[string]any{})
	for i := 0; i < ct.NumMethod(); i++ {
		mt := ct.Method(i).Type
		if mt.NumIn() != 2 || mt.NumOut() != 1 || mt.In(1) != mapType {
			continue
		}
		ent, ok := cv.Method(i).Call([]reflect.Value{reflect.ValueOf(map[string]any(nil))})[0].
			Interface().(sdk.ProjectNameEntityBase)
		if ok && nil != ent && "" != ent.GetName() {
			out[ent.GetName()] = ct.Method(i).Name
		}
	}
	return out
}

func codecEntity(client *sdk.ProjectNameSDK, accessor string) sdk.ProjectNameEntityBase {
	return reflect.ValueOf(client).MethodByName(accessor).
		Call([]reflect.Value{reflect.ValueOf(map[string]any(nil))})[0].
		Interface().(sdk.ProjectNameEntityBase)
}

// The entity's handle for a slot, through whichever form its Binary takes.
func codecBinary(t *testing.T, ent sdk.ProjectNameEntityBase, slot string) codecHandle {
	m := reflect.ValueOf(ent).MethodByName("Binary")
	if !m.IsValid() {
		t.Fatalf("entity %s has no Binary", ent.GetName())
	}
	var args []reflect.Value
	if 0 < m.Type().NumIn() && ("" != slot || !m.Type().IsVariadic()) {
		args = []reflect.Value{reflect.ValueOf(slot)}
	}
	handle, ok := m.Call(args)[0].Interface().(codecHandle)
	if !ok {
		t.Fatalf("entity %s: Binary does not answer Bytes and Put", ent.GetName())
	}
	return handle
}

var codecParamRe = regexp.MustCompile(`^\{(.+)\}$`)

// A value for each path parameter a point names.
func codecParams(point map[string]any) map[string]any {
	out := map[string]any{}
	parts, _ := point["parts"].([]any)
	for _, part := range parts {
		if m := codecParamRe.FindStringSubmatch(fmt.Sprint(part)); nil != m {
			out[m[1]] = "p1"
		}
	}
	return out
}

func codecAction(point map[string]any) string {
	sel, _ := point["select"].(map[string]any)
	action, _ := sel["$action"].(string)
	return action
}

func codecArgs(point map[string]any, extra map[string]any) map[string]any {
	out := codecParams(point)
	if action := codecAction(point); "" != action {
		out["$action"] = action
	}
	for k, v := range extra {
		out[k] = v
	}
	return out
}

func codecContent(name string) []byte {
	return []byte("file:" + name + "\x00\xff\r\n--")
}

// The data a form or multipart point is sent, and the parts it must arrive as.
func codecPlan(client *sdk.ProjectNameSDK, body map[string]any) (map[string]any, []codecPart) {
	data := map[string]any{}
	expect := []codecPart{}
	form := "form" == body["kind"]
	fields, _ := body["fields"].([]any)
	for _, f := range fields {
		field, _ := f.(map[string]any)
		name, _ := field["name"].(string)
		if "" == name {
			continue
		}
		if true == field["binary"] {
			mtype := ""
			if !form {
				mtype, _ = field["media"].(string)
				if "" == mtype {
					mtype = "application/octet-stream"
				}
			}
			data[name] = client.Binary.Bytes(codecContent(name),
				map[string]any{"name": "/local/dir/" + name + ".bin", "type": mtype})
			if form {
				expect = append(expect, codecPart{name: name, value: string(codecContent(name))})
			} else {
				expect = append(expect, codecPart{name: name, value: string(codecContent(name)),
					file: true, filename: name + ".bin", mtype: mtype})
			}
		} else if true == field["list"] {
			data[name] = []any{"a", "b c"}
			expect = append(expect, codecPart{name: name, value: "a"}, codecPart{name: name, value: "b c"})
		} else if join, ok := field["join"].(string); ok {
			data[name] = []any{"a", "b"}
			expect = append(expect, codecPart{name: name, value: "a" + join + "b"})
		} else {
			data[name] = "v\"" + name + "\r\n"
			expect = append(expect, codecPart{name: name, value: "v\"" + name + "\r\n"})
		}
	}
	return data, expect
}

var codecDispRe = regexp.MustCompile(
	`(?m)^Content-Disposition: form-data; name="([^"]*)"(?:; filename="([^"]*)")?\r?$`)

var codecTypeRe = regexp.MustCompile(`(?m)^Content-Type: (.*?)\r?$`)

func codecMultipart(t *testing.T, arrived codecArrival) []codecPart {
	ctype := arrived.headers.Get("Content-Type")
	m := regexp.MustCompile(`boundary=([^;]+)`).FindStringSubmatch(ctype)
	if nil == m {
		t.Fatalf("no boundary in %q", ctype)
	}
	boundary := m[1]
	text := string(arrived.body)
	if !strings.HasSuffix(text, "--"+boundary+"--\r\n") {
		t.Fatalf("the body does not close: %q", text)
	}
	chunks := strings.Split(text, "--"+boundary)
	parts := []codecPart{}
	for _, chunk := range chunks[1 : len(chunks)-1] {
		at := strings.Index(chunk, "\r\n\r\n")
		head := chunk[2:at]
		content := chunk[at+4 : len(chunk)-2]
		disp := codecDispRe.FindStringSubmatch(head)
		if nil == disp {
			t.Fatalf("a part without a disposition: %q", head)
		}
		if strings.Contains(head, "filename=") {
			mtype := ""
			if tm := codecTypeRe.FindStringSubmatch(head); nil != tm {
				mtype = tm[1]
			}
			parts = append(parts, codecPart{name: disp[1], value: content, file: true,
				filename: disp[2], mtype: mtype})
		} else {
			parts = append(parts, codecPart{name: disp[1], value: content})
		}
	}
	return parts
}

func codecForm(t *testing.T, body []byte) []codecPart {
	parts := []codecPart{}
	if 0 == len(body) {
		return parts
	}
	for _, pair := range strings.Split(string(body), "&") {
		name, value, _ := strings.Cut(pair, "=")
		n, err := url.QueryUnescape(name)
		if err != nil {
			t.Fatalf("form name %q: %v", name, err)
		}
		v, err := url.QueryUnescape(value)
		if err != nil {
			t.Fatalf("form value %q: %v", value, err)
		}
		parts = append(parts, codecPart{name: n, value: v})
	}
	return parts
}

// What arrived under the names that were sent, in the order they arrived.
func codecSent(got []codecPart, expect []codecPart) []codecPart {
	out := []codecPart{}
	for _, g := range got {
		for _, e := range expect {
			if e.name == g.name {
				out = append(out, g)
				break
			}
		}
	}
	return out
}

func codecCases(client *sdk.ProjectNameSDK) []codecCase {
	out := []codecCase{}
	acc := codecAccessors(client)
	entities, _ := client.GetRootCtx().Config["entity"].(map[string]any)

	enames := []string{}
	for ename := range entities {
		enames = append(enames, ename)
	}
	sort.Strings(enames)

	for _, ename := range enames {
		accessor, ok := acc[ename]
		if !ok {
			continue
		}
		entcfg, _ := entities[ename].(map[string]any)
		ops, _ := entcfg["op"].(map[string]any)
		opnames := []string{}
		for opname := range ops {
			opnames = append(opnames, opname)
		}
		sort.Strings(opnames)

		for _, opname := range opnames {
			opcfg, _ := ops[opname].(map[string]any)
			points, _ := opcfg["points"].([]any)
			for _, p := range points {
				point, _ := p.(map[string]any)
				label := ename + "." + opname
				if action := codecAction(point); "" != action {
					label += ":" + action
				}
				rb, _ := point["body"].(map[string]any)
				rs, _ := point["response"].(map[string]any)
				writes := "create" == opname || "update" == opname || "patch" == opname

				if kind, _ := rb["kind"].(string); writes && ("form" == kind || "multipart" == kind) {
					point, opname := point, opname
					out = append(out, codecCase{
						name: label + " sends a " + kind + " body",
						run: func(t *testing.T, client *sdk.ProjectNameSDK, net *codecNet) {
							data, expect := codecPlan(client, rb)
							net.answerWith("application/json", []byte(`{"id":"p1"}`))
							if _, err := codecOp(codecEntity(client, accessor), opname,
								codecArgs(point, data)); err != nil {
								t.Fatal(err)
							}
							arrived := net.arrived(t)
							var got []codecPart
							if "form" == kind {
								if arrived.headers.Get("Content-Type") != rb["media"] {
									t.Fatalf("content type %q, declared %v",
										arrived.headers.Get("Content-Type"), rb["media"])
								}
								got = codecForm(t, arrived.body)
							} else {
								got = codecMultipart(t, arrived)
							}
							if sent := codecSent(got, expect); !reflect.DeepEqual(sent, expect) {
								t.Fatalf("arrived %#v, sent %#v", sent, expect)
							}
						},
					})
				}

				if "raw" == rb["kind"] && writes {
					point := point
					binary := true == rb["binary"]
					kind := "text"
					if binary {
						kind = "binary"
					}
					out = append(out, codecCase{
						name: label + " sends a raw " + kind + " body",
						run: func(t *testing.T, client *sdk.ProjectNameSDK, net *codecNet) {
							net.answerWith("application/json", []byte(`{"id":"p1"}`))
							ent := codecEntity(client, accessor)
							ent.Data(codecParams(point))
							ent.Match(codecParams(point))
							if binary {
								mtype, _ := rb["media"].(string)
								got, err := codecBinary(t, ent, codecAction(point)).Put(
									client.Binary.Bytes(codecContent(label), map[string]any{"type": mtype}), nil)
								if err != nil {
									t.Fatal(err)
								}
								if got != ent {
									t.Fatal("Put did not answer the entity")
								}
								if string(net.arrived(t).body) != string(codecContent(label)) {
									t.Fatalf("arrived %q", net.arrived(t).body)
								}
							} else {
								text := "text \"" + label + "\"\n"
								if _, err := codecOp(ent, opname,
									codecArgs(point, map[string]any{"$body": text})); err != nil {
									t.Fatal(err)
								}
								if string(net.arrived(t).body) != text {
									t.Fatalf("arrived %q", net.arrived(t).body)
								}
							}
							if net.arrived(t).headers.Get("Content-Type") != rb["media"] {
								t.Fatalf("content type %q, declared %v",
									net.arrived(t).headers.Get("Content-Type"), rb["media"])
							}
						},
					})
				}

				if "raw" == rs["kind"] && "load" == opname {
					point := point
					binary := true == rs["binary"]
					kind := "text"
					if binary {
						kind = "binary"
					}
					out = append(out, codecCase{
						name: label + " reads a raw " + kind + " body",
						run: func(t *testing.T, client *sdk.ProjectNameSDK, net *codecNet) {
							ent := codecEntity(client, accessor)
							ent.Data(codecParams(point))
							ent.Match(codecParams(point))
							mtype, _ := rs["media"].(string)
							if binary {
								net.answerWith(mtype, codecContent(label))
								data, err := codecBinary(t, ent, codecAction(point)).Bytes(nil, nil)
								if err != nil {
									t.Fatal(err)
								}
								if string(data) != string(codecContent(label)) {
									t.Fatalf("read %q", data)
								}
								_, err = ent.Load(codecArgs(point, nil), nil)
								perr, _ := err.(*sdk.ProjectNameError)
								if nil == perr || "binary_sink_required" != perr.Code {
									t.Fatalf("a plain load was not refused: %v", err)
								}
							} else {
								net.answerWith(mtype, []byte("café "+label))
								got, err := ent.Load(codecArgs(point, nil), nil)
								if err != nil {
									t.Fatal(err)
								}
								if got != ent {
									t.Fatal("Load did not answer the entity")
								}
								data, _ := ent.Data().(map[string]any)
								if "café "+label != data["$body"] {
									t.Fatalf("data %#v", data)
								}
							}
						},
					})
				}
			}
		}
	}
	return out
}

func codecOp(ent sdk.ProjectNameEntityBase, opname string, args map[string]any) (any, error) {
	switch opname {
	case "create":
		return ent.Create(args, nil)
	case "update":
		return ent.Update(args, nil)
	case "patch":
		return ent.Patch(args, nil)
	}
	return ent.Load(args, nil)
}

func TestCodec(t *testing.T) {
	probe, err := sdk.NewProjectNameSDK(map[string]any{"base": "http://127.0.0.1:1"})
	if err != nil {
		t.Fatal(err)
	}
	cases := codecCases(probe)

	net := &codecNet{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		net.mu.Lock()
		net.arrivals = append(net.arrivals, codecArrival{method: r.Method, url: r.URL.String(),
			headers: r.Header.Clone(), body: body})
		answer := net.answer
		net.mu.Unlock()
		mtype := answer.mtype
		if "" == mtype {
			mtype = "application/json"
		}
		w.Header().Set("Content-Type", mtype)
		w.Header().Set("Content-Length", fmt.Sprint(len(answer.body)))
		status := answer.status
		if 0 == status {
			status = 200
		}
		w.WriteHeader(status)
		w.Write(answer.body)
	}))
	defer server.Close()

	ran, failed := 0, 0
	defer func() {
		fmt.Printf("codec: ran %d case(s), %d failed\n", ran, failed)
	}()

	t.Run("this SDK has a point to drive", func(t *testing.T) {
		if 0 == len(cases) {
			t.Fatal("no form, multipart or raw point was found")
		}
	})

	for _, kase := range cases {
		kase := kase
		ok := t.Run(kase.name, func(t *testing.T) {
			ran++
			net.mu.Lock()
			net.arrivals = nil
			net.answer = codecAnswer{}
			net.mu.Unlock()
			client, err := sdk.NewProjectNameSDK(map[string]any{"base": server.URL})
			if err != nil {
				t.Fatal(err)
			}
			kase.run(t, client, net)
		})
		if !ok {
			failed++
		}
	}
}
