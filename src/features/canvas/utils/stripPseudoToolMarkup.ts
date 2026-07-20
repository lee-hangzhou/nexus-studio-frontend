/** Hide pseudo / simulated tool output from assistant display text. */
export function stripPseudoToolMarkup(text: string): string {
  if (!text) return '';
  return text
    .replace(/<function_response\b[^>]*>[\s\S]*?<\/function_response>/gi, '')
    .replace(/<function_calls\b[^>]*>[\s\S]*?<\/function_calls>/gi, '')
    .replace(/(?:\*\*)?(?:工具调用|Tool\s*call)(?:\*\*)?\s*[:：][\s\S]*?(?=\n\s*---|\n\n[^\s]|$)/gi, '')
    .trim();
}
