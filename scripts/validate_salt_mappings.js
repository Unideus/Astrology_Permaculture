const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const zodiacOrder = [
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces'
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function normalizeSalt(value) {
  return String(value || '')
    .replace(/\s*\([^)]*\)\s*/g, '')
    .trim();
}

function getCanonicalMap() {
  const biodynamicMap = readJson('biodynamic_map.json');
  const signs = biodynamicMap.zodiac_cell_salts || {};
  return Object.fromEntries(
    zodiacOrder.map(sign => [sign, normalizeSalt(signs[sign]?.cell_salt)])
  );
}

function getMonthlySaltMap() {
  const monthly = readJson('src/logic/salts.json').salts_by_month || {};
  const result = {};

  Object.values(monthly).forEach(entry => {
    const sign = String(entry.zodiac_sign || '').toLowerCase();
    if (!sign) return;
    result[sign] = normalizeSalt(entry.cell_salt);
  });

  return result;
}

function getServerHelperSaltMap() {
  const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const match = serverSource.match(/function getCellSaltsForSign\(sign\)\s*{\s*const saltMap = {([\s\S]*?)\n\s*};/);
  if (!match) {
    throw new Error('Could not find getCellSaltsForSign saltMap in server.js');
  }

  const result = {};
  const entryPattern = /['"]([a-z]+)['"]\s*:\s*['"]([^'"]+)['"]/g;
  let entry;
  while ((entry = entryPattern.exec(match[1])) !== null) {
    result[entry[1].toLowerCase()] = normalizeSalt(entry[2]);
  }

  return result;
}

function compareSource(sourceName, canonical, sourceMap) {
  const errors = [];

  zodiacOrder.forEach(sign => {
    const expected = canonical[sign];
    const actual = sourceMap[sign];

    if (!expected) {
      errors.push(`biodynamic_map.json is missing ${sign}`);
      return;
    }

    if (!actual) {
      errors.push(`${sourceName} is missing ${sign}`);
      return;
    }

    if (actual !== expected) {
      errors.push(`${sourceName} ${sign}: expected "${expected}", found "${actual}"`);
    }
  });

  return errors;
}

function main() {
  const canonical = getCanonicalMap();
  const checks = [
    ['src/logic/salts.json', getMonthlySaltMap()],
    ['server.js getCellSaltsForSign', getServerHelperSaltMap()]
  ];

  const errors = checks.flatMap(([sourceName, sourceMap]) =>
    compareSource(sourceName, canonical, sourceMap)
  );

  if (errors.length > 0) {
    console.error('Cell-salt mapping validation failed:');
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log('Cell-salt mapping validation OK');
}

main();
