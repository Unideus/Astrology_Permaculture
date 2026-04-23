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

  // Get recommended plants based on deficient salts
  getRecommendedPlants(deficientSalts) {
    const plantMap = {};
    
    deficientSalts.forEach(salt => {
      const saltKey = salt.cell_salt.toLowerCase().replace(/ /g, '_');
      const mineralData = this.biodynamicMap.mineral_to_plants[saltKey];
      
      if (mineralData && mineralData.plants) {
        const plants = mineralData.plants;
        plants.forEach(plant => {
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
  generatePlan(userData) {
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
    
    // Get recommended plants
    const recommendedPlants = this.getRecommendedPlants(uniqueSalts);
    
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

  // Generate 3-year implementation plan
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
        title: 'Soil Remediation & Preparation',
        duration: 'Months 0-12',
        focus: 'Build soil biology, establish cover crops',
        tasks: [
          {
            task: 'Soil Testing',
            timing: 'Month 0',
            details: soilTest ? 'Use existing test data' : 'Send soil sample to lab'
          },
          {
            task: 'Cover Crop Planting',
            timing: 'Month 1-3',
            plants: ['Cereal Rye', 'Crimson Clover', 'Hairy Vetch'],
            details: 'Plant during Waning Moon for root establishment'
          },
          {
            task: 'Compost & Amendments',
            timing: 'Month 2-4',
            details: 'Apply compost, biochar, mineral amendments based on soil test'
          },
          {
            task: 'Support Species',
            timing: 'Month 6-9',
            plants: ['Autumn Olive', 'Comfrey', 'Yarrow'],
            details: 'Nitrogen fixers and dynamic accumulators'
          }
        ]
      },
      
      year1: {
        title: config.trees ? 'Shrubs & Small Trees' : 'Perennial Herbs & Ground Cover',
        duration: 'Months 12-24',
        focus: config.focus,
        tasks: [
          {
            task: 'Berry Plantings',
            timing: 'Early Spring (dormant)',
            plants: ['Raspberry', 'Black Currant', 'Gooseberry', 'Blueberry'],
            details: 'Plant during Waxing Moon for establishment'
          },
          {
            task: 'Small Trees',
            timing: 'Early Spring or Late Fall',
            plants: config.trees ? ['Dwarf Apple', 'Pear', 'Cherry', 'Peach'] : ['Dwarf Citrus (containers)'],
            details: 'Bare root preferred, mulch heavily'
          },
          {
            task: 'Herb Spiral/Bed',
            timing: 'Spring after last frost',
            plants: ['Comfrey', 'Yarrow', 'Chamomile', 'Lemon Balm', 'Catnip'],
            details: 'Medicinal herbs matching deficient cell salts'
          },
          {
            task: 'Vine Trellises',
            timing: 'Spring',
            plants: ['Grapes', 'Honeysuckle', 'Clematis'],
            details: 'Install support structures'
          }
        ]
      },
      
      year2: {
        title: 'Main Canopy & Production',
        duration: 'Months 24-36',
        focus: 'Establish permanent plantings',
        tasks: [
          {
            task: 'Canopy Trees',
            timing: 'Early Spring (dormant)',
            plants: config.trees ? ['Black Walnut', 'Chestnut', 'Oak', 'Hickory'] : ['Dwarf varieties in large containers'],
            details: '30-40ft spacing for standard, 10-15ft for dwarf'
          },
          {
            task: 'Nut Production',
            timing: 'Spring/Fall',
            plants: ['Hazelnut', 'Almond', 'Pecan (zone dependent)'],
            details: 'Long-term investment, 5-10 years to full production'
          },
          {
            task: 'Perennial Vegetables',
            timing: 'Early Spring',
            plants: ['Asparagus', 'Rhubarb', 'Jerusalem Artichoke', 'Horseradish'],
            details: '2-3 years to full harvest'
          },
          {
            task: 'Guild Completion',
            timing: 'Throughout season',
            details: 'Fill in nitrogen fixers, pollinators, mulch plants'
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
