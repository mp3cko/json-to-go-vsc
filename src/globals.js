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
const vscode = require('vscode');

const { type, T } = require('./type');
/**********/

const enums = {
  input: {
    askMe: 'ask me every time',
    clipboard: 'clipboard',
    currentFile: 'current file',
    selection: 'selection',
  },
  output: {
    askMe: 'ask me every time',
    clipboard: 'clipboard',
    cursorPosition: 'cursor position',
    temporaryFile: 'temporary file',
  },
  Button: {
    AreYouSure: 'Are you sure?',
    Cancel: 'Cancel',
    Confirm: 'Confirm',
    DontShowAgain: 'Don\'t show again',
    ShowDetails: 'Show details',
    GoToSettings: 'Go to settings',
    Remember: {
      Yes: 'Yes',
      No: 'No',
      DontAsk: 'No and don\'t ask again',
    },
  },
  T: T,
};

const keys = {
  jsonToGo: 'json-to-go',
  ctx: {
    perm: {
      askRememberInput: 'askRememberInput',
      askRememberOutput: 'askRememberOutput',
      notifyClipboardOutput: 'notifyClipboardOutput',
    },
    temp: {
      pasteIntegrationLangs: 'pasteIntegrationLangs',
      promptForStructName: 'promptForStructName',
    },
    editor: {
      /** @deprecated context menu deprecated */
      contextMenuVisible: 'contextMenuVisible',
    },
  },
  cmd: {
    convert: 'convert',
    convertFresh: 'convertFresh',
    openSettings: 'openSettings',
    resetAllSettings: 'resetAllSettings',
  },
  li: {
    self: 'li',
    onDidChangeTextDocument: 'onDidChangeTextDocument',
    onDidChangeConfiguration: 'onDidChangeConfiguration',
  },
  settings: {
    addExamples: 'addExamples',
    allOmitEmpty: 'allOmitEmpty',
    autoSelectTypeName: 'autoSelectTypeName',
    generatedTypeName: 'generatedTypeName',
    inlineTypeDefinitions: 'inlineTypeDefinitions',
    saveConversions: 'saveConversions',
    io: {
      /** @deprecated replaced by input */
      inputSource: 'inputSource',
      input: 'io.input',
      output: 'io.output',
    },
    pasteIntegration: {
      self: 'pasteIntegration',
      promptForTypeName: 'pasteIntegration.promptForTypeName',
      supportedLanguages: 'pasteIntegration.supportedLanguages',
    },
  },
};

/**
 * Interface for operating listeners.
 * @typedef {Object} ListenerController
 * @property {(listenerFunc?,evSrc?) => boolean} enable Enables the listener either using the provided listener and event source, or existing one, throwing an error if neither exists.
 * @property {() => boolean} dispose Disables the listener if it exists, returning true if so. It can be re-enabled later using enable without arguments.
 * @property {(event?)} listener The current listener function.
 * @property {(event?)} eventSource The current event source function.
 * @property {string} name The name of the listener.
 */

/**
 * @typedef {Object} Listeners Object containing all active ListenerController instances and in turn all active listeners.
 * @property {ListenerController} [onDidChangeTextDocument] A ListenerController instance.
 * @property {ListenerController} [onDidChangeConfiguration] A ListenerController instance.
 */

/**
 * @typedef {Object} GlobalDisposable The global object containing all run-time data.
 * @property {vscode.WorkspaceConfiguration} cfg The workspace configuration object.
 * @property {vscode.ExtensionContext} [ctx] The extension context provided by VS Code.
 * @property {vscode.Disposable[]} disposables All global disposables are added here
 * @property {() => number} dispose A method that disposes all global disposables and increments the timesDisposed counter.
 * @property {(msg: string, error?: boolean) => void} log A simple logger for extension
 * @property {Listeners} li An object with ListenerController instances.
 * @property {number} timesDisposed A method that returns the number of times the object has been disposed.
 */

/**
 * The big G. Actually, it's a small one, but he always dreamed biG.
 * @type {GlobalDisposable}
 */
const g = newGlobals();

/**
 * Creates a new GlobalDisposable object. The object is a proxy that prevents reassigning or deleting its properties, unless dispose is called.
 * @param {Object} [input={}] The initial properties of the GlobalDisposable.
 * @returns {GlobalDisposable} A new GlobalDisposable object.
 */
function newGlobals(input = {}) {
  if (!isObj(input)) input = {};

  let nDisp = 0;

  const daRealG = {
    ...deepCopy(input),

    get cfg() {
      return vscode.workspace.getConfiguration(keys.jsonToGo);
    },

    ctx: undefined,

    disposables: [],

    dispose() {
      this.disposables.forEach((d) => d.dispose());
      this.disposables.length = 0;

      Object.keys(this.li).forEach((k) => this.li[k].dispose());

      simpleLog(`GlobalDisposable: disposed [${++nDisp}]`);

      return nDisp;
    },

    li: {
      onDidChangeTextDocument: new ListenerControllerInitializer(),
      onDidChangeConfiguration: new ListenerControllerInitializer(),
    },

    log: simpleLog,

    get timesDisposed() {
      return nDisp;
    },
  };

  return new Proxy(daRealG, {
    get: (target, prop) => target[prop],

    set: (target, key, value) => {
      if (key in target && target[key] !== undefined) {
        simpleLog(
          `GlobalDisposable: cannot reassign '${String(key)}', it is already set to: '${JSON.stringify(target[key])}'`,
          true,
        );

        return false;
      }

      target[key] = value;

      return true;
    },
  });
}

/**
 * ListenerController factory function.
 * @returns {ListenerController} A new ListenerController object.
 */
function ListenerControllerInitializer() {
  let disp, list, evSrc;

  let nEnable = 0;
  let nDisp = 0;

  createGetter(this, 'eventSource', () => evSrc);
  createGetter(this, 'listener', () => list);
  createGetter(this, 'name', () => list.name);

  this.enable = (li, ev) => {
    if ((!isFunc(li) || !isFunc(ev)) && (!isFunc(list) || !isFunc(evSrc))) {
      throw NewError(
        `To enable ListenerController for the first time must provide listener and event source, have args: [${type(li).all} and ${type(ev).all}]`,
      );
    }

    let validConf = false;
    if (isFunc(li) && isFunc(ev)) {
      list = li;
      evSrc = ev;
      validConf = true;
    }

    if (!validConf && (!isFunc(list) || !isFunc(evSrc))) {
      throw NewError(
        `Invalid ListenerController conf: ${JSON.stringify(this)}`,
      );
    }

    if (isFunc(disp?.dispose)) {
      disp.dispose();
    }

    disp = evSrc(list, this, g.ctx.subscriptions);

    simpleLog(`ListenerController(${this.name}): enabled [${++nEnable}]`);

    return true;
  };

  this.dispose = () => {
    if (isFunc(disp?.dispose)) {
      disp.dispose();
      disp = undefined;

      simpleLog(`ListenerController(${this.name}): disposed [${++nDisp}]`);

      return true;
    }

    return false;
  };

  return this;
}

/**
 * Recursively creates a copy of an object or array.
 * @template T
 * @param {T} obj The object to be copied.
 * @returns {T} The deep copy of the input, or at least I hope so.
 */
function deepCopy(obj) {
  if (!isObj(obj)) return obj;

  const copy = Array.isArray(obj) ? [] : {};
  for (let key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      copy[key] = deepCopy(obj[key]);
    }
  }

  return copy;
}

function isObj(x) {
  return type(x).match({ is: enums.T.object, isNot: enums.T.null });
}

function isFunc(x) {
  return type(x).is(enums.T.function);
}

function createGetter(obj, prop, getter) {
  Object.defineProperty(obj, prop, {
    get: getter,
    enumerable: true,
    configurable: false,
  });
}

/**
 * Logs a message with a timestamp and extension name prefix.
 * @param {string} msg - The message to log.
 * @param {boolean} [error=false] - If true, logs the message as an error; otherwise, logs it as a regular message.
 */
function simpleLog(msg, error = false) {
  const timeStr = new Date().toISOString().replace('T', ' ').replace('Z', '');
  const log = `[${timeStr}] [${keys.jsonToGo}] ${msg}`;

  error ? console.error(log) : console.log(log);
}

/**
 * Create new Error with the extension name prefix.
 * @param {string} msg - The error message.
 */
function NewError(msg) {
  return new Error(`${keys.jsonToGo}: ${msg}`);
}

simpleLog('globals.js loaded');

module.exports = {
  enums,
  keys,
  vscode,
  g,
};
