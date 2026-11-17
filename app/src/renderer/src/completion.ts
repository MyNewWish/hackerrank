// The editor's static Python completion source: pure data, free of Monaco, so it can be tested
// directly. `monaco.ts` adapts it into a Monaco completion provider; a language server could later
// replace that provider without touching this module or the editor.

export type CompletionKind = "keyword" | "builtin" | "snippet" | "identifier";

export interface CompletionEntry {
  label: string;
  kind: CompletionKind;
  /** Text to insert; for snippets, Monaco snippet syntax (`${1:name}`, `$0`). */
  insertText: string;
  /** A short note shown beside the label. */
  detail?: string;
}

const KEYWORDS = [
  "False", "None", "True", "and", "as", "assert", "async", "await", "break", "class", "continue",
  "def", "del", "elif", "else", "except", "finally", "for", "from", "global", "if", "import", "in",
  "is", "lambda", "nonlocal", "not", "or", "pass", "raise", "return", "try", "while", "with", "yield",
  "match", "case",
];

const BUILTINS = [
  "abs", "all", "any", "ascii", "bin", "bool", "bytearray", "bytes", "callable", "chr",
  "classmethod", "dict", "dir", "divmod", "enumerate", "filter", "float", "format", "frozenset",
  "getattr", "hasattr", "hash", "hex", "id", "input", "int", "isinstance", "issubclass", "iter",
  "len", "list", "map", "max", "min", "next", "object", "oct", "open", "ord", "pow", "print",
  "property", "range", "repr", "reversed", "round", "set", "setattr", "slice", "sorted",
  "staticmethod", "str", "sum", "super", "tuple", "type", "zip",
  "Exception", "ValueError", "KeyError", "IndexError", "TypeError", "StopIteration",
];

/** Common stdin → stdout boilerplate, in Monaco snippet syntax. */
const SNIPPETS: Omit<CompletionEntry, "kind">[] = [
  {
    label: "ifmain",
    detail: 'if __name__ == "__main__": main()',
    insertText: 'if __name__ == "__main__":\n    ${1:main()}$0',
  },
  {
    label: "defmain",
    detail: "def main() plus the main guard",
    insertText: 'def main():\n    ${1:pass}$0\n\n\nif __name__ == "__main__":\n    main()\n',
  },
  {
    label: "readlines",
    detail: "Read every stdin line into a list",
    insertText: "import sys\n\n${1:lines} = sys.stdin.read().splitlines()\n$0",
  },
  {
    label: "forline",
    detail: "Loop over stdin line by line",
    insertText: 'import sys\n\nfor ${1:line} in sys.stdin:\n    ${1:line} = ${1:line}.rstrip("\\n")\n    $0',
  },
  {
    label: "readints",
    detail: "Read one line of space-separated integers",
    insertText: "${1:nums} = list(map(int, input().split()))$0",
  },
];

const KEYWORDS_AND_BUILTINS = new Set([...KEYWORDS, ...BUILTINS]);

/**
 * Words in `text` that look like identifiers and aren't keywords or builtins. `wordAtCursor`, the
 * word being typed, is left out unless it also occurs elsewhere: it is not a word the user has written yet.
 */
function identifiersIn(text: string, wordAtCursor: string): string[] {
  const counts = new Map<string, number>();
  for (const [word] of text.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) {
    if (!KEYWORDS_AND_BUILTINS.has(word)) counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  if (counts.get(wordAtCursor) === 1) counts.delete(wordAtCursor);
  return [...counts.keys()];
}

/**
 * Everything the static provider offers for a file whose text is `text`, with `wordAtCursor` being
 * typed: keywords, builtins, snippets and the file's own identifiers. The editor filters them by prefix.
 */
export function pythonCompletions(text: string, wordAtCursor = ""): CompletionEntry[] {
  return [
    ...KEYWORDS.map((label): CompletionEntry => ({ label, kind: "keyword", insertText: label })),
    ...BUILTINS.map((label): CompletionEntry => ({ label, kind: "builtin", insertText: label })),
    ...SNIPPETS.map((s): CompletionEntry => ({ ...s, kind: "snippet" })),
    ...identifiersIn(text, wordAtCursor).map((label): CompletionEntry => ({ label, kind: "identifier", insertText: label })),
  ];
}
