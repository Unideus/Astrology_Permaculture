// Permaculture Design App - Main Application Logic
const fs = require('fs');
const path = require('path');

class PermacultureApp {
  constructor() {
    this.biodynamicMap = JSON.parse(fs.readFileSync('biodynamic_map.json', 'utf-8'));
    this.masterRegistry = JSON.parse(fs.readFileSync('master_registry.json', 'utf-8'));
    this.zodiacOrder = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
                        'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
  }

  // Get deficient cell salts based on sun sign (sign + next 2)
  getDeficientSalts(sunSign) {
    const sign = sunSign.toLowerCase();
    const idx = this.zodiacOrder.indexOf(sign);
    if (idx === -1) throw new Error(`Invalid sun sign: ${sunSign}`);
    
    // Get current sign + next 2 signs
    const signs = [
      this.zodiacOrder[idx],
      this.zodiacOrder[(idx + 1) % 12],
      this.zodiacOrder[(idx + 2) % 12]
    ];
    
    return signs.map(s => ({
      sign: s,
      cell_salt: this.biodynamicMap.zodiac_cell_salts[s].cell_salt,
      function: this.biodynamicMap.zodiac_cell_salts[s].function
    }));
  }

  // Filter registry by zone, climate affinity, and optionally zodiac salt
  filterPlants({ zone = null, koppen = null, affinity = null, layer = null, salt = null, nitrogenFixer = false }) {
    const results = Object.values(this.masterRegistry);
    
    return results.filter(plant => {
      // Zone filter
      if (zone !== null) {
        const zones = plant.climate_profile?.zones || [];
        if (zones.length > 0 && (zone < zones[0] || zone > zones[zones.length - 1])) {
          return false;
        }
      }
      
      // Climate affinity filter (skip if plant has no affinity or affinity is "any")
      if (affinity !== null && plant.climate_affinity && plant.climate_affinity !== 'any') {
        if (plant.climate_affinity !== affinity) return false;
      }
      
      // Layer filter
      if (layer !== null && plant.taxonomy?.layer !== layer) return false;
      
      // Zodiac salt filter (plant bio_logic.salts must include the cell salt)
      if (salt !== null) {
        const plantSalts = plant.bio_logic?.salts || [];
        const hasSalt = plantSalts.some(ps => ps.toLowerCase().replace(/ /g, '_') === salt.toLowerCase().replace(/ /g, '_'));
        if (!hasSalt) return false;
      }
      
      // Nitrogen fixer filter
      if (nitrogenFixer) {
        const funcs = plant.permaculture_role?.functions || [];
        const isNFixer = funcs.includes('nitrogen_fixation') || funcs.includes('nitrogen');
        if (!isNFixer) return false;
      }
      
      return true;
    });
  }

  // Get recommended plants based on deficient salts, filtered by climate zone
  getRecommendedPlants(deficientSalts, climateData = null) {
    const plantMap = {};
    
    // Extract zone number from climate data (e.g., "7b" → 7)
    let siteZone = null;
    if (climateData && climateData.hardinessZone) {
      const zoneMatch = climateData.hardinessZone.match(/^(\d+)/);
      if (zoneMatch) siteZone = parseInt(zoneMatch[1]);
    }
    
    deficientSalts.forEach(salt => {
      const saltKey = salt.cell_salt.toLowerCase().replace(/ /g, '_');
      const mineralData = this.biodynamicMap.mineral_to_plants[saltKey];
      
      if (mineralData && mineralData.plants) {
        mineralData.plants.forEach(plant => {
          // Zone filtering
          if (siteZone !== null && this.biodynamicMap.plant_zones) {
            const zoneInfo = this.biodynamicMap.plant_zones[plant];
            if (zoneInfo && zoneInfo.hardiness) {
              const range = zoneInfo.hardiness.split('-');
              const minZone = parseInt(range[0]);
              const maxZone = parseInt(range[1]);
              if (siteZone < minZone || siteZone > maxZone) {
                return; // Skip — plant won't survive here
              }
            }
          }
          
          if (!plantMap[plant]) {
            plantMap[plant] = {
              plant,
              minerals: [],
              functions: []
            };
          }
          plantMap[plant].minerals.push(salt.cell_salt);
          plantMap[plant].functions.push(salt.function);
        });
      }
    });
    
    return Object.values(plantMap);
  }

  // Generate complete plan
  generatePlan(userData, climateData = null) {
    const {
      address,
      sunSign,
      familyMembers = [],
      scale,
      soilTest = null,
      desiredPlants = []
    } = userData;
    
    // Combine all sun signs
    const allSigns = [sunSign, ...familyMembers.map(m => m.sunSign)];
    const allDeficientSalts = allSigns.flatMap(sign => this.getDeficientSalts(sign));
    
    // Remove duplicates
    const uniqueSalts = allDeficientSalts.filter((salt, idx, self) =>
      idx === self.findIndex(s => s.cell_salt === salt.cell_salt)
    );
    
    // Get recommended plants, filtered by zone if climate data available
    const recommendedPlants = this.getRecommendedPlants(uniqueSalts, climateData);
    
    // Generate 3-year plan — now uses registry queries with climate + salt context
    const plan = this.generateThreeYearPlan(scale, climateData, uniqueSalts, soilTest);
    
    return {
      siteInfo: {
        address,
        scale,
        sunSign,
        familyMembers
      },
      cellSalts: {
        deficient: uniqueSalts,
        explanation: `Based on sun sign${allSigns.length > 1 ? 's' : ''}: ${allSigns.join(', ')}. ` +
                    `Supplementing ${uniqueSalts.length} cell salt${uniqueSalts.length > 1 ? 's' : ''}.`
      },
      recommendedPlants,
      guild: this.generate7LayerGuild(uniqueSalts, climateData, desiredPlants),
      threeYearPlan: plan,
      moonCalendar: this.getMoonPlantingCalendar(),
      soilRecommendations: soilTest ? this.analyzeSoil(soilTest) : null
    };
  }

  // ── 7-LAYER UNIVERSAL EDIBLE GUILD GENERATOR ────────────────────────────
  // Generates a 7-layer guild based on climate zone, Köppen code, and cell salts.
  // Each layer gets the best plant: A-Tier (salt match) preferred, B-Tier (best local edible) as fallback.
  // NEVER leaves a layer blank.
  generate7LayerGuild(uniqueSalts, climateData, desiredPlants = []) {
    const LAYERS = [
      { id: 'layer1_canopy',        name: 'Canopy',       registryLayers: ['canopy'],                        heightDesc: '>20ft mature height' },
      { id: 'layer2_low_tree',      name: 'Low Tree',     registryLayers: ['sub_canopy', 'low_tree'],        heightDesc: '10-20ft' },
      { id: 'layer3_shrub',         name: 'Shrub',        registryLayers: ['shrub'],                        heightDesc: '3-10ft' },
      { id: 'layer4_herbaceous',    name: 'Herbaceous',   registryLayers: ['herbaceous'],                    heightDesc: 'Large perennials/annuals' },
      { id: 'layer5_ground_cover',  name: 'Soil Surface', registryLayers: ['ground_cover', 'herbaceous'],    heightDesc: 'Living mulch/groundcover' },
      { id: 'layer6_rhizosphere',   name: 'Rhizosphere',  registryLayers: ['root'],                         heightDesc: 'Roots/tubers' },
      { id: 'layer7_vertical',      name: 'Vertical',     registryLayers: ['vine'],                          heightDesc: 'Vines/climbers' },
    ];

    // Extract climate context
    let siteZone = null;
    let siteKoppen = null;
    if (climateData) {
      if (climateData.hardinessZone) {
        const zm = climateData.hardinessZone.match(/^(\d+)/);
        if (zm) siteZone = parseInt(zm[1]);
      }
      siteKoppen = climateData.koppenCode || null;
    }

    // Determine climate affinity from Köppen
    let affinityTarget = null;
    if (siteKoppen) {
      if (siteKoppen.startsWith('A') || siteKoppen.startsWith('Cf') || siteKoppen.startsWith('Df')) {
        affinityTarget = 'humid';
      } else if (siteKoppen.startsWith('B') || siteKoppen.startsWith('Cs')) {
        affinityTarget = 'arid';
      }
    }

    // Collect all salt names for matching
    const saltNames = uniqueSalts.map(s => s.cell_salt);
    const saltKeys = saltNames.map(s => s.toLowerCase().replace(/ /g, '_'));

    // Build lookup: salt key → set of plant IDs from biodynamic_map
    const saltPlantSets = {};
    for (const sk of saltKeys) {
      const mineralData = this.biodynamicMap.mineral_to_plants[sk];
      if (mineralData && mineralData.plants) {
        saltPlantSets[sk] = new Set(mineralData.plants.map(p => p.toLowerCase().replace(/\s+/g, '_')));
      }
    }

    const guild = {};
    const assignedIds = new Set();  // cross-layer dedup: no plant as primary in multiple layers
    
    // Build lookup for desiredPlants (lowercase for comparison)
    const desiredPlantIds = new Set((desiredPlants || [])
      .map(p => p.toLowerCase().trim())
      .map(p => Object.values(this.masterRegistry).find(x => x.common_name.toLowerCase() === p)?.id || p.replace(/s+/g, '_').toLowerCase())
      .filter(Boolean));
    
    for (const layerDef of LAYERS) {
      // Step 1: CLIMATE GATE — collect up to 10 candidates per layer
      let candidates = [];
      const usedIds = new Set();

      for (const regLayer of layerDef.registryLayers) {
        const plants = this.filterPlants({ zone: siteZone, layer: regLayer });
        // Apply affinity filter
        const viable = plants.filter(p => {
          if (affinityTarget && p.climate_affinity && p.climate_affinity !== 'any') {
            return p.climate_affinity === affinityTarget;
          }
          return true;
        });
        // Also collect non-affinity-matched as fallback order
        for (const p of viable) {
          if (!usedIds.has(p.id) && candidates.length < 10) {
            usedIds.add(p.id);
            candidates.push(p);
          }
        }
        // If still under 10, fill from non-viable (affinity mismatch)
        for (const p of plants) {
          if (!usedIds.has(p.id) && candidates.length < 10) {
            usedIds.add(p.id);
            candidates.push(p);
          }
        }
      }

      // Step 2: SALT SCORING — classify each candidate
      const scored = candidates.map(plant => {
        const plantSalts = (plant.bio_logic?.salts || []).map(s => s.toLowerCase().replace(/ /g, '_'));
        const plantId = plant.id.toLowerCase().replace(/\s+/g, '_');

        // Check if plant's bio_logic salts match any deficient salt
        let matchedSalt = null;
        for (let i = 0; i < saltKeys.length; i++) {
          if (plantSalts.includes(saltKeys[i])) {
            matchedSalt = saltNames[i];
            break;
          }
        }

        // Also check biodynamic_map mineral_to_plants reverse lookup
        if (!matchedSalt) {
          for (let i = 0; i < saltKeys.length; i++) {
            const set = saltPlantSets[saltKeys[i]];
            if (set && set.has(plantId)) {
              matchedSalt = saltNames[i];
              break;
            }
          }
        }

        return {
          id: plant.id,
          name: plant.common_name,
          layer: layerDef.name,
          layer_id: layerDef.id,
          height: layerDef.heightDesc,
          tier: matchedSalt ? 'A' : 'B',
          salt_content: matchedSalt || null,
          tier_label: matchedSalt ? 'A-Tier' : 'B-Tier — Best Local Fit',
          botanical_name: plant.botanical_name || null,
          climate_affinity: plant.climate_affinity || 'any',
          zones: plant.climate_profile?.zones || [],
        };
      });

      // Sort: A-Tier first, then B-Tier
      scored.sort((a, b) => {
        if (a.tier !== b.tier) return a.tier === 'A' ? -1 : 1;
        return 0;
      });

      // Step 3: FILLING THE LAYERS — never blank
      // Primary selection: top A-Tier (not already assigned), or top B-Tier if no A-Tier exists
      let primary = null;
      for (const s of scored) {
        if (!assignedIds.has(s.id)) {
          primary = s;
          assignedIds.add(s.id);
          break;
        }
      }
      // If all scored candidates are already assigned, pick the first anyway (never blank)

      // If no candidates at all from registry, create a placeholder B-Tier
      if (!primary) {
        guild[layerDef.id] = {
          id: 'placeholder_' + layerDef.id,
          name: 'No registry match — requires manual selection',
          layer: layerDef.name,
          layer_id: layerDef.id,
          height: layerDef.heightDesc,
          tier: 'B',
          salt_content: null,
          tier_label: 'B-Tier — Best Local Fit',
          botanical_name: null,
          climate_affinity: 'any',
          zones: [],
          candidates: [],
          note: 'Registry has no plants for this layer in your zone. Add plants to master_registry.json or select manually.',
        };
        continue;
      }

      guild[layerDef.id] = {
        id: primary.id,
        name: primary.name,
        layer: primary.layer,
        layer_id: primary.layer_id,
        height: primary.height,
        tier: primary.tier,
        salt_content: primary.salt_content,
        tier_label: primary.tier_label,
        botanical_name: primary.botanical_name,
        climate_affinity: primary.climate_affinity,
        zones: primary.zones,
        candidates: scored.slice(0, 10),  // full candidate list for reference
      };
    }

    return guild;
  }

  // Generate 3-year implementation plan using registry queries
  generateThreeYearPlan(scale, climateData, uniqueSalts, soilTest) {
    const scaleConfig = {
      'balcony': { area: '0-100 sq ft', trees: false, focus: 'containers, herbs' },
      'backyard': { area: '100-1000 sq ft', trees: true, focus: 'berries, small trees' },
      'homestead': { area: '1/4-2 acres', trees: true, focus: 'orchard, guilds' },
      'farm': { area: '2-50 acres', trees: true, focus: 'commercial orchard' },
      'community': { area: '50+ acres', trees: true, focus: 'food forest' }
    };
    
    // Extract climate context
    let siteZone = null;
    let siteKoppen = null;
    if (climateData) {
      if (climateData.hardinessZone) {
        const zm = climateData.hardinessZone.match(/^(\d+)/);
        if (zm) siteZone = parseInt(zm[1]);
      }
      siteKoppen = climateData.koppenCode || null;
    }
    
    // Determine climate affinity from Köppen
    // A, Cfa, Cfb, Dfa, Dfb = humid; BSh, BSk, Csa, Csb = arid; Cwa, Dwa = transitional
    let affinityTarget = null;
    if (siteKoppen) {
      if (siteKoppen.startsWith('A') || siteKoppen.startsWith('Cf') || siteKoppen.startsWith('Df')) {
        affinityTarget = 'humid';
      } else if (siteKoppen.startsWith('B') || siteKoppen.startsWith('Cs')) {
        affinityTarget = 'arid';
      }
    }
    
    // ── PREFLIGHT: config, primary salt, star name ─────────────────────────
    const config = scaleConfig[scale] || scaleConfig.backyard;

    // Quantity multiplier: scale determines how many plants per layer
    const scaleDepthMap = {
    'balcony': 2,     // 0-100 sq ft: 1-2 per layer
    'backyard': 4,    // 100-1000 sq ft: 3-4 per layer
    'homestead': 9,   // 1/4-2 acres: 8-10 per layer
    'farm': 17,       // 2-50 acres: 15-20 per layer
    'community': 17   // 50+ acres: same as farm
  };
    const planDepth = scaleDepthMap[scale] || 3;

    // ── DIVERSITY FALLBACK: fill gaps when filtered list is too short ──────
    const fillGaps = (candidates, needed, zone, affinityTarget) => {
      if (candidates.length >= needed) return candidates;
      // Try relaxing affinity, then zone constraints
      const relaxed = Object.values(this.masterRegistry).filter(p => {
        if (candidates.some(c => c.id === p.id)) return false;
        const zones = p.climate_profile?.zones || [];
        if (zone !== null && zones.length > 0 && (zone < zones[0] || zone > zones[zones.length - 1])) return false;
        return true;
      });
      return [...candidates, ...relaxed].slice(0, needed);
    };

    const primarySalt = uniqueSalts.length > 0 ? uniqueSalts[0].cell_salt : null;
    
    // Compute star name before branching so it's available in return block
    const preTreeStar = config.trees
      ? (() => {
          const sp = this.filterPlants({ zone: siteZone, layer: 'canopy' });
          const vs = sp.filter(p => !affinityTarget || !p.climate_affinity || p.climate_affinity === 'any' || p.climate_affinity === affinityTarget);
          return (vs[0] || sp[0] || null)?.common_name || 'canopy tree';
        })()
      : 'container tree';
    
    const year0Tasks = [];
    
    // Soil test baseline
    year0Tasks.push({
      task: 'Soil Testing & Baseline',
      timing: 'Month 0 (before planting)',
      details: soilTest
        ? `Use existing soil test (pH ${soilTest.ph}). Tree guilds need pH 6.0-7.0.`
        : 'Send soil sample to extension office. Most fruit/nut trees prefer pH 6.0-7.0.',
      plants: []
    });
    
    if (config.trees) {
      // Star player: pick ONE canopy tree matching zone and affinity
      const starPlayer = this.filterPlants({ zone: siteZone, layer: 'canopy' });
      const viableStar = starPlayer.filter(p => {
        // Zone MIN clamp: exclude plants whose min zone exceeds user's zone
        const zones = p.climate_profile?.zones || [];
        if (zones.length > 0 && siteZone !== null && zones[0] > siteZone) return false;
        if (affinityTarget && p.climate_affinity && p.climate_affinity !== 'any') {
          return p.climate_affinity === affinityTarget;
        }
        return true;
      });
      const star = viableStar.length > 0 ? viableStar[0] : starPlayer[0] || null;
      
      if (star) {
        year0Tasks.push({
          task: 'Canopy Tree Planting',
          timing: 'Late winter/early spring (dormant bare root)',
          plants: [star.common_name],
          botanical: star.botanical_name || null,
          cellSalts: star.bio_logic?.salts || [],
          climateAffinity: star.climate_affinity || 'any',
          details: `${star.common_name} — ${star.taxonomy?.type || 'tree'}. Spacing: 30-50ft. ` +
                   `Matures in 5-15 years. Timeline: Establish Year 1. Expected Harvest: Year 4+.`,
          guild_note: `This is the structural anchor of your entire system. All other plants support it.`
        });
      }
      
      // N-fixers: 2 shrubs with nitrogen_fixation function
      // N-fixers: shrubs in zone, further filtered by zone_min clamp
      let nFixers = this.filterPlants({ zone: siteZone, layer: 'shrub', nitrogenFixer: true });
      nFixers = nFixers.filter(p => {
        const zones = p.climate_profile?.zones || [];
        return !(zones.length > 0 && siteZone !== null && zones[0] > siteZone);
      });
      const viableNFixers = nFixers.filter(p => {
        if (affinityTarget && p.climate_affinity && p.climate_affinity !== 'any') {
          return p.climate_affinity === affinityTarget;
        }
        return true;
      });
      const year0Used = new Set();
      const fillGapsY0 = (candidates, needed, zone, affinity, allowedLayers) => {
        const pool = candidates.filter(p => !year0Used.has(p.id) && (!allowedLayers || allowedLayers.includes(p.taxonomy?.layer)));
        if (pool.length >= needed) {
          const result = pool.slice(0, needed);
          result.forEach(p => year0Used.add(p.id));
          return result;
        }
        const supplementCandidates = Object.values(this.masterRegistry).filter(p => {
          if (year0Used.has(p.id)) return false;
          if (!allowedLayers || !allowedLayers.includes(p.taxonomy?.layer)) return false;
          const zones = p.climate_profile?.zones || [];
          if (zone !== null && zones.length > 0 && (zone < zones[0] || zone > zones[zones.length - 1])) return false;
          return true;
        });
        const result = [...pool, ...supplementCandidates].slice(0, needed);
        result.forEach(p => year0Used.add(p.id));
        return result;
      };
      const selectedNFixers = fillGapsY0(viableNFixers, planDepth, siteZone, affinityTarget, ['shrub', 'herbaceous']);
      
      year0Tasks.push({
        task: 'Support Species (N-Fixers)',
        timing: 'Month 3-6',
        plants: selectedNFixers.map(p => p.common_name),
        botanical: selectedNFixers.map(p => p.botanical_name).filter(Boolean),
        cellSalts: [...new Set(selectedNFixers.flatMap(p => p.bio_logic?.salts || []))],
        details: 'Fast-growing nitrogen fixers. Chop-and-drop biomass to feed the canopy star player. ' +
                 'Some yield berries as a bonus. These define the sub-canopy layer.',
        guild_note: `N-fixers pump nitrogen into the guild. Cut back 3-4x per year for maximum biomass.`
      });
      
      // Water infrastructure
      year0Tasks.push({
        task: 'Water Infrastructure',
        timing: 'Month 0-2',
        plants: [],
        details: 'Swales on contour, drip irrigation zones, rain catchment. Design around mature canopy spread.',
        guild_note: `Without water capture, your star player struggles in dry spells.`
      });
      
      // Cover crops between rows
      year0Tasks.push({
        task: 'Cover Crops Between Rows',
        timing: 'Month 1-3',
        plants: ['Cereal Rye', 'Crimson Clover', 'Hairy Vetch', 'White Clover'],
        details: 'Protect bare soil, build biology, suppress weeds. Will be mowed/chopped as guild fills in.',
        guild_note: `Cover crops buy time while the slow trees establish.`
      });
    } else {
      // Balcony: containers, dwarf/compact trees
      const containerTrees = this.filterPlants({ zone: siteZone, layer: 'canopy' });
      const viableContainer = containerTrees.filter(p => {
        if (affinityTarget && p.climate_affinity && p.climate_affinity !== 'any') {
          return p.climate_affinity === affinityTarget;
        }
        return true;
      });
      const star = viableContainer[0] || containerTrees[0] || null;
      
      year0Tasks.push({
        task: 'Container Setup & Dwarf Tree',
        timing: 'Month 0-2',
        plants: star ? [star.common_name + ' (dwarf/formal)'] : [],
        details: '5-gallon minimum containers with drainage. Use well-draining potting mix. ' +
                 'Dwarf trees need root stock suited to container life.',
        guild_note: `Balcony systems are container-first. No in-ground planting possible.`
      });
      
      year0Tasks.push({
        task: 'Herb Containers & Trellises',
        timing: 'Month 1-3',
        plants: ['Mint', 'Chives', 'Parsley', 'Thyme'],
        details: 'Shallow-rooted herbs in window boxes and hanging planters. Vertical trellis for vines.',
        guild_note: `Herbs are the balcony food forest. Fast harvest, high density.`
      });
    }
    
    // ── YEAR 1: Sub-Canopy & Herbaceous tied to zodiac salt ─────────────────
    const year1Tasks = [];
    
    // Sub-canopy plants sharing zodiac salt
    const saltPlants = primarySalt
      ? this.filterPlants({ zone: siteZone, layer: 'sub_canopy', salt: primarySalt })
      : this.filterPlants({ zone: siteZone, layer: 'sub_canopy' });
    const viableSaltSC = saltPlants.filter(p => {
      if (affinityTarget && p.climate_affinity && p.climate_affinity !== 'any') {
        return p.climate_affinity === affinityTarget;
      }
      return true;
    });
    const year1Used = new Set();
    // Fill gaps for Y1: only herbaceous/sub_canopy/vine (no canopy in lower layers)
    const fillGapsY1 = (candidates, needed, zone, affinity, allowedLayers) => {
      const pool = candidates.filter(p => !year1Used.has(p.id) && (!allowedLayers || allowedLayers.includes(p.taxonomy?.layer)));
      if (pool.length >= needed) {
        const result = pool.slice(0, needed);
        result.forEach(p => year1Used.add(p.id));
        return result;
      }
      const supplementCandidates = Object.values(this.masterRegistry).filter(p => {
        if (year1Used.has(p.id)) return false;
        if (!allowedLayers || !allowedLayers.includes(p.taxonomy?.layer)) return false;
        const zones = p.climate_profile?.zones || [];
        if (zone !== null && zones.length > 0 && (zone < zones[0] || zone > zones[zones.length - 1])) return false;
        return true;
      });
      const result = [...pool, ...supplementCandidates].slice(0, needed);
      result.forEach(p => year1Used.add(p.id));
      return result;
    };
    const selectedSubCanopy = fillGapsY1(viableSaltSC, planDepth * 2, siteZone, affinityTarget, ['sub_canopy', 'herbaceous', 'vine', 'shrub']);
    
    // Herbaceous plants sharing zodiac salt (fill if not enough sub-canopy)
    const herbSaltPlants = primarySalt
      ? this.filterPlants({ zone: siteZone, layer: 'herbaceous', salt: primarySalt })
      : this.filterPlants({ zone: siteZone, layer: 'herbaceous' });
    const viableSaltHerb = herbSaltPlants.filter(p => {
      if (affinityTarget && p.climate_affinity && p.climate_affinity !== 'any') {
        return p.climate_affinity === affinityTarget;
      }
      return true;
    });
    
    // Combine to get 3 total for year 1
    // Deduplicate: same plant shouldn't appear twice in one year's task list
    const seenIds = new Set(selectedSubCanopy.map(p => p.id));
    const year1Candidates = [
      ...selectedSubCanopy,
      ...viableSaltHerb.filter(p => { if (seenIds.has(p.id)) return false; seenIds.add(p.id); return true; })
    ];
    // Widen if fewer than 5 unique — relax salt, then layer constraint
    let year1Selected = fillGapsY1(year1Candidates, planDepth * 2, siteZone, affinityTarget, ['sub_canopy', 'herbaceous', 'vine', 'shrub']);
    const y1Unique = [...new Set(year1Selected.map(p => p.id))];
    if (y1Unique.length < 5) {
      // Widen: allow any climate-matched plants, not just salt-linked
      const widenedCandidates = Object.values(this.masterRegistry).filter(p => {
        const zones = p.climate_profile?.zones || [];
        if (zones.length > 0 && (siteZone < zones[0] || siteZone > zones[zones.length - 1])) return false;
        return ['herbaceous', 'sub_canopy', 'vine', 'shrub'].includes(p.taxonomy?.layer);
      });
      const needed = planDepth * 2;
      const pool = widenedCandidates.filter(p => !year1Used.has(p.id));
      const extra = pool.slice(0, needed - year1Selected.length);
      year1Selected = [...year1Selected, ...extra];
      extra.forEach(p => year1Used.add(p.id));
    }
    
    year1Tasks.push({
      task: 'Salt-Linked Plants (Sub-Canopy & Herbaceous)',
      timing: 'Early Spring after last frost',
      plants: year1Selected.map(p => p.common_name),
      botanical: year1Selected.map(p => p.botanical_name).filter(Boolean),
      cellSalts: [...new Set(year1Selected.flatMap(p => p.bio_logic?.salts || []))],
      primarySalt: primarySalt,
      details: `Plants selected for alignment with ${primarySalt || 'general'} cell salt needs. ` +
               `Sub-canopy fills the mid-story; herbaceous provides ground cover and harvest.`,
      guild_note: `These plants address the zodiac salt deficiency directly. Their biomass feeds the canopy.`
    });
    
    // Dynamic accumulators
    const dynAcc = this.filterPlants({ zone: siteZone, layer: 'herbaceous', salt: primarySalt });
    const viableDyn = dynAcc.filter(p => p.permaculture_role?.functions?.includes('potassium_mining') ||
                                          p.permaculture_role?.functions?.includes('biomass'));
    const selectedDyn = fillGapsY1(viableDyn, planDepth, siteZone, affinityTarget, ['herbaceous', 'vine']);
    selectedDyn.forEach(p => year1Used.add(p.id));
    
    // Widen if fewer than 5 unique dynamic accumulators
    if (selectedDyn.length < 5) {
      const widerDyn = Object.values(this.masterRegistry).filter(p => {
        if (year1Used.has(p.id)) return false;
        const zones = p.climate_profile?.zones || [];
        if (zones.length > 0 && (siteZone < zones[0] || siteZone > zones[zones.length - 1])) return false;
        return ['herbaceous', 'vine'].includes(p.taxonomy?.layer);
      });
      const extra = widerDyn.slice(0, 5 - selectedDyn.length);
      extra.forEach(p => year1Used.add(p.id));
    }
    
    year1Tasks.push({
      task: 'Dynamic Accumulators',
      timing: 'Spring after last frost',
      plants: selectedDyn.map(p => p.common_name),
      details: 'Plant at tree drip lines. Deep roots mine potassium, calcium, silica. ' +
               'Begin chop-and-drop cycles to feed canopy star player.',
      guild_note: `Accumulators are the mineral cyclers. Cut at bloom for maximum biomass nutrient content.`
    });
    
    // Vines (if scale supports)
    if (config.trees) {
      const vines = this.filterPlants({ zone: siteZone, layer: 'vine' });
      const viableVine = vines.filter(p => {
        if (affinityTarget && p.climate_affinity && p.climate_affinity !== 'any') {
          return p.climate_affinity === affinityTarget;
        }
        return true;
      });
      
      year1Tasks.push({
        task: 'Vine Trellises',
        timing: 'Spring',
        plants: fillGapsY1(viableVine, planDepth, siteZone, affinityTarget, ['vine', 'herbaceous']).map(p => p.common_name),
        details: 'Install on pergolas or between trees. Grapes on south-facing trellises for maximum sun.',
        guild_note: `Vines use vertical space above the herbaceous layer. Don't let them smother the star player.`
      });
    }
    
    // ── YEAR 2: Ground Cover & Root ──────────────────────────────────────────
    const year2Used = new Set();
    const fillGapsY2 = (candidates, needed, zone, affinity, allowedLayers) => {
      const pool = candidates.filter(p => !year2Used.has(p.id) && (!allowedLayers || allowedLayers.includes(p.taxonomy?.layer)));
      if (pool.length >= needed) {
        const result = pool.slice(0, needed);
        result.forEach(p => year2Used.add(p.id));
        return result;
      }
      const supplementCandidates = Object.values(this.masterRegistry).filter(p => {
        if (year2Used.has(p.id)) return false;
        if (!allowedLayers || !allowedLayers.includes(p.taxonomy?.layer)) return false;
        const zones = p.climate_profile?.zones || [];
        if (zone !== null && zones.length > 0 && (zone < zones[0] || zone > zones[zones.length - 1])) return false;
        return true;
      });
      const result = [...pool, ...supplementCandidates].slice(0, needed);
      result.forEach(p => year2Used.add(p.id));
      return result;
    };
    
    // Ground cover
    const groundCover = this.filterPlants({ zone: siteZone, layer: 'ground_cover' });
    const viableGC = groundCover.filter(p => {
      if (affinityTarget && p.climate_affinity && p.climate_affinity !== 'any') {
        return p.climate_affinity === affinityTarget;
      }
      return true;
    });
    
    const year2Tasks = [];
    
    // Ground cover: ONLY ground_cover and herbaceous plants allowed
    const gcPlants = (() => {
      const needed = planDepth * 2;
      const primary = viableGC.filter(p => !year2Used.has(p.id));
      if (primary.length >= needed) {
        const result = primary.slice(0, needed);
        result.forEach(p => year2Used.add(p.id));
        return result.map(p => p.common_name);
      }
      // Fall back only to ground_cover or herbaceous - never canopy/sub_canopy
      const supplementCandidates = Object.values(this.masterRegistry).filter(p => {
        if (year2Used.has(p.id)) return false;
        // Only allow ground_cover or herbaceous — NEVER canopy/sub_canopy/shrub
        if (!['ground_cover', 'herbaceous'].includes(p.taxonomy?.layer)) return false;
        const zones = p.climate_profile?.zones || [];
        if (zones.length > 0 && (siteZone < zones[0] || siteZone > zones[zones.length - 1])) return false;
        return true;
      });
      const result = [...primary, ...supplementCandidates].slice(0, needed);
      result.forEach(p => year2Used.add(p.id));
      if (result.length === 0) return ['No suitable Ground Cover found'];
      return result.map(p => p.common_name);
    })();
    
    year2Tasks.push({
      task: 'Ground Cover & Living Mulch',
      timing: 'Spring/Fall',
      plants: gcPlants,
      details: 'Suppress weeds, fix nitrogen, support pollinators. Mow before seed set if needed. ' +
               'Living mulch fills bare soil between trees and herbs.',
      guild_note: `Ground cover is the immune system of the soil. Keep it diverse.`
    });
    
    // Root layer
    const roots = this.filterPlants({ zone: siteZone, layer: 'root' });
    const viableRoot = roots.filter(p => {
      if (affinityTarget && p.climate_affinity && p.climate_affinity !== 'any') {
        return p.climate_affinity === affinityTarget;
      }
      return true;
    });
    
    // Root layer: ONLY root or herbaceous plants allowed (never canopy/sub_canopy/shrub)
    const rootPlants = (() => {
      const needed = planDepth * 2;
      const primary = viableRoot.filter(p => !year2Used.has(p.id));
      if (primary.length >= needed) {
        const result = primary.slice(0, needed);
        result.forEach(p => year2Used.add(p.id));
        return result.map(p => p.common_name);
      }
      const supplementCandidates = Object.values(this.masterRegistry).filter(p => {
        if (year2Used.has(p.id)) return false;
        // Only allow root or herbaceous — NEVER canopy/sub_canopy/shrub
        if (!['root', 'herbaceous'].includes(p.taxonomy?.layer)) return false;
        const zones = p.climate_profile?.zones || [];
        if (zones.length > 0 && (siteZone < zones[0] || siteZone > zones[zones.length - 1])) return false;
        return true;
      });
      const result = [...primary, ...supplementCandidates].slice(0, needed);
      result.forEach(p => year2Used.add(p.id));
      if (result.length === 0) return ['No suitable Root Layer found'];
      return result.map(p => p.common_name);
    })();
    
    year2Tasks.push({
      task: 'Root Layer (Bulbs & Tubers)',
      timing: 'Early Spring or Fall',
      plants: rootPlants,
      details: 'Deep-rooted storage crops. Harvest in fall/winter. ' +
               'Some (garlic, onion) also serve as pest deterrents in guilds.',
      guild_note: `Root layer uses space below. Most root vegetables prefer well-drained soil.`
    });
    
    // Guild completion
    const remaining = this.filterPlants({ zone: siteZone });
    const viableRemaining = remaining.filter(p => {
      if (affinityTarget && p.climate_affinity && p.climate_affinity !== 'any') {
        return p.climate_affinity === affinityTarget;
      }
      return true;
    });
    
    year2Tasks.push({
      task: 'Guild Completion & First Harvests',
      timing: 'Throughout season',
      plants: fillGapsY2(viableRemaining, planDepth * 3, siteZone, affinityTarget, ['herbaceous', 'vine', 'root', 'ground_cover', 'shrub']).map(p => p.common_name),
      details: 'Fill remaining niches with guild-compatible plants. ' +
               `Begin harvesting herbs and early production crops by season end.`,
      guild_note: `By year 2, the guild is producing food. Year 3+ is full production.`
    });
    
    // N-Fixer post-processing: move non-legume species to Dynamic Accumulators
    const DYNAMIC_ACCUMULATORS = new Set(['nettle', 'dandelion', 'comfrey', 'horseradish']);
    [year0Tasks, year1Tasks, year2Tasks].forEach(tasks => {
      tasks.forEach(task => {
        if (!task.plants || !Array.isArray(task.plants)) return;
        // Deduplicate plant list
        task.plants = [...new Map(task.plants.map(p => [p.toLowerCase(), p])).values()];
        if (task.task && task.task.includes('N-Fixers') && !task.task.includes('Dynamic')) {
          const nonLegumes = task.plants.filter(p => DYNAMIC_ACCUMULATORS.has(p.toLowerCase()));
          const legumes = task.plants.filter(p => !DYNAMIC_ACCUMULATORS.has(p.toLowerCase()));
          task.plants = legumes;
          if (nonLegumes.length > 0) {
            task.details = (task.details || '') + ` Dynamic Accumulators (K/Minerals): ${nonLegumes.join(', ')}.`;
          }
        }
      });
    });
    
    const year = { timeframe: 'Months 0-12' };
    
    return {
      year0: {
        title: config.trees ? 'Canopy & Infrastructure' : 'Containers & Soil Base',
        timeframe: year.timeframe,
        focus: config.trees
          ? `Establish ${preTreeStar} as the system anchor`
          : 'Permanent containers, trellises, soil building',
        tasks: year0Tasks,
        timeframe: year.timeframe,
        climateContext: {
          zone: siteZone || 'unknown',
          koppen: siteKoppen || 'unknown',
          affinityFilter: affinityTarget || 'any'
        }
      },
      year1: {
        title: 'Sub-Canopy, Herbaceous & Vines',
        duration: 'Year 2',
        focus: `Fill mid-story with salt-linked plants targeting ${primarySalt || 'cell salt balance'}`,
        tasks: year1Tasks
      },
      year2: {
        title: 'Ground Cover, Roots & First Harvests',
        duration: 'Year 3',
        focus: 'Fill soil niche, begin producing food',
        tasks: year2Tasks
      }
    };
  }

  // Get moon-based planting calendar
  getMoonPlantingCalendar() {
    return {
      waxingMoon: {
        phase: 'New Moon → Full Moon',
        action: 'Sap Rising',
        plant: ['Leafy annuals', 'Flowers', 'Fruiting crops', 'Transplants'],
        avoid: ['Root crops', 'Pruning', 'Harvesting for storage']
      },
      waningMoon: {
        phase: 'Full Moon → New Moon',
        action: 'Sap Falling',
        plant: ['Root crops', 'Perennials', 'Trees', 'Shrubs'],
        tasks: ['Pruning', 'Harvesting', 'Soil amendments', 'Compost turning']
      },
      newMoon: {
        action: 'Rest and planning',
        plant: ['Nothing or hardy greens']
      },
      fullMoon: {
        action: 'Harvest medicinal herbs',
        plant: ['Nothing or quick greens']
      }
    };
  }

  // Analyze soil test results
  analyzeSoil(soilTest) {
    const recommendations = [];
    
    // pH adjustments
    if (soilTest.ph < 6.0) {
      recommendations.push({
        issue: 'Low pH (acidic)',
        solution: 'Add lime (calcium carbonate)',
        amount: '5-10 lbs per 100 sq ft'
      });
    } else if (soilTest.ph > 7.5) {
      recommendations.push({
        issue: 'High pH (alkaline)',
        solution: 'Add sulfur or peat moss',
        amount: '2-5 lbs sulfur per 100 sq ft'
      });
    }
    
    // NPK adjustments
    if (soilTest.nitrogen < 20) {
      recommendations.push({
        issue: 'Low Nitrogen',
        solution: 'Plant nitrogen fixers: clover, beans, autumn olive',
        organic: ['Blood meal', 'Fish emulsion', 'Composted manure']
      });
    }
    
    if (soilTest.phosphorus < 15) {
      recommendations.push({
        issue: 'Low Phosphorus',
        solution: 'Add bone meal, rock phosphate',
        plants: ['Comfrey', 'Nettle']
      });
    }
    
    if (soilTest.potassium < 100) {
      recommendations.push({
        issue: 'Low Potassium',
        solution: 'Add greensand, kelp meal, wood ash',
        plants: ['Comfrey', 'Banana peels']
      });
    }
    
    return recommendations;
  }
}

// Export for use in server
module.exports = PermacultureApp;

// CLI mode (for backward compatibility)
if (require.main === module) {
  const app = new PermacultureApp();
  
  // Test with sample data
  const testPlan = app.generatePlan({
    address: '123 Main St, Benton, AR',
    sunSign: 'Aries',
    familyMembers: [],
    scale: 'homestead',
    soilTest: null
  });
  
  console.log(JSON.stringify(testPlan, null, 2));
}