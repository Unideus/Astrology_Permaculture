// Client-side Permaculture App Logic
let familyMemberCount = 0;
let generatedPlan = null;

function goToStep2() {
  const address = document.getElementById('address').value;
  const sunSign = document.getElementById('sunSign').value;
  const scale = document.getElementById('scale').value;

  if (!address || !sunSign || !scale) {
    alert('Please fill in all required fields');
    return;
  }

  document.getElementById('step1').classList.add('hidden');
  document.getElementById('step2').classList.remove('hidden');
}

function goToStep1() {
  document.getElementById('step2').classList.add('hidden');
  document.getElementById('step1').classList.remove('hidden');
}

function addFamilyMember() {
  familyMemberCount++;
  const container = document.getElementById('familyMembers');
  
  const memberDiv = document.createElement('div');
  memberDiv.className = 'family-member';
  memberDiv.innerHTML = `
    <input type="text" placeholder="Name (optional)" class="member-name">
    <select class="member-sign" required>
      <option value="">Select sun sign...</option>
      <option value="aries">♈ Aries</option>
      <option value="taurus">♉ Taurus</option>
      <option value="gemini">♊ Gemini</option>
      <option value="cancer">♋ Cancer</option>
      <option value="leo">♌ Leo</option>
      <option value="virgo">♍ Virgo</option>
      <option value="libra">♎ Libra</option>
      <option value="scorpio">♏ Scorpio</option>
      <option value="sagittarius">♐ Sagittarius</option>
      <option value="capricorn">♑ Capricorn</option>
      <option value="aquarius">♒ Aquarius</option>
      <option value="pisces">♓ Pisces</option>
    </select>
    <button class="remove-btn" onclick="removeFamilyMember(this)">Remove</button>
  `;
  
  container.appendChild(memberDiv);
}

function removeFamilyMember(btn) {
  btn.parentElement.remove();
  familyMemberCount--;
}

// Toggle soil test form
document.getElementById('hasSoilTest').addEventListener('change', function() {
  const form = document.getElementById('soilTestForm');
  if (this.checked) {
    form.classList.remove('hidden');
  } else {
    form.classList.add('hidden');
  }
});

async function generatePlan() {
  // Gather all data
  const userData = {
    address: document.getElementById('address').value,
    sunSign: document.getElementById('sunSign').value,
    scale: document.getElementById('scale').value,
    userDesiredPlants: document.getElementById('userDesiredPlants').value.trim() || null,
    familyMembers: []
  };

  // Get family members
  document.querySelectorAll('.family-member').forEach(member => {
    const name = member.querySelector('.member-name').value;
    const sign = member.querySelector('.member-sign').value;
    if (sign) {
      userData.familyMembers.push({ name, sunSign: sign });
    }
  });

  // Get soil test if provided
  if (document.getElementById('hasSoilTest').checked) {
    userData.soilTest = {
      ph: parseFloat(document.getElementById('soilPH').value) || null,
      nitrogen: parseInt(document.getElementById('soilNitrogen').value) || null,
      phosphorus: parseInt(document.getElementById('soilPhosphorus').value) || null,
      potassium: parseInt(document.getElementById('soilPotassium').value) || null
    };
  }

  // Show loading
  document.getElementById('step2').innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <h3>Generating your permaculture plan...</h3>
      <p>Analyzing location, cell salts, and planting schedules</p>
    </div>
  `;

  try {
    // Call API
    const response = await fetch('/api/generate-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    if (!response.ok) throw new Error('Failed to generate plan');

    generatedPlan = await response.json();

    // Debug: log raw AI response so we can inspect what came back
    console.log('=== AI RESPONSE ===');
    console.log(JSON.stringify(generatedPlan, null, 2));

    // Display results
    displayResults(generatedPlan);

  } catch (error) {
    alert('Error generating plan: ' + error.message);
    location.reload();
  }
}

function displayResults(plan) {
  document.getElementById('step2').classList.add('hidden');
  document.getElementById('results').classList.remove('hidden');

  // Site Info
  const loc = plan.locationData || {};
  const geoFailed = loc.error;
  const climate = plan.climateData || {};
  
  // Build climate info HTML
  let climateHTML = '';
  if (climate.hardinessZone) {
    climateHTML += `<p><strong>🌡️ USDA Hardiness Zone:</strong> ${climate.hardinessZone}`;
    if (climate.avgAnnualMinTempF !== null) {
      climateHTML += ` <small>(avg min ${climate.avgAnnualMinTempF}°F / ${climate.avgAnnualMinTempC}°C)</small>`;
    }
    climateHTML += `</p>`;
  }
  if (climate.koppenCode) {
    climateHTML += `<p><strong>🌍 Köppen Climate:</strong> ${climate.koppenCode} — ${climate.koppenDescription || ''}</p>`;
  }
  if (climate.growingSeasonDays) {
    climateHTML += `<p><strong>📅 Est. Growing Season:</strong> ~${climate.growingSeasonDays} days</p>`;
  }
  if (climate.frostDates && climate.frostDates.light) {
    const fd = climate.frostDates;
    climateHTML += `<div style="margin-top:10px;"><strong>🧊 Frost Dates (30-yr avg):</strong></div>`;
    if (fd.light.avgLastSpringFrost) {
      climateHTML += `<p style="margin-left:8px;margin-top:4px;">🌱 Last spring frost (32°F/0°C): <strong>${fd.light.avgLastSpringFrost}</strong></p>`;
      climateHTML += `<p style="margin-left:8px;">🍂 First fall frost (32°F/0°C): <strong>${fd.light.avgFirstFallFrost}</strong></p>`;
      climateHTML += `<p style="margin-left:8px;">📊 Frost-free days: ~${fd.light.avgFrostFreeDays} days/year</p>`;
    }
    if (fd.hard.avgLastSpringFrost) {
      climateHTML += `<p style="margin-left:8px;margin-top:6px;">❄️ Last hard frost (28°F/-2°C): <strong>${fd.hard.avgLastSpringFrost}</strong></p>`;
      climateHTML += `<p style="margin-left:8px;">❄️ First hard frost (28°F/-2°C): <strong>${fd.hard.avgFirstFallFrost}</strong></p>`;
      climateHTML += `<p style="margin-left:8px;">📊 Hard frost-free days: ~${fd.hard.avgFrostFreeDays} days/year</p>`;
    }
    climateHTML += `<p class="note" style="margin-left:8px;font-size:0.8em;">Based on ${fd.light.dataYears || 0} years of data (1991–2020)</p>`;
  }
  if (climate.source) {
    climateHTML += `<p class="note" style="font-size:0.85em;color:#666;">Source: ${climate.source}${climate.koppenDistanceKm ? ` (nearest Köppen point ${climate.koppenDistanceKm} km away)` : ''}</p>`;
  }
  
  document.getElementById('siteInfo').innerHTML = `
    <p><strong>Address:</strong> ${plan.siteInfo.address}</p>
    <p><strong>Scale:</strong> ${plan.siteInfo.scale}</p>
    <p><strong>Primary Sun Sign:</strong> ${plan.siteInfo.sunSign}</p>
    ${plan.siteInfo.familyMembers.length > 0 ? 
      `<p><strong>Family Members:</strong> ${plan.siteInfo.familyMembers.map(m => m.sunSign).join(', ')}</p>` : ''}
    ${loc.latitude ? `<p><strong>Coordinates:</strong> ${loc.latitude.toFixed(4)}°N, ${loc.longitude.toFixed(4)}°W</p>` : ''}
    ${loc.formattedAddress ? `<p><strong>Geocoded:</strong> ${loc.formattedAddress}</p>` : ''}
    ${climateHTML ? `<div class="climate-info" style="margin-top:12px;padding:10px;background:#e8f5e9;border-left:3px solid #4caf50;border-radius:4px;">${climateHTML}</div>` : ''}
    ${geoFailed ? `<p class="note" style="background:#ffebee;border-color:#ef5350;">⚠️ <strong>Location warning:</strong> ${loc.error}</p>` : ''}
  `;

  // Render map and sun analysis
  if (loc.latitude && loc.longitude) {
    renderMap(loc.latitude, loc.longitude, plan.siteInfo.address);
    drawPlantSunAnalysis(loc.latitude, loc.longitude);
  } else {
    document.getElementById('siteMap').innerHTML = '<p class="note">Location map unavailable</p>';
  }

  // AI Guilds — clear container before every render to prevent ghost data
  document.getElementById('aiGuilds').innerHTML = '';
  if (plan.aiGenerated) {
    document.getElementById('aiGuildsCard').style.display = 'block';
    renderAIGuilds(plan.aiGenerated);
  } else {
    // AI failed to generate guilds — show error, do NOT use fallback
    document.getElementById('aiGuildsCard').style.display = 'block';
    document.getElementById('aiGuilds').innerHTML = '<p style="color:#d32f2f;font-weight:bold;padding:12px;background:#ffebee;border:1px solid #ef5350;border-radius:4px;">⚠️ AI failed to generate guilds.</p>';
  }

  // Cell Salts
  document.getElementById('cellSalts').innerHTML = `
    <p>${plan.cellSalts.explanation}</p>
    <div class="plant-list">
      ${plan.cellSalts.deficient.map(salt => `
        <div class="plant-item">
          <h4>${salt.sign}</h4>
          <p><strong>${salt.cell_salt}</strong></p>
          <p>${salt.function}</p>
        </div>
      `).join('')}
    </div>
  `;

  // Recommended Plants
  // If geocoding failed, do NOT show a stale plant list — clear it and warn the user
  if (geoFailed) {
    document.getElementById('recommendedPlants').innerHTML = `
      <p class="note" style="background:#ffebee;border-color:#ef5350;">
        ⚠️ <strong>Location unavailable.</strong> Recommended plants require a valid USDA hardiness zone. 
        Please enter a valid City and State (e.g., "Duluth, MN") and try again.
      </p>
    `;
  } else {
    document.getElementById('recommendedPlants').innerHTML = `
      <div class="plant-list">
        ${plan.recommendedPlants.slice(0, 12).map(plant => `
          <div class="plant-item">
            <h4>${plant.plant.replace(/_/g, ' ')}</h4>
            <p><strong>Rich in:</strong> ${plant.minerals.join(', ')}</p>
          </div>
        `).join('')}
      </div>
      ${plan.recommendedPlants.length > 12 ? 
        `<p class="note">Showing 12 of ${plan.recommendedPlants.length} recommended plants. Full list in downloadable plan.</p>` : ''}
    `;
  };

  // 3-Year Plan
  const planData = plan.threeYearPlan;
  
  // Variable Injection: extract primary tree from AI guilds
  const primaryTree = (plan.aiGenerated?.guilds?.[0]?.layers?.layer1_canopy)
    ? plan.aiGenerated.guilds[0].layers.layer1_canopy.split('[')[0].trim()
    : null;
  
  document.getElementById('threeYearPlan').innerHTML = `
    <div class="plan-timeline">
      <div class="year-section">
        <h4>${planData.year0.title}</h4>
        <p><em>${planData.year0.duration}</em></p>
        <p>${primaryTree ? `Establish ${primaryTree} as the system anchor` : planData.year0.focus}</p>
        <div style="margin-top: 15px">
          ${planData.year0.tasks.map(task => {
            // Variable Injection: bind to primaryTree for canopy planting task
            const isCanopyTask = primaryTree && /canopy/i.test(task.task);
            const displayPlants = (task.plants && primaryTree)
              ? (task.plants.map(p => {
                  if (typeof p === 'string' && /sour.cherry/i.test(p)) return primaryTree;
                  return p;
                }))
              : task.plants;
            return `
            <div class="task-item">
              <strong>${task.task} - ${task.timing}</strong>
              ${displayPlants ? `<p>Plants: ${displayPlants.map(p => typeof p === 'object' ? (p.common_name || p.name || JSON.stringify(p)) : p).join(', ')}</p>` : ''}
              <p>${task.details}</p>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="year-section">
        <h4>${planData.year1.title}</h4>
        <p><em>${planData.year1.duration}</em></p>
        <p>${planData.year1.focus}</p>
        <div style="margin-top: 15px">
          ${planData.year1.tasks.map(task => `
            <div class="task-item">
              <strong>${task.task} - ${task.timing}</strong>
              ${task.plants ? `<p>Plants: ${task.plants.map(p => typeof p === 'object' ? (p.common_name || p.name || JSON.stringify(p)) : p).join(', ')}</p>` : ''}
              <p>${task.details}</p>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="year-section">
        <h4>${planData.year2.title}</h4>
        <p><em>${planData.year2.duration}</em></p>
        <p>${planData.year2.focus}</p>
        <div style="margin-top: 15px">
          ${planData.year2.tasks.map(task => `
            <div class="task-item">
              <strong>${task.task} - ${task.timing}</strong>
              ${task.plants ? `<p>Plants: ${task.plants.map(p => typeof p === 'object' ? (p.common_name || p.name || JSON.stringify(p)) : p).join(', ')}</p>` : ''}
              <p>${task.details}</p>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  // Moon Calendar
  const moon = plan.moonCalendar;
  document.getElementById('moonCalendar').innerHTML = `
    <div class="moon-phase">
      <div class="moon-card">
        <h4>🌒 Waxing Moon</h4>
        <p><em>${moon.waxingMoon.phase}</em></p>
        <p><strong>Action:</strong> ${moon.waxingMoon.action}</p>
        <ul>
          ${moon.waxingMoon.plant.map(p => `<li>${p}</li>`).join('')}
        </ul>
      </div>

      <div class="moon-card">
        <h4>🌗 Waning Moon</h4>
        <p><em>${moon.waningMoon.phase}</em></p>
        <p><strong>Action:</strong> ${moon.waningMoon.action}</p>
        <ul>
          ${moon.waningMoon.plant.map(p => `<li>${p}</li>`).join('')}
          ${moon.waningMoon.tasks.map(t => `<li>${t}</li>`).join('')}
        </ul>
      </div>

      <div class="moon-card">
        <h4>🌑 New Moon</h4>
        <p><strong>Action:</strong> ${moon.newMoon.action}</p>
        <ul>
          ${moon.newMoon.plant.map(p => `<li>${p}</li>`).join('')}
        </ul>
      </div>

      <div class="moon-card">
        <h4>🌕 Full Moon</h4>
        <p><strong>Action:</strong> ${moon.fullMoon.action}</p>
        <ul>
          ${moon.fullMoon.plant.map(p => `<li>${p}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;
}

function renderMap(lat, lon, address) {
  const mapDiv = document.getElementById('siteMap');
  // Use address string for Google Maps search (better than coords for specific addresses)
  const searchQuery = encodeURIComponent(address);
  
  mapDiv.innerHTML = `
    <div class="map-wrapper">
      <iframe
        src="https://www.google.com/maps?q=${searchQuery}&z=17&output=embed"
        style="border: none; width: 100%; height: 400px;"
        allowfullscreen
        loading="lazy"
      ></iframe>
    </div>
  `;
}

function formatTime(date) {
  if (!date || isNaN(date)) return 'N/A';
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function getCompassDirection(azimuth) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(azimuth / 45) % 8;
  return directions[index] + ` (${Math.round(azimuth)}°)`;
}

function getSunDesignTip(altitude, direction) {
  if (altitude < 15) {
    return 'Low sun angle creates long shadows. Place tall structures (trees, trellises) on the north side to avoid shading sun-loving plants.';
  } else if (altitude < 45) {
    return 'Moderate sun angle. Consider east-west rows for maximum light exposure on both sides.';
  } else {
    return 'High sun angle provides intense direct light. Ensure adequate spacing between plants to prevent overheating and maintain airflow.';
  }
}

function renderAIGuilds(aiData) {
  const guildsDiv = document.getElementById('aiGuilds');
  if (!aiData.guilds || aiData.guilds.length === 0) {
    guildsDiv.innerHTML = '<p style="color:#d32f2f;font-weight:bold;padding:12px;background:#ffebee;border:1px solid #ef5350;border-radius:4px;">⚠️ AI failed to generate guilds. Please try again.</p>';
    return;
  }

  const layerLabels = {
    layer1_canopy: '🌳 Layer 1 — Canopy',
    layer2_low_tree: '🌿 Layer 2 — Low Tree',
    layer3_shrub: '🫐 Layer 3 — Shrub',
    layer4_herbaceous: '🌱 Layer 4 — Herbaceous',
    layer5_rhizosphere: '🥔 Layer 5 — Rhizosphere',
    layer6_soil_surface: '🍀 Layer 6 — Soil Surface',
    layer7_vertical: '🧗 Layer 7 — Vertical'
  };

  guildsDiv.innerHTML = `
    ${aiData.summary ? `<div class="note" style="margin-bottom:20px">
      <strong>AI Summary:</strong> ${aiData.summary}
    </div>` : ''}
    <div class="guild-stack">
      ${aiData.guilds.map(guild => `
        <div class="guild-card" style="border-left:4px solid #4caf50;margin-bottom:24px;padding:12px 16px;background:#f9f9f9;border-radius:6px">
          <h4 style="margin:0 0 8px 0">🌳 ${guild.name}</h4>
          ${guild.function ? `<p style="margin:0 0 12px 0;color:#555;font-size:0.9em"><em>${guild.function}</em></p>` : ''}
          <div class="layer-table" style="display:grid;gap:4px">
            ${Object.entries(layerLabels).map(([key, label]) => {
              const val = guild.layers ? (guild.layers[key] || '-') : (guild[key] || '-');
              return `
                <div style="display:grid;grid-template-columns:200px 1fr;gap:8px;align-items:center;padding:4px 0;border-bottom:1px solid #eee">
                  <span style="font-size:0.85em;color:#666">${label}</span>
                  <span style="font-weight:500">${val}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `).join('')}
    </div>
    
    ${aiData.companionPlanting && aiData.companionPlanting.length > 0 ? `
      <h4 style="margin-top:20px;color:var(--primary)">🌱 Companion Planting</h4>
      <ul style="margin-left:20px">
        ${aiData.companionPlanting.map(pair => {
          if (Array.isArray(pair)) return `<li>${pair.join(' + ')}</li>`;
          if (typeof pair === 'object') {
            const vals = Object.values(pair).filter(v => typeof v === 'string');
            return vals.length ? `<li>${vals.join(' + ')}</li>` : '';
          }
          return `<li>${String(pair)}</li>`;
        }).join('')}
      </ul>
    ` : ''}
    
    ${aiData.timingAdvice ? `
      <h4 style="margin-top:20px;color:var(--primary)">📅 Timing Advice</h4>
      <div class="note">${aiData.timingAdvice}</div>
    ` : ''}
    
    ${aiData.soilAmendments && aiData.soilAmendments.length > 0 ? `
      <h4 style="margin-top:20px;color:var(--primary)">🧪 Soil Amendments</h4>
      <ul style="margin-left:20px">
        ${aiData.soilAmendments.map(amend => `<li>${typeof amend === 'object' ? `${amend.issue}: ${amend.solution}` : amend}</li>`).join('')}
      </ul>
    ` : ''}
    
    ${aiData.waterManagement ? `
      <h4 style="margin-top:20px;color:var(--primary)">💧 Water Management</h4>
      <div class="note">${aiData.waterManagement}</div>
    ` : ''}
    
    ${aiData.beneficialInsectHabitat ? `
      <h4 style="margin-top:20px;color:var(--primary)">🐞 Beneficial Insect Habitat</h4>
      <div class="note">${aiData.beneficialInsectHabitat}</div>
    ` : ''}
  `;
}

function startOver() {
  location.reload();
}

function saveSite() {
  if (!generatedPlan) {
    alert('No plan to save. Generate a plan first.');
    return;
  }

  const siteId = prompt('Enter a name for this site:', generatedPlan.siteInfo.address.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase());
  if (!siteId) return;

  const siteData = {
    name: generatedPlan.siteInfo.address,
    description: `Permaculture plan for ${generatedPlan.siteInfo.scale} scale`,
    location: {
      address: generatedPlan.siteInfo.address,
      latitude: generatedPlan.locationData?.latitude,
      longitude: generatedPlan.locationData?.longitude
    },
    designerProfile: {
      sunSign: generatedPlan.siteInfo.sunSign,
      familyMembers: generatedPlan.siteInfo.familyMembers
    },
    plan: generatedPlan,
    created: new Date().toISOString()
  };

  fetch(`/api/sites/${encodeURIComponent(siteId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(siteData)
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      alert('Site saved successfully!');
    } else {
      alert('Error: ' + data.error);
    }
  })
  .catch(err => alert('Error saving site: ' + err.message));
}

function downloadPlan() {
  // For now, just show alert - will implement PDF generation
  alert('PDF download coming soon! For now, you can screenshot or print this page (Ctrl+P / Cmd+P)');
}


function drawPlantSunAnalysis(lat, lon) {
  const container = document.getElementById('plantSunAnalysis');
  if (!container) return;

  // Manual solar altitude calculation for solstices at solar noon
  // Formula: altitude = 90° - |latitude - declination|
  const toRad = Math.PI / 180;
  const absLat = Math.abs(lat);
  
  // Summer solstice: sun declination = +23.44°
  const summerAlt = (90 - Math.abs(absLat - 23.44)).toFixed(1);
  
  // Winter solstice: sun declination = -23.44°
  const winterAlt = (90 - Math.abs(absLat + 23.44)).toFixed(1);
  
  // Equinox: sun declination = 0°
  const equinoxAlt = (90 - absLat).toFixed(1);

  // Shadow length for a 10ft tree
  function shadowLength(sunAltDeg) {
    if (sunAltDeg <= 0) return '∞';
    return (10 / Math.tan(sunAltDeg * toRad)).toFixed(1) + ' ft';
  }

  container.innerHTML = `
    <div class="sun-analysis-grid">
      <div class="sun-card sun-summer">
        <h4>☀️ Summer Peak (Jun 21)</h4>
        <p><strong>Sun Angle:</strong> ${summerAlt}° above horizon</p>
        <p><strong>Shadow:</strong> ${shadowLength(summerAlt)} for 10ft tree</p>
        <p><strong>Impact:</strong> Intense overhead light. High evaporation, short shadows. Fruit trees and canopy plants thrive.</p>
      </div>

      <div class="sun-card sun-equinox">
        <h4>🌿 Equinox (Mar/Sept)</h4>
        <p><strong>Sun Angle:</strong> ${equinoxAlt}° above horizon</p>
        <p><strong>Shadow:</strong> ${shadowLength(equinoxAlt)} for 10ft tree</p>
        <p><strong>Impact:</strong> Balanced light. Moderate shadows. Ideal for most vegetables and understory plants.</p>
      </div>

      <div class="sun-card sun-winter">
        <h4>❄️ Winter Low (Dec 21)</h4>
        <p><strong>Sun Angle:</strong> ${winterAlt}° above horizon</p>
        <p><strong>Shadow:</strong> ${shadowLength(winterAlt)} for 10ft tree</p>
        <p><strong>Impact:</strong> Low-angle light, long shadows. Southern exposure critical. Protect tender plants from frost.</p>
      </div>
    </div>

    <div class="sun-recommendations">
      <h4>🌱 Planting Recommendations</h4>
      <ul>
        <li><strong>South-facing beds:</strong> Sunniest all year. Best for fruit trees, tomatoes, peppers, squash.</li>
        <li><strong>East-facing beds:</strong> Morning sun, afternoon shade. Good for leafy greens, herbs, strawberries.</li>
        <li><strong>West-facing beds:</strong> Hot afternoon sun. Good for Mediterranean herbs, drought-tolerant perennials.</li>
        <li><strong>North-facing beds:</strong> Coolest, most shade. Best for shade-tolerant plants: hostas, ferns, mushrooms.</li>
        <li><strong>Under deciduous trees:</strong> Full sun in winter (when bare), dappled shade in summer. Perfect for shade-loving understory.</li>
      </ul>
    </div>
  `;
}

// =========================================================
// SAVED SITES LIST / LOAD UI
// =========================================================

function showSavedSites() {
  const modal = document.getElementById('savedSitesModal');
  const listContainer = document.getElementById('savedSitesList');
  modal.classList.remove('hidden');
  listContainer.innerHTML = '<p class="note">Loading saved sites...</p>';

  fetch('/api/sites')
    .then(res => res.json())
    .then(sites => {
      if (!sites || sites.length === 0) {
        listContainer.innerHTML = `
          <div class="empty-state">
            <p><strong>No saved sites yet.</strong></p>
            <p>Generate a plan and click "💾 Save Site" to store it here.</p>
          </div>
        `;
        return;
      }

      listContainer.innerHTML = sites.map(site => `
        <div class="saved-site-item">
          <div class="saved-site-info">
            <h4>${escapeHtml(site.name || 'Unnamed Site')}</h4>
            <p>${escapeHtml(site.description || 'No description')}</p>
            <p class="site-meta">${site.created ? 'Created: ' + formatDate(site.created) : ''}</p>
          </div>
          <div class="saved-site-actions">
            <button class="btn btn-primary" onclick="loadSite('${escapeHtml(site.siteId)}')">📂 Open</button>
            <button class="btn btn-danger" onclick="deleteSite('${escapeHtml(site.siteId)}')">🗑️</button>
          </div>
        </div>
      `).join('');
    })
    .catch(err => {
      listContainer.innerHTML = `<p class="note" style="color:#d32f2f;">Error loading sites: ${escapeHtml(err.message)}</p>`;
    });
}

function closeSavedSites() {
  document.getElementById('savedSitesModal').classList.add('hidden');
}

function loadSite(siteId) {
  fetch(`/api/sites/${encodeURIComponent(siteId)}`)
    .then(res => {
      if (!res.ok) throw new Error('Site not found');
      return res.json();
    })
    .then(siteData => {
      const plan = siteData.plan;
      if (!plan) {
        alert('Site data is incomplete (no plan found).');
        return;
      }
      generatedPlan = plan;

      // Hide all form sections, show results
      document.getElementById('step1').classList.add('hidden');
      document.getElementById('step2').classList.add('hidden');
      document.getElementById('results').classList.remove('hidden');

      // Render the plan
      displayResults(plan);

      // Close modal
      closeSavedSites();
    })
    .catch(err => alert('Error loading site: ' + err.message));
}

function deleteSite(siteId) {
  if (!confirm(`Delete "${siteId}"? This cannot be undone.`)) return;

  fetch(`/api/sites/${encodeURIComponent(siteId)}`, { method: 'DELETE' })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showSavedSites(); // Refresh list
      } else {
        alert('Error: ' + data.error);
      }
    })
    .catch(err => alert('Error deleting site: ' + err.message));
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (e) {
    return isoString;
  }
}

// Close modal on click outside
window.addEventListener('click', (e) => {
  const modal = document.getElementById('savedSitesModal');
  if (e.target === modal) closeSavedSites();
});

// Close modal on Escape key
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSavedSites();
});
