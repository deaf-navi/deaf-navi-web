const HARD_NOISE_PATTERNS = [
  /dialogue de sourds/i,
  /\bo[ií]dos?\s+sordos?\b/i,
  /\bdi[aá]logo\s+de\s+sordos\b/iu,
];

export function isHardNoiseWorldText(text) {
  const normalized = String(text ?? '').normalize('NFKC');
  if (HARD_NOISE_PATTERNS.some((pattern) => pattern.test(normalized))) return true;
  // Portuguese "libras" also denotes pounds. An amount in a salary/currency
  // story is not a sign-language signal; retain any independent Deaf context.
  const withoutPounds = normalized.replace(/\b\d[\d.,\s]*(?:mil\s+|milh[oõ]es\s+(?:de\s+)?)?libras(?:\s+esterlinas)?\b/giu, '');
  if (withoutPounds !== normalized
    && /sal[aá]rio|\b(?:GBP|Reino Unido|esterlinas)\b|\bc[aâ]mbio\b/iu.test(normalized)
    && !/surd|surdez|sord|auditiv|hearing|deaf|l[ií]ngua de (?:sinais|gestos)|sign language|\b(?:Libras|ASL|BSL)\b|acessib|accessib|legendas|int[eé]rprete/iu.test(withoutPounds)) return true;
  // A surname is not evidence of Deaf relevance. Keep genuine coverage involving him.
  const namedUnionLeader = /\bUnai\s+Sordo\b|\bSordo\s*\(CCOO\)|\bSordo\s+y\s+[ÁA]lvarez\b/iu.test(normalized);
  const withoutName = namedUnionLeader ? normalized.replace(/\bUnai\s+Sordo\b/giu, '').replace(/\bSordo\b/gu, '') : normalized;
  if (withoutName !== normalized && !/sord[oa]s?|lengua\s+de\s+se[nñ]as|lengua\s+de\s+signos|discapacidad\s+auditiva|hipoacusia|deaf|hearing/iu.test(withoutName)) return true;
  // audífonos means both hearing aids and headphones. Bluetooth alone is not noise.
  const hearingContext = /sord|auditiv|audici[oó]n|p[eé]rdida|hipoacusia|hearing|deaf|補聴|難聴|聴覚|accessib|accesib|sign language|lengua de (?:señas|signos)|\b(?:ASL|Libras|Auslan)\b|closed captions?|subt[ií]tulos en (?:directo|vivo)/iu.test(normalized);
  if (hearingContext) return false;
  if (/Mejores aud[ií]fonos.*Premios Xataka/iu.test(normalized)) return true;
  // Source-checked false positives: a celebrity's sarcastic caption and a
  // general TikTok Shop sales feature, not accessibility reporting.
  if (/\bVijay Deverakonda\b/iu.test(normalized) && /\bKoffee With Karan\b/iu.test(normalized) && /\bneeds? subtitles\b/iu.test(normalized)) return true;
  if (/TikTok/iu.test(normalized) && /aud[ií]fonos/iu.test(normalized) && /as[ií] crece su tienda/iu.test(normalized)) return true;
  if (/aud[ií]fonos/iu.test(normalized)
    && /\b(?:Sony|Hello Kitty)\b/iu.test(normalized)
    && /edici[oó]n (?:limitada|especial)|colecci[oó]n|colaboraci[oó]n/iu.test(normalized)) return true;
  if (/aud[ií]fonos/iu.test(normalized)
    && /gam(?:ing|er)|videojuegos|headsets?|auriculares|razer|soundcore|anker|tablet|smartwatch|deportivos|traducen idiomas|cancelaci[oó]n de ruido|escuchar m[uú]sica|sonido envolvente|k-pop|bocinas y cargadores/iu.test(normalized)) return true;
  // Subtitles can also mean fabricated political translations or tourism credits.
  // Do not reject caption technology, accessibility, or ordinary subtitled screenings.
  return /\b(?:fake|false) subtitles\b/iu.test(normalized)
    || (/\b(?:shooting|filming) locations\b/iu.test(normalized)
      && /\b(?:mention|credits?)\b/iu.test(normalized) && /\bsubtitles\b/iu.test(normalized));
}
