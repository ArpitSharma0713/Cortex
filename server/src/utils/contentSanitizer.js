const SUSPICIOUS_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
  /disregard\s+(all\s+)?(previous|prior|above)/gi,
  /you\s+are\s+now\s+/gi,
  /system\s*:\s*/gi,
  /\[?(system|assistant)\s+prompt\]?/gi,
  /new\s+instructions?\s*:/gi,
];

export function flagSuspiciousContent(text) {
  if (!text) {
    return [];
  }

  const matches = [];

  for (const pattern of SUSPICIOUS_PATTERNS) {
    const found = text.match(pattern);

    if (found) {
      matches.push(...found);
    }
  }

  return matches;
}
