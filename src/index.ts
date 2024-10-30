import * as ts from 'typescript';

class CustomCompilerHost implements ts.CompilerHost {
  private delegate: ts.CompilerHost;
  private customScanner: ts.Scanner;

  constructor(delegate: ts.CompilerHost) {
    this.delegate = delegate
    this.customScanner = this.createCustomScanner();
  }

  // 创建 Scanner 并覆盖 scan 方法
  private createCustomScanner(): ts.Scanner {
    const scanner = ts.createScanner(
      ts.ScriptTarget.Latest,
      /*skipTrivia*/ false
    );
    const originalScan = scanner.scan;

    // 覆盖 Scanner 的 scan 方法，添加日志和自定义逻辑
    scanner.scan = function (...args: any): ts.SyntaxKind {
      const token = originalScan.apply(this, args);
      // console.log(`Scanned token: ${ts.SyntaxKind[token]}, text: '${scanner.getTokenText()}'`);

      // 自定义标记处理逻辑
      if (
        token === ts.SyntaxKind.Identifier &&
        scanner.getTokenText() === 'AAAAA'
      ) {
        debugger;
        console.log(`Found identifier: '${scanner.getTokenText()}'`);
      }

      return token;
    };

    return scanner;
  }

  // 确保在创建 SourceFile 时调用 Scanner
  createSourceFile(
    fileName: string,
    sourceText: string,
    languageVersion: ts.ScriptTarget,
    setParentNodes?: boolean,
    scriptKind?: ts.ScriptKind
  ): ts.SourceFile {
    console.log(`Creating SourceFile for: ${fileName}`);

    // 使用 Scanner 处理源代码文本
    this.customScanner.setText(sourceText);
    let modifiedSourceText = '';
    let token: ts.SyntaxKind;

    while (
      (token = this.customScanner.scan()) !== ts.SyntaxKind.EndOfFileToken
    ) {
      modifiedSourceText += this.customScanner.getTokenText();
    }

    // 使用修改后的源代码文本创建 SourceFile
    const sourceFile = ts.createSourceFile(
      fileName,
      modifiedSourceText,
      languageVersion,
      setParentNodes,
      scriptKind
    );

    // 进一步处理 AST
    this.hookAST(sourceFile);
    return sourceFile;
  }

  // 覆盖 getSourceFile 以确保 Scanner 处理所有 ts 文件
  getSourceFile(
    fileName: string,
    languageVersion: ts.ScriptTarget,
    onError?: (message: string) => void,
    shouldCreateNewSourceFile?: boolean
  ): ts.SourceFile | undefined {
    console.log(`getSourceFile called for: ${fileName}`);

    // 检查是否已经从 delegate 获取到 sourceFile
    let sourceFile = this.delegate.getSourceFile(
      fileName,
      languageVersion,
      onError,
      shouldCreateNewSourceFile
    );

    // 如果获取到的是 .ts 文件，需要进行自定义处理
    if (fileName.endsWith('.ts')) {
      const fileContent = this.readFile(fileName);
      if (fileContent) {
        // 通过自定义的 createSourceFile 来处理源文件，确保 scanner 被调用
        sourceFile = this.createSourceFile(
          fileName,
          fileContent,
          languageVersion
        );
      }
    }

    return sourceFile;
  }

  // 自定义的读文件操作
  readFile(fileName: string): string | undefined {
    const content = this.delegate.readFile(fileName);
    if (content) {
      console.log(`Reading file: ${fileName}`);
      return content;
    }
    console.error(`File not found or empty: ${fileName}`);
    return undefined;
  }

  // 以下部分保持不变

  getDefaultLibFileName(options: ts.CompilerOptions): string {
    return this.delegate.getDefaultLibFileName(options);
  }

  writeFile(
    fileName: string,
    content: string,
    writeByteOrderMark: boolean,
    onError?: (message: string) => void,
    sourceFiles?: readonly ts.SourceFile[]
  ): void {
    if (sourceFiles) {
      sourceFiles.forEach((sourceFile) => this.hookAST(sourceFile));
    }
    this.delegate.writeFile(
      fileName,
      content,
      writeByteOrderMark,
      onError,
      sourceFiles
    );
  }

  getCurrentDirectory(): string {
    return this.delegate.getCurrentDirectory();
  }

  getDirectories(path: string): string[] {
    return this.delegate.getDirectories!(path);
  }

  fileExists(fileName: string): boolean {
    return this.delegate.fileExists(fileName);
  }

  getCanonicalFileName(fileName: string): string {
    return this.delegate.getCanonicalFileName(fileName);
  }

  useCaseSensitiveFileNames(): boolean {
    return this.delegate.useCaseSensitiveFileNames();
  }

  getNewLine(): string {
    return this.delegate.getNewLine();
  }

  // Hook AST，进行自定义处理
  private hookAST(sourceFile: ts.SourceFile): void {
    const visit = (node: ts.Node) => {
      // 这里可以添加 AST 处理逻辑
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
}

// 使用示例
function compile(fileNames: string[], options: ts.CompilerOptions): void {
  const host = ts.createCompilerHost(options);
  const customHost = new CustomCompilerHost(host);
  const program = ts.createProgram(fileNames, options, customHost);

  const emitResult = program.emit();

  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics);

  diagnostics.forEach((diagnostic) => {
    if (diagnostic.file) {
      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
        diagnostic.start!
      );
      const message = ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        '\n'
      );
      console.log(
        `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`
      );
    } else {
      console.log(
        ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
      );
    }
  });

  const exitCode = emitResult.emitSkipped ? 1 : 0;
  console.log(`Process exiting with code '${exitCode}'.`);
  process.exit(exitCode);
}

// 编译 TypeScript 文件
const fileNames = ['test/samples/1.ts'];
const options: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2015,
  module: ts.ModuleKind.CommonJS,
};

compile(fileNames, options);
