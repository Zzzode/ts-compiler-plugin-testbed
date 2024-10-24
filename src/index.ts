import * as ts from 'typescript';

class CustomCompilerHost implements ts.CompilerHost {
  private delegate: ts.CompilerHost;
  private customScanner: ts.Scanner;

  constructor(delegate: ts.CompilerHost) {
    this.delegate = delegate;
    this.customScanner = this.createCustomScanner();
  }

  private createCustomScanner(): ts.Scanner {
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, /*skipTrivia*/ false);

    const originalScan = scanner.scan;

    scanner.scan = function (...args: any): ts.SyntaxKind {
      const token = originalScan.apply(this, args);

      console.log(`Scanned token: ${ts.SyntaxKind[token]}, text: ${scanner.getTokenText()}`);

      // 这里可以添加自定义逻辑来修改标记

      return token;
    };

    return scanner;
  }

  createSourceFile(
    fileName: string,
    sourceText: string,
    languageVersion: ts.ScriptTarget,
    setParentNodes?: boolean,
    scriptKind?: ts.ScriptKind
  ): ts.SourceFile {
    console.log(`Creating SourceFile for: ${fileName}`);

    this.customScanner.setText(sourceText);
    let modifiedSourceText = '';
    let token: ts.SyntaxKind;
    while ((token = this.customScanner.scan()) !== ts.SyntaxKind.EndOfFileToken) {
      modifiedSourceText += this.customScanner.getTokenText();
    }

    const sourceFile = ts.createSourceFile(
      fileName,
      modifiedSourceText,
      languageVersion,
      setParentNodes,
      scriptKind
    );

    this.hookAST(sourceFile);

    return sourceFile;
  }

  getSourceFile(
    fileName: string,
    languageVersion: ts.ScriptTarget,
    onError?: (message: string) => void,
    shouldCreateNewSourceFile?: boolean
  ): ts.SourceFile | undefined {
    const sourceFile = this.delegate.getSourceFile(
      fileName,
      languageVersion,
      onError,
      shouldCreateNewSourceFile
    );

    if (sourceFile) {
      this.hookAST(sourceFile);
    }

    return sourceFile;
  }

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
      sourceFiles.forEach(sourceFile => this.hookAST(sourceFile));
    }
    this.delegate.writeFile(fileName, content, writeByteOrderMark, onError, sourceFiles);
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

  readFile(fileName: string): string | undefined {
    const fileContent = this.delegate.readFile(fileName);
    if (fileContent) {
      console.log(`Reading file: ${fileName}`);
      const sourceFile = this.createSourceFile(fileName, fileContent, ts.ScriptTarget.Latest);
      return sourceFile.getFullText();
    }
    return fileContent;
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

  private hookAST(sourceFile: ts.SourceFile): void {
    const visit = (node: ts.Node) => {
      // console.log(`Visiting node: ${ts.SyntaxKind[node.kind]}`);

      // 这里可以添加更多的处理逻辑
      // 例如，修改节点、收集信息等

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }
}

function compile(fileNames: string[], options: ts.CompilerOptions): void {
  const host = ts.createCompilerHost(options);
  const customHost = new CustomCompilerHost(host);
  const program = ts.createProgram(fileNames, options, customHost);

  const emitResult = program.emit();

  const diagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

  diagnostics.forEach(diagnostic => {
    if (diagnostic.file) {
      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!);
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      console.log(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
    } else {
      console.log(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    }
  });

  const exitCode = emitResult.emitSkipped ? 1 : 0;
  console.log(`Process exiting with code '${exitCode}'.`);
  process.exit(exitCode);
}

// 使用示例
const fileNames = ['test/samples/1.ts'];
const options: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2015,
  module: ts.ModuleKind.CommonJS
};

compile(fileNames, options);