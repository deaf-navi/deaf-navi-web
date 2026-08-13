const HARD_NOISE_PATTERNS = [
  /dialogue de sourds/i,
  /\bo[ií]dos?\s+sordos?\b/i,
];

export function isHardNoiseWorldText(text) {
  const normalized = String(text ?? '').normalize('NFKC');
  return HARD_NOISE_PATTERNS.some((pattern) => pattern.test(normalized));
}
