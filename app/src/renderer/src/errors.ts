/** IPC errors arrive as "Error invoking remote method 'x': Error: <message>". */
export function errorMessage(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  return message.replace(/^Error invoking remote method '[^']+': (\w*Error: )?/, "");
}
