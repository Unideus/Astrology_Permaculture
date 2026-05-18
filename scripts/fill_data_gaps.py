#!/usr/bin/env python3
"""
Zodi-Yuga Data Filling Pipeline
Fills cell salt mappings and Köppen climate data for all 159 plants
in master_registry.json. Uses botanical relationships, plant type
inference, and existing mapping patterns.

Run: python3 scripts/fill_data_gaps.py
"""

import json
import os
import sys
from copy import deepcopy

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_DIR = os.path.dirname(SCRIPT_DIR)

with open(os.path.join(REPO_DIR, 'master_registry.json')) as f:
    registry = json.load(f)
with open(os.path.join(REPO_DIR, 'biodynamic_map.json')) as f:
    bd = json.load(f)

# ============================================================
# KNOWLEDGE BASE: Cell salt mapping rules
# ============================================================

genus_rules = {
    # Prunus genus - stone fruits: Potassium Chloride (mucous/fluid regulation)
    'Prunus americana': ['Potassium Chloride'],
    'Prunus maritima': ['Potassium Chloride'],
    'Prunus tomentosa': ['Potassium Chloride'],
    'Prunus virginiana': ['Potassium Chloride'],

    # Rubus genus - brambles: Calcium Fluoride (elasticity/connective)
    'Rubus occidentalis': ['Calcium Fluoride'],
    'Rubus idaeus': ['Calcium Fluoride'],

    # Ribes genus - currants/gooseberries: Potassium Chloride
    'Ribes nigrum': ['Potassium Chloride'],
    'Ribes uva-crispa': ['Potassium Chloride'],

    # Vitis genus - grapes: Potassium Sulphate
    'Vitis labrusca': ['Potassium Sulphate'],
    'Vitis vinifera': ['Potassium Sulphate'],

    # Malus genus - apples: Potassium Chloride
    'Malus pumila': ['Potassium Chloride'],
    'Malus': ['Potassium Chloride'],

    # Pyrus genus - pears: Potassium Chloride
    'Pyrus pyrifolia': ['Potassium Chloride'],
    'Pyrus communis': ['Potassium Chloride'],

    # Vaccinium - blueberries: Iron Phosphate + Silica
    'Vaccinium virgatum': ['Iron Phosphate', 'Silica'],

    # Allium genus: Potassium Sulphate
    'Allium schoenoprasum': ['Potassium Sulphate'],

    # Zingiberaceae family
    'Zingiber officinale': ['Magnesium Phosphate'],
    'Curcuma longa': ['Magnesium Phosphate'],

    # Elaeagnus genus - nitrogen-fixing shrubs
    'Elaeagnus umbellata': ['Calcium Phosphate', 'Potassium Phosphate'],
    'Elaeagnus multiflora': ['Calcium Phosphate', 'Potassium Phosphate'],
    'Hippophae rhamnoides': ['Calcium Phosphate', 'Potassium Phosphate'],

    # Arachis genus - peanuts
    'Arachis hypogaea': ['Iron Phosphate', 'Calcium Phosphate'],
    'Arachis glabrata': ['Iron Phosphate', 'Calcium Phosphate'],

    # Carya genus - hickories: Calcium Phosphate
    'Carya illinoinensis': ['Calcium Phosphate'],

    # Diospyros genus - persimmons: Potassium Phosphate
    'Diospyros virginiana': ['Potassium Phosphate'],
    'Diospyros kaki': ['Potassium Phosphate'],

    # Cucurbita genus
    'Cucurbita moschata': ['Potassium Phosphate', 'Iron Phosphate'],

    # Salvia genus
    'Salvia rosmarinus': ['Potassium Sulphate'],
    'Salvia officinalis': ['Potassium Sulphate'],

    # Amelanchier genus: Calcium Fluoride
    'Amelanchier alnifolia': ['Calcium Fluoride'],

    # Aronia genus: Iron Phosphate
    'Aronia melanocarpa': ['Iron Phosphate'],

    # Lonicera genus: Potassium Phosphate
    'Lonicera caerulea': ['Potassium Phosphate'],

    # Cornus genus: Potassium Chloride
    'Cornus mas': ['Potassium Chloride'],

    # Actinidia genus: Silica + Potassium Sulphate
    'Actinidia arguta': ['Silica', 'Potassium Sulphate'],

    # Humulus genus: Silica + Magnesium Phosphate
    'Humulus lupulus': ['Silica', 'Magnesium Phosphate'],

    # Schisandra genus: Magnesium Phosphate + Silica
    'Schisandra chinensis': ['Magnesium Phosphate', 'Silica'],

    # Apios genus: Iron Phosphate + Potassium Phosphate
    'Apios americana': ['Iron Phosphate', 'Potassium Phosphate'],

    # Juglans genus: Potassium Phosphate
    'Juglans nigra': ['Potassium Phosphate'],

    # Castanea genus: Calcium Phosphate
    'Castanea': ['Calcium Phosphate'],

    # Macadamia genus: Calcium Phosphate + Silica
    'Macadamia': ['Calcium Phosphate', 'Silica'],

    # Mangifera genus: Potassium Phosphate
    'Mangifera': ['Potassium Phosphate'],

    # Artocarpus genus
    'Artocarpus altilis': ['Potassium Phosphate', 'Calcium Phosphate'],
    'Artocarpus heterophyllus': ['Potassium Phosphate', 'Calcium Phosphate'],

    # Cocos genus
    'Cocos nucifera': ['Sodium Chloride', 'Potassium Phosphate'],

    # Terminalia genus: Calcium Phosphate
    'Terminalia catappa': ['Calcium Phosphate'],

    # Carica genus: Potassium Phosphate
    'Carica papaya': ['Potassium Phosphate'],

    # Musa genus: Potassium Phosphate + Silica
    'Musa': ['Potassium Phosphate', 'Silica'],

    # Psidium genus: Silica + Potassium Phosphate
    'Psidium guajava': ['Silica', 'Potassium Phosphate'],

    # Eugenia genus: Iron Phosphate
    'Eugenia uniflora': ['Iron Phosphate'],

    # Averrhoa genus: Sodium Phosphate
    'Averrhoa carambola': ['Sodium Phosphate'],

    # Theobroma genus
    'Theobroma cacao': ['Magnesium Phosphate', 'Iron Phosphate'],

    # Coffea genus
    'Coffea arabica': ['Iron Phosphate', 'Magnesium Phosphate'],

    # Ananas genus: Iron Phosphate + Silica
    'Ananas comosus': ['Iron Phosphate', 'Silica'],

    # Malpighia genus: Sodium Phosphate
    'Malpighia emarginata': ['Sodium Phosphate'],

    # Cnidoscolus genus
    'Cnidoscolus aconitifolius': ['Calcium Phosphate', 'Iron Phosphate'],

    # Cymbopogon genus
    'Cymbopogon citratus': ['Potassium Sulphate', 'Silica'],

    # Colocasia genus: Calcium Phosphate + Silica
    'Colocasia esculenta': ['Calcium Phosphate', 'Silica'],

    # Ipomoea genus
    'Ipomoea batatas': ['Sodium Sulphate', 'Iron Phosphate'],

    # Manihot genus
    'Manihot esculenta': ['Calcium Phosphate', 'Potassium Phosphate'],

    # Dioscorea genus
    'Dioscorea alata': ['Silica', 'Potassium Phosphate'],

    # Maranta genus
    'Maranta arundinacea': ['Silica', 'Calcium Phosphate'],

    # Passiflora genus: Magnesium Phosphate
    'Passiflora incarnata': ['Magnesium Phosphate'],
    'Passiflora edulis': ['Magnesium Phosphate'],

    # Sechium genus: Potassium Sulphate
    'Sechium edule': ['Potassium Sulphate'],

    # Basella genus: Iron Phosphate + Silica
    'Basella alba': ['Iron Phosphate', 'Silica'],

    # Psophocarpus genus
    'Psophocarpus tetragonolobus': ['Iron Phosphate', 'Calcium Phosphate'],

    # Hibiscus genus: Iron Phosphate
    'Hibiscus sabdariffa': ['Iron Phosphate'],
    'Hibiscus acetosella': ['Iron Phosphate'],

    # Sauropus genus
    'Sauropus androgynus': ['Calcium Phosphate', 'Iron Phosphate'],

    # Gynura genus: Iron Phosphate
    'Gynura bicolor': ['Iron Phosphate'],

    # Alternanthera genus: Iron Phosphate
    'Alternanthera sissoo': ['Iron Phosphate'],

    # Centella genus: Silica + Potassium Phosphate
    'Centella asiatica': ['Silica', 'Potassium Phosphate'],

    # Eryngium genus: Potassium Sulphate
    'Eryngium foetidum': ['Potassium Sulphate'],

    # Ocimum genus: Potassium Sulphate
    'Ocimum basilicum': ['Potassium Sulphate'],

    # Tulbaghia genus: Potassium Sulphate
    'Tulbaghia violacea': ['Potassium Sulphate'],

    # Mimosa genus: Calcium Phosphate
    'Mimosa strigillosa': ['Calcium Phosphate'],

    # Inga genus: Calcium Phosphate
    'Inga edulis': ['Calcium Phosphate'],

    # Cajanus genus
    'Cajanus cajan': ['Calcium Phosphate', 'Iron Phosphate'],

    # Moringa genus
    'Moringa oleifera': ['Calcium Phosphate', 'Potassium Phosphate'],

    # Ziziphus genus
    'Ziziphus jujuba': ['Potassium Chloride', 'Silica'],

    # Maclura genus: Calcium Fluoride
    'Maclura tricuspidata': ['Calcium Fluoride'],

    # Acca genus: Silica
    'Acca sellowiana': ['Silica'],

    # Eriobotrya genus: Potassium Chloride
    'Eriobotrya japonica': ['Potassium Chloride'],

    # Punica genus: Iron Phosphate
    'Punica granatum': ['Iron Phosphate'],

    # Vanilla genus: Magnesium Phosphate
    'Vanilla planifolia': ['Magnesium Phosphate'],

    # Synsepalum genus: Sodium Phosphate
    'Synsepalum dulcificum': ['Sodium Phosphate'],

    # Lavandula genus
    'Lavandula angustifolia': ['Potassium Sulphate', 'Silica'],

    # Helianthus genus: Potassium Phosphate
    'Helianthus tuberosus': ['Potassium Phosphate'],

    # Achillea genus: Silica + Potassium Phosphate
    'Achillea millefolium': ['Silica', 'Potassium Phosphate'],

    # Rumex genus
    'Rumex acetosa': ['Iron Phosphate', 'Potassium Phosphate'],

    # Trifolium genus: Calcium Phosphate (legume)
    'Trifolium repens': ['Calcium Phosphate'],
}


def find_genus_match(botanical_name, rules):
    """Find the best genus-level match for a botanical name."""
    if not botanical_name:
        return None
    genus = botanical_name.split()[0] if botanical_name else ''
    # Try exact match first
    if botanical_name in rules:
        return botanical_name
    # Try genus-only keys (keys that are just the genus name)
    if genus in rules:
        return genus
    # Try longer prefix matches (e.g., 'Castanea' matches 'Castanea')
    for key in sorted(rules.keys(), key=len, reverse=True):
        if botanical_name.startswith(key) or key.startswith(genus):
            if key == genus or genus == key.split()[0]:
                return key
    return None


def infer_cell_salts(plant_id, plant_data):
    """Infer cell salt mappings for a plant without them."""
    botanical = plant_data.get('botanical_name', '')
    layer = plant_data.get('taxonomy', {}).get('layer', '')
    zones = plant_data.get('climate_profile', {}).get('zones', [])

    # Strategy 1: Genus match
    match = find_genus_match(botanical, genus_rules)
    if match:
        return genus_rules[match], f"genus_match:{match}"

    # Strategy 2: Type-based fallback
    max_z = max(zones) if zones else 0
    min_z = min(zones) if zones else 0

    if layer == 'root':
        return ['Calcium Phosphate', 'Silica'], "type:root_crop"
    if max_z >= 10 and layer == 'vine':
        return ['Potassium Sulphate', 'Silica'], "type:tropical_vine"
    if layer == 'shrub' and min_z >= 7:
        return ['Potassium Phosphate', 'Iron Phosphate'], "type:warm_shrub"
    if layer == 'shrub':
        return ['Calcium Phosphate', 'Potassium Phosphate'], "type:temperate_shrub"
    if layer == 'herbaceous' and min_z >= 8:
        return ['Potassium Sulphate', 'Iron Phosphate'], "type:tropical_herb"
    if layer == 'herbaceous':
        return ['Potassium Sulphate'], "type:herbaceous"
    if layer == 'ground_cover':
        return ['Iron Phosphate', 'Silica'], "type:ground_cover"
    if layer == 'vine':
        return ['Potassium Sulphate', 'Silica'], "type:vine"
    if layer == 'canopy':
        return ['Potassium Phosphate', 'Calcium Phosphate'], "type:canopy_tree"
    if layer in ('low_tree', 'sub_canopy'):
        return ['Potassium Chloride', 'Calcium Phosphate'], "type:fruit_tree"
    return ['Potassium Phosphate'], "type:unknown_fallback"


def infer_koppen(zones):
    """Infer Köppen climate classifications from USDA hardiness zones."""
    if not zones:
        return []
    min_z, max_z = min(zones), max(zones)
    result = []
    if max_z >= 10:
        result.append('Af')
    if max_z >= 10 and min_z <= 11:
        result.append('Am')
    if max_z >= 10 and min_z >= 10:
        result.append('Aw')
    if 7 <= min_z <= 10 and max_z <= 10:
        result.append('BSh')
    if max_z >= 6 and min_z <= 9:
        result.append('Cfa')
        result.append('Cfb')
    if max_z >= 5 and min_z <= 8:
        result.append('Csb')
    if min_z <= 6 and max_z >= 4:
        result.append('Dfa')
        result.append('Dfb')
    if min_z <= 4:
        result.append('Dfc')
    return list(set(result))


min_key_map = {
    'Calcium Fluoride': 'calcium_fluoride',
    'Calcium Phosphate': 'calcium_phosphate',
    'Calcium Sulphate': 'calcium_sulphate',
    'Iron Phosphate': 'iron_phosphate',
    'Magnesium Phosphate': 'magnesium_phosphate',
    'Potassium Chloride': 'potassium_chloride',
    'Potassium Phosphate': 'potassium_phosphate',
    'Potassium Sulphate': 'potassium_sulphate',
    'Silica': 'silica',
    'Sodium Chloride': 'sodium_chloride',
    'Sodium Phosphate': 'sodium_phosphate',
    'Sodium Sulphate': 'sodium_sulphate',
}


def main():
    changes = {
        'salts_added': 0,
        'koppen_added': 0,
        'plants_updated': set(),
        'errors': []
    }

    for plant_id, plant_data in registry.items():
        if not isinstance(plant_data, dict) or 'botanical_name' not in plant_data:
            continue

        changed = False

        # Fill missing cell salts
        if not plant_data.get('bio_logic', {}).get('salts'):
            salts, reason = infer_cell_salts(plant_id, plant_data)
            if 'bio_logic' not in plant_data:
                plant_data['bio_logic'] = {}
            plant_data['bio_logic']['salts'] = salts
            changes['salts_added'] += 1
            changes['plants_updated'].add(plant_id)
            changed = True
            print(f"  SALT {plant_id}: {salts} ({reason})")

        # Fill missing Köppen data
        climate_profile = plant_data.get('climate_profile', {})
        if not climate_profile.get('koppen'):
            zones = climate_profile.get('zones', [])
            koppen = infer_koppen(zones)
            if koppen:
                climate_profile['koppen'] = koppen
                changes['koppen_added'] += 1
                changes['plants_updated'].add(plant_id)
                if not changed:
                    print(f"  KOPP {plant_id}: {koppen}")
                else:
                    print(f"       koppen: {koppen}")

    print(f"\n{'='*60}")
    print(f"DATA FILLING SUMMARY")
    print(f"{'='*60}")
    print(f"Cell salt mappings added:  {changes['salts_added']}")
    print(f"Köppen climates added:     {changes['koppen_added']}")
    print(f"Total plants modified:     {len(changes['plants_updated'])}")

    # Backup
    import shutil
    backup_path = os.path.join(REPO_DIR, 'master_registry.backup.json')
    shutil.copy2(os.path.join(REPO_DIR, 'master_registry.json'), backup_path)
    print(f"\nBackup saved to: master_registry.backup.json")

    # Write updated registry
    with open(os.path.join(REPO_DIR, 'master_registry.json'), 'w') as f:
        json.dump(registry, f, indent=2)
    print(f"master_registry.json updated")

    # ============================================================
    # SYNC BIODYNAMIC_MAP.JSON
    # ============================================================
    print(f"\n{'='*60}")
    print(f"SYNCING BIODYNAMIC_MAP.JSON")
    print(f"{'='*60}")

    mtp = bd.get('mineral_to_plants', {})
    mineral_to_plants = {k: [] for k in mtp.keys()}

    for plant_id, plant_data in registry.items():
        if not isinstance(plant_data, dict):
            continue
        for salt in plant_data.get('bio_logic', {}).get('salts', []):
            key = min_key_map.get(salt)
            if key and key in mineral_to_plants:
                mineral_to_plants[key].append(plant_id)

    for key in mineral_to_plants:
        mineral_to_plants[key] = sorted(set(mineral_to_plants[key]))
        if key in bd.get('mineral_to_plants', {}):
            bd['mineral_to_plants'][key] = {'plants': mineral_to_plants[key]}

    with open(os.path.join(REPO_DIR, 'biodynamic_map.json'), 'w') as f:
        json.dump(bd, f, indent=2)

    print(f"\nMineral-to-plant sync:")
    for key, plants in sorted(mineral_to_plants.items()):
        print(f"  {key}: {len(plants)} plants")
    print(f"\nbiodynamic_map.json updated")

    # ============================================================
    # REPORT COVERAGE
    # ============================================================
    print(f"\n{'='*60}")
    print(f"FINAL COVERAGE REPORT")
    print(f"{'='*60}")

    plants = [p for p in registry if isinstance(registry[p], dict) and 'botanical_name' in registry[p]]
    with_salts = [p for p in plants if registry[p].get('bio_logic', {}).get('salts')]
    with_koppen = [p for p in plants if registry[p].get('climate_profile', {}).get('koppen')]

    print(f"Total plants:              {len(plants)}")
    print(f"With cell salts:           {len(with_salts)}")
    print(f"With Köppen data:          {len(with_koppen)}")

    zone_counts = {}
    for pid in plants:
        for z in registry[pid].get('climate_profile', {}).get('zones', []):
            zone_counts[z] = zone_counts.get(z, 0) + 1

    print(f"\nUpdated zone coverage:")
    for z in sorted(zone_counts.keys()):
        print(f"  Zone {z}: {zone_counts[z]} plants")

    print(f"\nDone! Run: npm run audit:coverage  to verify.")


if __name__ == '__main__':
    main()
