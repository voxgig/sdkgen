
.PHONY: build test vet tidy clean setup

setup:
	go mod tidy

build: setup
	go build ./...

test: build
	go test ./...

vet: build
	go vet ./...

tidy:
	go mod tidy

clean:
	go clean -cache -testcache
