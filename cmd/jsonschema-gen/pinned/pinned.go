// JSON to Go extension for VS Code.
//
// Date: March 2025
// Author: Mario Petričko
// GitHub: http://github.com/maracko/json-to-go-vsc
//
// Apache License
// Version 2.0, January 2004
// http://www.apache.org/licenses/

//go:build pinned

// This package exists to keep "unused" dependencies pinned in go.mod
package pinned

import "github.com/invopop/jsonschema"

var _ = jsonschema.Version
