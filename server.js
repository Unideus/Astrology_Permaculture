// Permaculture Design App Server
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const PermacultureApp = require('./app.js');
const { KoppenLookup } = require('koppen-climate-lookup');

const app = express();
const PORT = process.env.PORT || 3000;

// Ollama config
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5-coder:14b';

// ── Tender perennial blacklist (USDA zone-sensitive) ──────────────────────
const TENDER_PERENNIALS = [
  'Rosemary', 'Lavender', 'Thyme (non-hardy)', 'Sage (non-hardy)',
  'Bay Laurel', 'Artichoke'
];

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Initialize app
const permaApp = new PermacultureApp();

// Ensure sites directory exists
const SITES_DIR = path.join(__dirname, 'sites');
(async () => {
  try { await fs.mkdir(SITES_DIR, { recursive: true }); } catch (e) {}
})();

// =========================================================
// TIER 1: GEOCODING (OpenStreetMap Nominatim)
// =========================================================
app.post('/api/geocode', async (req, res) => {
  try {
    const { address } = req.body;
    if (!address) return res.status(400).json({ error: 'Address required' });

    const baseAddress = address.trim();

    // ── Parse structured components from the address string ──────────────
    // Handle formats: "123 Main St, Duluth, MN" / "123 Main St, Duluth, MN, USA" / "Duluth, MN"
    const commaParts = baseAddress.split(',').map(p => p.trim()).filter(Boolean);
    let street = null, city = null, state = null;

    if (commaParts.length >= 3) {
      // "123 Main St, Duluth, MN" → street=city-state[0], city=city-state[1], state=city-state[2]
      street = commaParts[0];
      city   = commaParts[1];
      state  = commaParts[2];
    } else if (commaParts.length === 2) {
      city  = commaParts[0];
      state = commaParts[1];
    } else if (commaParts.length === 1) {
      // Could be "Duluth MN" or "Duluth, MN" — try split-on-spaces
      const spaceParts = commaParts[0].split(/\s+/);
      if (spaceParts.length >= 2) {
        city  = spaceParts.slice(0, -1).join(' ');
        state = spaceParts[spaceParts.length - 1];
      } else {
        city = commaParts[0];
      }
    }

    const stateAbbr = state || '';
    // Expand common state abbreviations (simple map — add more as needed)
    const stateMap = {
      'AL':'Alabama','AK':'Alaska','AZ':'Arizona','AR':'Arkansas','CA':'California',
      'CO':'Colorado','CT':'Connecticut','DE':'Delaware','FL':'Florida','GA':'Georgia',
      'HI':'Hawaii','ID':'Idaho','IL':'Illinois','IN':'Indiana','IA':'Iowa',
      'KS':'Kansas','KY':'Kentucky','LA':'Louisiana','ME':'Maine','MD':'Maryland',
      'MA':'Massachusetts','MI':'Michigan','MN':'Minnesota','MS':'Mississippi',
      'MO':'Missouri','MT':'Montana','NE':'Nebraska','NV':'Nevada','NH':'New Hampshire',
      'NJ':'New Jersey','NM':'New Mexico','NY':'New York','NC':'North Carolina',
      'ND':'North Dakota','OH':'Ohio','OK':'Oklahoma','OR':'Oregon','PA':'Pennsylvania',
      'RI':'Rhode Island','SC':'South Carolina','SD':'South Dakota','TN':'Tennessee',
      'TX':'Texas','UT':'Utah','VT':'Vermont','VA':'Virginia','WA':'Washington',
      'WV':'West Virginia','WI':'Wisconsin','WY':'Wyoming','DC':'District of Columbia'
    };
    const stateName = stateMap[stateAbbr.toUpperCase()] || stateAbbr;

    // ── Strategy 1: Structured query (most reliable) ──────────────────
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json'
    };

    if (city) {
      const params = new URLSearchParams({ format: 'json', limit: '1', countrycodes: 'us' });
      if (street)  params.set('street',  street);
      params.set('city',   city);
      if (stateName) params.set('state', stateName);

      const structUrl = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
      try {
        const r = await fetch(structUrl, { headers });
        if (r.ok) {
          const data = await r.json();
          if (data && data.length > 0) {
            const result = data[0];
            return res.json({
              latitude: parseFloat(result.lat),
              longitude: parseFloat(result.lon),
              formattedAddress: result.display_name,
              placeId: result.place_id,
              boundingBox: result.boundingbox,
              queryUsed: `structured:${params.toString().slice(0,60)}`
            });
          } else {
          }
        }
      } catch (e) {
        console.warn('Structured geocode failed:', e.message);
      }
    }

    // ── Strategy 2: Free-text with countrycodes=us lock ─────────────────
    const freeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(baseAddress)}&countrycodes=us&limit=1`;
    try {
      const r = await fetch(freeUrl, { headers });
      if (r.ok) {
        const data = await r.json();
        if (data && data.length > 0) {
          const result = data[0];
          return res.json({
            latitude: parseFloat(result.lat),
            longitude: parseFloat(result.lon),
            formattedAddress: result.display_name,
            placeId: result.place_id,
            boundingBox: result.boundingbox,
            queryUsed: 'free-text+countrycodes'
          });
        } else {
        }
      } else {
      }
    } catch (e) {
      console.warn('Free-text geocode failed:', e.message);
    }

    // All strategies exhausted
    res.status(404).json({ error: `Address not found in USA: ${address}` });
  } catch (error) {
    console.error('Geocoding error:', error);
    res.status(500).json({ error: error.message });
  }
});

// =========================================================
// TIER 1: OLLAMA INTEGRATION
// =========================================================
app.post('/api/generate-plan', async (req, res) => {
  try {
    const userData = req.body;
    
    // Validate required fields
    if (!userData.address || !userData.sunSign || !userData.scale) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get geocoded location
    let locationData = null;
    try {
      const geoResponse = await fetch(`http://localhost:${PORT}/api/geocode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: userData.address })
      });
      if (geoResponse.ok) {
        locationData = await geoResponse.json();
      }
    } catch (geoError) {
      console.warn('Geocoding failed, using fallback:', geoError.message);
    }

    // Get climate data BEFORE building Ollama prompt
    let climateData = null;
    if (locationData && locationData.latitude && locationData.longitude) {
      try {
        const climateResponse = await fetch(`http://localhost:${PORT}/api/climate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude: locationData.latitude,
            longitude: locationData.longitude
          })
        });
        if (climateResponse.ok) {
          climateData = await climateResponse.json();
        }
      } catch (climateError) {
        console.warn('Climate lookup failed:', climateError.message);
      }
    }

    // Build prompt for Ollama WITH climate data
    const prompt = buildPermaculturePrompt(userData, locationData, climateData);

    // Call Ollama
    let ollamaPlan = null;
    try {
      const ollamaResponse = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.7,
            num_ctx: 4096
          }
        })
      });

      if (ollamaResponse.ok) {
        const ollamaData = await ollamaResponse.json();
        ollamaPlan = parseOllamaResponse(ollamaData.response);
      }
    } catch (ollamaError) {
      console.warn('Ollama failed, falling back to template:', ollamaError.message);
    }

    // Climate data already fetched above for Ollama prompt — reuse it
    // Generate fallback plan with climate filtering
    const plan = permaApp.generatePlan(userData, climateData);

    // Merge Ollama plan if available
    if (ollamaPlan) {
      plan.aiGenerated = {
        summary: ollamaPlan.summary,
        guilds: ollamaPlan.guilds,
        companionPlanting: ollamaPlan.companionPlanting,
        timingAdvice: ollamaPlan.timingAdvice,
        soilAmendments: ollamaPlan.soilAmendments,
        waterManagement: ollamaPlan.waterManagement,
        pestControl: ollamaPlan.pestControl
      };
    }

    // Attach location data to plan
    if (locationData) {
      plan.locationData = locationData;
      plan.climateData = climateData;
    } else {
      plan.locationData = {
        latitude: null,
        longitude: null,
        formattedAddress: userData.address,
        error: 'Could not geocode address. Please try a different format (e.g., "City, State").'
      };
    }

    res.json(plan);
  } catch (error) {
    console.error('Error generating plan:', error);
    res.status(500).json({ error: error.message });
  }
});

function buildPermaculturePrompt(userData, locationData, climateData = null) {
  const { address, sunSign, familyMembers = [], scale, soilTest } = userData;
  
  // Build climate context for the AI
  let climateContext = '';
  if (climateData) {
    const zone = climateData.hardinessZone || 'unknown';
    const koppen = climateData.koppenCode || 'unknown';
    const frostInfo = climateData.frostDates?.light?.avgLastSpringFrost 
      ? `Last spring frost: ${climateData.frostDates.light.avgLastSpringFrost}, First fall frost: ${climateData.frostDates.light.avgFirstFallFrost}`
      : 'Frost-free or near-frost-free climate';
    climateContext = `
CLIMATE CONSTRAINTS (STRICT):
- USDA Hardiness Zone: ${zone}
- Köppen Climate: ${koppen}
- ${frostInfo}
- ONLY suggest plants that survive in USDA zone ${zone}
- NO temperate plants (apple, pear, cherry, almond, walnut, chestnut, hazelnut) in zone 9+ unless specifically subtropical varieties
- For zone 10a: citrus, avocado, mango, banana, papaya, passionfruit, guava, fig, pineapple, coconut, okra, sweet potato, taro, and tropical greens are appropriate
- DO NOT suggest: almond, walnut, chestnut, pecan, apple, pear, cherry, peach, apricot, plum
- STRICTLY filter tender perennials for cold sites: IF zone <= 5, REMOVE all plants matching [${TENDER_PERENNIALS.join(', ')}] from any guild or companion list. Replace with ONLY zone-hardy substitutes: Russian Sage (zone 4+), Bee Balm (zone 3+), Chives (zone 3+), Hyssop (zone 3+), or Mint (zone 3+). Do not suggest any tender perennial as a permanent outdoor plant in zone 5 or below.
- DO NOT suggest Mediterranean herbs (Rosemary, Lavender, Sage, Thyme, Oregano) as permanent outdoor supporting species in zone 6 or below — these are frost-tender.
- IF zone >= 7, Rosemary and Lavender MAY be included as appropriate.
- STRICTLY use ONLY the plants in the provided registry list. DO NOT invent names like Dragon Fruit, Cinnamon, Nutmeg, Cardamom, Lychee, Durian, or any plant not explicitly in your provided data.
- All guild supporting plants must be real, growable species from your verified plant list.
  `;
  }
  
  return `You are an expert permaculture designer and astrological gardener. Create a detailed permaculture design plan based on the following information:

SITE INFORMATION:
- Address: ${address}
- Coordinates: ${locationData ? `${locationData.latitude}, ${locationData.longitude}` : 'Unknown'}
- Scale: ${scale}
- Primary Sun Sign: ${sunSign}
${familyMembers.length > 0 ? `- Family Members: ${familyMembers.map(m => m.sunSign).join(', ')}` : ''}
${soilTest ? `- Soil Test: pH ${soilTest.ph}, N ${soilTest.nitrogen}, P ${soilTest.phosphorus}, K ${soilTest.potassium}` : '- No soil test provided'}

${climateContext}

Based on the cell salt philosophy:
- ${sunSign} individuals benefit from plants rich in: ${getCellSaltsForSign(sunSign)}

Please provide a structured permaculture design plan with the following sections:

1. SUMMARY: A 2-3 paragraph overview of the design approach

2. GUILDS: 3-5 specific plant guilds (groups of plants that support each other):
   - Each guild should have a name, central tree/shrub, supporting plants, and function
   - CRITICAL: All plants MUST be compatible with the stated USDA hardiness zone

3. COMPANION_PLANTING: Key companion planting combinations for the recommended crops:
   - IF site zone <= 5 (cold climate): Default to "Hardy Mulch" or "Native Grass" ground covers instead of Mediterranean herbs. Use cold-hardy companions only.
   - IF site zone >= 7 (warm climate): Mediterranean herbs (Rosemary, Lavender, Sage companion trio) are appropriate as companion plants.

4. TIMING_ADVICE: Specific timing recommendations based on moon phases and seasons

5. SOIL_AMENDMENTS: Specific amendments needed based on ${soilTest ? 'the provided soil test' : 'general principles'}

6. WATER_MANAGEMENT: Water capture, retention, and irrigation strategies for the ${scale} scale

7. PEST_CONTROL: Natural pest management strategies using companion plants and beneficial insects

Format your response as valid JSON with these exact keys: summary, guilds (array), companionPlanting (array), timingAdvice (string), soilAmendments (array), waterManagement (string), pestControl (string)

Example guild format:
{
  "name": "Apple Guild",
  "central": "Dwarf Apple Tree",
  "supporting": ["Comfrey", "Chives", "Daffodils", "Clover"],
  "function": "Fruit production with dynamic accumulator and pest deterrent"
}`;
}

function getCellSaltsForSign(sign) {
  const saltMap = {
    'aries': 'Potassium Phosphate (Kali Phos)',
    'taurus': 'Sodium Sulphate (Nat Sulph)',
    'gemini': 'Potassium Chloride (Kali Mur)',
    'cancer': 'Calcium Fluoride (Calc Fluor)',
    'leo': 'Magnesium Phosphate (Mag Phos)',
    'virgo': 'Potassium Sulphate (Kali Sulph)',
    'libra': 'Sodium Phosphate (Nat Phos)',
    'scorpio': 'Calcium Sulphate (Calc Sulph)',
    'sagittarius': 'Silica (Silicea)',
    'capricorn': 'Calcium Phosphate (Calc Phos)',
    'aquarius': 'Sodium Chloride (Nat Mur)',
    'pisces': 'Iron Phosphate (Ferrum Phos)'
  };
  return saltMap[sign.toLowerCase()] || 'General minerals';
}

function parseOllamaResponse(response) {
  try {
    // Strip markdown code blocks if present
    let cleaned = response;
    if (cleaned.includes('```json')) {
      cleaned = cleaned.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
    }
    
    // Try to extract JSON from the response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    // If no JSON, return the raw text as summary
    return { summary: response };
  } catch (e) {
    console.warn('Failed to parse Ollama response as JSON, using raw text');
    return { summary: response };
  }
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// =========================================================
// TIER 1: SITE SAVE/LOAD
// =========================================================

// Save site
app.post('/api/sites/:siteId', async (req, res) => {
  try {
    const { siteId } = req.params;
    const siteData = req.body;
    
    if (!siteData || typeof siteData !== 'object') {
      return res.status(400).json({ error: 'Site data required' });
    }
    
    siteData.siteId = siteId;
    siteData.updated = new Date().toISOString();
    
    const filePath = path.join(SITES_DIR, `${siteId}.json`);
    await fs.writeFile(filePath, JSON.stringify(siteData, null, 2));
    
    res.json({ success: true, siteId, message: 'Site saved' });
  } catch (error) {
    console.error('Save site error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Load site
app.get('/api/sites/:siteId', async (req, res) => {
  try {
    const { siteId } = req.params;
    const filePath = path.join(SITES_DIR, `${siteId}.json`);
    
    const data = await fs.readFile(filePath, 'utf-8');
    res.json(JSON.parse(data));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'Site not found' });
    }
    console.error('Load site error:', error);
    res.status(500).json({ error: error.message });
  }
});

// List all sites
app.get('/api/sites', async (req, res) => {
  try {
    const files = await fs.readdir(SITES_DIR);
    const sites = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const data = await fs.readFile(path.join(SITES_DIR, file), 'utf-8');
          const site = JSON.parse(data);
          sites.push({
            siteId: site.siteId,
            name: site.name || site.siteId,
            description: site.description || '',
            created: site.created || '',
            updated: site.updated || ''
          });
        } catch (e) {
          // Skip corrupted files
        }
      }
    }
    
    res.json(sites);
  } catch (error) {
    console.error('List sites error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete site
app.delete('/api/sites/:siteId', async (req, res) => {
  try {
    const { siteId } = req.params;
    const filePath = path.join(SITES_DIR, `${siteId}.json`);
    
    await fs.unlink(filePath);
    res.json({ success: true, message: 'Site deleted' });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'Site not found' });
    }
    console.error('Delete site error:', error);
    res.status(500).json({ error: error.message });
  }
});

// =========================================================
// TIER 1: HARDINESS ZONE & KÖPPEN LOOKUP (via lat/lon)
// =========================================================
app.post('/api/climate', async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ error: 'Latitude and longitude must be numbers' });
    }

    // ── USDA Hardiness Zone from Open-Meteo archive ──
    let hardinessZone = '7b';
    let avgAnnualMinC = null;
    let avgAnnualMinF = null;
    let growingSeasonDays = 180;
    let hardinessSource = 'Fallback estimate';

    let frostDates = null;

    try {
      // Fetch 30 years of daily data (1991–2020)
      const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=1991-01-01&end_date=2020-12-31&daily=temperature_2m_min&timezone=auto`;
      const archiveResponse = await fetch(archiveUrl);
      
      if (archiveResponse.ok) {
        const archiveData = await archiveResponse.json();
        const dailyMin = archiveData.daily?.temperature_2m_min || [];
        const times = archiveData.daily?.time || [];
        
        if (dailyMin.length > 0 && times.length > 0) {
          // Group by year, find coldest day each year
          const yearlyMins = {};
          for (let i = 0; i < times.length; i++) {
            const year = parseInt(times[i].substring(0, 4));
            if (!yearlyMins[year]) yearlyMins[year] = [];
            yearlyMins[year].push(dailyMin[i]);
          }
          
          const annualMins = Object.values(yearlyMins).map(yearTemps => Math.min(...yearTemps));
          avgAnnualMinC = annualMins.reduce((a, b) => a + b, 0) / annualMins.length;
          avgAnnualMinF = avgAnnualMinC * 9 / 5 + 32;
          
          // USDA zone: zone N spans (-60 + 10N) to (-50 + 10N) °F
          // e.g. zone 7 = 0°F to 10°F
          let zone = Math.floor((avgAnnualMinF + 60) / 10) + 1;
          zone = Math.max(1, Math.min(13, zone));
          
          // Sub-zone: a = colder half, b = warmer half of the 10°F range
          const zoneFloor = -60 + (zone - 1) * 10;
          const zoneMid = zoneFloor + 5;
          const subZone = avgAnnualMinF < zoneMid ? 'a' : 'b';
          hardinessZone = `${zone}${subZone}`;
          
          // Growing season will be calculated from actual frost-free days below
          hardinessSource = 'Open-Meteo Climate Archive (1991–2020)';

          // ── Frost Date Analysis ──
          const dailyData = [];
          for (let i = 0; i < times.length; i++) {
            dailyData.push({ date: times[i], temp: dailyMin[i] });
          }

          const byYear = {};
          dailyData.forEach(d => {
            const year = parseInt(d.date.substring(0, 4));
            if (!byYear[year]) byYear[year] = [];
            byYear[year].push(d);
          });

          const frostThresholds = [
            { tempC: 0, label: 'light', tempF: 32 },
            { tempC: -2, label: 'hard', tempF: 28 }
          ];

          frostThresholds.forEach(ft => {
            const springDates = [];
            const fallDates = [];
            const frostFreeDays = [];

            Object.values(byYear).forEach(yearData => {
              const lastSpring = findLastSpringFrost(yearData, ft.tempC);
              const firstFall = findFirstFallFrost(yearData, ft.tempC);
              
              if (lastSpring) springDates.push(new Date(lastSpring));
              if (firstFall) fallDates.push(new Date(firstFall));
              
              // Only count frost-free days if both dates exist in the same year
              if (lastSpring && firstFall) {
                const s = new Date(lastSpring);
                const f = new Date(firstFall);
                frostFreeDays.push(Math.round((f - s) / (1000 * 60 * 60 * 24)));
              }
            });

            const totalYears = Object.keys(byYear).length;

            if (springDates.length > 0 || fallDates.length > 0) {
              if (springDates.length > 0) {
                const avgSpringDoy = Math.round(springDates.reduce((sum, d) => sum + getDayOfYear(d), 0) / springDates.length);
                ft.avgLastSpringFrost = doyToDate(avgSpringDoy);
              }
              if (fallDates.length > 0) {
                const avgFallDoy = Math.round(fallDates.reduce((sum, d) => sum + getDayOfYear(d), 0) / fallDates.length);
                ft.avgFirstFallFrost = doyToDate(avgFallDoy);
              }
              if (frostFreeDays.length > 0) {
                ft.avgFrostFreeDays = Math.round(frostFreeDays.reduce((a, b) => a + b, 0) / frostFreeDays.length);
              } else {
                // No years had both spring AND fall frost
                // Use avg of available dates from different years
                const springDoys = springDates.map(d => getDayOfYear(d));
                const fallDoys = fallDates.map(d => getDayOfYear(d));
                if (springDoys.length > 0 && fallDoys.length > 0) {
                  const avgSpringDoy = springDoys.reduce((a, b) => a + b, 0) / springDoys.length;
                  const avgFallDoy = fallDoys.reduce((a, b) => a + b, 0) / fallDoys.length;
                  const estimatedDays = avgFallDoy - avgSpringDoy;
                  ft.avgFrostFreeDays = estimatedDays > 0 ? Math.round(estimatedDays) : 365;
                } else {
                  ft.avgFrostFreeDays = 365;
                }
              }
              ft.dataYears = totalYears;
            } else {
              // No frost events in entire 30-year record
              ft.frostFree = true;
              ft.avgLastSpringFrost = 'No frost (year-round growing)';
              ft.avgFirstFallFrost = 'No frost (year-round growing)';
              ft.avgFrostFreeDays = 365;
              ft.dataYears = totalYears;
            }
          });

          frostDates = {
            light: frostThresholds.find(f => f.label === 'light'),
            hard: frostThresholds.find(f => f.label === 'hard')
          };

          // Use actual frost-free days as growing season (light frost 32°F/0°C)
          if (frostDates.light && frostDates.light.avgFrostFreeDays) {
            growingSeasonDays = frostDates.light.avgFrostFreeDays;
          }
        }
      }
    } catch (archiveError) {
      console.warn('Archive API failed:', archiveError.message);
    }

    // ── Köppen classification ──
    let koppenCode = null;
    let koppenDescription = null;
    let koppenDistance = null;
    try {
      const lookup = new KoppenLookup();
      const nearest = lookup.findNearest(latitude, longitude, 100);
      if (nearest) {
        koppenCode = nearest.koppenClass;
        koppenDistance = Math.round(nearest.distance * 100) / 100;
        hardinessSource += ` + Köppen lookup`;
      }
    } catch (koppenError) {
      console.warn('Köppen lookup failed:', koppenError.message);
    }

    // Köppen descriptions
    const koppenDescriptions = {
      'Af': 'Tropical rainforest — hot, humid, no dry season',
      'Am': 'Tropical monsoon — short dry season',
      'Aw': 'Tropical savanna — distinct wet/dry seasons',
      'BWh': 'Hot desert — arid, very hot',
      'BWk': 'Cold desert — arid, cooler',
      'BSh': 'Hot semi-arid — steppe, hot',
      'BSk': 'Cold semi-arid — steppe, cooler',
      'Csa': 'Mediterranean — hot, dry summer; mild, wet winter',
      'Csb': 'Warm-summer Mediterranean — mild, dry summer',
      'Cfa': 'Humid subtropical — hot, humid summer; mild winter',
      'Cfb': 'Oceanic — mild year-round, no dry season',
      'Cfc': 'Subpolar oceanic — cool, short summer',
      'Dfa': 'Hot-summer humid continental — hot summer, cold winter',
      'Dfb': 'Warm-summer humid continental — warm summer, cold winter',
      'Dfc': 'Subarctic — short, cool summer; very cold winter',
      'Dfd': 'Extreme subarctic — short, cool summer; extremely cold winter',
      'ET': 'Tundra — very cold, treeless',
      'EF': 'Ice cap — permanent ice'
    };
    koppenDescription = koppenDescriptions[koppenCode] || 'Temperate climate';

    res.json({
      hardinessZone,
      avgAnnualMinTempC: avgAnnualMinC !== null ? Math.round(avgAnnualMinC * 10) / 10 : null,
      avgAnnualMinTempF: avgAnnualMinF !== null ? Math.round(avgAnnualMinF * 10) / 10 : null,
      growingSeasonDays,
      frostDates,
      koppenCode,
      koppenDescription,
      koppenDistanceKm: koppenDistance,
      source: hardinessSource
    });
  } catch (error) {
    console.error('Climate lookup error:', error);
    res.json({
      hardinessZone: '7b',
      avgAnnualMinTempC: null,
      avgAnnualMinTempF: null,
      growingSeasonDays: 180,
      koppenCode: null,
      koppenDescription: null,
      source: 'Fallback estimate',
      error: error.message
    });
  }
});

// Frost date helper functions
function findLastSpringFrost(yearData, thresholdC) {
  // Search Jan 1 – Jun 30 for the last frost of the winter/growing season start
  const springWindow = yearData.filter(d => {
    const m = parseInt(d.date.substring(5, 7));
    return m >= 1 && m <= 6;
  });
  for (let i = springWindow.length - 1; i >= 0; i--) {
    if (springWindow[i].temp <= thresholdC) return springWindow[i].date;
  }
  return null;
}

function findFirstFallFrost(yearData, thresholdC) {
  // Search Jul 1 – Dec 31 for the first frost of the fall/winter
  const fallWindow = yearData.filter(d => {
    const m = parseInt(d.date.substring(5, 7));
    return m >= 7 && m <= 12;
  });
  for (let i = 0; i < fallWindow.length; i++) {
    if (fallWindow[i].temp <= thresholdC) return fallWindow[i].date;
  }
  return null;
}

function getDayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function doyToDate(doy) {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let month = 0;
  let day = doy;
  while (day > daysInMonth[month]) {
    day -= daysInMonth[month];
    month++;
  }
  return `${monthNames[month]} ${day}`;
}

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║     🌱 Permaculture Design Generator Server               ║
║                                                           ║
║     Running on: http://localhost:${PORT}                    ║
║                                                           ║
║     Press Ctrl+C to stop                                 ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
