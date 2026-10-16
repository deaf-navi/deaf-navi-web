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

test('World relevance distinguishes dialogue idioms and surnames from Deaf reporting', () => {
  assert.equal(isHardNoiseWorldText('Los candidatos protagonizan un diálogo de sordos: inflación y política'), true);
  assert.equal(isHardNoiseWorldText('Unai Sordo: la huelga y los salarios'), true);
  assert.equal(isHardNoiseWorldText('Unai Sordo pide intérpretes de lengua de signos para trabajadores sordos'), false);
  assert.equal(isHardNoiseWorldText('Sordos ganan el campeonato de fútbol'), false);
});
test('Spanish consumer headsets do not become hearing-aid news',()=>{
 assert.equal(isHardNoiseWorldText('Audífonos Razer x Pokémon: así son los headsets de Charizard, Lucario y Sylveon con audio inalámbrico y luces'),true);
 assert.equal(isHardNoiseWorldText('Audífonos y auriculares inalámbricos para escuchar música'),true);
 assert.equal(isHardNoiseWorldText('Audífonos Bluetooth para personas con pérdida de audición'),false);
 assert.equal(isHardNoiseWorldText('Razer desarrolla headsets accesibles para jugadores sordos'),false);
});
