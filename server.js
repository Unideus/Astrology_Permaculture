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

    // Try exact address first, then progressively simpler queries
    const queries = [address];
    
    // Extract city, state from address for fallback
    const parts = address.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      queries.push(parts.slice(-2).join(', ')); // "City, State"
    }
    if (parts.length >= 1) {
      queries.push(parts[parts.length - 1]); // Just state
    }

    for (const query of queries) {
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
      
      try {
        const response = await fetch(nominatimUrl, {
          headers: { 'User-Agent': 'PermacultureDesignApp/1.0' }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            const result = data[0];
            return res.json({
              latitude: parseFloat(result.lat),
              longitude: parseFloat(result.lon),
              formattedAddress: result.display_name,
              placeId: result.place_id,
              boundingBox: result.boundingbox,
              queryUsed: query
            });
          }
        }
      } catch (e) {
        console.warn(`Geocoding failed for query "${query}":`, e.message);
      }
    }

    // All queries failed
    res.status(404).json({ error: 'Address not found' });
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

    // Build prompt for Ollama
    const prompt = buildPermaculturePrompt(userData, locationData);

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

    // Generate fallback plan (existing logic)
    const plan = permaApp.generatePlan(userData);

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

    // Add real location data
    let climateData = null;
    if (locationData && locationData.latitude && locationData.longitude) {
      // Get climate data
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

function buildPermaculturePrompt(userData, locationData) {
  const { address, sunSign, familyMembers = [], scale, soilTest } = userData;
  
  return `You are an expert permaculture designer and astrological gardener. Create a detailed permaculture design plan based on the following information:

SITE INFORMATION:
- Address: ${address}
- Coordinates: ${locationData ? `${locationData.latitude}, ${locationData.longitude}` : 'Unknown'}
- Scale: ${scale}
- Primary Sun Sign: ${sunSign}
${familyMembers.length > 0 ? `- Family Members: ${familyMembers.map(m => m.sunSign).join(', ')}` : ''}
${soilTest ? `- Soil Test: pH ${soilTest.ph}, N ${soilTest.nitrogen}, P ${soilTest.phosphorus}, K ${soilTest.potassium}` : '- No soil test provided'}

Based on the cell salt philosophy:
- ${sunSign} individuals benefit from plants rich in: ${getCellSaltsForSign(sunSign)}

Please provide a structured permaculture design plan with the following sections:

1. SUMMARY: A 2-3 paragraph overview of the design approach

2. GUILDS: 3-5 specific plant guilds (groups of plants that support each other):
   - Each guild should have a name, central tree/shrub, supporting plants, and function

3. COMPANION_PLANTING: Key companion planting combinations for the recommended crops

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
          
          // Growing season estimate: ~365 - (abs avg min in °F / 3.3)
          growingSeasonDays = Math.round(365 - (Math.abs(avgAnnualMinF) / 3.3));
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
              if (lastSpring && firstFall) {
                const s = new Date(lastSpring);
                const f = new Date(firstFall);
                springDates.push(s);
                fallDates.push(f);
                frostFreeDays.push(Math.round((f - s) / (1000 * 60 * 60 * 24)));
              }
            });

            if (springDates.length > 0) {
              const avgSpringDoy = Math.round(springDates.reduce((sum, d) => sum + getDayOfYear(d), 0) / springDates.length);
              const avgFallDoy = Math.round(fallDates.reduce((sum, d) => sum + getDayOfYear(d), 0) / fallDates.length);
              ft.avgLastSpringFrost = doyToDate(avgSpringDoy);
              ft.avgFirstFallFrost = doyToDate(avgFallDoy);
              ft.avgFrostFreeDays = Math.round(frostFreeDays.reduce((a, b) => a + b, 0) / frostFreeDays.length);
              ft.dataYears = springDates.length;
            }
          });

          frostDates = {
            light: frostThresholds.find(f => f.label === 'light'),
            hard: frostThresholds.find(f => f.label === 'hard')
          };
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
  // Spring window: Feb 15 – Jun 15
  const springWindow = yearData.filter(d => {
    const m = parseInt(d.date.substring(5, 7));
    const day = parseInt(d.date.substring(8, 10));
    return (m > 2 || (m === 2 && day >= 15)) && (m < 6 || (m === 6 && day <= 15));
  });
  for (let i = springWindow.length - 1; i >= 0; i--) {
    if (springWindow[i].temp <= thresholdC) return springWindow[i].date;
  }
  return null;
}

function findFirstFallFrost(yearData, thresholdC) {
  // Fall window: Aug 15 – Dec 15
  const fallWindow = yearData.filter(d => {
    const m = parseInt(d.date.substring(5, 7));
    const day = parseInt(d.date.substring(8, 10));
    return (m > 8 || (m === 8 && day >= 15)) && (m < 12 || (m === 12 && day <= 15));
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
