const fs = require('fs');
const path = require('path');

const registryPath = path.join(__dirname, '..', 'master_registry.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
const plants = Object.values(registry);

const ZONES = Array.from({ length: 12 }, (_, index) => index + 1);
const CLIMATES = ['humid', 'arid', 'any'];
const MIN_CANDIDATES = 3;

const LAYER_GROUPS = [
  { label: 'canopy', layers: ['canopy'] },
  { label: 'sub_canopy / low_tree', layers: ['sub_canopy', 'low_tree'] },
  { label: 'shrub', layers: ['shrub'] },
  { label: 'herbaceous', layers: ['herbaceous'] },
  { label: 'ground_cover', layers: ['ground_cover'] },
  { label: 'root', layers: ['root'] },
  { label: 'vine', layers: ['vine'] }
];

function plantName(plant) {
  return plant.common_name || plant.name || plant.id || 'Unnamed plant';
}

function isZoneCompatible(plant, zone) {
  const zones = plant.climate_profile?.zones;
  return Array.isArray(zones) && zones.includes(zone);
}

function isClimateCompatible(plant, climate) {
  if (climate === 'any') return true;
  const affinity = plant.climate_affinity || 'any';
  return affinity === climate || affinity === 'any';
}

function isLayerCompatible(plant, layerGroup) {
  if (layerGroup.label === 'ground_cover') {
    const functions = plant.permaculture_role?.functions || [];
    return plant.taxonomy?.layer === 'ground_cover' ||
      functions.includes('ground_cover') ||
      functions.includes('living_mulch');
  }
  return layerGroup.layers.includes(plant.taxonomy?.layer);
}

function hasFunctions(plant) {
  return Array.isArray(plant.permaculture_role?.functions) && plant.permaculture_role.functions.length > 0;
}

function hasSalts(plant) {
  return Array.isArray(plant.bio_logic?.salts) && plant.bio_logic.salts.length > 0;
}

function formatNames(items, limit = 8) {
  if (items.length === 0) return '-';
  const names = items.map(plantName);
  if (names.length <= limit) return names.join(', ');
  return `${names.slice(0, limit).join(', ')} (+${names.length - limit} more)`;
}

function candidatesFor(zone, climate, layerGroup) {
  return plants.filter(plant =>
    isZoneCompatible(plant, zone) &&
    isClimateCompatible(plant, climate) &&
    isLayerCompatible(plant, layerGroup)
  );
}

const rows = [];
const gaps = [];

for (const zone of ZONES) {
  for (const climate of CLIMATES) {
    for (const layerGroup of LAYER_GROUPS) {
      const candidates = candidatesFor(zone, climate, layerGroup);
      const missingFunctions = candidates.filter(plant => !hasFunctions(plant));
      const missingSalts = candidates.filter(plant => !hasSalts(plant));
      const isThin = candidates.length < MIN_CANDIDATES;

      const row = {
        zone,
        climate,
        layer: layerGroup.label,
        count: candidates.length,
        hasAtLeastThree: candidates.length >= MIN_CANDIDATES,
        missingFunctions,
        missingSalts,
        isThin
      };

      rows.push(row);

      if (isThin || missingFunctions.length > 0 || missingSalts.length > 0) {
        gaps.push(row);
      }
    }
  }
}

gaps.sort((a, b) => {
  if (a.isThin !== b.isThin) return a.isThin ? -1 : 1;
  if (a.count !== b.count) return a.count - b.count;
  const missingA = a.missingFunctions.length + a.missingSalts.length;
  const missingB = b.missingFunctions.length + b.missingSalts.length;
  if (missingA !== missingB) return missingB - missingA;
  if (a.zone !== b.zone) return a.zone - b.zone;
  return a.layer.localeCompare(b.layer);
});

console.log('Registry Coverage Audit');
console.log('=======================');
console.log(`Plants audited: ${plants.length}`);
console.log(`Minimum candidates per layer: ${MIN_CANDIDATES}`);
console.log('');

console.log('Worst gaps first');
console.log('----------------');
if (gaps.length === 0) {
  console.log('No thin layers or missing metadata found.');
} else {
  gaps.slice(0, 40).forEach(row => {
    const status = row.isThin ? 'THIN' : 'METADATA';
    console.log(
      `[${status}] zone ${row.zone} / ${row.climate} / ${row.layer}: ` +
      `${row.count} candidate${row.count === 1 ? '' : 's'}`
    );
    if (row.missingFunctions.length > 0) {
      console.log(`  missing role functions: ${formatNames(row.missingFunctions)}`);
    }
    if (row.missingSalts.length > 0) {
      console.log(`  missing bio_logic salts: ${formatNames(row.missingSalts)}`);
    }
  });
  if (gaps.length > 40) {
    console.log(`... ${gaps.length - 40} additional gaps omitted from the worst-gap preview.`);
  }
}
console.log('');

console.log('Detailed coverage by zone and climate');
console.log('-------------------------------------');
for (const zone of ZONES) {
  for (const climate of CLIMATES) {
    console.log(`\nZone ${zone} / ${climate}`);
    LAYER_GROUPS.forEach(layerGroup => {
      const row = rows.find(item =>
        item.zone === zone &&
        item.climate === climate &&
        item.layer === layerGroup.label
      );
      const status = row.hasAtLeastThree ? 'OK' : 'THIN';
      console.log(
        `  ${row.layer.padEnd(22)} ${String(row.count).padStart(3)} candidates  ${status}`
      );
      if (row.missingFunctions.length > 0) {
        console.log(`    missing role functions: ${formatNames(row.missingFunctions)}`);
      }
      if (row.missingSalts.length > 0) {
        console.log(`    missing bio_logic salts: ${formatNames(row.missingSalts)}`);
      }
    });
  }
}
