import * as _ from "lodash";
import * as path from "path";
import * as os from "os";
import * as vscode from "vscode";
import { FileType, Uri, QuickPickItem } from "vscode";

const icons = {
  [FileType.File]: "$(file)",
  [FileType.Directory]: "$(file-directory)",
  [FileType.SymbolicLink | FileType.File]: "$(file-symlink-file)",
  [FileType.SymbolicLink | FileType.Directory]: "$(file-symlink-directory)",
  [FileType.Unknown]: "$(file)",
};

export class FileItem implements QuickPickItem {
  absolutePath: string;
  alwaysShow: boolean;
  label: string;
  filetype: FileType;

  constructor(absolutePath: string, filetype: FileType, label?: string) {
    this.absolutePath = absolutePath;
    this.label = `${icons[filetype]} ${label || path.basename(absolutePath)}`;
    this.alwaysShow = true;
    this.filetype = filetype;
  }
}

async function readDirectoryIfExists(
  uri: Uri
): Promise<Array<[string, FileType]> | null> {
  try {
    return await vscode.workspace.fs.readDirectory(uri);
  } catch (e) {
    if (e instanceof vscode.FileSystemError && e.code === "FileNotFound") {
      return null;
    } else {
      throw e;
    }
  }
}

export async function createFileItems(
  pathname: string
): Promise<ReadonlyArray<FileItem>> {
  const config = vscode.workspace.getConfiguration();

  const matchType: string | undefined = config.get<string>(
    "vscode-advanced-open-file.matchType"
  );

  let directory = pathname;
  let fragment = "";

  if (!pathname.endsWith(path.sep)) {
    directory = path.dirname(pathname);
    fragment = path.basename(pathname);
  }

  const isMatch = (() => {
    switch (matchType) {
      case "contiguous": {
        return (filename: string) => filename.includes(fragment);
      }
      case "sparse": {
        const regexp = new RegExp(
          fragment
            .split("")
            .map((s) => _.escapeRegExp(s))
            .join(".*")
        );
        return (filename: string) => regexp.test(filename);
      }
      case "prefix": {
        return (filename: string) => filename.startsWith(fragment);
      }
      default: {
        console.error(
          "[vscode-advanced-open-file] Unexpected value for matchType",
          { matchType }
        );
        return (filename: string) => filename.startsWith(fragment);
      }
    }
  })();

  const uri = Uri.file(directory);
  const files = (await readDirectoryIfExists(uri)) || [];
  const matchedFiles = files.filter((entry) => {
    let [filename] = entry;
    // Smart case
    if (fragment.toLowerCase() === fragment) {
      filename = filename.toLowerCase();
    }
    return isMatch(filename);
  });

  const filePickItems = await Promise.all(
    matchedFiles.map(async (fileArr) => {
      const f = fileArr[0];
      const absolutePath = path.join(directory, f);
      const uri = Uri.file(absolutePath);
      const fileType = await vscode.workspace.fs.stat(uri);

      return new FileItem(absolutePath, fileType.type);
    })
  );

  // Group directories first if desired
  if (config.get("vscode-advanced-open-file.groupDirectoriesFirst")) {
    filePickItems.sort((fileA, fileB) => {
      if (
        fileA.filetype === FileType.Directory &&
        fileB.filetype !== FileType.Directory
      ) {
        return -1;
      } else if (
        fileA.filetype !== FileType.Directory &&
        fileB.filetype === FileType.Directory
      ) {
        return 1;
      }

      return 0;
    });
  }

  const fsRoot =
    os.platform() === "win32" ? process.cwd().split(path.sep)[0] : "/";
  if (!fragment && directory !== fsRoot) {
    const parent = path.dirname(directory);
    if (config.get("vscode-advanced-open-file.includeDotDotItemForParent")) {
      filePickItems.unshift(new FileItem(parent, FileType.Directory, ".."));
    }
  }

  return filePickItems;
}
