import * as Path from "path";
import * as vscode from "vscode";
import { commands, ExtensionContext, WorkspaceFolder, Uri } from "vscode";
import { AdvancedOpenFile, activeInstance } from "./advancedOpenFile";

async function pickWorkspace(): Promise<string> {
  const targetWorkspaceFolder: WorkspaceFolder | undefined =
    await vscode.window.showWorkspaceFolderPick();
  if (targetWorkspaceFolder === undefined) {
    throw new Error("No workspace is opened.");
  }

  return targetWorkspaceFolder.uri.path;
}

async function pathToCurrentDirectory(): Promise<string> {
  const currentEditor = vscode.window.activeTextEditor;
  if (currentEditor) {
    return Path.dirname(currentEditor.document.uri.path);
  }

  return pickWorkspace();
}

async function pathToCurrentWorkspace(): Promise<string> {
  const currentEditor = vscode.window.activeTextEditor;
  if (currentEditor) {
    const folder = vscode.workspace.getWorkspaceFolder(
      currentEditor.document.uri
    );
    if (folder === undefined) {
      throw new Error("No workspace exists");
    }

    return folder.uri.path;
  }

  return pickWorkspace();
}

async function advancedOpenFile(): Promise<void> {
  let defaultDir = await pathToCurrentDirectory();
  defaultDir += Path.sep;

  const f = new AdvancedOpenFile(Uri.file(defaultDir));
  f.pick();
}

async function advancedOpenWorkspaceFile(): Promise<void> {
  let defaultDir = await pathToCurrentWorkspace();
  defaultDir += Path.sep;

  const f = new AdvancedOpenFile(Uri.file(defaultDir));
  f.pick();
}

export function activate(context: ExtensionContext) {
  context.subscriptions.push(
    commands.registerCommand("extension.advancedOpenFile", advancedOpenFile),
    commands.registerCommand(
      "extension.advancedOpenWorkspaceFile",
      advancedOpenWorkspaceFile
    ),
    commands.registerCommand(
      "extension.advancedOpenFile.deletePathComponent",
      () => activeInstance?.deletePathComponent()
    ),
    commands.registerCommand("extension.advancedOpenFile.tabComplete", () =>
      activeInstance?.tabComplete()
    ),
    commands.registerCommand(
      "extension.advancedOpenFile.addCurrentFolderToWorkspace",
      () => activeInstance?.addCurrentFolderToWorkspace()
    )
  );
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function deactivate() {}
