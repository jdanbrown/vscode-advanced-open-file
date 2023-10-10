import * as os from "os";
import * as Path from "path";
import * as vscode from "vscode";
import { FileType, QuickPick, Uri } from "vscode";
import { FileItem, createFileItems } from "./fileItem";

export let activeInstance: AdvancedOpenFile | null = null;

function getFsRoot(): string {
  return os.platform() === "win32" ? process.cwd().split(Path.sep)[0] : "/";
}

function ensureEndsWith(s: string, endsWith: string): string {
  if (s.endsWith(endsWith)) {
    return s;
  } else {
    return s + endsWith;
  }
}

function ensureEndsWithPathSep(path: string): string {
  return ensureEndsWith(path, Path.sep);
}

async function fileExists(uri: Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch (e) {
    return false;
  }
}

export class AdvancedOpenFile {
  private workspaceDir: Uri;
  private currentPath: Uri;
  private picker: QuickPick<FileItem>;

  constructor(workspaceDir: Uri, currentPath: Uri) {
    this.picker = this.initPicker();
    this.workspaceDir = workspaceDir;
    this.currentPath = currentPath;
  }

  async pick() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    activeInstance = this;
    // Expose custom keys for "when" clauses in keybindings
    //  - https://code.visualstudio.com/api/references/when-clause-contexts#add-a-custom-when-clause-context
    vscode.commands.executeCommand(
      "setContext",
      "extension.advancedOpenFile.active",
      true
    );
    this.show();

    this.picker.value = ensureEndsWithPathSep(this.currentPath.fsPath);
    this.picker.items = await createFileItems(this.currentPath.fsPath);
  }

  initPicker(): QuickPick<FileItem> {
    const picker: QuickPick<FileItem> = vscode.window.createQuickPick();
    // picker.onDidChangeActive(this.onDidChangeActive.bind(this));
    // picker.onDidChangeSelection(this.onDidChangeSelection.bind(this));
    picker.onDidChangeValue(this.onDidChangeValue.bind(this));
    picker.onDidAccept(this.onDidAccept.bind(this));
    picker.onDidHide(this.onDidHide.bind(this));

    return picker;
  }

  show() {
    this.picker.show();
  }

  dispose() {
    this.picker.dispose();
  }

  // async onDidChangeActive(items: readonly FileItem[]) {
  //   console.log("[XXX] onDidChangeActive", {
  //     items,
  //     item0: items[0]?.absolutePath,
  //   });
  // }

  // async onDidChangeSelection(items: readonly FileItem[]) {
  //   console.log("[XXX] onDidChangeSelection", {
  //     items,
  //     item0: items[0]?.absolutePath,
  //   });
  // }

  async onDidChangeValue(value: string) {
    // console.log("[XXX] onDidChangeValue", { value });

    // Special path handling
    //  - "" -> show no items (to avoid confusion)
    //  - "...//" -> rewrite to fs root
    //  - ".../~/" -> rewrite to home dir
    //  - ".../:/" -> rewrite to project root dir
    if (value === "") {
      this.picker.items = [];
    } else if (value.endsWith(`${Path.sep}${Path.sep}`)) {
      this.picker.value = ensureEndsWithPathSep(getFsRoot());
    } else if (value.endsWith(`${Path.sep}~${Path.sep}`) || value === "~") {
      this.picker.value = ensureEndsWithPathSep(os.homedir());
    } else if (value.endsWith(`${Path.sep}:${Path.sep}`) || value === ":") {
      this.picker.value = ensureEndsWithPathSep(this.workspaceDir.path);
    } else {
      // List matching files
      createFileItems(value).then((items: ReadonlyArray<FileItem>) => {
        this.picker.items = items;
      });
    }
  }

  async onDidAccept() {
    // console.log("[XXX] onDidAccept", {value: this.picker.value, selectedItem: this.picker.selectedItems[0]?.absolutePath});
    const pickedItem = this.picker.selectedItems[0];
    if (pickedItem) {
      if ((pickedItem.filetype & FileType.File) > 0) {
        this.dispose();
        this.openFile(Uri.file(pickedItem.absolutePath));
      } else {
        const path =
          pickedItem.absolutePath +
          (pickedItem.absolutePath === getFsRoot() ? "" : Path.sep);
        this.currentPath = Uri.file(path);
        this.pick();
      }
    }
  }

  async onDidHide() {
    activeInstance = null;
    await vscode.commands.executeCommand(
      "setContext",
      "extension.advancedOpenFile.active",
      false
    );
    this.dispose();
  }

  async deletePathComponent() {
    this.picker.value = ensureEndsWithPathSep(Path.dirname(this.picker.value));
  }

  async tabComplete() {
    const activeItem = this.picker.activeItems[0];
    if (activeItem) {
      let path = activeItem.absolutePath;
      if ((activeItem.filetype & FileType.Directory) > 0) {
        path = ensureEndsWithPathSep(path);
      }
      this.picker.value = path;
    }
  }

  async addCurrentFolderToWorkspace() {
    const dirPath = this.picker.value;
    if (dirPath.endsWith(Path.sep)) {
      const dirUri = Uri.file(dirPath);
      if (await fileExists(dirUri)) {
        this.dispose();
        // Adding a workspace folder requires this bit of crazy
        //  - https://code.visualstudio.com/api/references/vscode-api#workspace
        vscode.workspace.updateWorkspaceFolders(
          vscode.workspace.workspaceFolders?.length ?? 0,
          null,
          { uri: dirUri }
        );
        vscode.window.showInformationMessage(
          `Added folder to workspace: ${dirPath}`
        );
      }
    }
  }

  async newFile() {
    const path = this.picker.value;
    if (
      path &&
      !path.endsWith(Path.sep) &&
      !(await fileExists(Uri.file(path)))
    ) {
      this.dispose();
      await this.createFile(path);
    }
  }

  async deleteActiveFile() {
    const activeItem = this.picker.activeItems[0];
    if (activeItem) {
      this.dispose();
      vscode.commands.executeCommand(
        "fileutils.removeFile",
        Uri.file(activeItem.absolutePath)
      );
    }
  }

  async moveActiveFile() {
    const activeItem = this.picker.activeItems[0];
    if (activeItem) {
      this.dispose();
      vscode.commands.executeCommand(
        "fileutils.moveFile",
        Uri.file(activeItem.absolutePath)
      );
    }
  }

  async createFile(path: string) {
    const uri = Uri.file(path);
    const directory = Uri.file(Path.dirname(path));
    // Ensure parent dirs exist
    await vscode.workspace.fs.createDirectory(directory);
    // Create file
    //  - Careful: Don't overwrite with an empty file if file already exists
    const edit = new vscode.WorkspaceEdit();
    edit.createFile(uri, { overwrite: false });
    const applied = await vscode.workspace.applyEdit(edit);
    if (applied) {
      // Open file
      await this.openFile(uri);
    }
  }

  async openFile(uri: Uri) {
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document);
  }
}
