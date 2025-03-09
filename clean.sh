#!/bin/bash

# JSON to Go extension for VS Code.
#
# Date: March 2025
# Author: Mario Petričko
# GitHub: http://github.com/maracko/json-to-go-vsc
#
# Apache License
# Version 2.0, January 2004
# http://www.apache.org/licenses/


echo "Removing vendored deps" & rm -rf ./cmd/jsonschema-gen/vendored 2>/dev/null
echo "Removing binaries" && rm ./bin/jsonschema-gen-* 2>/dev/null
echo "Tidying go.mod" && go mod tidy
