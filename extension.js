const fs = require("fs");
const path = require("path");
const vscode = require("vscode");
const { displayName, name } = require("./package.json");
const { ConfigAggregator, StateAggregator, SfProject } = require("@salesforce/core");
const { ComponentSet } = require("@salesforce/source-deploy-retrieve");
const formatter = require("./omnistudio-formatter/index.js");

// Output channel — visible under View > Output > "Omnistudio Prettier"
let outputChannel;

function getIndent() {
    return vscode.workspace.getConfiguration(name).get("indent", "\t");
}

// ─────────────────────────────────────────────────────────────────────────────
// Activation
// ─────────────────────────────────────────────────────────────────────────────

function activate(context) {
    outputChannel = vscode.window.createOutputChannel(displayName);
    context.subscriptions.push(outputChannel);
    outputChannel.appendLine(`[${displayName}] Extension activated.`);

    context.subscriptions.push(
        vscode.commands.registerCommand(`${name}.formatDirectory`, cmdFormatDirectory),
        vscode.commands.registerCommand(`${name}.formatWorkspace`, cmdFormatWorkspace),
        vscode.commands.registerCommand(`${name}.retrieve`, cmdRetrieve),
        vscode.commands.registerCommand(`${name}.deploy`, cmdDeploy),
    );

    // Register as the document formatter for omnistudio-xml files
    context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider({ language: "omnistudio-xml" }, { provideDocumentFormattingEdits }));
}

function deactivate() {}

// ─────────────────────────────────────────────────────────────────────────────
// Retrieve command
// ─────────────────────────────────────────────────────────────────────────────

async function getUsername() {
    const aggregator = await ConfigAggregator.create();
    const aliasOrUsername = aggregator.getPropertyValue("target-org");

    if (!aliasOrUsername) {
        throw new Error('No default org set. Run "SFDX: Set a Default Org" first.');
    }

    // Resolve alias to actual username
    const stateAggregator = await StateAggregator.getInstance();
    const username = (await stateAggregator.aliases.resolveUsername(aliasOrUsername)) ?? aliasOrUsername;
    return username;
}

async function cmdRetrieve(uri, uris) {
    const filePaths = [];
    if (uris) {
        for (const uri of uris) {
            if (fs.statSync(uri.fsPath).isDirectory()) {
                const files = fs.globSync("**/*.{os,oip,ouc,rpt}-meta.xml", { cwd: uri.fsPath }).map((f) => path.join(uri.fsPath, f));
                filePaths.push(...files);
            } else {
                filePaths.push(uri.fsPath);
            }
        }
    } else {
        const fsPath = vscode.window.activeTextEditor?.document.uri.fsPath;
        if (fsPath) {
            filePaths.push(fsPath);
        }
    }
    if (filePaths.length < 1) {
        vscode.window.showWarningMessage(`${displayName}: No files selected.`);
        return;
    }

    for (const filePath of filePaths) {
        outputChannel.appendLine(`[${displayName}] Retrieving: ${filePath}`);
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: displayName,
            cancellable: false,
        },
        async (progress) => {
            progress.report({ message: `Retrieving Components...` });

            try {
                const project = await SfProject.getInstance();
                const retrieveOperation = await ComponentSet.fromSource(filePaths).retrieve({
                    usernameOrConnection: await getUsername(),
                    output: project.path,
                    merge: true,
                });

                const result = await retrieveOperation.pollStatus();

                if (result.response.status === "Succeeded") {
                    for (const filePath of filePaths) {
                        outputChannel.appendLine(`[${displayName}] Retrieved: ${filePath}`);
                    }
                    progress.report({ message: "Formatting..." });
                    for (const filePath of filePaths) {
                        const formatResult = formatter.formatFile(filePath, getIndent());
                        outputChannel.appendLine(`[${displayName}] ${formatResult.message}`);
                    }
                    if (vscode.workspace.getConfiguration(name).get("showNotifications", true)) {
                        vscode.window.showInformationMessage(`${displayName}: Retrieved Components.`);
                    }
                } else {
                    vscode.window.showWarningMessage(`${displayName}: Retrieve completed with status: ${result.response.status}`);
                }
            } catch (err) {
                outputChannel.appendLine(`[${displayName}] Retrieve error: ${err.message}`);
                outputChannel.show();
                vscode.window.showErrorMessage(`${displayName} retrieve error: ${err.message}`);
            }
        },
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Deploy command
// ─────────────────────────────────────────────────────────────────────────────

async function cmdDeploy(uri, uris) {
    let SF_DEPLOY_COMMAND = "sf.metadata.deploy.source.path";
    const filePaths = [];
    if (uris) {
        for (const uri of uris) {
            if (fs.statSync(uri.fsPath).isDirectory()) {
                const files = fs.globSync("**/*.{os,oip,ouc,rpt}-meta.xml", { cwd: uri.fsPath }).map((f) => path.join(uri.fsPath, f));
                filePaths.push(...files);
            } else {
                filePaths.push(uri.fsPath);
            }
        }
    } else {
        SF_DEPLOY_COMMAND = "sf.metadata.deploy.active.editor";
        const fsPath = vscode.window.activeTextEditor?.document.uri.fsPath;
        if (fsPath) {
            filePaths.push(fsPath);
        }
    }
    if (filePaths.length < 1) {
        vscode.window.showWarningMessage(`${displayName}: No files selected.`);
        return;
    }

    try {
        for (const filePath of filePaths) {
            const result = formatter.minifyFile(filePath, getIndent());
            outputChannel.appendLine(`[${displayName}] ${result.message}`);
        }
    } catch (err) {
        outputChannel.appendLine(`[${displayName}] Pre-deploy format error: ${err.message}`);
        // Don't abort deploy if formatting fails
    }

    vscode.commands.executeCommand(SF_DEPLOY_COMMAND, uri, uris);

    outputChannel.appendLine(`[${displayName}] Sleeping 5 seconds...`);
    await sleep(5);

    for (const filePath of filePaths) {
        const formatResult = formatter.formatFile(filePath, getIndent());
        outputChannel.appendLine(`[${displayName}] ${formatResult.message}`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Document formatter — called by VS Code on Format Document (Shift+Alt+F)
// ─────────────────────────────────────────────────────────────────────────────

async function provideDocumentFormattingEdits(document) {
    const filePath = document.uri.fsPath;

    try {
        const originalContent = document.getText();
        const { formatted, changed } = formatter.formatFileContent(filePath, originalContent, getIndent());

        if (!changed) {
            outputChannel.appendLine(`[${displayName}] Already formatted: ${filePath}`);
            return [];
        }

        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(originalContent.length));

        outputChannel.appendLine(`[${displayName}] Formatted: ${filePath}`);
        return [vscode.TextEdit.replace(fullRange, formatted)];
    } catch (err) {
        outputChannel.appendLine(`[${displayName}] ERROR during formatting: ${err.message}`);
        outputChannel.show();
        return [];
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Command handlers
// ─────────────────────────────────────────────────────────────────────────────

async function cmdFormatDirectory(uri) {
    let dirPath = uri?.fsPath;
    if (!dirPath) {
        return;
    }
    await runFormatterOnDirectory(dirPath);
}

async function cmdFormatWorkspace() {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) {
        vscode.window.showWarningMessage(`${displayName}: No workspace folder open.`);
        return;
    }
    await runFormatterOnDirectory(root);
}

async function runFormatterOnDirectory(dirPath) {
    outputChannel.appendLine(`[${displayName}] Formatting directory: ${dirPath}`);

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: displayName,
            cancellable: false,
        },
        async (progress) => {
            progress.report({ message: "Formatting..." });
            try {
                const results = formatter.formatDirectory(dirPath, getIndent());
                let formatted = 0;
                for (const result of results) {
                    outputChannel.appendLine(`[${displayName}] ${result.message}`);
                    if (result.changed) {
                        formatted++;
                    }
                }
                if (vscode.workspace.getConfiguration(name).get("showNotifications", true)) {
                    vscode.window.showInformationMessage(`${displayName}: ${formatted} file${formatted > 1 ? "s" : ""} formatted.`);
                }
            } catch (err) {
                outputChannel.appendLine(`[${displayName}] ERROR: ${err.message}`);
                outputChannel.show();
                vscode.window.showErrorMessage(`${displayName} error: ${err.message}`);
            }
        },
    );
}

function sleep(sec) {
    return new Promise((resolve) => setTimeout(resolve, sec * 1000));
}

module.exports = { activate, deactivate };
