const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const relationshipTypes = new Set([
  'accumulator',
  'beneficiary',
  'companion',
  'indicator'
]);

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function getCanonicalSalts() {
  const biodynamicMap = readJson('biodynamic_map.json');
  return new Set(
    Object.values(biodynamicMap.zodiac_cell_salts || {})
      .map(entry => entry.cell_salt)
      .filter(Boolean)
  );
}

function main() {
  const canonicalSalts = getCanonicalSalts();
  const registry = readJson('master_registry.json');
  const validPlantIds = new Set(Object.keys(registry));
  const relationships = readJson('data/tissue_salt_plant_relationships.json');
  const errors = [];
  const seen = new Set();
  const counts = {};

  if (!Array.isArray(relationships)) {
    errors.push('data/tissue_salt_plant_relationships.json must contain an array.');
  } else {
    relationships.forEach((item, index) => {
      const label = `relationship ${index + 1}`;
      const key = `${item.salt}::${item.plant_id}::${item.relationship_type}`;

      if (!canonicalSalts.has(item.salt)) {
        errors.push(`${label}: non-canonical salt "${item.salt}"`);
      }

      if (!validPlantIds.has(item.plant_id)) {
        errors.push(`${label}: unknown plant_id "${item.plant_id}"`);
      }

      if (!relationshipTypes.has(item.relationship_type)) {
        errors.push(`${label}: invalid relationship_type "${item.relationship_type}"`);
      }

      if (seen.has(key)) {
        errors.push(`${label}: duplicate salt + plant_id + relationship_type "${key}"`);
      }
      seen.add(key);

      const salt = item.salt || 'UNKNOWN';
      const type = item.relationship_type || 'UNKNOWN';
      counts[salt] ||= {};
      counts[salt][type] = (counts[salt][type] || 0) + 1;
    });
  }

  if (errors.length > 0) {
    console.error('Tissue-salt relationship validation failed:');
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log(`Tissue-salt relationship validation OK (${relationships.length} relationships)`);
  Object.keys(counts).sort().forEach(salt => {
    const typeCounts = Object.entries(counts[salt])
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([type, count]) => `${type}: ${count}`)
      .join(', ');
    console.log(`${salt}: ${typeCounts}`);
  });
}

main();
