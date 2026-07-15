export function canPrompt(): boolean {
  if ('CI' in process.env) return false;
  return process.stdin.isTTY === true;
}
