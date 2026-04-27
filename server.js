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

    // Get geocoded location — try full address first, then strip to City, State on failure
    let locationData = null;
    const fullAddress = userData.address;
    
    const tryGeocode = async (address) => {
      const geoResponse = await fetch(`http://localhost:${PORT}/api/geocode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });
      if (geoResponse.ok) return await geoResponse.json();
      return null;
    };

    locationData = await tryGeocode(fullAddress);

    // Fallback: if full address fails, strip to City, State and retry
    if (!locationData) {
      console.warn(`Full address geocode failed (${fullAddress}), trying City, State fallback...`);
      // Extract City, State from the address string
      const commaParts = fullAddress.split(',').map(p => p.trim()).filter(Boolean);
      let cityStateFallback = null;
      if (commaParts.length >= 2) {
        // Use first two parts: "City, State" or "City, State, ZIP"
        cityStateFallback = `${commaParts[0]}, ${commaParts[1]}`;
      } else if (commaParts.length === 1) {
        // Single part like "Duluth MN" — split on spaces
        const spaceParts = commaParts[0].split(/\s+/);
        if (spaceParts.length >= 2) {
          cityStateFallback = `${spaceParts.slice(0, -1).join(' ')}, ${spaceParts[spaceParts.length - 1]}`;
        }
      }
      if (cityStateFallback && cityStateFallback !== fullAddress) {
        locationData = await tryGeocode(cityStateFallback);
        if (locationData) {
          console.warn(`City/State fallback succeeded: ${cityStateFallback}`);
        }
      }
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
    // Build zone-filtered plant list to include in prompt (Task 4: verify AI uses context)
    const siteZoneNum = climateData ? parseInt((climateData.hardinessZone || '0').match(/^(\d+)/)?.[1] || '0') : null;

    // NO-ZONE BLOCKER: Do not proceed to AI without a valid zone
    if (siteZoneNum === null || siteZoneNum === 0) {
      return res.status(422).json({ error: 'Location data required to verify plant hardiness. Please provide a City and State.' });
    }

    const filteredPlants = siteZoneNum
      ? permaApp.filterPlants({ zone: siteZoneNum })
      : [];
    
    const prompt = buildPermaculturePrompt(userData, locationData, climateData, filteredPlants);

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
      console.warn('Ollama generation failed:', ollamaError.message);
      ollamaPlan = null;
    }

    // Homestead scale requires AI guilds — return error if Ollama unavailable
    const scale = userData.scale || userData.propertySize;
    if (!ollamaPlan && scale === 'homestead') {
      return res.status(503).json({
        error: 'Guild generation unavailable. Please try again or use a different location.',
        detail: 'AI-powered guild generation requires the Ollama service to be available.'
      });
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
        beneficialInsectHabitat: ollamaPlan.beneficialInsectHabitat || ollamaPlan.pestControl || null,
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

function buildPermaculturePrompt(userData, locationData, climateData = null, filteredPlants = []) {
  const { address, sunSign, familyMembers = [], scale, soilTest, userDesiredPlants } = userData;
  
  // Build climate context for the AI
  let climateContext = '';
  if (climateData) {
    const zone = climateData.hardinessZone || 'unknown';
    const koppen = climateData.koppenCode || 'unknown';
    const frostInfo = climateData.frostDates?.light?.avgLastSpringFrost 
      ? `Last spring frost: ${climateData.frostDates.light.avgLastSpringFrost}, First fall frost: ${climateData.frostDates.light.avgFirstFallFrost}`
      : 'Frost-free or near-frost-free climate';
    
    // Extract numeric zone for comparisons
    const siteZoneNum = parseInt((zone.match(/^(\d+)/) || [])[1] || '0');
    
    // ── Köppen description translation ─────────────────────────────────────
    const koppenDescriptions = {
      'Cfa': 'Humid Subtropical — hot humid summers, mild winters with occasional freezes',
      'Cfb': 'Oceanic/Marine — cool wet summers, mild winters',
      'Csa': 'Hot-Summer Mediterranean — dry summers, mild wet winters',
      'Csb': 'Warm-Summer Mediterranean — dry summers, cool wet winters',
      'Cwa': 'Humid Subtropical (Monsoon) — hot summers, dry winters',
      'Dfa': 'Hot-Humid Continental — hot summers, cold winters with deep freezes',
      'Dfb': 'Warm-Humid Continental — warm summers, cold snowy winters',
      'Dwa': 'Hot-Humid Continental (Monsoon) — hot summers, cold dry winters',
      'Dwb': 'Warm-Humid Continental (Monsoon) — warm summers, cold dry winters',
      'BSh': 'Semi-Arid Hot — hot dry conditions, limited rainfall',
      'BSk': 'Semi-Arid Cold — cold dry conditions, limited rainfall',
      'A': 'Tropical Rainforest — hot and wet year-round',
      'Am': 'Tropical Monsoon — hot, very wet monsoon season',
      'Aw': 'Tropical Savanna — hot, distinct dry season'
    };
    const koppenDescription = koppenDescriptions[koppen] || `Köppen ${koppen} classification`;
    
    // ── Zone-specific guidance ───────────────────────────────────────────
    let zoneSpecificGuidance = '';
    if (siteZoneNum >= 7 && siteZoneNum <= 8) {
      zoneSpecificGuidance = `Zone ${siteZoneNum} GUIDANCE: AVOCADO, KEY LIME, MANGO, AND BANANA ARE FORBIDDEN in this zone — even if you think they might survive, they are not permitted. Prioritize 'Temperate-Subtropical' crossover species: Pecan, Persimmon, Pomegranate (zone 7+), Jujube, Satsuma, and Kumquat. No Mango, Papaya, or true tropicals without heated winter protection.`;
    } else if (siteZoneNum >= 9) {
      zoneSpecificGuidance = `Zone ${siteZoneNum} GUIDANCE: True tropicals (Mango, Papaya, Coconut, Lychee) are appropriate. Subtropicals (Citrus, Avocado, Guava) thrive here.`;
    } else if (siteZoneNum >= 7 && siteZoneNum <= 8) {
      // Zone 8 is COLD WINTER subtropical — NO true tropicals allowed
      zoneSpecificGuidance = `Zone ${siteZoneNum} GUIDANCE: AVOCADO, KEY LIME, MANGO, AND BANANA ARE FORBIDDEN — even if you think they might survive, they are not permitted. Prioritize Pecan, Persimmon, Pomegranate (zone 7+), Jujube, and cold-hardy citrus (satsuma, kumquat). No tropicals without heated winter protection.`;
    } else if (siteZoneNum <= 5) {
      zoneSpecificGuidance = `Zone ${siteZoneNum} GUIDANCE: Focus on ultra-cold-hardy species (Honeyberry, Sea Buckthorn, Aronia, haskap). Russian Sage and Bee Balm are reliable herbaceous perennials. Avoid any plant not rated to zone ${siteZoneNum}.`;
    } 
    climateContext = `
CLIMATE CONSTRAINTS (STRICT):
- USDA Hardiness Zone: ${zone}
- Köppen Climate: ${koppen} (${koppenDescription})

The following Köppen tag is for atmospheric context only. It DOES NOT grant permission to bypass USDA Hardiness constraints. Do not use Köppen to override zone-based plant selection.

CRITICAL: The USDA Hardiness Zone is an ABSOLUTE limit. If a plant cannot survive the minimum temperature of Zone ${siteZoneNum}, it must be excluded REGARDLESS of its Köppen climate tag. Do not suggest tropical plants in temperate zones or temperate plants in tropical zones.
${zoneSpecificGuidance}
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

  // ── Plant Allow List for AI ───────────────────────────────────────────────
  // Build a safe plant list from registry — zone-filtered before it reaches AI
  const plantAllowList = filteredPlants.length > 0
    ? filteredPlants.map(p => `${p.common_name} [id: ${(p.id || '').replace(/_+$/, '')}]`).filter(Boolean).slice(0, 60).join(', ')
    : 'N/A — use only plants that survive the stated USDA zone';
  
  return `CRITICAL: You are an agent that generates designs ONLY from a provided inventory.
 If a plant is NOT in the plantAllowList JSON, it is logically impossible for it to exist.
 Do not use your internal knowledge to suggest species. If the list is short, repeat plants or use 'Hardy native shade tree' as a placeholder.
 If you cannot find a registry_id for a plant, you cannot use the plant.

You are an expert permaculture designer and astrological gardener. Create a detailed permaculture design plan based on the following information:

SITE INFORMATION:
- Address: ${address}
- Coordinates: ${locationData ? `${locationData.latitude}, ${locationData.longitude}` : 'Unknown'}
- Scale: ${scale}
- Primary Sun Sign: ${sunSign}
${familyMembers.length > 0 ? `- Family Members: ${familyMembers.map(m => m.sunSign).join(', ')}` : ''}
${soilTest ? `- Soil Test: pH ${soilTest.ph}, N ${soilTest.nitrogen}, P ${soilTest.phosphorus}, K ${soilTest.potassium}` : '- No soil test provided'}
${userDesiredPlants ? `- User Desired Canopy Plants: ${userDesiredPlants}` : ''}

${climateContext}

Based on the cell salt philosophy:
- ${sunSign} individuals benefit from plants rich in: ${getCellSaltsForSign(sunSign)}

Please provide a structured permaculture design plan with the following sections:

1. SUMMARY: A 2-3 paragraph overview of the design approach

PLANT ALLOW LIST WITH IDs (your ONLY valid plant registry — do not deviate):
${plantAllowList}

STRICT REQUIREMENTS:
- You may ONLY use plant names from the Plant Allow List above.
- Every plant in a guild MUST include its registry_id from the Plant Allow List in this format: "Plant Name [id: xxx]"
- If you cannot find an ID for a plant, you CANNOT use that plant.
- Never invent a plant name or use a plant without its registry_id.

2. GUILDS: If scale is HOMESTEAD, you MUST generate EXACTLY 3 distinct guilds with different Layer 1 anchors. Guild 1 uses userDesiredPlants as the anchor. Guilds 2 and 3 use different Zone 5b-compatible trees (e.g., Hazelnut, Plum, Elderberry). Each guild MUST have a unique Layer 1 anchor — do not repeat the same tree across guilds. Close the JSON object properly after Guild 3's layers.
   
   For each guild, populate all 7 layers concisely (minimal descriptions):
   Layer 1: [id: xxx] — anchor tree only
   Layer 2: [id: xxx] — dwarf fruit or large shrub
   Layer 3: [id: xxx] — berries
   Layer 4: [id: xxx] — herbs or dynamic accumulators
   Layer 5: [id: xxx] — root crops
   Layer 6: [id: xxx] — ground cover
   Layer 7: [id: xxx] or "None"

   TREE CLASSIFICATION: Peach [id: peach] is a Tree. It must NEVER be listed in the Herbaceous (Layer 4) or Shrub (Layer 3) layers. It belongs in Layer 1 (Canopy) or Layer 2 (Low Tree) only. Apply this rule to all fruit trees — no fruit tree belongs in Herbaceous or Shrub layers.

   CRITICAL: All plants MUST be compatible with the stated USDA hardiness zone.
   ZONE TRUTH: You MUST use the geocoded Hardiness Zone provided in the Site Information. Do not use fallbacks or estimates. Crown Point, IN is Zone 5b/6a. Do not suggest Zone 7+ plants like Figs unless they are explicitly marked as ultra-hardy or indoor/container plants in the registry. Do not invent a warmer zone than what was geocoded.
   DO NOT create "Vegetable Guilds". All vegetables must be assigned to Layer 4 or 6 of a Tree-centric Guild.
   If no suitable plant exists in the plantAllowList for a specific layer, provide a specific native species for the site's Zone and label it [PROPOSED NATIVE] (e.g., "Wild Grape [PROPOSED NATIVE]" for Layer 7, "Serviceberry [PROPOSED NATIVE]" for Layer 2). This marks it as ecologically sound but not in the database.
   ID CLEANUP: Every [id: xxx] must contain only lowercase letters, numbers, and underscores — no trailing underscores, no extra characters. Strip trailing underscores before outputting: [id: black_currant] is valid, [id: black_currant_] is not.

   LAYER 1 RIGIDITY: Layer 1 (Canopy) MUST be a Tree. If you run out of trees from the registry, DO NOT create a fake guild. It is better to have 1 perfect guild than a fake one.
   THE ANCHOR REQUIREMENT: If a Guild is centered around a tree (Mulberry, Chestnut, Cherry, etc.), that tree MUST be placed in Layer 1 (Canopy). Do not leave Layer 1 empty if a tree exists in the guild.

   VERTICAL VALIDATION (STRICT): Layer 7 (Vertical) is STRICTLY for vining/climbing plants only. If you do not have a vine like Grapes, Hops, or Pole Beans in the registry, you MUST return "None". DO NOT place Bell Peppers, Chard, or any other non-climbing plant in Layer 7 under any circumstances.

   LAYER 2 REJECTION: If you do not have a dwarf tree or large shrub in the registry for Layer 2, you must return "None" or "[PROPOSED NATIVE]". Do not categorize small herbs or groundcovers as trees.

   SUMMARY SYNC: The AI Summary at the top must mention the specific Canopy trees chosen (e.g., "Centered on Apple and Hazelnut") to make the output feel cohesive and intentional.
   GUILD-PLAN SYNC: The 3-Year Implementation Plan MUST use the exact same common name and ID as the Guild's Layer 1 anchor. If Layer 1 is Mulberry, the Plan starts with Mulberry. No exceptions.

3. COMPANION_PLANTING: Generate EXACTLY 5 companion pairs in this format:
   "Plant A + Plant B: [Functional Relationship]". Use ONLY plants from the Plant Allow List.
   DO NOT output single plant names or bare pairs. Each entry must include the colon and a brief reason.
   CRITICAL: Companion relationships must be based on actual permaculture functions: Nitrogen Fixation, Dynamic Accumulation, Pest Deterrent (via scent/flowers), or Physical Support. Do NOT claim relationships without a functional basis (e.g., "Blackberries deter pests" is not valid — blackberries do not function as pest deterrents).
   NITROGEN FIXATION ONLY ATTRIBUTION — THE LEGUME LAW: ONLY legumes (Clover, Beans, Peas, Vetch) or specific N-fixing shrubs (Goumi, Seaberry) can be called Nitrogen Fixers. DO NOT claim N-fixation for Turnips, Radish, Nettle, or Comfrey — label those as 'Dynamic Accumulators' or 'Soil Decompactors'. Comfrey [id: comfrey] is a DYNAMIC ACCUMULATOR (Potassium/Minerals). It is NOT a Nitrogen Fixer. Never label Comfrey as an N-fixer in the 3-Year Plan or Companion sections.
   - IF site zone <= 5 (cold climate): Default to "Hardy Mulch" or "Native Grass" ground covers instead of Mediterranean herbs. Use cold-hardy companions only.
   - IF site zone >= 7 (warm climate): Mediterranean herbs (Rosemary, Lavender, Sage companion trio) are appropriate as companion plants.

   ID INTEGRITY: Use the EXACT registry id. If the registry says "red_raspberry", you MUST use [id: red_raspberry], not [id: raspberry]. Match the id string exactly as it appears in the Plant Allow List. Never abbreviate, guess, or partially match an id.

4. TIMING_ADVICE: The 3-Year Implementation Plan must be strictly chronological and synchronized with the Guild's Layer 1 anchors.

   VARIABLE-DRIVEN PLAN (no templates): DO NOT use a template for the 3-Year Implementation Plan. You must dynamically construct the text by referencing the Layer 1, 3, and 4 IDs you just generated for the Guilds. If Layer 1 is [id: peach], the plan MUST start with [id: peach]. If Layer 3 is [id: elderberry], Year 2 must mention elderberry. The plan is constructed from guild outputs, never from memory.

   DYNAMIC PLAN GENERATION: The 3-Year Implementation Plan MUST use the specific plants chosen in the Guilds section above. If the Guild says "Apple [id: apple]", the Plan MUST say "Apple". Never mention Sour Cherry or Peach in the plan unless they appear in the Guild layers. Plan and Guild must be 100% consistent — no diverging plant lists.

   USER DESIRED PRIORITY: If userDesiredPlants contains "Apple", the Guild and the Plan must BOTH start with "Apple". Ensure the ID [id: apple] is used throughout. The user's choice is the starting constraint — all else follows.

   CANOPY/SUMMARY SYNC: The AI Summary and Layer 1 must match the user's Desired Canopy Trees. If the user requested Apple, do not put Peach in Layer 1 or the Summary. The Summary must reflect the actual guild anchors, nothing else.

   SEASONAL FLOW (do not mix up):
   - Year 1: Spring (Infrastructure/Canopy — plant Guild anchor trees) -> Summer (N-Fixers: Clover, Beans) -> Fall (Mulch)
   - Year 2: Spring (Shrubs/Herbs — Layer 3 and Layer 4 fill) -> Summer (Dynamic Accumulators)
   - Year 3: Spring (Groundcovers/Roots — Layer 5/6) -> Summer (First Harvests)

   THE "SOUR CHERRY" EXORCISM: The term "Sour Cherry" is FORBIDDEN unless the user explicitly requested it. Similarly, "Plant now or wait for harvest" is FORBIDDEN. If either appears in output uninvited, treat it as a logic failure. Use "Timeline: Establish Year 1" or "Expected Harvest: Year 4+" instead.

   PHRASE TERMINATION: Never write "Plant now or wait for harvest" or any similar nonsensical phrase. Use "Timeline: Establish Year 1" or "Expected Harvest: Year 4+" instead.

5. SOIL_AMENDMENTS: Specific amendments needed based on ${soilTest ? 'the provided soil test' : 'general principles'}

6. WATER_MANAGEMENT: Water capture, retention, and irrigation strategies for the ${scale} scale

7. BENEFICIAL_INSECT_HABITAT: Renamed from pest control. List 3-5 specific Insectary Plants from the registry (e.g., Dill, Yarrow, Fennel, Parsley, Queen Anne's Lace) and explain how their flowers support predatory insects (lacewings, hoverflies, parasitic wasps). Focus on plants that provide nectar, pollen, and shelter year-round.

Format your response as valid JSON with these exact keys: summary, guilds (array), companionPlanting (array), timingAdvice (string), soilAmendments (array), waterManagement (string), beneficialInsectHabitat (string)

Example beneficialInsectHabitat:
"Beneficial Insect Habitat: Dill [id: dill] attracts hoverflies; Yarrow [id: yarrow] hosts predatory wasps; Fennel [id: fennel] shelters lacewings. Plant these in guild margins to maintain year-round predatory insect populations."

Example companionPlanting entries (MUST match this format):
  "companionPlanting": [
    "Tomato + Basil: Basil repels aphids, improves flavor",
    "Navy Beans + Corn: Beans fix nitrogen, corn provides support"
  ]

Example companionPlanting format (MUST follow this pattern):
  "companionPlanting": [
    "Tomato + Basil: repels aphids and improves tomato flavor",
    "Navy Beans + Corn: beans fix nitrogen, corn provides trellis"
  ]

Example 7-Layer Guild format (MUST include registry_id for every plant; fill ALL 7 layers):
{
  "name": "Pomegranate Guild",
  "layers": {
    "layer1_canopy": "Pomegranate Tree [id: pomegranate]",
    "layer2_low_tree": "Goji Berry [id: goji]",
    "layer3_shrub": "Elderberry [id: elderberry]",
    "layer4_herbaceous": "Comfrey [id: comfrey], Chives [id: chives]",
    "layer5_rhizosphere": "Naturally Occurring",
    "layer6_soil_surface": "Clover [id: clover]",
    "layer7_vertical": "Hardy Native Vine"
  },
  "function": "Subtropical fruit production with nitrogen fixation and dynamic accumulation"
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
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Clean trailing underscores from all registry IDs in guild layer values
      const cleanId = (s) => typeof s === 'string' ? s.replace(/\[id:\s*([^\]]+)\]/g, (_, id) => `[id: ${id.replace(/_+$/, '')}]`) : s;
      
      if (parsed.guilds && Array.isArray(parsed.guilds)) {
        parsed.guilds = parsed.guilds.map(guild => {
          // Already has layers — pass through (but clean IDs)
          if (guild.layers) {
            const cleanedLayers = {};
            for (const [k, v] of Object.entries(guild.layers)) {
              cleanedLayers[k] = cleanId(v);
            }
            return { ...guild, layers: cleanedLayers };
          }
          
          // Legacy format (central + supporting) — convert to 7-layer
          const layers = {
            layer1_canopy: guild.central || 'Hardy Native Canopy',
            layer2_low_tree: guild.lowTree || guild.layer2 || 'Naturally Occurring',
            layer3_shrub: guild.shrub || guild.layer3 || 'Naturally Occurring',
            layer4_herbaceous: guild.supporting?.join(', ') || guild.herbaceous || guild.layer4 || 'Naturally Occurring',
            layer5_rhizosphere: guild.rhizosphere || guild.layer5 || 'Naturally Occurring',
            layer6_soil_surface: guild.groundCover || guild.layer6 || 'Naturally Occurring',
            layer7_vertical: guild.vertical || guild.layer7 || 'Naturally Occurring'
          };
          const cleanedLayers = {};
          for (const [k, v] of Object.entries(layers)) {
            cleanedLayers[k] = cleanId(v);
          }
          return { name: guild.name, layers: cleanedLayers, function: guild.function || '' };
        });
      }
      
      // Normalize pestControl → beneficialInsectHabitat
      if (parsed.pestControl && !parsed.beneficialInsectHabitat) {
        parsed.beneficialInsectHabitat = parsed.pestControl;
      }
      
      // LEGUME SANITY CHECK: hard-validation rewrite of N-fixer misattributions
      // Applies to ALL guilds AND plan fields — catches Nettle/Dandelion in all 3 guilds
      // Only Legumes (Beans, Clover, Vetch, Peas) and Goumi/Seaberry get N-Fixer
      const LEGUME_N_FIXERS = ['beans', 'clover', 'vetch', 'peas', 'goumi', 'seaberry'];
      const NOT_N_FIXERS = ['nettle', 'turnips', 'turnip', 'radish', 'radishes', 'comfrey', 'dandelion', 'dandelions'];
      const fixNFixerText = (text) => {
        if (!text || typeof text !== 'string') return text;
        let fixed = text;
        NOT_N_FIXERS.forEach(plant => {
          const regex = new RegExp(`\\b${plant}\\b[^;]*nitrogen.fix[^"']*`, 'gi');
          fixed = fixed.replace(regex, `${plant} — Dynamic Accumulator`);
          const directRegex = new RegExp(`\\b${plant}\\b.*?:.*?(?:nitrogen|n-fix)[^"']*`, 'gi');
          fixed = fixed.replace(directRegex, `${plant}: Dynamic Accumulator (potassium/minerals)`);
        });
        return fixed;
      };
      
      if (parsed.timingAdvice) parsed.timingAdvice = fixNFixerText(parsed.timingAdvice);
      if (parsed.beneficialInsectHabitat) parsed.beneficialInsectHabitat = fixNFixerText(parsed.beneficialInsectHabitat);
      if (parsed.summary) parsed.summary = fixNFixerText(parsed.summary);
      if (parsed.soilAmendments && Array.isArray(parsed.soilAmendments)) {
        parsed.soilAmendments = parsed.soilAmendments.map(a => typeof a === 'string' ? fixNFixerText(a) : a);
      }
      
      // Apply N-fixer check to all guild layer values across all 3 guilds
      if (parsed.guilds && Array.isArray(parsed.guilds)) {
        parsed.guilds = parsed.guilds.map(guild => {
          if (guild.layers) {
            const cleanedLayers = {};
            for (const [k, v] of Object.entries(guild.layers)) {
              cleanedLayers[k] = cleanId(fixNFixerText(v));
            }
            return { ...guild, layers: cleanedLayers };
          }
          return guild;
        });
      }
      
      return parsed;
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
