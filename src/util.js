/**
 * JSON to Go extension for VS Code.
 *
 * Date: March 2025
 * Author: Mario Petričko
 * GitHub: http://github.com/maracko/json-to-go-vsc
 *
 * Apache License
 * Version 2.0, January 2004
 * http://www.apache.org/licenses/
 *
 */

/**********/
const os = require('os');
const path = require('path');
const { g, keys, vscode } = require('./globals');
const jsonToGo = require('../lib/json-to-go');
/**********/

/**
 * Generates the long key by concatenating with main extension key
 * @param {string} key The key to be concatenated.
 * @param {string} [sep='.'] The separator to be used. Default is '.'.
 * @returns {string} The generated long key.
 */
function lKey(key, sep = '.') {
  return keys.jsonToGo + sep + key;
}

/** @returns {string} Capitalized string */
function capStr(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** @returns {string[]} Capitalized array */
function capArray(arr) {
  return arr.map((str) => capStr(str));
}

/**
 * Capitalizes the values of an object.
 * @param {Object.<string,string>} obj The object whose values will be capitalized.
 * @returns {string[]} An array containing the capitalized values.
 */
function capValues(obj) {
  return Object.values(obj).map((val) => capStr(val));
}

/**
 * Converts the given JSON text to Go type using the current settings.
 * If the conversion fails, the result object will contain an error message.
 * @param {string} text The JSON text to convert.
 * @param {string} typeName The name of the generated type.
 */
function convertText(text, typeName) {
  return jsonToGo(
    text,
    typeName || g.cfg.get(keys.settings.generatedTypeName),
    !g.cfg.get(keys.settings.inlineTypeDefinitions),
    g.cfg.get(keys.settings.addExamples),
    g.cfg.get(keys.settings.allOmitEmpty),
  );
}

/**
 * Saves the conversion result to a file
 * @param {String} json The input JSON.
 * @param {String} go The output Go struct.
 * @param {Object} [options] Additional options.
 * @param {boolean} [options.addPackage] Indicates whether the output contains a package declaration.
 * @param {string} [options.workspaceName] Conversion workspace name. By default reads the name of the first folder in the workspace.
 * @returns {Promise<string>} A promise containing the filled out template.
 */
async function saveConversion(
  json,
  go,
  { addPackage = false, workspaceName } = {},
) {
  addPackage && (go = `package model\n\n\n${go}`);
  let parts = [os.homedir(), `.${keys.jsonToGo}-history`];

  workspaceName = workspaceName || '';
  switch (true) {
  case workspaceName.length > 0:
    break;
  case vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders.length > 0:
    workspaceName = vscode.workspace.workspaceFolders[0].name;
    break;
  default:
    workspaceName = 'no-workspace';
    break;
  }

  parts.push(workspaceName, `${Date.now()}-${keys.jsonToGo}-conversion.md`);
  let fUri = vscode.Uri.file(path.join(...parts));

  let md = '# JSON-to-Go conversion\n\n';
  md += `## Date: ${new Date().toUTCString()}\n\n`;
  md += `## Workspace: ${workspaceName}\n\n`;
  md += '```go\n' + go + '\n```\n\n';
  md += '```json\n' + json + '\n```\n';

  await vscode.workspace.fs.writeFile(fUri, Buffer.from(md, 'utf8'));

  return md;
}
/**
 * I throw, you catch?
 * @param {any} weird Whatever it may be that is weird.
 * @throws {Error} Always throws, always weird.
 */
function weirdThrow(weird) {
  if (weird) throw new Error(`${weird} is weird`);
  else throw new Error('Something is weird');
}

/**
 * Simple check to determine if a string is semi-valid JSON array or object.
 * @param {string} str The string to check.
 * @returns {boolean} True if the string is complex JSON, false otherwise.
 */
function isComplexJSON(str) {
  return (
    typeof str === 'string' &&
    ((str.charAt(0) === '{' && str.charAt(str.length - 1) === '}') ||
      (str.charAt(0) === '[' && str.charAt(str.length - 1) === ']'))
  );
}

module.exports = {
  capStr,
  capArray,
  capValues,
  convertText,
  lKey,
  saveConversion,
  weirdThrow,
  isComplexJSON,
};
