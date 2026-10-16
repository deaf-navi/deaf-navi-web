const HARD_NOISE_PATTERNS = [
  /dialogue de sourds/i,
  /\bo[ií]dos?\s+sordos?\b/i,
];

export function isHardNoiseWorldText(text) {
  const normalized = String(text ?? '').normalize('NFKC');
  if (HARD_NOISE_PATTERNS.some((pattern) => pattern.test(normalized))) return true;
  // audífonos means both hearing aids and headphones. Bluetooth alone is not noise.
  const hearingContext = /sord|auditiv|audici[oó]n|p[eé]rdida|hipoacusia|hearing|deaf|補聴|難聴|聴覚/iu.test(normalized);
  return !hearingContext && /aud[ií]fonos/iu.test(normalized)
    && /gam(?:ing|er)|videojuegos|cancelaci[oó]n de ruido|escuchar m[uú]sica|sonido envolvente|k-pop|bocinas y cargadores/iu.test(normalized);
}
