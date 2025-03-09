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
 */

/**********/
const li = require('./listeners');
const { type } = require('./type');
const { keys, enums, g, vscode } = require('./globals');
const {
  lKey,
  weirdThrow,
  convertText,
  capStr,
  capValues,
  capArray,
  saveConversion,
} = require('./util');
/***********/

/**
 * Activates the extension and sets up the necessary configurations and commands.
 * @param {vscode.ExtensionContext} ctx The extension context provided by VS Code.
 */
async function activate(ctx) {
  try {
    g.ctx = ctx;
    await initCtx();
    const { langs: pasteIntegrationLangs } = await li.updatePasteContext();

    // reset for <= 0.3.1
    if (g.cfg.get(keys.settings.io.inputSource)) {
      g.cfg.update(
        keys.settings.io.inputSource,
        undefined,
        vscode.ConfigurationTarget.Global,
      );

      resetAllSettings(true);

      const msg =
        'Json to Go has reached a major release and your settings have been reset.' +
        '\n' +
        'Sorry for the inconvenience, you are encouraged to check out what changed.';

      const btn = await vscode.window.showInformationMessage(
        msg,
        enums.Button.GoToSettings,
      );

      if (btn === enums.Button.GoToSettings) openSettingsWindow();
    }

    g.li.onDidChangeConfiguration.enable(
      li.onDidChangeConfigurationListener,
      vscode.workspace.onDidChangeConfiguration,
    );

    g.li.onDidChangeTextDocument.enable(
      li.onDidChangeTextDocumentListener,
      (li, thisArg, disposables) =>
        vscode.workspace.onDidChangeTextDocument(li, thisArg, disposables),
    );

    if (pasteIntegrationLangs.length === 0) {
      g.li.onDidChangeTextDocument.dispose();
    }

    ctx.subscriptions.push(
      vscode.commands.registerCommand(lKey(keys.cmd.convert), async () => {
        return await convert();
      }),
    );

    ctx.subscriptions.push(
      vscode.commands.registerCommand(lKey(keys.cmd.convertFresh), async () => {
        return await convert(true);
      }),
    );

    ctx.subscriptions.push(
      vscode.commands.registerCommand(
        lKey(keys.cmd.resetAllSettings),
        async () => {
          return await resetAllSettings();
        },
      ),
    );

    ctx.subscriptions.push(
      vscode.commands.registerCommand(lKey(keys.cmd.openSettings), async () => {
        return await openSettingsWindow();
      }),
    );

    ctx.subscriptions.push(g);

    return Promise.resolve({ convert, type });
  } catch (err) {
    handleErr(err);
  }
}

/** @todo Potential cleanup needed. */
function deactivate() {}

/**
 * Converts JSON to Go. The main command of the extension.
 * @param {boolean} [fresh=false] Won't use saved settings or save any new ones if true.
 * @return {Promise<void>} A promise that resolves when the conversion is complete.
 */
async function convert(fresh = false) {
  try {
    let txt = '';
    let input = g.cfg.get(keys.settings.io.input);

    if (input === enums.input.askMe || fresh) {
      input = await vscode.window.showQuickPick(
        capArray([
          enums.input.clipboard,
          enums.input.selection,
          enums.input.currentFile,
        ]),
        {
          placeHolder:
            'Select input source (can be changed inside extension settings)',
        },
      );

      if (!input) {
        vscode.window.showInformationMessage('Nothing chosen, aborting');

        return;
      }

      input = input.toLowerCase();

      if (!fresh) {
        if (g.ctx.globalState.get(lKey(keys.ctx.perm.askRememberInput))) {
          const rememberInput = await vscode.window.showQuickPick(
            capValues(enums.Button.Remember),
            {
              placeHolder: 'Remember input?',
            },
          );

          switch (rememberInput) {
          case enums.Button.Remember.Yes:
            g.cfg.update(
              keys.settings.io.input,
              input,
              vscode.ConfigurationTarget.Global,
            );

            break;
          case enums.Button.Remember.DontAsk:
            g.ctx.globalState.update(
              lKey(keys.ctx.perm.askRememberInput),
              false,
            );

            break;
          case undefined:
          case enums.Button.Remember.No:
            break;

          default:
            weirdThrow(`Remember input: "${rememberInput}"`);
          }
        }
      }
    }

    switch (input) {
    case enums.input.selection: {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No editor active for input');

        return;
      }
      txt = editor.document.getText(editor.selection);

      break;
    }
    case enums.input.clipboard:
      txt = await vscode.env.clipboard.readText();

      break;
    case enums.input.currentFile:
      if (!vscode.window.activeTextEditor) {
        vscode.window.showErrorMessage('No editor active for input');

        return;
      }
      txt = vscode.window.activeTextEditor.document.getText();

      break;
    default:
      weirdThrow(`Input: "${input}"`);
    }

    if (!txt) {
      vscode.window.showErrorMessage(`Nothing found inside ${capStr(input)}`);

      return;
    }

    const struct = convertText(txt);

    if (struct.error) {
      vscode.window
        .showErrorMessage('Invalid JSON', enums.Button.ShowDetails)
        .then((btn) => {
          if (btn === enums.Button.ShowDetails) {
            vscode.window.showInformationMessage(struct.error);
          }
        });

      return;
    }

    let output = g.cfg.get(keys.settings.io.output);
    if (output === enums.output.askMe || fresh) {
      output = await vscode.window.showQuickPick(
        capArray([
          enums.output.clipboard,
          enums.output.cursorPosition,
          enums.output.temporaryFile,
        ]),
        {
          placeHolder: 'Select output destination',
        },
      );

      if (!output) {
        vscode.window.showInformationMessage('Nothing chosen, aborting');

        return;
      }

      output = output.toLowerCase();

      if (!fresh) {
        if (g.ctx.globalState.get(lKey(keys.ctx.perm.askRememberOutput))) {
          const rememberOutput = await vscode.window.showQuickPick(
            capValues(enums.Button.Remember),
            {
              placeHolder: 'Remember output?',
            },
          );

          switch (rememberOutput) {
          case enums.Button.Remember.Yes:
            g.cfg.update(
              keys.settings.io.output,
              output,
              vscode.ConfigurationTarget.Global,
            );

            break;
          case enums.Button.Remember.DontAsk:
            g.ctx.globalState.update(
              lKey(keys.ctx.perm.askRememberOutput),
              false,
            );

            break;
          case undefined:
          case enums.Button.Remember.No:
            break;

          default:
            weirdThrow(`Remember output "${rememberOutput}"`);
          }
        }
      }
    }
    switch (output) {
    case enums.output.clipboard:
      await vscode.env.clipboard.writeText(struct.go);
      if (g.ctx.globalState.get(lKey(keys.ctx.perm.notifyClipboardOutput))) {
        vscode.window
          .showInformationMessage(
            'Go struct copied to clipboard',
            enums.Button.DontShowAgain,
          )
          .then((btn) => {
            if (btn === enums.Button.DontShowAgain) {
              g.ctx.globalState.update(
                lKey(keys.ctx.perm.notifyClipboardOutput),
                false,
              );
              g.cfg.update(
                keys.ctx.perm.notifyClipboardOutput,
                false,
                vscode.ConfigurationTarget.Global,
              );
            }
          });
      }

      break;
    case enums.output.cursorPosition: {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No editor active for output');

        return;
      }

      editor.edit((editBuilder) => {
        editBuilder.insert(editor.selection.active, struct.go);
      });

      break;
    }
    case enums.output.temporaryFile: {
      const doc = await vscode.workspace.openTextDocument({
        language: 'go',
        content: struct.go,
      });

      await vscode.window.showTextDocument(
        doc,
        vscode.ViewColumn.Beside,
        false,
      );

      if (g.cfg.get(keys.settings.autoSelectTypeName)) {
        await vscode.commands.executeCommand('cursorMove', {
          to: 'right',
          by: 'character',
          value: 5,
        });
        await vscode.commands.executeCommand('cursorMove', {
          to: 'right',
          by: 'character',
          value: g.cfg.get(keys.settings.generatedTypeName).length,
          select: true,
        });
      }

      if (g.cfg.get(keys.settings.saveConversions)) {
        await saveConversion(txt, struct.go);
      }
    }
    }
  } catch (err) {
    handleErr(err);
  }
}

/**
 * Initializes and optionally resets the context for the extension.
 * @param {boolean} [reset=false] Indicates whether to reset the context values.
 * @return {Promise<Object>} A promise that resolves to the default context values.
 */
async function initCtx(reset = false) {
  const def = {
    // perm
    [keys.ctx.perm.askRememberInput]: true,
    [keys.ctx.perm.askRememberOutput]: true,
    [keys.ctx.perm.notifyClipboardOutput]: true,
    // temp
    [keys.ctx.temp.pasteIntegrationLangs]: ['go'],
    [keys.ctx.temp.promptForStructName]: true,
  };
  for (const [k, v] of Object.entries(def)) {
    if (reset || type(g.ctx.globalState.get(lKey(k))).is(enums.T.undefined)) {
      await g.ctx.globalState.update(lKey(k), v);
    }
  }

  return def;
}

async function resetAllSettings(force = false) {
  const reset = async () => {
    const settings = [
      keys.settings.addExamples,
      keys.settings.autoSelectTypeName,
      keys.settings.allOmitEmpty,
      keys.settings.inlineTypeDefinitions,
      keys.settings.generatedTypeName,
      keys.settings.saveConversions,
      keys.settings.io.input,
      keys.settings.io.output,
      keys.settings.pasteIntegration.promptForTypeName,
      keys.settings.pasteIntegration.supportedLanguages,
    ];

    for (const setting of settings) {
      await g.cfg.update(setting, undefined, vscode.ConfigurationTarget.Global);
    }

    await initCtx(true);

    return await li.updatePasteContext();
  };

  if (force) {
    await reset();

    return;
  }

  const btn = await vscode.window.showInformationMessage(
    enums.Button.AreYouSure,
    {
      modal: true,
      detail: 'Resets all JSON-to-Go data, except any saved conversions',
    },
    enums.Button.Confirm,
  );

  switch (btn) {
  case enums.Button.Cancel:
  case undefined:
    break;

  case enums.Button.Confirm:
    await reset();
    await openSettingsWindow();

    break;
  }
}

function openSettingsWindow() {
  vscode.commands.executeCommand(
    'workbench.action.openSettings',
    `@ext:maracko.${keys.jsonToGo}`,
  );
}

/**
 * Handles errors and displays an error message with details.
 * @param {Error} error - The error object.
 */
async function handleErr(error) {
  let msg;

  if (type(error?.message).isNot(enums.T.string)) {
    msg = `Error: An unknown error occurred in JSON to Go: ${JSON.stringify(
      error,
    )}`;
    g.log(msg, true);

    return;
  }

  msg = `Error:\nName: "${error.name}"\nMessage: "${error.message}"\nStack: "${error.stack}"`;
  g.log(msg, true);

  vscode.window
    .showErrorMessage(
      'An error occurred in JSON to Go',
      enums.Button.ShowDetails,
    )
    .then((btn) => {
      if (btn === enums.Button.ShowDetails) {
        vscode.window.showInformationMessage(msg);
      }
    });
}

module.exports = { activate, deactivate, convert, type };
