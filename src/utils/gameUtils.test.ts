import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatBytes,
  parseSize,
  cleanTitle,
  extractRegionFromName,
  normalizeRegion,
  extractYear,
  evaluate1G1RScore,
  processDuplicates1G1R,
  filterGamesByFormat,
  calculateGameTotalBytes,
  getGameBadge,
} from './gameUtils.ts';
import { Juego } from '../types/index.ts';
import { parseImportedGameSelection } from './exporter.ts';
import { generateCleanGamelistXml } from './usbSyncWriter.ts';
import { sourceFileRegistry } from './sourceFileRegistry.ts';

test('formatBytes correctly scales byte values', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1024), '1 KB');
  assert.equal(formatBytes(1048576), '1 MB');
  assert.equal(formatBytes(1073741824), '1 GB');
  assert.equal(formatBytes(1572864000), '1.46 GB');
});

test('parseSize accurately parses text inputs', () => {
  assert.equal(parseSize('1024 B'), 1024);
  assert.equal(parseSize('1 KB'), 1024);
  assert.equal(parseSize('2 MB'), 2 * 1024 * 1024);
  assert.equal(parseSize('1.5 GB'), 1.5 * 1024 * 1024 * 1024);
  assert.equal(parseSize('2.5G'), 2.5 * 1024 * 1024 * 1024);
  assert.equal(parseSize(''), 0);
});

test('cleanTitle removes tags in parentheses and brackets', () => {
  assert.equal(
    cleanTitle('Final Fantasy VII (USA) [Disc 1 of 3]'),
    'Final Fantasy VII'
  );
  assert.equal(
    cleanTitle('Super Mario 64 (Europe) (En,Fr,De)'),
    'Super Mario 64'
  );
  assert.equal(
    cleanTitle('The Legend of Zelda - Breath of the Wild [01007EF00011E000] [v0]'),
    'The Legend of Zelda - Breath of the Wild'
  );
});

test('extractRegionFromName identifies European, USA, Japan, and World signatures', () => {
  assert.equal(extractRegionFromName('Tekken 3 (Europe).chd'), 'Spain');
  assert.equal(extractRegionFromName('Chrono Trigger (USA).sfc'), 'USA');
  assert.equal(extractRegionFromName('Mother 3 (Japan).gba'), 'Japan');
  assert.equal(extractRegionFromName('Pac-Man (World).zip'), 'World');
  assert.equal(extractRegionFromName('UnknownGame.bin'), 'Global');
});

test('normalizeRegion standardizes common abbreviations', () => {
  assert.equal(normalizeRegion('es'), 'Spain');
  assert.equal(normalizeRegion('spain'), 'Spain');
  assert.equal(normalizeRegion('eu'), 'Europe');
  assert.equal(normalizeRegion('us'), 'USA');
  assert.equal(normalizeRegion('japan'), 'Japan');
  assert.equal(normalizeRegion('world'), 'World');
  assert.equal(normalizeRegion('custom_region'), 'Custom_region');
});

test('extractYear extracts 4-digit release year safely', () => {
  assert.equal(extractYear('19970903T000000'), '1997');
  assert.equal(extractYear('2017-03-03'), '2017');
  assert.equal(extractYear('1998'), '1998');
  assert.equal(extractYear(''), '');
});

test('processDuplicates1G1R tags duplicates and picks the highest-ranking candidate', () => {
  const games: Juego[] = [
    {
      id: 1,
      nombre: 'Gran Turismo 2 (USA)',
      cleanTitle: 'Gran Turismo 2',
      ruta: './gt2_us.iso',
      rutaCompleta: '/roms/psx/gt2_us.iso',
      sistema: 'psx',
      extension: '.iso',
      tamanoBytes: 650000000,
      region: 'USA',
      genero: 'Carreras',
      desarrollador: 'Polyphony',
      anio: '1999',
      descripcion: '',
      dependencias: [],
    },
    {
      id: 2,
      nombre: 'Gran Turismo 2 (Spain) (Disc 1)',
      cleanTitle: 'Gran Turismo 2',
      ruta: './gt2_es.m3u',
      rutaCompleta: '/roms/psx/gt2_es.m3u',
      sistema: 'psx',
      extension: '.m3u',
      tamanoBytes: 1300000000,
      region: 'Spain',
      genero: 'Carreras',
      desarrollador: 'Polyphony',
      anio: '1999',
      descripcion: '',
      dependencias: [
        {
          tipo: 'DISC',
          nombreArchivo: 'Gran Turismo 2 - Arcade Mode (Spain).bin',
          rutaCompleta: '/roms/psx/gt2_arc.bin',
          tamanoBytes: 650000000,
        },
      ],
    },
  ];

  const processed = processDuplicates1G1R(games, 'ES');
  assert.equal(processed.length, 2);
  assert.equal(processed[0].esDuplicado, true);
  assert.equal(processed[1].esDuplicado, true);

  // The Spanish .m3u edition must be picked as 'original' (preferred region + .m3u bonus)
  const original = processed.find((j) => j.rolDuplicado === 'original');
  const discard = processed.find((j) => j.rolDuplicado === 'descarte');

  assert.equal(original?.id, 2);
  assert.equal(discard?.id, 1);
});

test('filterGamesByFormat purges matching extensions', () => {
  const games: Juego[] = [
    {
      id: 1,
      nombre: 'Game 1',
      cleanTitle: 'Game 1',
      ruta: './game1.xex',
      rutaCompleta: '/roms/xbox360/game1.xex',
      sistema: 'xbox360',
      extension: '.xex',
      tamanoBytes: 5000,
      region: 'Global',
      genero: '',
      desarrollador: '',
      anio: '',
      descripcion: '',
      dependencias: [],
    },
    {
      id: 2,
      nombre: 'Game 2',
      cleanTitle: 'Game 2',
      ruta: './game2.iso',
      rutaCompleta: '/roms/xbox360/game2.iso',
      sistema: 'xbox360',
      extension: '.iso',
      tamanoBytes: 8000000000,
      region: 'Global',
      genero: '',
      desarrollador: '',
      anio: '',
      descripcion: '',
      dependencias: [],
    },
  ];

  const result = filterGamesByFormat(games, '.xex', 'xbox360');
  assert.equal(result.countRemoved, 1);
  assert.equal(result.remaining.length, 1);
  assert.equal(result.remaining[0].id, 2);
});

test('getGameBadge correctly reflects multidisc and switch special formats', () => {
  const m3uGame: Juego = {
    id: 1,
    nombre: 'Metal Gear Solid',
    cleanTitle: 'Metal Gear Solid',
    ruta: './mgs.m3u',
    rutaCompleta: '/roms/psx/mgs.m3u',
    sistema: 'psx',
    extension: '.m3u',
    tamanoBytes: 1400000000,
    region: 'Spain',
    genero: 'Acción',
    desarrollador: 'Konami',
    anio: '1998',
    descripcion: '',
    dependencias: [],
  };

  const badge = getGameBadge(m3uGame);
  assert.equal(badge.label, 'M3U MULTIDISCO');
});

test('parseImportedGameSelection correctly extracts keys and titles from JSON and CSV', () => {
  // JSON format
  const jsonInput = JSON.stringify({
    total: 2,
    selectedKeys: ['psx__Crash Bandicoot', 'snes__Super Mario World'],
    games: [
      { sistema: 'psx', nombre: 'Crash Bandicoot', cleanTitle: 'Crash Bandicoot' },
      { sistema: 'snes', nombre: 'Super Mario World', cleanTitle: 'Super Mario World' },
    ],
  });

  const parsedJson = parseImportedGameSelection(jsonInput);
  assert.equal(parsedJson.keys.length >= 2, true);
  assert.equal(parsedJson.keys.includes('psx__Crash Bandicoot'), true);

  // CSV format
  const csvInput = `Sistema,Nombre,Titulo_Limpio,Tamano_Bytes,Tamano,Ruta\r\n"psx","Tekken 3","Tekken 3",700000000,"700 MB","./tekken.bin"`;
  const parsedCsv = parseImportedGameSelection(csvInput);
  assert.equal(parsedCsv.keys.includes('psx__Tekken 3'), true);
  assert.equal(parsedCsv.titles.includes('Tekken 3'), true);
});

test('generateCleanGamelistXml outputs valid relative paths and never outputs blob: URLs', () => {
  const testGames: Juego[] = [
    {
      id: '102752',
      gameId: '102752',
      nombre: '007 : The World Is Not Enough',
      cleanTitle: '007 : The World Is Not Enough',
      ruta: './007 - El Mundo Nunca es Suficiente (Spain).chd',
      rutaCompleta: '/roms/psx/007.chd',
      sistema: 'psx',
      extension: '.chd',
      tamanoBytes: 418512896,
      region: 'Europe',
      genero: 'Disparos / 1ª persona',
      desarrollador: 'Black Ops Entertainment',
      publisher: 'EA Games',
      family: 'James Bond 007',
      rating: '0.75',
      releasedate: '20001117T000000',
      anio: '2000',
      descripcion: 'Misión secreta James Bond',
      rutaImage: 'blob:http://localhost:3000/some-random-blob-uuid-1',
      rutaThumb: 'blob:http://localhost:3000/some-random-blob-uuid-2',
      rutaMarquee: 'blob:http://localhost:3000/some-random-blob-uuid-3',
      rutaFanart: 'blob:http://localhost:3000/some-random-blob-uuid-4',
      video: 'blob:http://localhost:3000/some-random-blob-uuid-5',
      rutaManual: 'blob:http://localhost:3000/some-random-blob-uuid-6',
      dependencias: [],
    },
  ];

  const xml = generateCleanGamelistXml(testGames);

  // Must NOT contain any blob: prefix
  assert.equal(xml.includes('blob:'), false);

  // Must contain clean relative path format
  assert.equal(xml.includes('<path>./007 - El Mundo Nunca es Suficiente (Spain).chd</path>'), true);
  assert.equal(xml.includes('<thumbnail>./images/007 - El Mundo Nunca es Suficiente (Spain)-thumb.png</thumbnail>'), true);
  assert.equal(xml.includes('<video>./videos/007 - El Mundo Nunca es Suficiente (Spain)-video.mp4</video>'), true);
  assert.equal(xml.includes('<developer>Black Ops Entertainment</developer>'), true);
  assert.equal(xml.includes('<publisher>EA Games</publisher>'), true);
  assert.equal(xml.includes('<family>James Bond 007</family>'), true);
});

test('sourceFileRegistry stores and retrieves files by system and filename', () => {
  sourceFileRegistry.clear();

  const fakeFile = new File(['fake rom bytes'], '007.chd', { type: 'application/octet-stream' });
  sourceFileRegistry.registerFile('psx', '007.chd', fakeFile);

  assert.equal(sourceFileRegistry.hasFile('psx', '007.chd'), true);
  assert.equal(sourceFileRegistry.getFile('psx', '007.chd')?.name, '007.chd');
  assert.equal(sourceFileRegistry.getFile('psx', './007.chd')?.name, '007.chd');
});

test('pdbDatabase serializes and parses game libraries with clean metadata', async () => {
  const { generatePdbBinary, parsePdbBinary } = await import('./pdbDatabase.ts');

  const sampleGames: Juego[] = [
    {
      id: 'psx_crash',
      nombre: 'Crash Bandicoot',
      cleanTitle: 'Crash Bandicoot',
      ruta: './crash.chd',
      rutaCompleta: '/roms/psx/crash.chd',
      sistema: 'psx',
      extension: '.chd',
      tamanoBytes: 524288000,
      region: 'Europe',
      genero: 'Plataformas',
      desarrollador: 'Naughty Dog',
      anio: '1996',
      descripcion: 'Aventuras de Crash',
      rutaThumb: 'blob:http://localhost:3000/dead-blob-url',
      dependencias: [],
    },
  ];

  const blob = generatePdbBinary(sampleGames, [], 'TestAppFolder');
  assert.equal(blob.size > 0, true);

  const arrayBuffer = await blob.arrayBuffer();
  const parsed = await parsePdbBinary(arrayBuffer);

  assert.equal(parsed.juegos.length, 1);
  assert.equal(parsed.juegos[0].nombre, 'Crash Bandicoot');
  assert.equal(parsed.juegos[0].sistema, 'psx');
  // Blob URL must have been stripped to maintain portability
  assert.equal(parsed.juegos[0].rutaThumb, undefined);
  assert.equal(parsed.config.databaseFileName, 'retrobat_library.pdb');
  assert.equal(parsed.config.cacheImagesDir, 'cache/images');
});


