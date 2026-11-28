package feature

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"GOMODULE/core"
	"GOMODULE/utility"
)

type CacheFeature struct {
	BaseFeature
	client  *core.ProjectNameSDK
	options map[string]any
	store   map[string]*cacheEntry
	order   []string
	secret  []byte

	// Activity tracking (mirrors the ts client._cache record).
	Hit    int
	Miss   int
	Bypass int
}

type cacheEntry struct {
	expiry   int64
	scope    string
	snapshot *cacheSnapshot
}

type cacheSnapshot struct {
	status     int
	statusText string
	data       any
	headers    map[string]any
}

func NewCacheFeature() *CacheFeature {
	return &CacheFeature{
		BaseFeature: BaseFeature{
			Version: "0.0.1",
			Name:    "cache",
			Active:  true,
		},
	}
}

func (f *CacheFeature) Init(ctx *core.Context, options map[string]any) {
	f.client = ctx.Client
	f.options = options
	f.Active = foptBool(options, "active", false)

	if !f.Active {
		return
	}

	f.store = map[string]*cacheEntry{}
	f.order = []string{}
	f.secret = make([]byte, 32)
	if _, err := rand.Read(f.secret); err != nil {
		panic(err)
	}

	inner := ctx.Utility.Fetcher

	ctx.Utility.Fetcher = func(ctx2 *core.Context, url string, fetchdef map[string]any) (any, error) {
		return f.through(ctx2, url, fetchdef, inner)
	}
}

func (f *CacheFeature) through(ctx *core.Context, url string, fetchdef map[string]any,
	inner core.FetcherFunc) (any, error) {

	method := "GET"
	if m, ok := fetchdef["method"].(string); ok && m != "" {
		method = strings.ToUpper(m)
	}

	methods := foptStrList(f.options, "methods")
	if methods == nil {
		methods = []string{"GET"}
	}
	cacheable := false
	for _, m := range methods {
		if strings.ToUpper(m) == method {
			cacheable = true
			break
		}
	}
	if !cacheable {
		res, err := inner(ctx, url, fetchdef)
		if method != "GET" && method != "HEAD" {
			f.invalidate(url)
		}
		return res, err
	}

	key := method + " " + url + " " + f.digest(fetchdef["headers"])
	now := foptNow(f.options)()

	if hit, ok := f.store[key]; ok && hit.expiry > now {
		f.Hit++
		return f.replay(hit.snapshot), nil
	}

	res, err := inner(ctx, url, fetchdef)

	if err == nil && f.storable(res) {
		snapshot := f.snapshot(res)
		ttl := cacheLifetime(snapshot.headers, int64(foptInt(f.options, "ttl", 5000)))
		if ttl <= 0 {
			f.Bypass++
			return f.replay(snapshot), nil
		}
		f.drop(key)
		f.evict()
		f.store[key] = &cacheEntry{expiry: now + ttl, scope: cacheScope(url), snapshot: snapshot}
		f.order = append(f.order, key)
		f.Miss++
		return f.replay(snapshot), nil
	}

	f.Bypass++
	return res, err
}

func (f *CacheFeature) digest(headers any) string {
	pairs := [][2]string{}
	if hm, ok := headers.(map[string]any); ok {
		for k, v := range hm {
			if v != nil {
				pairs = append(pairs, [2]string{strings.ToLower(k), fmt.Sprint(v)})
			}
		}
	} else if hm, ok := headers.(map[string]string); ok {
		for k, v := range hm {
			pairs = append(pairs, [2]string{strings.ToLower(k), v})
		}
	}
	sort.Slice(pairs, func(i, j int) bool {
		if pairs[i][0] != pairs[j][0] {
			return pairs[i][0] < pairs[j][0]
		}
		return pairs[i][1] < pairs[j][1]
	})
	mac := hmac.New(sha256.New, f.secret)
	for _, p := range pairs {
		mac.Write([]byte(p[0] + ":" + p[1] + "\n"))
	}
	return hex.EncodeToString(mac.Sum(nil))
}

func (f *CacheFeature) invalidate(url string) {
	path := cacheScope(url)
	collection := cacheParent(path)
	for key, entry := range f.store {
		if cacheUnder(entry.scope, path) || entry.scope == collection {
			f.drop(key)
		}
	}
}

func (f *CacheFeature) drop(key string) {
	if _, ok := f.store[key]; !ok {
		return
	}
	delete(f.store, key)
	for i, k := range f.order {
		if k == key {
			f.order = append(f.order[:i], f.order[i+1:]...)
			break
		}
	}
}

// The configured ttl capped by the response's Cache-Control; zero when the
// response may not be stored.
func cacheLifetime(headers map[string]any, ttl int64) int64 {
	control := ""
	for k, v := range headers {
		if strings.ToLower(k) == "cache-control" {
			control = strings.ToLower(fmt.Sprint(v))
		}
	}
	life := ttl
	for _, part := range strings.Split(control, ",") {
		directive := strings.TrimSpace(part)
		switch directive {
		case "no-store", "private", "no-cache":
			return 0
		}
		if strings.HasPrefix(directive, "max-age") {
			value := strings.TrimSpace(strings.TrimPrefix(directive, "max-age"))
			if strings.HasPrefix(value, "=") {
				value = strings.Trim(strings.TrimSpace(value[1:]), "\"")
				if secs, err := strconv.ParseInt(value, 10, 64); err == nil && secs >= 0 && secs*1000 < life {
					life = secs * 1000
				}
			}
		}
	}
	return life
}

func cacheScope(url string) string {
	if i := strings.IndexAny(url, "?#"); i >= 0 {
		url = url[:i]
	}
	return strings.TrimRight(url, "/")
}

func cacheParent(scope string) string {
	root := 0
	if scheme := strings.Index(scope, "://"); scheme >= 0 {
		root = strings.Index(scope[scheme+3:], "/")
		if root < 0 {
			return scope
		}
		root += scheme + 3
	}
	cut := strings.LastIndex(scope, "/")
	if cut < root {
		cut = root
	}
	return scope[:cut]
}

func cacheUnder(scope string, prefix string) bool {
	return scope == prefix || strings.HasPrefix(scope, prefix+"/")
}

// A body the transport could not read as JSON passes through, for the operation to report.
// A body that declares another type than JSON passes by, unread.
func (f *CacheFeature) storable(res any) bool {
	status, ok := fresStatus(res)
	rm, _ := res.(map[string]any)
	unreadable, _ := rm["unreadable"].(bool)
	return ok && status >= 200 && status < 300 && !unreadable && f.json(rm)
}

func (f *CacheFeature) json(rm map[string]any) bool {
	headers, _ := rm["headers"].(map[string]any)
	for key, val := range headers {
		if strings.EqualFold("content-type", key) {
			media, _ := val.(string)
			return "" == media || utility.IsJSONMedia(media)
		}
	}
	return true
}

func (f *CacheFeature) snapshot(res any) *cacheSnapshot {
	rm, _ := res.(map[string]any)

	snap := &cacheSnapshot{headers: map[string]any{}}

	if status, ok := fresStatus(res); ok {
		snap.status = status
	}
	if st, ok := rm["statusText"].(string); ok {
		snap.statusText = st
	}
	if jf, ok := rm["json"].(func() any); ok {
		snap.data = jf()
	}
	if headers, ok := rm["headers"].(map[string]any); ok {
		for k, v := range headers {
			snap.headers[strings.ToLower(k)] = v
		}
	}

	return snap
}

// replay builds a fresh transport-shaped response so the body stays
// re-readable for every consumer.
func (f *CacheFeature) replay(snap *cacheSnapshot) map[string]any {
	data := snap.data
	headers := map[string]any{}
	for k, v := range snap.headers {
		headers[k] = v
	}
	return map[string]any{
		"status":     snap.status,
		"statusText": snap.statusText,
		"body":       "not-used",
		"json":       (func() any)(func() any { return data }),
		"headers":    headers,
	}
}

// evict drops oldest entries (FIFO) until the store is under `max`.
func (f *CacheFeature) evict() {
	max := foptInt(f.options, "max", 256)
	for len(f.store) >= max && len(f.order) > 0 {
		oldest := f.order[0]
		f.order = f.order[1:]
		delete(f.store, oldest)
	}
}
