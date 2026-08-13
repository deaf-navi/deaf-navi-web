import test from 'node:test';
import assert from 'node:assert/strict';

import { isHardNoiseWorldText } from '../src/lib/world-relevance.mjs';

test('World relevance: Spanish deaf-ear idioms are rejected', () => {
  assert.equal(
    isHardNoiseWorldText('Koundé, oídos sordos a las ofertas: está a un paso de hacer historia'),
    true,
  );
  assert.equal(isHardNoiseWorldText('El gobierno hizo oído sordo a las advertencias'), true);
});

test('World relevance: French deaf-dialogue idiom is rejected', () => {
  assert.equal(isHardNoiseWorldText('Le sommet tourne au dialogue de sourds'), true);
});

test('World relevance: genuine Spanish Deaf news remains eligible', () => {
  assert.equal(
    isHardNoiseWorldText('Estudiantes sordos reciben interpretación en lengua de señas'),
    false,
  );
});
