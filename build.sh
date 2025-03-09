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


print_info() {
    echo "*********************"
    echo "$1"
    echo "*********************"
}

get_current_ver() {
    echo "$(node -p "require('./package.json').version")" || {
        echo "Error: Failed to get current version from package.json"
        exit 1
    }
}

vendor_deps() {
    print_info "Vendoring dependencies"

    MOD_DIR="$(go env GOPATH)"/pkg/mod
    VENDOR_DIR="./cmd/jsonschema-gen/vendored"
    JSONSCHEMA_MOD="github.com/invopop/jsonschema"
    DEPS=()

    rm -rf "$VENDOR_DIR"
    mkdir -p "$VENDOR_DIR"

    # used by the jsonschema-gen binary to rename embedded modules in the generated code
    touch "$VENDOR_DIR/deps.txt"
    # prevents `go mod tidy` from indexing vendored modules
    touch "$VENDOR_DIR/go.mod"

    go mod tidy

    # parse deps from go.mod
    readarray -t DEPS < <(go mod graph | grep "$JSONSCHEMA_MOD" | awk '{print $2}')

    for DEP in "${DEPS[@]}"; do
        DEP_NAME="${DEP%@*}"
        DEP_VER="${DEP#*@}"

        echo "Processing $DEP_NAME@$DEP_VER"

        mkdir -p "$VENDOR_DIR/$DEP_NAME"
        cp -rf "$MOD_DIR/$DEP_NAME@$DEP_VER"/* "$VENDOR_DIR/$DEP_NAME"
        echo "$DEP_NAME" >>$VENDOR_DIR/deps.txt
    done

    # overwrite permissions to allow deletion
    chmod -R 777 "$VENDOR_DIR"

    # remove go.mod and go.sum files to enable embedding
    find $VENDOR_DIR \( -type f -name "go.mod" -o -name "go.sum" \) -exec rm -f {} \;

    # patch jsonschema to not panic on unsupported types
    sed -i 's/panic("unsupported type " + t.String())/st.Type = "UNSUPPORTED_TYPE_" + t.String()/' "$VENDOR_DIR/$JSONSCHEMA_MOD/reflect.go"

}

build_binaries() {
    print_info "Building binaries"

    PLATFORMS=(
        "windows/amd64"
        "windows/arm64"
        "linux/amd64"
        "linux/arm64"
        "linux/arm"
        "darwin/amd64"
        "darwin/arm64"
    )

    OUTPUT_DIR="./bin"
    mkdir -p "$OUTPUT_DIR"
    rm $OUTPUT_DIR/jsonschema-gen* 2>/dev/null

    for PLATFORM in "${PLATFORMS[@]}"; do
        GOOS="${PLATFORM%/*}"
        GOARCH="${PLATFORM#*/}"

        BIN_OS="${GOOS}"
        BIN_ARCH="${GOARCH}"
        BIN_VER=$(get_current_ver)
        BIN_NAME=""

        if [ "$GOARCH" = "amd64" ]; then
            BIN_ARCH="x64"
        fi

        if [ "$GOOS" = "windows" ]; then
            BIN_OS="win32"
            BIN_NAME="jsonschema-gen-$BIN_OS-$BIN_ARCH-$BIN_VER.exe"
        else
            BIN_NAME="jsonschema-gen-$BIN_OS-$BIN_ARCH-$BIN_VER"
        fi

        echo "Building $PLATFORM"

        CGO_ENABLED=0 GOOS=$GOOS GOARCH=$GOARCH go build -ldflags="-s -w" -o "$OUTPUT_DIR/$BIN_NAME" ./cmd/jsonschema-gen
        if [ $? -ne 0 ]; then
            echo "An error occurred while building for $PLATFORM"
            exit 1
        fi
    done

}

vendor_deps

build_binaries

print_info "All done"

exit 0
