import ts from "typescript";

/** Dedent a fixture and guarantee a single trailing newline. */
export function source(text: string): string {
  const trimmed = text.replace(/^\n/, "").replace(/\n[ \t]*$/, "");
  const lines = trimmed.split("\n");
  const indents = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => line.match(/^[ \t]*/)?.[0].length ?? 0);
  const margin = indents.length === 0 ? 0 : Math.min(...indents);
  return `${lines.map((line) => line.slice(margin)).join("\n")}\n`;
}

/** Typecheck generated declarations the way a consumer's project would. */
export function typecheck(generated: string): string[] {
  const fileName = "generated.ts";
  const options: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    lib: ["es2022", "dom"],
    types: [],
    skipLibCheck: true,
  };

  const host = ts.createCompilerHost(options);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (file, languageVersion, onError, shouldCreateNewSourceFile) => {
    if (file === fileName) {
      return ts.createSourceFile(file, generated, languageVersion, true, ts.ScriptKind.TS);
    }
    return originalGetSourceFile(file, languageVersion, onError, shouldCreateNewSourceFile);
  };
  const originalFileExists = host.fileExists.bind(host);
  host.fileExists = (file) => file === fileName || originalFileExists(file);
  const originalReadFile = host.readFile.bind(host);
  host.readFile = (file) => (file === fileName ? generated : originalReadFile(file));

  const program = ts.createProgram([fileName], options, host);
  return ts
    .getPreEmitDiagnostics(program)
    .filter((diagnostic) => diagnostic.file?.fileName === fileName)
    .map((diagnostic) => {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
      if (diagnostic.file === undefined || diagnostic.start === undefined) return message;
      const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
      return `${position.line + 1}:${position.character + 1} ${message}`;
    });
}

export function expectCompiles(generated: string): void {
  const errors = typecheck(generated);
  if (errors.length > 0) {
    throw new Error(`Generated TypeScript failed to typecheck:\n${generated}\n${errors.join("\n")}`);
  }
}
