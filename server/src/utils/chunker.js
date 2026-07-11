const CHUNK_SIZE = 512;
const CHUNK_OVERLAP = 50;
const CHARS_PER_TOKEN = 4;

export function chunkText(text, options = {}) {
  const chunkSize = options.chunkSize || CHUNK_SIZE;
  const overlap = options.overlap || CHUNK_OVERLAP;

  const chunkSizeChars = chunkSize * CHARS_PER_TOKEN;
  const overlapChars = overlap * CHARS_PER_TOKEN;

  const cleaned = text
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  if (cleaned.length === 0) {
    return [];
  }

  const chunks = [];
  let start = 0;

  while (start < cleaned.length) {
    const end = Math.min(start + chunkSizeChars, cleaned.length);
    let chunkEnd = end;

    if (end < cleaned.length) {
      const boundary = cleaned.lastIndexOf(".", end);

      if (boundary > start + overlapChars) {
        chunkEnd = boundary + 1;
      }
    }

    const content = cleaned.slice(start, chunkEnd).trim();

    if (content.length > 0) {
      chunks.push({
        content,
        tokenCount: Math.ceil(content.length / CHARS_PER_TOKEN),
        chunkIndex: chunks.length,
      });
    }

    if (chunkEnd >= cleaned.length) {
      break;
    }

    const nextStart = chunkEnd - overlapChars;
    start = nextStart <= start ? chunkEnd : nextStart;
  }

  return chunks;
}
