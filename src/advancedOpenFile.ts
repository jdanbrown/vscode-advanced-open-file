import * as os from "os";
import * as Path from "path";
import * as vscode from "vscode";
import { FileType, QuickPick, Uri } from "vscode";
import { FileItem, createFileItems } from "./fileItem";

export let activeInstance: AdvancedOpenFile | null = null;

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

export class AdvancedOpenFile {
  private currentPath: Uri;
  private picker: QuickPick<FileItem>;

  constructor(uri: Uri) {
    this.picker = this.initPicker();
    this.currentPath = uri;
  }

  async pick() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    activeInstance = this;
    this.show();

    this.picker.value = this.currentPath.fsPath;
    this.picker.items = await createFileItems(this.currentPath.fsPath);
  }

  initPicker(): QuickPick<FileItem> {
    const picker: QuickPick<FileItem> = vscode.window.createQuickPick();
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

  onDidChangeValue(value: string) {
    createFileItems(value).then((items: ReadonlyArray<FileItem>) => {
      this.picker.items = items;
    });
  }

  onDidAccept() {
    const pickedItem = this.picker.selectedItems[0];
    const newFilepath = this.picker.value;

    if (pickedItem) {
      if ((pickedItem.filetype & FileType.File) > 0) {
        this.currentPath = Uri.file(pickedItem.absolutePath);
        this.openFile();
      } else {
        const fsRoot =
          os.platform() === "win32" ? process.cwd().split(Path.sep)[0] : "/";
        const path =
          pickedItem.absolutePath +
          (pickedItem.absolutePath === fsRoot ? "" : Path.sep);
        this.currentPath = Uri.file(path);
        this.pick();
      }
    } else {
      this.currentPath = Uri.file(newFilepath);
      this.createFile();
    }
  }

  onDidHide() {
    activeInstance = null;
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

  createFile() {
    this.dispose();

    const path = this.currentPath.fsPath;
    const parts = path.split(Path.sep);
    const fragment = parts[parts.length - 1];
    const directory = Uri.file(
      path.substring(0, path.length - fragment.length)
    );

    vscode.workspace.fs.createDirectory(directory).then(() => {
      const uri = Uri.file(path);
      const content = new Uint8Array(0);
      vscode.workspace.fs.writeFile(uri, content).then(() => this.openFile());
    });
  }

  openFile() {
    this.dispose();

    vscode.workspace.openTextDocument(this.currentPath).then((document) => {
      vscode.window.showTextDocument(document);
    });
  }
}
