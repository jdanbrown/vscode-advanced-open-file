import * as os from "os";
import * as Path from "path";
import * as vscode from "vscode";
import { commands, ExtensionContext, Uri } from "vscode";
import { AdvancedOpenFile, activeInstance } from "./advancedOpenFile";

function dirForActiveEditorOrTerminal(): string | null {
  // Get dir from active text/notebook editor
  //  - activeTextEditor is undefined if there are no text editors
  //  - activeNotebookEditor is undefined if there are no notebook editors
  const activeEditorUri =
    vscode.window.activeTextEditor?.document.uri ||
    vscode.window.activeNotebookEditor?.notebook.uri;
  const activeEditorDir =
    activeEditorUri && activeEditorUri.scheme === "file"
      ? Path.dirname(activeEditorUri.path)
      : null;
  // TODO Get cwd from active terminal -- which vscode tracks internally but doesn't yet expose
  //  - Need: https://github.com/microsoft/vscode/issues/145234 Expose shell integration command knowledge to extensions
  //  - Need: https://github.com/microsoft/vscode/issues/191924 Expose terminal's detected cwd to extensions
  const activeTerminalCwd: string | null = null;
  return activeEditorDir || activeTerminalCwd;
}

async function pathToCurrentDirectory(): Promise<string> {
  // Get dir for active text editor / notebook editor / terminal (TODO)
  const activeDir = dirForActiveEditorOrTerminal();
  if (activeDir) {
    return activeDir;
  }
  // If no active text editors, just use the workspace dir (which falls back to the home dir)
  return await pathToCurrentWorkspace();
}

async function pathToCurrentWorkspace(): Promise<string> {
  // Get dir for active text editor / notebook editor / terminal (TODO)
  const activeDir = dirForActiveEditorOrTerminal();
  if (activeDir) {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(
      Uri.file(activeDir)
    );
    if (workspaceFolder) {
      return workspaceFolder.uri.path;
    }
  }
  // Get dir from the first workspace folder
  //  - workspaceFolders is undefined if no workspace is opened
  //  - workspaceFolders is [] if a workspace is opened but it has no folders
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders[0]) {
    return workspaceFolders[0].uri.path;
  }
  // Nothing worked, so fall back to the user's home dir so that we always return something useful
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
