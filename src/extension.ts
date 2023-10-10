import * as os from "os";
import * as Path from "path";
import * as vscode from "vscode";
import { commands, ExtensionContext, Uri } from "vscode";
import { AdvancedOpenFile, activeInstance } from "./advancedOpenFile";

async function pathToCurrentDirectory(): Promise<string> {
  // activeTextEditor is undefined if there are no text editors
  //  - (I wish we could also get the cwd of activeTerminal)
  const currentEditor = vscode.window.activeTextEditor;
  if (currentEditor) {
    return Path.dirname(currentEditor.document.uri.path);
  }

  // If no active text editors, just use the workspace dir (which falls back to the home dir)
  return await pathToCurrentWorkspace();
}

async function pathToCurrentWorkspace(): Promise<string> {
  // activeTextEditor is undefined if there are no text editors
  const currentEditor = vscode.window.activeTextEditor;
  if (currentEditor) {
    // getWorkspaceFolder returns undefined if url matches no workspace folder
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(
      currentEditor.document.uri
    );
    if (workspaceFolder) {
      return workspaceFolder.uri.path;
    }
  }

  // workspaceFolders is undefined if no workspace is opened
  // workspaceFolders is [] if a workspace is opened but it has no folders
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders[0]) {
    return workspaceFolders[0].uri.path;
  }

  // Nothing worked, so fall back to the user's home dir so that we always return something
  return os.homedir();
}

const advancedOpenFile = (startAt: "cwd" | "workspace") => async () => {
  const workspaceDir = await pathToCurrentWorkspace();
  const startingDir =
    startAt === "workspace" ? workspaceDir : await pathToCurrentDirectory();

  const f = new AdvancedOpenFile(
    Uri.file(workspaceDir + Path.sep),
    Uri.file(startingDir + Path.sep)
  );
  f.pick();
};

export function activate(context: ExtensionContext) {
  context.subscriptions.push(
    commands.registerCommand(
      "extension.advancedOpenFile",
      advancedOpenFile("cwd")
    ),
    commands.registerCommand(
      "extension.advancedOpenWorkspaceFile",
      advancedOpenFile("workspace")
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
    ),
    commands.registerCommand("extension.advancedOpenFile.newFile", () =>
      activeInstance?.newFile()
    ),
    commands.registerCommand(
      "extension.advancedOpenFile.deleteActiveFile",
      () => activeInstance?.deleteActiveFile()
    ),
    commands.registerCommand("extension.advancedOpenFile.moveActiveFile", () =>
      activeInstance?.moveActiveFile()
    )
  );
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function deactivate() {}
