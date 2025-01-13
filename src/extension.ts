import * as os from "os";
import * as Path from "path";
import * as vscode from "vscode";
import { commands, ExtensionContext, Uri } from "vscode";
import { AdvancedOpenFile, activeInstance } from "./advancedOpenFile";

function dirForActiveEditorOrTerminal(): string | null {
  // Explicitly handle non-file uris
  //  - e.g. uri='untitled:Untitled-1' for empty editors (cmd-n)
  //    - Path.dirname('untitled:Untitled-1') === '.' (wrong)
  function dirnameOfFileUri(uri: Uri): string | null {
    return uri.scheme === "file" ? Path.dirname(uri.path) : null;
  }

  // Get dir from active editor (text/notebook) or terminal
  //  - Fall-through logic: notebook first, then text editor, then terminal, else null (for workspace dir)
  //    - HACK activeTerminal stays defined as the _last_ active terminal (ugh), so we use hackIsTerminalFocusedProbably
  //      to try to distinguish "terminal is focused" vs. e.g. "Settings is focused", "Copilot Chat is focused", etc.
  //    - When a notebook is focused, activeTextEditor uri points at the editor cell in the notebook, or undefined if no
  //      cell is selected -- so check activeNotebookEditorUri before activeTextEditorUri
  //    - When something unusual like an image is focused, activeTextEditor and activeNotebookEditor are both undefined
  //      (but activeTerminal is maybe defined), so we reach into activeTab.input to figure out its uri
  //    - Else, return null to indicate to the caller that they should fallback to the workspace dir
  const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
  const activeTabInput = activeTab?.input;
  const activeTabInputUri = (activeTabInput as { uri: Uri })?.uri;
  const activeTextEditorUri = vscode.window.activeTextEditor?.document.uri;
  const activeNotebookEditorUri =
    vscode.window.activeNotebookEditor?.notebook.uri;
  const activeTerminal = vscode.window.activeTerminal;
  const activeTerminalCwdUri = activeTerminal?.shellIntegration?.cwd;
  const hackIsTerminalFocusedProbably =
    activeTerminal?.name === activeTab?.label;
  return activeNotebookEditorUri
    ? dirnameOfFileUri(activeNotebookEditorUri)
    : activeTextEditorUri
    ? dirnameOfFileUri(activeTextEditorUri)
    : activeTabInputUri
    ? dirnameOfFileUri(activeTabInputUri)
    : activeTerminalCwdUri && hackIsTerminalFocusedProbably
    ? activeTerminalCwdUri.path
    : null;
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
