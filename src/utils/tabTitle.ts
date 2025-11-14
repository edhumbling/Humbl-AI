export const BASE_DOCUMENT_TITLE = 'Humbl AI';

export function createSnappySnippet(
  text: string,
  options: { wordLimit?: number; charLimit?: number } = {},
): string {
  if (!text) {
    return '';
  }

  const wordLimit = options.wordLimit ?? 5;
  const charLimit = options.charLimit ?? 40;

  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return '';
  }

  const words = cleaned.split(' ');
  const snippetWords: string[] = [];
  let budget = charLimit;

  for (const word of words) {
    if (!word) {
      continue;
    }

    const lengthWithGap = word.length + (snippetWords.length > 0 ? 1 : 0);
    if (snippetWords.length >= wordLimit || lengthWithGap > budget) {
      break;
    }

    snippetWords.push(word);
    budget -= lengthWithGap;
  }

  let snippet = snippetWords.join(' ');
  if (!snippet) {
    snippet = cleaned.slice(0, Math.min(charLimit, cleaned.length));
  }

  if (cleaned.length > snippet.length) {
    snippet = `${snippet.replace(/[.,:;!?-]+$/, '')}…`;
  }

  return snippet;
}

