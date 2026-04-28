// Plant Anchor Registry Normalization Engine
const fs = require('fs');
const path = require('path');

const ANCHOR_FILE = path.join(__dirname, 'anchor_registry.json');

class AnchorRegistry {
  constructor() {
    this.anchors = JSON.parse(fs.readFileSync(ANCHOR_FILE, 'utf-8')).anchors;
    this.allNames = new Map();
    this.buildNameIndex();
  }

  buildNameIndex() {
    for (const parentId in this.anchors) {
      const anchor = this.anchors[parentId];
      // Add parent ID
      this.allNames.set(parentId.toLowerCase(), parentId);
      // Add common names
      if (anchor.common_names) {
        anchor.common_names.forEach(name => {
          this.allNames.set(name.toLowerCase(), parentId);
        });
      }
      // Add botanical names
      if (anchor.botanical) {
        this.allNames.set(anchor.botanical.toLowerCase(), parentId);
      }
    }
  }

  // Normalize user input to parent_id
  normalizePlantInput(input) {
    if (!input || typeof input !== 'string') return null;
    
    const normalized = input.trim().toLowerCase();
    
    // Try direct match
    if (this.allNames.has(normalized)) {
      return this.allNames.get(normalized);
    }
    
    // Try substring match (for partial names like "apple" matching "apple_")
    for (const [name, parentId] of this.allNames.entries()) {
      if (name.includes(normalized) || normalized.includes(name)) {
        return parentId;
      }
    }
    
    // Try fuzzy matching - common variants
    const variants = {
      'apple': ['apple_', 'malus'],
      'pear': ['pear_', 'pyrus'],
      'cherry': ['cherry_', 'prunus'],
      'apricot': ['apricot_'],
      'walnut': ['walnut_', 'black_walnut_'],
      'chestnut': ['chestnut_', 'american_chestnut_'],
      'mulberry': ['mulberry_'],
      'persimmon': ['persimmon_'],
      'plum': ['plum_'],
      'fig': ['fig_']
    };
    
    for (const parentId in variants) {
      if (variants[parentId].includes(normalized) || normalized.includes(parentId)) {
        return parentId;
      }
    }
    
    return null;
  }

  // Get best fit variety for a zone/koppen
  getBestFit(parentId, zone, koppen) {
    const anchor = this.anchors[parentId];
    if (!anchor) return null;
    
    // Find all suitable layers and variants
    const candidates = [];
    
    for (const layerKey in anchor.layers) {
      const layer = anchor.layers[layerKey];
      
      // Check zone compatibility
      if (layer.zones) {
        if (Array.isArray(layer.zones)) {
          if (!layer.zones.includes(zone) && zone > Math.max(...layer.zones)) {
            continue; // Zone too high
          }
          if (zone < Math.min(...layer.zones)) {
            continue; // Zone too low
          }
        }
      }
      
      // Check Koppen affinity
      if (koppen && layer.koppen_affinity) {
        if (!layer.koppen_affinity.some(k => koppen.startsWith(k))) {
          continue;
        }
      }
      
      // Get variants
      const variants = layer.variants || [];
      for (const variant of variants) {
        candidates.push({
          parentId,
          layer: layerKey,
          variety: variant.name,
          zones: variant.zones,
          koppen_affinity: variant.koppen_affinity,
          chilling_hours: variant.chilling_hours,
          salt_content: variant.salt_content
        });
      }
    }
    
    if (candidates.length === 0) return null;
    
    // Score candidates by Koppen match
    const scored = candidates.map(c => {
      let score = 0;
      if (koppen && c.koppen_affinity) {
        const match = c.koppen_affinity.find(k => koppen.startsWith(k));
        if (match) score += 10;
      }
      if (c.chilling_hours <= 400) score += 5; // Low chilling preferred
      return { ...c, score };
    });
    
    scored.sort((a, b) => b.score - a.score);
    return scored[0];
  }

  // Get best ecological anchor for zone/koppen (fallback)
  getBestEcologicalAnchor(zone, koppen) {
    const ecological = [
      { parentId: 'oak', name: 'Live Oak', zones: [8, 9, 10], koppen: ['Csa', 'Csb', 'Cfa'] },
      { parentId: 'fig', name: 'Fig', zones: [7, 8, 9, 10], koppen: ['Csa', 'Csb', 'Cfa'] },
      { parentId: 'apricot', name: 'Apricot', zones: [5, 6, 7, 8, 9], koppen: ['Cfb', 'Csb', 'Cfa'] },
      { parentId: 'chestnut', name: 'Chestnut', zones: [5, 6, 7, 8], koppen: ['Cfb', 'Cfa'] },
      { parentId: 'walnut', name: 'Black Walnut', zones: [4, 5, 6, 7, 8], koppen: ['Dfb', 'Cfb'] },
    ];
    
    // Find best match
    let best = null;
    let bestScore = -1;
    
    for (const e of ecological) {
      let score = 0;
      if (e.zones.includes(zone)) score += 10;
      if (koppen && e.koppen.some(k => koppen.startsWith(k))) score += 5;
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    
    return best;
  }
}

// Export
module.exports = AnchorRegistry;
