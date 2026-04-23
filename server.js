// Permaculture Design App Server
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const PermacultureApp = require('./app.js');

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
    if (locationData) {
      plan.locationData = locationData;
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
// TIER 1: HARDINESS ZONE LOOKUP (via lat/lon)
// =========================================================
app.post('/api/climate', async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }

    // Use Open-Meteo API for climate data
    const climateUrl = `https://climate-api.open-meteo.com/v1/climate?latitude=${latitude}&longitude=${longitude}&start_year=1991&end_year=2020`;
    
    const response = await fetch(climateUrl);
    if (!response.ok) throw new Error('Climate API failed');
    
    const data = await response.json();
    
    // Estimate hardiness zone from average annual minimum temperature
    // USDA zones: 1=-60°F, 2=-50°F, 3=-40°F, 4=-30°F, 5=-20°F, 6=-10°F, 7=0°F, 8=10°F, 9=20°F, 10=30°F, 11=40°F, 12=50°F, 13=60°F
    const avgMinTemp = data?.temperature_2m_min?.[0] || 0;
    const zone = Math.max(1, Math.min(13, Math.floor((avgMinTemp + 60) / 10) + 1));
    
    res.json({
      hardinessZone: `${zone}`,
      avgMinTemp: avgMinTemp,
      growingSeasonDays: Math.round(365 - (Math.abs(avgMinTemp) * 3)), // Rough estimate
      source: 'Open-Meteo Climate API'
    });
  } catch (error) {
    console.error('Climate lookup error:', error);
    // Return fallback
    res.json({
      hardinessZone: '7b',
      avgMinTemp: 0,
      growingSeasonDays: 180,
      source: 'Fallback estimate',
      error: error.message
    });
  }
});

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
