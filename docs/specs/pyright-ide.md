# Spec: Python IDE features via Pyright

Status: agreed, not started · 2026-11-16 · Issue: #15 · Depends on #8 (static completion = HackerRank-like mode) and #9 (settings store)

## Goal
Give the Monaco editor completion, signature help, hover, and diagnostics for Python, powered by
[Pyright](https://github.com/microsoft/pyright), offline, with no pip installs. Keep a
"HackerRank-like" mode so practice can match the real screen, whose editor has only basic
keyword completion.

## Decisions
| # | Decision | Choice |
|---|---|---|
| 1 | Realism | A setting with two modes: **Full IDE** (default, uses Pyright) and **HackerRank-like** (Monaco's built-in word completion only). A lock for timed mocks can come later. |
| 2 | Features | **In:** completion, signature help, hover, diagnostics. **Out:** rename, go-to-def, references, code actions, semantic tokens, formatting. |
| 3 | Server | The official npm `pyright` package (`langserver.index.js`). It speaks LSP, so swapping in basedpyright later is trivial. Pylance can't be used (license). |
| 4 | Where it runs | In Electron main, via `utilityProcess.fork` on pyright's language server with `--stdio`. LSP messages pass to the renderer over IPC. |
| 5 | Client | A hand-written bridge, **not** `monaco-languageclient` (that would mean replacing `monaco-editor` with `@codingame/monaco-vscode-api`). Message types come from `vscode-languageserver-protocol`. |
| 6 | Environment | Bundled typeshed stdlib stubs only. `pythonVersion` is set from `discoverPython()`. No site-packages. |
| 7 | Size | About 20 MB more is acceptable. `pyright` must be unpacked from asar (`asarUnpack`) so the server can read the typeshed files. |
| 8 | Setting storage | An `ideMode: "full" \| "hackerrank"` key in the settings store that #9 builds (`userData`, main-owned, get/set over IPC). The toggle sits in the toolbar next to Run/Submit. |
| 9 | Strictness | `typeCheckingMode: "basic"`. |
| 10 | Diagnostics impact | Advisory only. Run/Submit never warn or block. |
| 11 | Documents | One in-memory document per open question (`didOpen` on mount, `didChange` on edit, `didClose` on unmount or question switch). The URI is virtual, e.g. `file:///hackrank/<questionId>/solution.py`. The server never reads the autosaved file. |
| 12 | Completion trigger | Automatic while typing, and on `.` (normal VS Code behaviour). |
| 13 | Failure | If the server fails to start or crashes: restart once, then fall back to word completion with a small status note ("Python IDE features unavailable"). The editor and Run/Submit are never affected. |
| 14 | Testing | Integration tests run the real server under `bun test`. Unit tests cover the pure LSP→Monaco converters. The Monaco providers are checked by hand in the app. |

## Architecture
```
renderer (Monaco)                      main                          utilityProcess
───────────────────                    ─────                         ──────────────
lsp/providers.ts  ── window.hackrank ──► lsp/server.ts ── stdio ──► pyright langserver
  Completion/Hover/SignatureHelp          spawn, restart-once,        (typeshed bundled)
  setModelMarkers(diagnostics)            JSON-RPC (vscode-jsonrpc)
lsp/convert.ts (pure, unit-tested)      settings store from #9 (+ ideMode)
```

- **Main (`src/main/lsp/server.ts`):** starts the server lazily the first time an editor opens in
  Full IDE mode. Sends `initialize` with `rootUri` set to the virtual workspace, and settings
  `python.analysis.typeCheckingMode = "basic"` and `pythonVersion` from `discoverPython`. Answers
  `workspace/configuration` requests. Exposes request/notify over IPC and forwards
  `textDocument/publishDiagnostics` to the renderer. Stops the server when the mode switches to
  HackerRank-like, and on app quit.
- **IPC (`src/shared/api.ts`):** add channels to `CHANNELS` and `HackrankApi`, roughly:
  `lsp:open(id, text)`, `lsp:change(id, version, text)` (full-text sync is enough for one small file),
  `lsp:close(id)`, `lsp:completion(id, pos)`, `lsp:hover(id, pos)`, `lsp:signatureHelp(id, pos, ctx)`,
  `lsp:diagnostics` (main → renderer push), `lsp:status` (main → renderer push: `ready | unavailable`),
  plus `ideMode` via the existing settings channels from #9. The renderer never sees raw JSON-RPC.
- **Renderer (`src/renderer/src/lsp/`):** `providers.ts` registers the Monaco providers once for
  `python` when Full IDE is on, and disposes them when it's off. In Full IDE mode it also disables
  Monaco's word-based suggestions (`wordBasedSuggestions: "off"`) so results aren't duplicated.
  HackerRank-like turns them back on. `App.tsx` sends open/change/close in step with the
  `<Editor key={question.id}>` lifecycle. Diagnostics map to `monaco.editor.setModelMarkers`
  with owner `pyright`.
- **Converters (`convert.ts`, pure):** LSP 0-based positions ↔ Monaco 1-based; `CompletionItemKind`
  → `monaco.languages.CompletionItemKind`; `DiagnosticSeverity` → `MarkerSeverity`; `MarkupContent`
  → `IMarkdownString`; `textEdit`/`insertText` → Monaco ranges. Completion items are resolved
  (`completionItem/resolve`) for documentation.

## Packaging
- Add deps: `pyright`, `vscode-jsonrpc`, `vscode-languageserver-protocol`.
- Find the server entry with `require.resolve("pyright/langserver.index.js")`, with a path
  fixed up for `app.asar.unpacked` in packaged builds.
- Keep main's bundle from inlining pyright (mark it `external` in `electron.vite.config.ts`).

## Tests
- `test/lsp.test.ts` (integration): start the real server and open a document. Then assert that:
  - `import sys\nsys.std` → completion includes `stdin`, `stdout`.
  - `print(undefined_name)` → one diagnostic on `undefined_name`.
  - hover on `len` → contents mention `len(`.
  - a syntax error → a diagnostic; fixing it via `didChange` → the diagnostics clear.
- `test/lsp-convert.test.ts` (unit): position/range round-trip, kind and severity tables, markdown passthrough.
- Settings: `ideMode` defaults to `full` when missing or invalid, and survives a restart.
- Manual: toggle modes, switch questions (no leaked markers), kill the server process → status note, editor still works.

## Out of scope
Rename, go-to-definition, references, code actions, formatting, semantic highlighting, inlay
hints, third-party packages, timed-mock lock, a dedicated settings screen.
