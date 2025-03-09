// JSON to Go extension for VS Code.
//
// Date: March 2025
// Author: Mario Petričko
// GitHub: http://github.com/maracko/json-to-go-vsc
//
// Apache License
// Version 2.0, January 2004
// http://www.apache.org/licenses/

package main

import (
	"bufio"
	"bytes"
	"embed"
	"encoding/json"
	"flag"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"text/template"
)

//go:embed all:vendored
//go:embed main.templ
var embedFS embed.FS

const (
	mainTemplName = "main.templ"
	depsFileName  = "deps.txt"
	tmpDirName    = "jsonschema-gen"
	vendorDirName = "vendored"
)

type importInfo struct {
	ModuleName  string
	PackageName string

	ImportName   string
	FileName     string
	RelativePath string
	FilePath     string
	TypeName     string
}

func main() {
	var (
		filePath   = flag.String("file", "", "Path to the Go source file")
		symbolName = flag.String("type", "", "Name of the type to generate schema for")
	)

	flag.Parse()

	if *filePath == "" || *symbolName == "" {
		flag.Usage()
		os.Exit(1)
	}

	absPath, err := filepath.Abs(*filePath)
	if err != nil {
		fail(err.Error())
	}

	fileName := filepath.Base(absPath)
	fileDir := filepath.Dir(absPath)

	pkgName, err := parsePkgName(absPath)
	if err != nil {
		fail(err.Error())
	}

	modDir := findGoMod(fileDir)
	if modDir == "" {
		fail("go.mod not found for file " + fileDir)
	}
	modName, goVer, err := parseGoMod(modDir)
	if err != nil {
		fail(err.Error())
	}

	if modName == "" {
		fail("module name not found in go.mod")
	}
	if goVer < "1.18" {
		fail("go mod version must be at least 1.18")
	}

	relPath, err := filepath.Rel(modDir, fileDir)
	if err != nil {
		fail(err.Error())
	}
	if relPath == "." {
		relPath = ""
	}

	importPath := modName
	if relPath != "" {
		importPath += "/" + relPath
	}

	i := importInfo{
		ImportName:   importPath,
		FileName:     fileName,
		PackageName:  pkgName,
		RelativePath: relPath,
		TypeName:     *symbolName,
		ModuleName:   modName,
		FilePath:     filepath.Join(fileDir, fileName),
	}

	tmpDir := filepath.Join(fileDir, tmpDirName)
	tmpMain := filepath.Join(tmpDir, "main.go")

	must(os.MkdirAll(tmpDir, 0777))

	f, err := os.Create(tmpMain)
	if err != nil {
		fail(err.Error())
	}
	defer f.Close()

	mainTemplate := template.Must(template.New(mainTemplName).ParseFS(embedFS, mainTemplName))
	must(mainTemplate.Execute(f, i))

	prefix := filepath.Join(importPath, tmpDirName, vendorDirName)
	must(copyDeps(tmpDir))
	must(renameImports(tmpDir, prefix))

	stdOut := new(bytes.Buffer)
	stdErr := new(bytes.Buffer)

	cmd := exec.Command("go", "run", tmpMain)
	cmd.Dir = tmpDir
	cmd.Stdout = stdOut
	cmd.Stderr = stdErr
	cmd.Env = append(
		os.Environ(),
		"GOWORK=off",
		"GO111MODULE=auto",
	)

	if err = cmd.Run(); err != nil {
		msg := err.Error()
		if stdErr.Len() > 0 {
			msg += "\n" + stdErr.String()
		}
		fail(msg)
	}

	must(os.RemoveAll(tmpDir))

	fmt.Printf("%s", stdOut.String())
}

func copyDeps(dst string) error {
	return fs.WalkDir(embedFS, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		target := filepath.Join(dst, path)

		if d.IsDir() {
			return os.MkdirAll(target, 0777)
		}

		data, err := embedFS.ReadFile(path)
		if err != nil {
			return err
		}

		return os.WriteFile(target, data, 0777)
	})
}

func renameImports(root, prefix string) error {
	deps, err := os.ReadFile(filepath.Join(root, vendorDirName, depsFileName))
	if err != nil {
		return err
	}

	depList := strings.Split(string(deps), "\n")

	return filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if !info.IsDir() && strings.HasSuffix(path, ".go") {
			b, err := os.ReadFile(path)
			if err != nil {
				return err
			}

			data := string(b)
			for _, dep := range depList {
				if dep == "" {
					continue
				}

				data = strings.ReplaceAll(data, dep, fmt.Sprintf("%s/%s", prefix, dep))
			}

			return os.WriteFile(path, []byte(data), 0777)
		}

		return nil
	})
}

func findGoMod(dir string) string {
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return ""
		}
		dir = parent
	}
}

func parseGoMod(modDir string) (modName, goVer string, err error) {
	data, err := os.ReadFile(filepath.Join(modDir, "go.mod"))
	if err != nil {
		return
	}

	for _, line := range strings.Split(string(data), "\n") {
		if strings.HasPrefix(line, "module ") {
			modName = strings.TrimSpace(strings.TrimPrefix(line, "module "))
		} else if strings.HasPrefix(line, "go ") {
			goVer = strings.TrimSpace(strings.TrimPrefix(line, "go "))
		}

		if goVer != "" && modName != "" {
			break
		}
	}

	return
}

func parsePkgName(file string) (pkgName string, err error) {
	f, err := os.Open(file)
	if err != nil {
		return "", err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	scanner.Split(bufio.ScanLines)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "package ") {
			return strings.TrimSpace(strings.TrimPrefix(line, "package ")), nil
		}
	}

	return "", fmt.Errorf("package name not found in file %s", file)
}

type failMsg struct {
	Error string `json:"error"`
}

func fail(msg string) {
	json.NewEncoder(os.Stderr).Encode(failMsg{Error: msg})
	os.Exit(1)
}
func must(err error) {
	if err != nil {
		fail(err.Error())
	}
}
