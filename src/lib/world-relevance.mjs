const HARD_NOISE_PATTERNS = [
  /dialogue de sourds/i,
  /\bo[ií]dos?\s+sordos?\b/i,
  /\bdi[aá]logo\s+de\s+sordos\b/iu,
];

export function isHardNoiseWorldText(text) {
  const normalized = String(text ?? '').normalize('NFKC');
  if (HARD_NOISE_PATTERNS.some((pattern) => pattern.test(normalized))) return true;
  // A surname is not evidence of Deaf relevance. Keep genuine coverage involving him.
  const withoutName = normalized.replace(/\bUnai\s+Sordo\b/giu, '');
  if (withoutName !== normalized && !/sord[oa]s?|lengua\s+de\s+se[nñ]as|lengua\s+de\s+signos|discapacidad\s+auditiva|hipoacusia|deaf|hearing/iu.test(withoutName)) return true;
  // audífonos means both hearing aids and headphones. Bluetooth alone is not noise.
  const hearingContext = /sord|auditiv|audici[oó]n|p[eé]rdida|hipoacusia|hearing|deaf|補聴|難聴|聴覚/iu.test(normalized);
  return !hearingContext && /aud[ií]fonos/iu.test(normalized)
    && /gam(?:ing|er)|videojuegos|headsets?|auriculares|razer|cancelaci[oó]n de ruido|escuchar m[uú]sica|sonido envolvente|k-pop|bocinas y cargadores/iu.test(normalized);
}
