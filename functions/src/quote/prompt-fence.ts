import { createHash } from 'node:crypto';

/**
 * Wraps visitor text in tags for a prompt, so the model can tell data from instructions.
 *
 * The tag name contains a hash of the text itself. A visitor cannot write the closing tag in
 * advance (that would mean writing the hash of a text that contains that hash), so the text can
 * never "close" the data block and continue as instructions. The same text always gives the same
 * prompt, which keeps extraction as repeatable as temperature 0 allows.
 */
export function fenceText(label: string, text: string): string {
  const id = createHash('sha256').update(text).digest('hex').slice(0, 12);
  const tag = `${label}-${id}`;
  return `<${tag}>\n${text}\n</${tag}>`;
}
