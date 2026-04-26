// Permaculture Design App - Main Application Logic
const fs = require('fs');
const path = require('path');

class PermacultureApp {
  constructor() {
    this.biodynamicMap = JSON.parse(fs.readFileSync('biodynamic_map.json', 'utf-8'));
    this.masterPlants = JSON.parse(fs.readFileSync('master_plants.json', 'utf-8'));
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

  // Generate complete plan — now accepts climateData for zone filtering
  generatePlan(userData, climateData = null) {
    const {
      address,
      sunSign,
      familyMembers = [],
      scale,
      soilTest = null
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
    
    // Generate 3-year plan based on scale
    const plan = this.generateThreeYearPlan(scale, recommendedPlants, soilTest);
    
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
      threeYearPlan: plan,
      moonCalendar: this.getMoonPlantingCalendar(),
      soilRecommendations: soilTest ? this.analyzeSoil(soilTest) : null
    };
  }

  // Generate 3-year implementation plan — CORRECTED: Canopy First Succession
  generateThreeYearPlan(scale, plants, soilTest) {
    const scaleConfig = {
      'balcony': { area: '0-100 sq ft', trees: false, focus: 'containers, herbs' },
      'backyard': { area: '100-1000 sq ft', trees: true, focus: 'berries, small trees' },
      'homestead': { area: '1/4-2 acres', trees: true, focus: 'orchard, guilds' },
      'farm': { area: '2-50 acres', trees: true, focus: 'commercial orchard' },
      'community': { area: '50+ acres', trees: true, focus: 'food forest' }
    };
    
    const config = scaleConfig[scale] || scaleConfig.backyard;
    
    return {
      year0: {
        title: config.trees ? 'Canopy Trees & Infrastructure' : 'Containers & Infrastructure',
        duration: 'Months 0-12',
        focus: config.trees ? 'Establish overstory structure that defines the entire system' : 'Permanent containers, trellises, soil base',
        tasks: [
          {
            task: 'Soil Testing & Baseline',
            timing: 'Month 0 (before planting)',
            details: soilTest ? 'Use existing test data to select trees' : 'Send soil sample; most fruit/nut trees prefer pH 6.0-7.0'
          },
          {
            task: 'Canopy Tree Planting',
            timing: 'Late winter/early spring (dormant bare root)',
            plants: config.trees ? ['Black Walnut', 'Chestnut', 'Pecan', 'Persimmon'] : ['Dwarf varieties in containers'],
            details: '30-50ft spacing. These need 5-15 years to mature. Plant now or wait years for harvest.'
          },
          {
            task: 'Water Infrastructure',
            timing: 'Month 0-2',
            details: 'Swales on contour, drip irrigation zones, rain catchment. Design around mature tree canopy spread.'
          },
          {
            task: 'Cover Crops Between Rows',
            timing: 'Month 1-3',
            plants: ['Cereal Rye', 'Crimson Clover', 'Hairy Vetch', 'White Clover'],
            details: 'Protect bare soil, build biology, fix nitrogen. Will be mowed/chopped as guild fills in.'
          },
          {
            task: 'Support Species (N-fixers)',
            timing: 'Month 3-6',
            plants: ['Autumn Olive', 'Sea Buckthorn', 'Goumi', 'Black Locust'],
            details: 'Fast-growing nitrogen fixers. Chop-and-drop biomass for canopy trees. Some yield berries as bonus.'
          }
        ]
      },
      
      year1: {
        title: config.trees ? 'Sub-canopy, Fruit Trees & Shrubs' : 'Herbs, Berries & Containers',
        duration: 'Months 12-24',
        focus: 'Fill in the layers beneath developing canopy',
        tasks: [
          {
            task: 'Fruit Tree Planting',
            timing: 'Early Spring (dormant)',
            plants: config.trees ? ['Apple', 'Pear', 'Peach', 'Plum', 'Cherry'] : ['Dwarf Citrus', 'Fig (containers)'],
            details: '15-25ft spacing. Plant into guilds that will support them. Mulch heavily.'
          },
          {
            task: 'Berry & Shrub Layer',
            timing: 'Early Spring',
            plants: ['Raspberry', 'Black Currant', 'Gooseberry', 'Elderberry', 'Blueberry'],
            details: 'Juglone-tolerant varieties near black walnut. Shade-tolerant currants on north side of trees.'
          },
          {
            task: 'Vine Trellises',
            timing: 'Spring',
            plants: ['Grapes', 'Hardy Kiwi', 'Passionflower'],
            details: 'Install on pergolas or between trees. Grapes on south-facing trellises for sun.'
          },
          {
            task: 'Dynamic Accumulators',
            timing: 'Spring after last frost',
            plants: ['Comfrey', 'Yarrow', 'Nettle'],
            details: 'Plant at tree drip lines. Begin chop-and-drop cycles to feed canopy.'
          }
        ]
      },
      
      year2: {
        title: 'Herbaceous, Ground Cover & Production Harvest',
        duration: 'Months 24-36',
        focus: 'Fill remaining niches, begin harvesting herbs and early fruits',
        tasks: [
          {
            task: 'Perennial Vegetables',
            timing: 'Early Spring',
            plants: ['Asparagus', 'Rhubarb', 'Jerusalem Artichoke', 'French Sorrel'],
            details: 'Asparagus needs 2-3 years before full harvest. Plant on berms for drainage.'
          },
          {
            task: 'Ground Cover & Living Mulch',
            timing: 'Spring/Fall',
            plants: ['White Clover', 'Creeping Thyme', 'Strawberry'],
            details: 'Suppress weeds, fix nitrogen, support pollinators. Mow before seed if needed.'
          },
          {
            task: 'Guild Completion',
            timing: 'Throughout season',
            plants: ['Chives', 'Daffodils', 'Lupine', 'Clover'],
            details: 'Fill gaps with pest deterrents, pollinator support, and mulch plants. Complete tree guilds.'
          },
          {
            task: 'First Harvests',
            timing: 'Seasonal',
            plants: ['Herbs', 'Berries (year 2-3)', 'Comfrey biomass'],
            details: 'Herbs and greens first. Berries in year 2-3. Tree fruit in year 3-7. Nuts in year 5-15.'
          }
        ]
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
