import test from 'node:test';
import assert from 'node:assert/strict';

import { isHardNoiseWorldText } from '../src/lib/world-relevance.mjs';
import { prepareWorldPublication } from '../src/lib/publication-quality.mjs';

test('Portuguese pound amounts do not qualify salary stories as Libras news', () => {
  const title = 'Como trabalhar no Reino Unido em 2027: visto Skilled Worker exige salário mínimo de 41.700 libras por ano, cerca de R$ 303 mil, mas o piso cai para 25.000 libras em parte das vagas de saúde e educação';
  assert.equal(isHardNoiseWorldText(title), true);
  assert.equal(isHardNoiseWorldText('Reino Unido oferece salário de 40 mil libras esterlinas'), true);
  for (const relevant of [
    'Curso de Libras no Reino Unido custa 100 libras',
    'Intérprete de BSL recebe salário de 41.700 libras no Reino Unido',
    'Trabalhadores surdos pedem salário de 25.000 libras',
    'Estudantes aprendem Libras e a cultura surda',
  ]) assert.equal(isHardNoiseWorldText(relevant), false, relevant);
  const result = prepareWorldPublication({articles:[{
    id:'currency-only', originalTitle:title, originalSummary:title,
    title:'英国の最低賃金は41,700ブラジル手話', summary:'英国の最低賃金について',
  }]});
  assert.equal(result.articles.length, 0);
  assert.equal(result.publicationReview.removed[0].reason, 'unrelated');
});

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

test('consumer audio and subtitle keyword collisions are excluded without losing access reporting', () => {
  for (const title of [
    'HONOR lanza en Perú nueva tablet, smartwatch y audífonos: características',
    'Lo último de Soundcore en Chile son unos audífonos con récord Guinness que prometen la llamada “más clara del mundo”',
    'Soundcore: qué ofrecen sus nuevos audífonos premium',
    'Soundcore Sport X20: ¿Valen la pena estos audífonos deportivos?',
    'Tiendas D1 suma a su catálogo unos audífonos que traducen idiomas en tiempo real por $49.900',
    'Amazon está rematando la versión mejorada de los audífonos Soundcore ideales para el transporte público: Anker P31i',
    'AP minister calls for mention of shooting locations in movie subtitles',
    'Plagiarised videos reposted with false subtitles to stoke anti-Japan sentiment in China',
    'Viral clip with fake subtitles falsely claims China’s Xi pledged 2.3 million jobs to SA amid US row',
  ]) assert.equal(isHardNoiseWorldText(title), true, title);
  for (const title of [
    'Soundcore desarrolla audífonos para personas con pérdida auditiva',
    'Audífonos con subtítulos en directo para personas sordas',
    'Audífonos Bluetooth',
    'False subtitles affect deaf viewers: accessibility groups seek improvements',
    'Filming locations introduce closed captions and sign language tours',
    'ASL and Libras interpretation makes theatre accessible',
    'New subtitle technology helps everyone follow dialogue',
  ]) assert.equal(isHardNoiseWorldText(title), false, title);
});
