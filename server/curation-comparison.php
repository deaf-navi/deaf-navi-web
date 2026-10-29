<?php
declare(strict_types=1);
// Private review prose is not a published operating condition. No other field,
// including unknown future fields, is excluded from this versioned digest.
function overseas_cafe_comparison_hash(array $payload): string {
 unset($payload['review_notes']);
 return hash('sha256',json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR));
}
