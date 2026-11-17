#!/bin/bash
# tut.sh <variation> <lang> : print the README tutorial section of NEW (or OLD with O=1)
P=/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2
R=$P/base32/out/${O:+old}; [ -z "$O" ] && R=$P/base32/out/new
awk 'f&&/^## /{exit} /^## Tutorial/{f=1} f' $R/$1/$2/README.md
