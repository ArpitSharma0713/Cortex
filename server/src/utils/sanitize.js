export function sanitizeText(text) {
  return text.replace(/\u0000/g, "");
}
