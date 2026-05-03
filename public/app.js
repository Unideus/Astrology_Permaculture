// Client-side Permaculture App Logic
let familyMemberCount = 0;
let generatedPlan = null;
let currentSavedSite = null;
let planDirty = false;
let planSaveStatus = null;
const dirtyGuildLayers = new Set();
const originalGuildLayers = new Map();
let activeGuildEditIndex = null;
const APP_VERSION = 'Prototype v0.1';
const THEME_STORAGE_KEY = 'permacultureTheme';
const GUILD_LAYER_DEFINITIONS = [
  { label: '1. Canopy', canonicalKey: 'layer1_canopy', keys: ['layer1_canopy'] },
  { label: '2. Sub-Canopy', canonicalKey: 'layer2_low_tree', keys: ['layer2_low_tree'] },
  { label: '3. Shrub', canonicalKey: 'layer3_shrub', keys: ['layer3_shrub'] },
  { label: '4. Herbaceous', canonicalKey: 'layer4', keys: ['layer4', 'layer4_herbaceous'] },
  { label: '5. Ground Cover', canonicalKey: 'layer5', keys: ['layer5', 'layer5_ground_cover', 'layer6_soil_surface'] },
  { label: '6. Root', canonicalKey: 'layer6', keys: ['layer6', 'layer6_rhizosphere', 'layer5_rhizosphere'] },
  { label: '7. Vine', canonicalKey: 'layer7', keys: ['layer7', 'layer7_vertical'] }
];

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.body.classList.toggle('dark-mode', isDark);
  document.body.classList.toggle('theme-dark', isDark);
  document.body.classList.toggle('theme-light', !isDark);

  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.textContent = isDark ? '☀️ Light mode' : '🌙 Dark mode';
  }
}

function toggleTheme() {
  const nextTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
  localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  applyTheme(nextTheme);
}

function getPreferredTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === 'dark' || savedTheme === 'light') {
    return savedTheme;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

document.addEventListener('DOMContentLoaded', () => {
  applyTheme(getPreferredTheme());
  const appVersionLabel = document.getElementById('appVersionLabel');
  if (appVersionLabel) {
    appVersionLabel.textContent = APP_VERSION;
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!localStorage.getItem(THEME_STORAGE_KEY)) {
      applyTheme(getPreferredTheme());
    }
  });
});

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

// Soil test inputs are intentionally disabled until the integration is ready.
const soilTestToggle = document.getElementById('hasSoilTest');
if (soilTestToggle) {
  soilTestToggle.addEventListener('change', function() {
    const form = document.getElementById('soilTestForm');
    if (!form) return;
    if (this.checked) {
      form.classList.remove('hidden');
    } else {
      form.classList.add('hidden');
    }
  });
}

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

  // Soil test integration is coming soon; only submit this if legacy controls exist.
  if (document.getElementById('hasSoilTest')?.checked) {
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

    if (!response.ok) {
      let message = 'Failed to generate plan';
      try {
        const errorData = await response.json();
        message = errorData.error || errorData.detail || message;
      } catch (parseError) {
        // Keep the generic message if the server did not return JSON.
      }
      throw new Error(message);
    }

    generatedPlan = await response.json();
    currentSavedSite = null;
    planDirty = false;
    planSaveStatus = null;
    dirtyGuildLayers.clear();
    originalGuildLayers.clear();
    activeGuildEditIndex = null;

    // Display results
    displayResults(generatedPlan);
    updateSaveStateIndicator();

  } catch (error) {
    alert('Error generating plan: ' + error.message);
    location.reload();
  }
}

function getPlanMineralNeeds(plan = generatedPlan) {
  return [...new Set((plan?.cellSalts?.deficient || [])
    .map(salt => salt.cell_salt)
    .filter(Boolean))];
}

function normalizeToken(value = '') {
  return String(value).trim().toLowerCase();
}

function getRecommendedPlantName(plant) {
  return plant?.name || plant?.common_name || plant?.plant || 'Unknown plant';
}

function getRecommendedPlantMinerals(plant) {
  return [...new Set((plant?.minerals || []).map(mineral => String(mineral).trim()).filter(Boolean))];
}

function getRecommendedPlantRoles(plant) {
  return [...new Set((plant?.roles || []).map(role => String(role).trim()).filter(Boolean))];
}

function getRecommendedPlantPreferenceGroup(plant) {
  return plant?.preference_group || 'general';
}

function getRecommendedPlantMatchLabels(plant) {
  return [...new Set((plant?.matchLabels || []).map(label => String(label).trim()).filter(Boolean))];
}

function helpsPlanDeficiency(plant, plan = generatedPlan) {
  const needs = new Set(getPlanMineralNeeds(plan).map(normalizeToken));
  return getRecommendedPlantMinerals(plant).some(mineral => needs.has(normalizeToken(mineral)));
}

function normalizeRecommendationKey(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getGuildUsedPlantKeys(plan = generatedPlan) {
  const keys = new Set();
  const guilds = Array.isArray(plan?.guild) ? plan.guild : [];

  guilds.forEach(guild => {
    const layers = guild?.layers || {};
    Object.values(layers).forEach(layer => {
      if (!layer) return;
      if (typeof layer === 'string') {
        const key = normalizeRecommendationKey(layer.split('[')[0]);
        if (key && key !== 'none') keys.add(key);
        return;
      }
      if (typeof layer !== 'object' || Array.isArray(layer)) return;
      [layer.id, layer.name, layer.common_name, layer.plant].forEach(value => {
        const key = normalizeRecommendationKey(value);
        if (key && key !== 'none') keys.add(key);
      });
    });
  });

  return keys;
}

function isRecommendedPlantUsedInGuild(plant, usedKeys) {
  return [plant?.id, plant?.plant, plant?.name, plant?.common_name]
    .map(normalizeRecommendationKey)
    .filter(Boolean)
    .some(key => usedKeys.has(key));
}

function shouldShowUnmappedRecommendationNote(plants = []) {
  const climateFallbackCount = plants.filter(plant => plant?.recommendation_source === 'climate_fallback').length;
  const mappedWithoutMineralsCount = plants.filter(plant =>
    plant?.metadata_mapped === true &&
    getRecommendedPlantMinerals(plant).length === 0
  ).length;
  return climateFallbackCount >= 3 || mappedWithoutMineralsCount >= 5;
}

function getCanopyClimateWarnings(plan = generatedPlan) {
  const guilds = Array.isArray(plan?.guild) ? plan.guild : [];
  return guilds
    .map(guild => guild?.layers?.layer1_canopy)
    .filter(layer => layer?.climate_warning)
    .map(layer => ({
      plantName: layer.name || layer.common_name || layer.plant || 'This canopy',
      warning: layer.climate_warning
    }));
}

function renderCanopyClimateWarnings(plan = generatedPlan) {
  const warnings = getCanopyClimateWarnings(plan);
  if (!warnings.length) return '';

  return warnings.map(({ plantName, warning }) => {
    const alternatives = Array.isArray(warning.alternatives) && warning.alternatives.length
      ? ` Consider ${warning.alternatives.slice(0, 3).join(', ')} as better-fit anchors.`
      : '';
    const reason = String(warning.reason || 'it may be marginal for this mapped site climate.')
      .replace(new RegExp(`^${escapeRegExp(String(plantName))}\\b`, 'i'), 'it');
    return `<div class="implementation-climate-note"><strong>Climate note:</strong> ${escapeHtml(plantName)} was chosen by you, but ${escapeHtml(reason)}${escapeHtml(alternatives)}</div>`;
  }).join('');
}

function formatPlantToken(value) {
  return String(value || '').replace(/_/g, ' ');
}

function formatPreferenceGroup(value) {
  const labels = {
    annual_crop: 'Annual crops',
    woody_structural: 'Woody / structural',
    guild_soil_support: 'Guild / soil support',
    perennial: 'Perennials',
    general: 'General'
  };
  return labels[value] || formatPlantToken(value);
}

function getRecommendedPlantCategory(plant) {
  const layer = plant?.taxonomy_layer || '';
  const type = plant?.taxonomy_type || '';
  const roles = new Set(getRecommendedPlantRoles(plant));

  if (layer === 'canopy' || /fruit_tree|nut_tree/.test(type)) return { value: 'canopy_tree', label: 'Canopy / tree crop' };
  if (layer === 'low_tree' || layer === 'sub_canopy') return { value: 'low_tree', label: 'Low tree / understory' };
  if (layer === 'shrub') return { value: 'shrub', label: 'Shrub / hedge crop' };
  if (layer === 'vine') return { value: 'vine', label: 'Vine / trellis crop' };
  if (layer === 'root' || /rhizome|root/.test(type)) return { value: 'root', label: 'Root / rhizome crop' };
  if (layer === 'ground_cover' || roles.has('living_mulch') || roles.has('ground_cover')) return { value: 'ground_cover', label: 'Ground cover / living mulch' };
  if (layer === 'herbaceous' && (roles.has('leafy_green') || roles.has('edible_greens') || roles.has('edible_leaf'))) return { value: 'leafy_green', label: 'Leafy green / herbaceous crop' };
  if (layer === 'herbaceous' && (roles.has('aromatic') || roles.has('medicinal') || roles.has('pest_deterrent') || roles.has('culinary_herb'))) return { value: 'herb_aromatic', label: 'Herb / aromatic support' };
  if (roles.has('nitrogen_fixation')) return { value: 'nitrogen_fixer', label: 'Nitrogen fixer / soil support' };
  if (['dynamic_accumulator', 'soil_building', 'biomass', 'chop_and_drop'].some(role => roles.has(role))) return { value: 'soil_building', label: 'Soil-building support' };
  return { value: plant?.recommendation_source === 'climate_fallback' ? 'climate_support' : (plant?.preference_group || 'general'), label: 'Climate-fit support plant' };
}

function getRecommendedPlantControls(plan = generatedPlan) {
  const plants = Array.isArray(plan?.recommendedPlants) ? plan.recommendedPlants : [];
  const roles = [...new Set(plants.flatMap(getRecommendedPlantRoles))].sort((a, b) => a.localeCompare(b));
  const minerals = [...new Set(plants.flatMap(getRecommendedPlantMinerals))].sort((a, b) => a.localeCompare(b));
  const categoryMap = new Map();
  plants.map(getRecommendedPlantCategory).forEach(category => categoryMap.set(category.value, category.label));
  const categories = [...categoryMap.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return { roles, minerals, categories };
}

function resetRecommendedPlantFilters() {
  const sortSelect = document.getElementById('recommendedSort');
  const roleFilter = document.getElementById('recommendedRoleFilter');
  const mineralFilter = document.getElementById('recommendedMineralFilter');
  const typeFilter = document.getElementById('recommendedTypeFilter');
  if (sortSelect) sortSelect.value = 'best';
  if (roleFilter) roleFilter.value = '';
  if (mineralFilter) mineralFilter.value = '';
  if (typeFilter) typeFilter.value = '';
  renderRecommendedPlants(generatedPlan);
}

function renderRecommendedPlants(plan = generatedPlan) {
  const container = document.getElementById('recommendedPlants');
  if (!container) return;

  const plants = Array.isArray(plan?.recommendedPlants) ? plan.recommendedPlants : [];
  const mineralNeeds = getPlanMineralNeeds(plan);
  const { roles, minerals, categories } = getRecommendedPlantControls(plan);
  const selectedSort = document.getElementById('recommendedSort')?.value || 'best';
  const selectedRole = document.getElementById('recommendedRoleFilter')?.value || '';
  const selectedMineral = document.getElementById('recommendedMineralFilter')?.value || '';
  const selectedType = document.getElementById('recommendedTypeFilter')?.value || '';

  const filteredPlants = plants
    .filter(plant => !selectedRole || getRecommendedPlantRoles(plant).includes(selectedRole))
    .filter(plant => !selectedMineral || getRecommendedPlantMinerals(plant).includes(selectedMineral))
    .filter(plant => !selectedType || getRecommendedPlantCategory(plant).value === selectedType)
    .sort((a, b) => {
      const nameA = getRecommendedPlantName(a);
      const nameB = getRecommendedPlantName(b);
      if (selectedSort === 'plant') return nameA.localeCompare(nameB);
      if (selectedSort === 'role') {
        const roleA = getRecommendedPlantRoles(a)[0] || 'zzzz';
        const roleB = getRecommendedPlantRoles(b)[0] || 'zzzz';
        return roleA.localeCompare(roleB) || nameA.localeCompare(nameB);
      }
      if (selectedSort === 'mineral') {
        const mineralA = getRecommendedPlantMinerals(a)[0] || 'zzzz';
        const mineralB = getRecommendedPlantMinerals(b)[0] || 'zzzz';
        return mineralA.localeCompare(mineralB) || nameA.localeCompare(nameB);
      }
      if (selectedSort === 'layer') {
        const layerA = a.taxonomy_layer || 'zzzz';
        const layerB = b.taxonomy_layer || 'zzzz';
        return String(layerA).localeCompare(String(layerB)) || nameA.localeCompare(nameB);
      }
      const deficiencyDiff = Number(helpsPlanDeficiency(b, plan)) - Number(helpsPlanDeficiency(a, plan));
      if (deficiencyDiff !== 0) return deficiencyDiff;
      const preferenceDiff = (a.preference_score ?? 50) - (b.preference_score ?? 50);
      if (preferenceDiff !== 0) return preferenceDiff;
      const mappedDiff = Number(Boolean(b.metadata_mapped)) - Number(Boolean(a.metadata_mapped));
      if (mappedDiff !== 0) return mappedDiff;
      return nameA.localeCompare(nameB);
    });

  const usedKeys = getGuildUsedPlantKeys(plan);
  const usedPlants = filteredPlants.filter(plant => isRecommendedPlantUsedInGuild(plant, usedKeys));
  const additionalPlants = filteredPlants.filter(plant => !isRecommendedPlantUsedInGuild(plant, usedKeys));
  const bothGroupsVisible = usedPlants.length > 0 && additionalPlants.length > 0;
  const usedLimit = bothGroupsVisible ? 6 : 12;
  const additionalLimit = bothGroupsVisible ? 6 : 12;
  const visibleUsedPlants = usedPlants.slice(0, usedLimit);
  const visibleAdditionalPlants = additionalPlants.slice(0, additionalLimit);
  const visibleCount = visibleUsedPlants.length + visibleAdditionalPlants.length;
  const showUnmappedNote = shouldShowUnmappedRecommendationNote(plants);
  const showGlobalUnmappedNote = Boolean(showUnmappedNote);
  const needsHtml = mineralNeeds.length
    ? mineralNeeds.map(mineral => `<span class="recommendation-tag mineral-tag">${escapeHtml(mineral)}</span>`).join('')
    : '<span class="recommendation-empty">No mineral deficiencies detected or mapped.</span>';
  const renderRecommendationGroup = (title, groupPlants) => groupPlants.length ? `
    <div class="recommended-group">
      <h4>${escapeHtml(title)}</h4>
      <div class="plant-list recommended-plant-list">
        ${groupPlants.map(plant => renderRecommendedPlantCard(plant, plan, { showGlobalUnmappedNote })).join('')}
      </div>
    </div>
  ` : '';

  container.innerHTML = `
    <div class="plan-mineral-needs">
      <strong>Plan mineral needs</strong>
      <div class="recommendation-tags">${needsHtml}</div>
    </div>
    ${showUnmappedNote ? `
      <div class="educational-note recommendation-context-note">
        Some climate-fit plants are shown even though their cell-salt profile is not mapped yet. These are included for USDA zone, Koppen climate, layer role, and guild diversity - not because they directly match a deficiency.
      </div>
    ` : ''}
    <div class="recommended-controls">
      <label>
        <span>Sort by</span>
        <select id="recommendedSort" onchange="renderRecommendedPlants(generatedPlan)">
          <option value="best"${selectedSort === 'best' ? ' selected' : ''}>Best match</option>
          <option value="plant"${selectedSort === 'plant' ? ' selected' : ''}>Plant name</option>
          <option value="role"${selectedSort === 'role' ? ' selected' : ''}>Role</option>
          <option value="mineral"${selectedSort === 'mineral' ? ' selected' : ''}>Mineral / Cell Salt</option>
          <option value="layer"${selectedSort === 'layer' ? ' selected' : ''}>Layer</option>
        </select>
      </label>
      <label>
        <span>Filter by role</span>
        <select id="recommendedRoleFilter" onchange="renderRecommendedPlants(generatedPlan)">
          <option value="">All roles</option>
          ${roles.map(role => `<option value="${escapeHtml(role)}"${selectedRole === role ? ' selected' : ''}>${escapeHtml(formatPlantToken(role))}</option>`).join('')}
        </select>
      </label>
      <label>
        <span>Filter by mineral</span>
        <select id="recommendedMineralFilter" onchange="renderRecommendedPlants(generatedPlan)">
          <option value="">All minerals</option>
          ${minerals.map(mineral => `<option value="${escapeHtml(mineral)}"${selectedMineral === mineral ? ' selected' : ''}>${escapeHtml(mineral)}</option>`).join('')}
        </select>
      </label>
      <label>
        <span>Filter by plant type</span>
        <select id="recommendedTypeFilter" onchange="renderRecommendedPlants(generatedPlan)">
          <option value="">All types</option>
          ${categories.map(category => `<option value="${escapeHtml(category.value)}"${selectedType === category.value ? ' selected' : ''}>${escapeHtml(category.label)}</option>`).join('')}
        </select>
      </label>
      <button class="btn btn-small" type="button" onclick="resetRecommendedPlantFilters()">Reset filters</button>
    </div>
    ${filteredPlants.length ? '<p class="note">These recommended candidates are grouped by whether they already appear in your guild design.</p>' : ''}
    ${renderRecommendationGroup('Recommended plants used in this plan', visibleUsedPlants)}
    ${renderRecommendationGroup('Additional recommended candidates', visibleAdditionalPlants)}
    ${!filteredPlants.length ? '<p class="note">No recommended plants match the current filters.</p>' : ''}
    ${filteredPlants.length > visibleCount ?
      `<p class="note">Showing ${visibleCount} of ${filteredPlants.length} recommended plants${plants.length !== filteredPlants.length ? ' matching current filters' : ''}.</p>` : ''}
  `;
}

function renderRecommendedPlantCard(plant, plan = generatedPlan, options = {}) {
  const name = getRecommendedPlantName(plant);
  const minerals = getRecommendedPlantMinerals(plant);
  const roles = getRecommendedPlantRoles(plant);
  const matchLabels = getRecommendedPlantMatchLabels(plant);
  const supportFunctions = [...new Set((plant.functions || []).map(item => String(item).trim()).filter(Boolean))];
  const layerParts = [plant.taxonomy_layer, plant.taxonomy_type].filter(Boolean).map(formatPlantToken);
  const category = getRecommendedPlantCategory(plant);
  const supportsDeficiency = helpsPlanDeficiency(plant, plan);
  const mapped = plant.metadata_mapped !== false && Boolean(plant.id || plant.common_name || plant.name);
  const isClimateFallback = plant.recommendation_source === 'climate_fallback';
  const displayMatchLabels = (isClimateFallback
    ? matchLabels.filter(label => !/cell-salt mapping/i.test(label))
    : matchLabels
  ).slice(0, 3);
  const fallbackMineralNote = isClimateFallback && minerals.length === 0
    ? 'Climate-fit recommendation. Cell-salt profile not mapped yet.'
    : '';
  const whyShown = options.showGlobalUnmappedNote && fallbackMineralNote
    ? (plant.recommendation_source === 'climate_fallback' ? 'Climate fit and guild diversity.' : plant.recommendation_reason || '')
    : fallbackMineralNote || plant.recommendation_reason || '';

  return `
    <div class="plant-item recommended-plant-card">
      <div class="recommended-card-header">
        <h4>${escapeHtml(formatPlantToken(name))}</h4>
        ${supportsDeficiency ? '<span class="recommendation-badge helps">Helps deficiency</span>' : ''}
      </div>
      ${plant.botanical_name ? `<p class="recommended-botanical">${escapeHtml(plant.botanical_name)}</p>` : ''}
      ${minerals.length || !isClimateFallback ? `<div class="recommendation-tags">
        ${minerals.length
          ? minerals.map(mineral => `<span class="recommendation-tag mineral-tag">${escapeHtml(mineral)}</span>`).join('')
          : '<span class="recommendation-tag muted-tag">Mineral profile not mapped yet</span>'}
      </div>` : ''}
      ${displayMatchLabels.length ? `<div class="recommendation-tags">${displayMatchLabels.map(label => `<span class="recommendation-tag ${/fallback|climate fit|diversity/i.test(label) ? 'preference-tag' : 'role-tag'}">${escapeHtml(label)}</span>`).join('')}</div>` : ''}
      ${roles.length ? `<div class="recommendation-tags">${roles.map(role => `<span class="recommendation-tag role-tag">${escapeHtml(formatPlantToken(role))}</span>`).join('')}</div>` : ''}
      <div class="recommendation-tags"><span class="recommendation-tag preference-tag">${escapeHtml(category.label)}</span></div>
      ${supportFunctions.length ? `<p class="recommended-meta"><strong>Cell-salt support:</strong> ${escapeHtml(supportFunctions.join('; '))}</p>` : ''}
      ${whyShown ? `<p class="recommended-meta"><strong>Why shown:</strong> ${escapeHtml(whyShown)}</p>` : ''}
      ${layerParts.length ? `<p class="recommended-meta"><strong>Layer/type:</strong> ${escapeHtml(layerParts.join(' / '))}</p>` : ''}
      ${plant.climate_affinity ? `<p class="recommended-meta"><strong>Climate:</strong> ${escapeHtml(plant.climate_affinity)}${Array.isArray(plant.zones) && plant.zones.length ? ` · Zones ${escapeHtml(plant.zones.join('-'))}` : ''}</p>` : ''}
      ${!mapped ? '<p class="recommended-meta"><strong>Metadata not mapped yet</strong></p>' : ''}
    </div>
  `;
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
    climateHTML += `<p class="note" style="font-size:0.85em;color:var(--text-light);">Source: ${climate.source}${climate.koppenDistanceKm ? ` (nearest Köppen point ${climate.koppenDistanceKm} km away)` : ''}</p>`;
  }
  
  document.getElementById('siteInfo').innerHTML = `
    <p><strong>Address:</strong> ${plan.siteInfo.address}</p>
    <p><strong>Scale:</strong> ${plan.siteInfo.scale}</p>
    <p><strong>Primary Sun Sign:</strong> ${plan.siteInfo.sunSign}</p>
    ${plan.siteInfo.familyMembers.length > 0 ? 
      `<p><strong>Family Members:</strong> ${plan.siteInfo.familyMembers.map(m => m.sunSign).join(', ')}</p>` : ''}
    ${loc.latitude ? `<p><strong>Coordinates:</strong> ${loc.latitude.toFixed(4)}°N, ${loc.longitude.toFixed(4)}°W</p>` : ''}
    ${loc.formattedAddress ? `<p><strong>Geocoded:</strong> ${loc.formattedAddress}</p>` : ''}
    ${climateHTML ? `<div class="climate-info" style="margin-top:12px;padding:10px;background:var(--info-bg);border-left:3px solid var(--success-border);border-radius:4px;">${climateHTML}</div>` : ''}
    ${geoFailed ? `<p class="note" style="background:var(--warning-bg);border-color:var(--danger-border);">⚠️ <strong>Location warning:</strong> ${loc.error}</p>` : ''}
  `;

  // Render map and sun analysis
  if (loc.latitude && loc.longitude) {
    renderMap(loc.latitude, loc.longitude, plan.siteInfo.address);
    drawPlantSunAnalysis(loc.latitude, loc.longitude, climate);
  } else {
    document.getElementById('siteMap').innerHTML = '<p class="note">Location map unavailable</p>';
  }

  // AI Guilds — clear container before every render to prevent ghost data
  document.getElementById('aiGuilds').innerHTML = '';
  document.getElementById('sevenLayerGuild').innerHTML = '';

  const sevenLayerGuildCard = document.getElementById('sevenLayerGuildCard');
  const hasGuild = Array.isArray(plan.guild)
    ? plan.guild.length > 0
    : Boolean(plan.guild && typeof plan.guild === 'object');

  if (hasGuild) {
    if (sevenLayerGuildCard) sevenLayerGuildCard.style.display = 'block';
    renderSevenLayerGuild(plan.guild);
  } else if (sevenLayerGuildCard) {
    sevenLayerGuildCard.style.display = 'none';
  }

  // Suppress AI guild card when 7-layer guild exists
  if (plan.aiGenerated && !plan.guild) {
    document.getElementById('aiGuildsCard').style.display = 'block';
    renderAIGuilds(plan.aiGenerated);
  } else {
    // 7-layer guild exists or AI failed - suppress AI card
    document.getElementById('aiGuildsCard').style.display = 'none';
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
      <p class="note" style="background:var(--warning-bg);border-color:var(--danger-border);">
        ⚠️ <strong>Location unavailable.</strong> Recommended plants require a valid USDA hardiness zone. 
        Please enter a valid City and State (e.g., "Duluth, MN") and try again.
      </p>
    `;
  } else {
    renderRecommendedPlants(plan);
  };

  // 3-Year Plan
  const planData = plan.threeYearPlan;

  // Extract ALL 3 guild anchors for brute-force injection (ARRAY-BASED RENDER + ALL-ANCHOR)
  const guildAnchors = getPlanGuildCanopyNames(plan);
  const scale = planData.year0.focus?.includes('Homestead') ? 'homestead' : '';

  // ARRAY-BASED RENDER (TIMELINE): Force chronological index order 0-4.
  // Swap water and canopy tasks so water always appears first.
  let orderedTasks = [...(planData.year0.tasks || [])];
  const findIdx = (tasks, pattern) => tasks.findIndex(t => pattern.test(t.task));
  const waterIdx = findIdx(orderedTasks, /water|irrigation|earthwork/i);
  const canopyIdx = findIdx(orderedTasks, /canopy|tree.?plant/i);
  if (waterIdx > -1 && canopyIdx > -1 && waterIdx > canopyIdx) {
    // Water comes after canopy in AI output — swap them
    const waterTask = orderedTasks.splice(waterIdx, 1)[0];
    const canopyTask = orderedTasks.splice(canopyIdx, 1)[0];
    orderedTasks.splice(canopyIdx, 0, waterTask);
    orderedTasks.splice(waterIdx, 0, canopyTask);
  }

  // ALL-ANCHOR BRUTE FORCE: Locate Canopy Planting task and overwrite its plants array
  // with all 3 guild anchors — no exceptions, no AI override
  orderedTasks.forEach(task => {
    if (/canopy|tree.?plant/i.test(task.task)) {
      if (scale === 'homestead' && guildAnchors.length > 1) {
        task.plants = [...guildAnchors];  // [Apple, Avocado, Fig] — never Avocado-only
      }
    }
  });

  document.getElementById('threeYearPlan').innerHTML = `
    <div class="plan-timeline">
      <div class="year-section">
        <h4>${planData.year0.title || 'Canopy & Infrastructure'}</h4>
        <p><em>${planData.year0.duration || planData.year0.timeframe || 'Months 0-12'}</em></p>
        <p>${planData.year0.focus || ''}</p>
        <div style="margin-top: 15px">
          ${orderedTasks.map(task => {
            const rawPlants = task.plants || [];
            const seen = new Set();
            const displayPlants = rawPlants
              .map(p => typeof p === 'string' ? p.trim() : (p.common_name || p.name || JSON.stringify(p)))
              .filter(p => {
                const key = p.toLowerCase();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
              });
            const climateWarningHtml = /canopy|tree.?plant/i.test(task.task || '')
              ? renderCanopyClimateWarnings(plan)
              : '';
            return `
            <div class="task-item">
              <strong>${task.task || 'Task'} - ${task.timing || ''}</strong>
              ${displayPlants.length ? `<p>Plants: ${displayPlants.join(', ')}</p>` : ''}
              <p>${task.details || ''}</p>
              ${climateWarningHtml}
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="year-section">
        <h4>${planData.year1.title || 'Year 1'}</h4>
        <p><em>${planData.year1.duration || 'Year 2'}</em></p>
        <p>${planData.year1.focus || ''}</p>
        <div style="margin-top: 15px">
          ${planData.year1.tasks.map(task => {
            const rawP = task.plants || [];
            const seen1 = new Set();
            const dp1 = rawP.map(p => typeof p === 'object' ? (p.common_name || p.name || JSON.stringify(p)) : p).filter(p => { const k=p.toLowerCase(); return seen1.has(k)?false:(seen1.add(k),true); });
            return `
            <div class="task-item">
              <strong>${task.task} - ${task.timing || ''}</strong>
              ${dp1.length ? `<p>Plants: ${dp1.join(', ')}</p>` : ''}
              <p>${task.details || ''}</p>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="year-section">
        <h4>${planData.year2.title || 'Year 2'}</h4>
        <p><em>${planData.year2.duration || 'Year 3'}</em></p>
        <p>${planData.year2.focus || ''}</p>
        <div style="margin-top: 15px">
          ${planData.year2.tasks.map(task => {
            const rawP2 = task.plants || [];
            const seen2 = new Set();
            const dp2 = rawP2.map(p => typeof p === 'object' ? (p.common_name || p.name || JSON.stringify(p)) : p).filter(p => { const k=p.toLowerCase(); return seen2.has(k)?false:(seen2.add(k),true); });
            return `
            <div class="task-item">
              <strong>${task.task || 'Task'} - ${task.timing || ''}</strong>
              ${dp2.length ? `<p>Plants: ${dp2.join(', ')}</p>` : ''}
              <p>${task.details || ''}</p>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  // ZOMBIE PHRASE KILLER: brute-force sanitize rendered HTML
  const planEl = document.getElementById('threeYearPlan');
  if (planEl) {
    planEl.innerHTML = planEl.innerHTML.replace(
      /plant now or wait for harvest/gi,
      'Timeline: Establish Year 1'
    );
  }

  // Moon Calendar
  const moon = plan.moonCalendar;
  document.getElementById('moonCalendar').innerHTML = `
    <div class="educational-note moon-guidance-note">
      This prototype shows basic moon-phase planting guidance. A full date-based planting calendar with crop-specific timing is planned.
    </div>
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
    guildsDiv.innerHTML = '<p style="color:var(--danger-text);font-weight:bold;padding:12px;background:var(--warning-bg);border:1px solid var(--danger-border);border-radius:4px;">⚠️ AI failed to generate guilds. Please try again.</p>';
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
        <div class="guild-card" style="border-left:4px solid var(--success-border);margin-bottom:24px;padding:12px 16px;background:var(--panel-bg);border-radius:6px">
          <h4 style="margin:0 0 8px 0">🌳 ${guild.name}</h4>
          ${guild.function ? `<p style="margin:0 0 12px 0;color:var(--text-light);font-size:0.9em"><em>${guild.function}</em></p>` : ''}
          <div class="layer-table" style="display:grid;gap:4px">
            ${Object.entries(layerLabels).map(([key, label]) => {
              const val = guild.layers ? (guild.layers[key] || '-') : (guild[key] || '-');
              return `
                <div style="display:grid;grid-template-columns:200px 1fr;gap:8px;align-items:center;padding:4px 0;border-bottom:1px solid var(--border)">
                  <span style="font-size:0.85em;color:var(--text-light)">${label}</span>
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
  currentSavedSite = null;
  planDirty = false;
  planSaveStatus = null;
  dirtyGuildLayers.clear();
  originalGuildLayers.clear();
  activeGuildEditIndex = null;
  updateSaveStateIndicator();
  location.reload();
}

function updateSaveControls() {
  const canSaveChanges = Boolean(currentSavedSite?.siteId && planDirty);
  const canSaveAsNew = Boolean(generatedPlan);
  [
    {
      saveChangesBtn: document.getElementById('saveChangesBtn'),
      saveAsNewBtn: document.getElementById('saveAsNewBtn')
    },
    {
      saveChangesBtn: document.getElementById('bottomSaveChangesBtn'),
      saveAsNewBtn: document.getElementById('bottomSaveAsNewBtn')
    }
  ].forEach(({ saveChangesBtn, saveAsNewBtn }) => {
    if (saveChangesBtn) {
      saveChangesBtn.disabled = !canSaveChanges;
      saveChangesBtn.classList.toggle('hidden', !canSaveChanges);
    }
    if (saveAsNewBtn) {
      saveAsNewBtn.disabled = !canSaveAsNew;
    }
  });
}

function hasPendingGuildEdits(guildIndex) {
  return [...dirtyGuildLayers].some(key => key.startsWith(`${guildIndex}:`));
}

function clearPendingGuildEdits(guildIndex) {
  [...dirtyGuildLayers]
    .filter(key => key.startsWith(`${guildIndex}:`))
    .forEach(key => dirtyGuildLayers.delete(key));
  [...originalGuildLayers.keys()]
    .filter(key => key.startsWith(`${guildIndex}:`))
    .forEach(key => originalGuildLayers.delete(key));
}

function saveGuildEdits(guildIndex) {
  clearPendingGuildEdits(guildIndex);
  renderSevenLayerGuild(generatedPlan?.guild);
  updateSaveStateIndicator();
}

function updateSaveStateIndicator() {
  const indicator = document.getElementById('saveStateIndicator');
  if (!indicator) {
    updateSaveControls();
    return;
  }

  indicator.classList.remove('dirty', 'saved');

  if (planDirty) {
    indicator.textContent = currentSavedSite?.name
      ? `Unsaved changes to saved site: ${currentSavedSite.name}`
      : 'Unsaved changes';
    indicator.classList.add('dirty');
    indicator.classList.remove('hidden');
    updateSaveControls();
    return;
  }

  if (currentSavedSite?.name && planSaveStatus === 'saved') {
    indicator.textContent = `Saved: ${currentSavedSite.name}`;
    indicator.classList.add('saved');
    indicator.classList.remove('hidden');
    updateSaveControls();
    return;
  }

  if (currentSavedSite?.name) {
    indicator.textContent = `Loaded saved site: ${currentSavedSite.name}`;
    indicator.classList.add('saved');
    indicator.classList.remove('hidden');
    updateSaveControls();
    return;
  }

  indicator.textContent = 'Not saved yet';
  indicator.classList.remove('hidden');
  updateSaveControls();
}

function makeSiteIdFromName(name) {
  const slug = String(name)
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `${slug || 'saved-site'}-${Date.now()}`;
}

function buildSiteData(siteName, createdAt = null) {
  const now = new Date().toISOString();
  return {
    name: siteName,
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
    created: createdAt || now,
    updated: now
  };
}

function persistSite(siteId, siteName, options = {}) {
  const savedAt = new Date().toISOString();
  const siteData = buildSiteData(siteName, options.createdAt || currentSavedSite?.createdAt || null);

  return fetch(`/api/sites/${encodeURIComponent(siteId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(siteData)
  })
  .then(res => res.json())
  .then(data => {
    if (!data.success) {
      throw new Error(data.error || 'Site save failed');
    }

    currentSavedSite = {
      siteId,
      name: siteName,
      createdAt: siteData.created,
      updatedAt: savedAt
    };
    planDirty = false;
    planSaveStatus = 'saved';
    dirtyGuildLayers.clear();
    originalGuildLayers.clear();
    activeGuildEditIndex = null;
    displayResults(generatedPlan);
    updateSaveStateIndicator();
    return data;
  });
}

function saveSite() {
  saveAsNewSite();
}

function saveAsNewSite() {
  if (!generatedPlan) {
    alert('No plan to save. Generate a plan first.');
    return;
  }

  const rawSiteName = prompt('Enter a name for this site:', generatedPlan.siteInfo.address.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase());
  const siteName = rawSiteName ? rawSiteName.trim() : '';
  if (!siteName) return;

  const siteId = makeSiteIdFromName(siteName);
  persistSite(siteId, siteName, { createdAt: new Date().toISOString() })
    .then(() => {
      alert('Site saved successfully!');
      if (!document.getElementById('savedSitesModal')?.classList.contains('hidden')) showSavedSites();
    })
  .catch(err => alert('Error saving site: ' + err.message));
}

function saveChanges() {
  if (!generatedPlan) {
    alert('No plan to save. Generate a plan first.');
    return;
  }

  if (!currentSavedSite?.siteId) {
    saveAsNewSite();
    return;
  }

  persistSite(currentSavedSite.siteId, currentSavedSite.name, { createdAt: currentSavedSite.createdAt })
    .then(() => {
      alert('Changes saved successfully!');
      if (!document.getElementById('savedSitesModal')?.classList.contains('hidden')) showSavedSites();
    })
    .catch(err => alert('Error saving changes: ' + err.message));
}

function downloadPlan() {
  alert('Native PDF export is coming soon. For now, use your browser print dialog (Ctrl+P / Cmd+P), then choose "Save as PDF" as the destination.');
}


function drawPlantSunAnalysis(lat, lon, climate = {}) {
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
  const zoneNumber = parseInt(String(climate?.hardinessZone || '').match(/^(\d+)/)?.[1] || '0', 10);
  const koppenCode = String(climate?.koppenCode || '');
  const frostFreeDays = Number(climate?.frostDates?.light?.avgFrostFreeDays || climate?.growingSeasonDays || 0);
  const isTropical = koppenCode.startsWith('A') || zoneNumber >= 12;
  const isColdSubarctic = /^(Dfc|Dfd|ET|EF)/.test(koppenCode) || (frostFreeDays > 0 && frostFreeDays < 150);
  const isWarmFrostFree = isTropical || zoneNumber >= 10 || climate?.frostDates?.light?.frostFree === true;
  const winterImpact = isWarmFrostFree
    ? 'Lower seasonal light still matters, but frost is unlikely. Use wind protection, mulch, and dry-season irrigation planning for young tropical plants.'
    : 'Low-angle light, long shadows. Southern exposure critical. Protect tender plants from frost.';
  const recommendationItems = isColdSubarctic
    ? [
        '<li><strong>South-facing microclimates:</strong> Prioritize the warmest protected sites for fruit trees, berries, and season-extension beds.</li>',
        '<li><strong>Wind and snow management:</strong> Use fences, hedges, and structures to reduce winter wind, catch insulating snow, and protect young trees.</li>',
        '<li><strong>Short-season crops:</strong> Favor early-ripening cultivars and short-season annuals; use starts, row cover, low tunnels, or greenhouse space for warm-season crops.</li>',
        '<li><strong>Wildlife protection:</strong> Fence or cage young trees and berry plantings where moose, deer, rabbits, or voles may browse trunks and shoots.</li>',
        '<li><strong>Soil warming and drainage:</strong> Use raised beds, mulch timing, and well-drained planting mounds where cold or wet soil delays spring growth.</li>'
      ]
    : isWarmFrostFree
    ? [
        '<li><strong>Young tropical trees:</strong> Use mulch, wind protection, and temporary afternoon shade while roots establish.</li>',
        '<li><strong>Dry-season irrigation:</strong> Group thirsty crops where drip lines or rain catchment can support them.</li>',
        '<li><strong>Living soil cover:</strong> Keep ground covered with sweet potato, perennial peanut, or other living mulch to reduce heat and erosion.</li>',
        '<li><strong>Salt and wind exposure:</strong> Place sensitive plants behind shrubs, palms, hedges, or other wind-filtering structure.</li>',
        '<li><strong>Understory crops:</strong> Use bananas, taro, ginger, turmeric, cacao, or coffee where partial shade and moisture are available.</li>'
      ]
    : [
        '<li><strong>South-facing beds:</strong> Sunniest all year. Best for fruit trees, tomatoes, peppers, squash.</li>',
        '<li><strong>East-facing beds:</strong> Morning sun, afternoon shade. Good for leafy greens, herbs, strawberries.</li>',
        '<li><strong>West-facing beds:</strong> Hot afternoon sun. Good for Mediterranean herbs, drought-tolerant perennials.</li>',
        '<li><strong>North-facing beds:</strong> Coolest, most shade. Best for shade-tolerant plants: hostas, ferns, mushrooms.</li>',
        '<li><strong>Under deciduous trees:</strong> Full sun in winter (when bare), dappled shade in summer. Perfect for shade-loving understory.</li>'
      ];

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
        <p><strong>Impact:</strong> ${winterImpact}</p>
      </div>
    </div>

    <div class="sun-recommendations">
      <h4>🌱 Planting Recommendations</h4>
      <ul>
        ${recommendationItems.join('')}
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

      const sortedSites = [...sites].sort((a, b) => {
        const aTime = new Date(a.updated || a.created || 0).getTime() || 0;
        const bTime = new Date(b.updated || b.created || 0).getTime() || 0;
        return bTime - aTime;
      });

      listContainer.innerHTML = sortedSites.map(site => `
        <div class="saved-site-item">
          <div class="saved-site-info">
            <h4>${escapeHtml(site.name || 'Unnamed Site')}</h4>
            <p>${escapeHtml(site.description || 'No description')}</p>
            <p class="site-meta">
              ${site.updated ? 'Updated: ' + formatDate(site.updated) : (site.created ? 'Created: ' + formatDate(site.created) : '')}
            </p>
          </div>
          <div class="saved-site-actions">
            <button class="btn btn-primary" onclick="loadSite('${escapeHtml(site.siteId)}')">📂 Open</button>
            <button class="btn btn-danger" onclick="deleteSite('${escapeHtml(site.siteId)}')">🗑️</button>
          </div>
        </div>
      `).join('');
    })
    .catch(err => {
      listContainer.innerHTML = `<p class="note" style="color:var(--danger-text);">Error loading sites: ${escapeHtml(err.message)}</p>`;
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
      currentSavedSite = {
        siteId: siteData.siteId || siteId,
        name: siteData.name || siteId,
        createdAt: siteData.created || null,
        updatedAt: siteData.updated || null
      };
      planDirty = false;
      planSaveStatus = null;
      dirtyGuildLayers.clear();
      originalGuildLayers.clear();
      activeGuildEditIndex = null;

      // Hide all form sections, show results
      document.getElementById('step1').classList.add('hidden');
      document.getElementById('step2').classList.add('hidden');
      document.getElementById('results').classList.remove('hidden');

      // Render the plan
      displayResults(plan);
      updateSaveStateIndicator();

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

function escapeRegExp(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

function getCurrentGuilds() {
  if (!generatedPlan?.guild) return [];
  return Array.isArray(generatedPlan.guild) ? generatedPlan.guild : [generatedPlan.guild];
}

function getGuildLayerValue(guildItem, keys) {
  const layers = guildItem?.layers || guildItem || {};
  for (const key of keys) {
    if (layers[key]) return layers[key];
  }
  return null;
}

function getGuildLayerPlantLabel(layer) {
  if (!layer) return 'No plants selected yet';
  if (typeof layer === 'string') {
    const value = layer.trim();
    return value && value.toLowerCase() !== 'none' ? value : 'No plants selected yet';
  }
  if (Array.isArray(layer)) return layer.length ? layer.join(', ') : 'No plants selected yet';
  return layer.name || layer.plant || layer.common_name || 'No plants selected yet';
}

function getPlanGuildCanopyNames(plan) {
  const rawGuild = plan?.guild;
  const guilds = Array.isArray(rawGuild) ? rawGuild : (rawGuild ? [rawGuild] : []);
  const seen = new Set();
  const names = [];

  guilds.forEach(guildItem => {
    const canopy = getGuildLayerValue(guildItem, ['layer1_canopy']);
    const name = getGuildLayerPlantLabel(canopy);
    if (!name || name === 'No plants selected yet' || name.toLowerCase() === 'none') return;

    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    names.push(name);
  });

  return names;
}

function syncThreeYearPlanCanopiesFromGuild(plan) {
  const year0 = plan?.threeYearPlan?.year0;
  if (!year0 || !Array.isArray(year0.tasks)) return;

  const canopyNames = getPlanGuildCanopyNames(plan);
  if (!canopyNames.length) return;

  const formatList = (items) => {
    if (items.length <= 2) return items.join(' and ');
    return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
  };

  const canopyList = formatList(canopyNames);
  const canopyTask = year0.tasks.find(task => /canopy|tree.?plant/i.test(task.task || ''));

  if (canopyNames.length > 1) {
    year0.focus = `Establish ${canopyList} as the canopy anchors`;
    if (canopyTask) {
      canopyTask.task = 'Canopy Tree Planting - Plant Primary Anchors';
      canopyTask.plants = canopyNames;
      canopyTask.details = `${canopyList} are the primary canopy anchors for the guild system. Plant with spacing appropriate to each species and site conditions.`;
    }
  } else {
    year0.focus = `Establish ${canopyNames[0]} as the system anchor`;
    if (canopyTask) {
      canopyTask.plants = [canopyNames[0]];
      canopyTask.details = `${canopyNames[0]} is the primary canopy anchor for the guild system. Plant with spacing appropriate to the species and site conditions.`;
    }
  }

  if (canopyTask) {
    canopyTask.guild_note = canopyNames.length > 1
      ? 'These canopy anchors come directly from the current guild canopies.'
      : 'This canopy anchor comes directly from the current guild canopy.';
    canopyTask.botanical = null;
    canopyTask.cellSalts = [];
    canopyTask.climateAffinity = 'guild-derived';
  }
}

function getSelectedGuildLayer() {
  const modal = document.getElementById('guildEditModal');
  const select = document.getElementById('guildLayerSelect');
  if (!modal || !select) return { guildIndex: -1, guildItem: null, layerDef: null, layer: null };

  const guildIndex = Number(modal.dataset.guildIndex);
  const guildItem = getCurrentGuilds()[guildIndex] || null;
  const layerDef = GUILD_LAYER_DEFINITIONS.find(def => def.canonicalKey === select.value) || null;
  const layer = guildItem && layerDef ? getGuildLayerValue(guildItem, layerDef.keys) : null;

  return { guildIndex, guildItem, layerDef, layer };
}

function getSiteZoneNumber() {
  const zone = generatedPlan?.climateData?.hardinessZone || '';
  const match = String(zone).match(/^(\d+)/);
  return match ? match[1] : '';
}

function getLayerRoles(layer) {
  if (!layer || typeof layer !== 'object' || Array.isArray(layer)) return [];
  const roles = [...(layer.functions || []), ...(layer.roles || [])];
  return [...new Set(roles.map(role => String(role).trim()).filter(Boolean))];
}

function getLayerMinerals(layer) {
  if (!layer || typeof layer !== 'object' || Array.isArray(layer)) return [];
  return [...new Set((layer.minerals || layer.cell_salts || []).map(mineral => String(mineral).trim()).filter(Boolean))];
}

function getUsedGuildPlantIds() {
  const ids = new Set();
  getCurrentGuilds().forEach(guildItem => {
    const layers = guildItem?.layers || {};
    Object.values(layers).forEach(layer => {
      if (layer && typeof layer === 'object' && !Array.isArray(layer) && layer.id) {
        ids.add(layer.id);
      }
    });
  });
  return [...ids];
}

function getGuildTitle(guildItem, index) {
  const rawTitle = guildItem?.name || guildItem?.anchor || `Guild ${index + 1}`;
  return String(rawTitle)
    .replace(/_/g, ' ')
    .replace(/\s+Guild$/i, '')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase()) + ' Guild';
}

function toggleGuildEditMode(guildIndex) {
  activeGuildEditIndex = activeGuildEditIndex === guildIndex ? null : guildIndex;
  renderSevenLayerGuild(generatedPlan?.guild);
}

function openGuildEditModal(guildIndex, layerKey = null) {
  const guilds = getCurrentGuilds();
  const guildItem = guilds[guildIndex];
  const modal = document.getElementById('guildEditModal');
  const title = document.getElementById('guildEditTitle');
  const select = document.getElementById('guildLayerSelect');
  if (!modal || !title || !select || !guildItem) return;

  modal.dataset.guildIndex = String(guildIndex);
  title.textContent = `Edit ${getGuildTitle(guildItem, guildIndex)}`;
  select.innerHTML = GUILD_LAYER_DEFINITIONS
    .map(layerDef => `<option value="${escapeHtml(layerDef.canonicalKey)}">${escapeHtml(layerDef.label)}</option>`)
    .join('');
  select.value = layerKey || GUILD_LAYER_DEFINITIONS[0].canonicalKey;
  const layerField = select.closest('.form-group');
  if (layerField) layerField.classList.toggle('hidden', Boolean(layerKey));

  updateGuildEditPreview();
  modal.classList.remove('hidden');
}

function updateGuildEditPreview() {
  const currentPlant = document.getElementById('guildCurrentPlant');
  if (!currentPlant) return;

  const { layer } = getSelectedGuildLayer();

  currentPlant.textContent = getGuildLayerPlantLabel(layer);
  loadGuildReplacementCandidates();
}

async function loadGuildReplacementCandidates() {
  const replacementSelect = document.getElementById('guildReplacementSelect');
  const status = document.getElementById('guildReplacementStatus');
  const { layerDef, layer } = getSelectedGuildLayer();
  const zone = getSiteZoneNumber();
  const koppen = generatedPlan?.climateData?.koppenCode || '';
  const currentId = layer && typeof layer === 'object' && !Array.isArray(layer) ? layer.id : '';

  if (!replacementSelect || !status) return;
  replacementSelect.innerHTML = '';

  if (!layerDef || !zone) {
    status.textContent = 'Compatible replacements need a generated plan with a USDA zone.';
    replacementSelect.disabled = true;
    return;
  }

  status.textContent = 'Loading compatible replacements...';
  replacementSelect.disabled = true;

  try {
    const params = new URLSearchParams({
      layerKey: layerDef.canonicalKey,
      zone,
      koppen
    });
    if (currentId) params.set('excludeId', currentId);

    const currentRoles = getLayerRoles(layer);
    const currentMinerals = getLayerMinerals(layer);
    const currentSalt = layer && typeof layer === 'object' && !Array.isArray(layer) ? layer.salt_content : '';
    const usedIds = getUsedGuildPlantIds();
    if (currentRoles.length) params.set('currentRoles', currentRoles.join(','));
    if (currentSalt) params.set('currentSalt', currentSalt);
    if (currentMinerals.length) params.set('currentMinerals', currentMinerals.join(','));
    if (usedIds.length) params.set('usedIds', usedIds.join(','));

    const response = await fetch(`/api/guild-layer-candidates?${params.toString()}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to load replacement candidates');
    }

    const data = await response.json();
    const candidates = Array.isArray(data.candidates) ? data.candidates : [];
    if (!candidates.length) {
      status.textContent = 'No compatible replacements found for this layer.';
      return;
    }

    replacementSelect.innerHTML = candidates
      .map(candidate => {
        const labels = (candidate.matchLabels || []).slice(0, 3).join(', ');
        const labelText = labels ? ` - ${labels}` : '';
        return `<option value="${escapeHtml(candidate.id)}">${escapeHtml(candidate.name + labelText)}</option>`;
      })
      .join('');
    replacementSelect.dataset.candidates = JSON.stringify(candidates);
    replacementSelect.disabled = false;
    status.textContent = `${candidates.length} compatible replacement${candidates.length === 1 ? '' : 's'} available.`;
  } catch (error) {
    status.textContent = error.message;
  }
}

function applyGuildLayerEdit() {
  const replacementSelect = document.getElementById('guildReplacementSelect');
  const { guildIndex, guildItem, layerDef } = getSelectedGuildLayer();
  if (!replacementSelect || !guildItem || !layerDef || !replacementSelect.value) return;

  const candidates = JSON.parse(replacementSelect.dataset.candidates || '[]');
  const replacement = candidates.find(candidate => candidate.id === replacementSelect.value);
  if (!replacement) return;

  const dirtyKey = `${guildIndex}:${layerDef.canonicalKey}`;
  const originalLayer = getGuildLayerValue(guildItem, layerDef.keys);
  if (!originalGuildLayers.has(dirtyKey)) {
    originalGuildLayers.set(dirtyKey, originalLayer == null ? null : JSON.parse(JSON.stringify(originalLayer)));
  }

  if (!guildItem.layers) guildItem.layers = {};
  guildItem.layers[layerDef.canonicalKey] = replacement;
  planDirty = true;
  planSaveStatus = null;
  dirtyGuildLayers.add(dirtyKey);
  layerDef.keys
    .filter(key => key !== layerDef.canonicalKey)
    .forEach(key => delete guildItem.layers[key]);

  if (layerDef.canonicalKey === 'layer1_canopy') {
    guildItem.name = `${replacement.name} Guild`;
    if (replacement.id) guildItem.anchor = replacement.id;
    syncThreeYearPlanCanopiesFromGuild(generatedPlan);
    displayResults(generatedPlan);
  } else {
    renderSevenLayerGuild(generatedPlan.guild);
  }

  updateSaveStateIndicator();
  closeGuildEditModal();
}

function closeGuildEditModal() {
  const modal = document.getElementById('guildEditModal');
  if (modal) modal.classList.add('hidden');
  const select = document.getElementById('guildLayerSelect');
  const layerField = select?.closest('.form-group');
  if (layerField) layerField.classList.remove('hidden');
}

// Close modal on click outside
window.addEventListener('click', (e) => {
  const modal = document.getElementById('savedSitesModal');
  if (e.target === modal) closeSavedSites();
  const guildModal = document.getElementById('guildEditModal');
  if (e.target === guildModal) closeGuildEditModal();
});

// Close modal on Escape key
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeSavedSites();
    closeGuildEditModal();
  }
});

// ── 7-LAYER GUILD RENDERER ──────────────────────────────────────────────────
function renderSevenLayerGuild(guild) {
  if (!guild || typeof guild !== 'object') return;

  const guilds = Array.isArray(guild) ? guild : [guild];
  const layerDefinitions = GUILD_LAYER_DEFINITIONS;

  const getLayerValue = (guildItem, keys) => {
    const layers = guildItem.layers || guildItem;
    for (const key of keys) {
      if (layers[key]) return layers[key];
    }
    return null;
  };

  const renderLayerPlant = (layer) => {
    if (!layer) return 'No plants selected yet';
    if (typeof layer === 'string') {
      const value = layer.trim();
      return value && value.toLowerCase() !== 'none' ? value : 'No plants selected yet';
    }
    if (Array.isArray(layer)) return layer.length ? layer.join(', ') : 'No plants selected yet';
    return layer.name || layer.plant || layer.common_name || 'No plants selected yet';
  };

  const renderLayerMeta = (layer) => {
    if (!layer || typeof layer !== 'object' || Array.isArray(layer)) return '';

    let label = '';
    let badgeClass = '';
    if (layer.tier === 'Anchor') {
      const isChosen = layer.selection_reason === 'Chosen by you';
      const hasClimateWarning = Boolean(layer.climate_warning);
      label = (isChosen ? 'Chosen by you' : 'Suggested') + (hasClimateWarning ? ' · climate warning' : ' · Canopy anchor');
      badgeClass = hasClimateWarning ? 'climate-warning' : (isChosen ? 'chosen-by-you' : 'suggested-anchor');
    } else if (layer.tier === 'A') {
      label = 'Mineral match' + (layer.salt_content ? ' · ' + layer.salt_content : '');
      badgeClass = 'mineral-match';
    } else if (layer.tier === 'B') {
      label = 'Climate fit · Support plant';
      badgeClass = 'climate-fit';
    } else if (layer.selection_reason) {
      label = layer.selection_reason;
    }

    const minerals = layer.minerals || layer.cell_salts || [];
    const displayedMinerals = Array.isArray(minerals)
      ? minerals.filter(mineral => String(mineral).toLowerCase() !== String(layer.salt_content || '').toLowerCase())
      : [];
    const mineralText = displayedMinerals.length
      ? displayedMinerals.join(', ')
      : '';
    const roles = layer.functions || layer.roles || [];
    const roleText = Array.isArray(roles) && roles.length
      ? roles.map(role => String(role).replace(/_/g, ' ')).join(', ')
      : '';
    const mineralLabel = layer.salt_content ? 'Other minerals: ' : 'Mineral profile: ';
    const mineralValue = mineralText
      ? mineralText
      : (layer.salt_content ? 'None mapped' : 'Not mapped yet');
    const roleValue = roleText || 'Not mapped yet';

    const metaParts = [];
    if (label) metaParts.push('<span class="guild-badge ' + escapeHtml(badgeClass) + '">' + escapeHtml(label) + '</span>');
    metaParts.push('<span>' + escapeHtml(mineralLabel) + escapeHtml(mineralValue) + '</span>');
    metaParts.push('<span>Role: ' + escapeHtml(roleValue) + '</span>');
    if (layer.climate_warning) {
      const warning = layer.climate_warning;
      const alternatives = Array.isArray(warning.alternatives) && warning.alternatives.length
        ? '<span><strong>Better-fit alternatives:</strong> ' + escapeHtml(warning.alternatives.join(', ')) + '</span>'
        : '';
      metaParts.push(
        '<div class="guild-climate-warning">' +
          '<span><strong>Climate note:</strong> ' + escapeHtml(warning.reason || 'This user-selected canopy may be marginal for the mapped site climate.') + '</span>' +
          alternatives +
        '</div>'
      );
    }

    return metaParts.length
      ? '<div class="guild-plant-meta">' + metaParts.join('') + '</div>'
      : '';
  };

  const renderComparisonColumn = (label, layer, className) => {
    const plantName = renderLayerPlant(layer);
    const meta = renderLayerMeta(layer);
    return '<div class="guild-comparison-column ' + className + '">' +
      '<div class="guild-comparison-label">' + escapeHtml(label) + '</div>' +
      '<div class="guild-comparison-plant">' + escapeHtml(plantName) + '</div>' +
      (meta || '<div class="guild-plant-meta"><span>Mineral profile: Not mapped yet</span><span>Role: Not mapped yet</span></div>') +
    '</div>';
  };

  const formatGuildTitle = (guildItem, index) => {
    const rawTitle = guildItem.name || guildItem.anchor || `Guild ${index + 1}`;
    return String(rawTitle)
      .replace(/_/g, ' ')
      .replace(/\s+Guild$/i, '')
      .trim()
      .replace(/\b\w/g, char => char.toUpperCase()) + ' Guild';
  };

  const htmlParts = [];

  guilds.forEach((guildItem, index) => {
    const title = formatGuildTitle(guildItem, index);
    const hasPendingEdits = hasPendingGuildEdits(index);
    const isEditMode = activeGuildEditIndex === index;
    htmlParts.push('<div class="seven-layer-card guild-card' + (hasPendingEdits ? ' pending-edit' : '') + (isEditMode ? ' edit-mode' : '') + '">');
    htmlParts.push('  <div class="guild-card-header">');
    htmlParts.push('    <h4 style="margin:0;">' + escapeHtml(title) + '</h4>');
    htmlParts.push('    <div class="guild-card-actions">');
    htmlParts.push('      <button class="btn btn-guild-save' + (hasPendingEdits ? '' : ' hidden') + '" type="button" data-guild-index="' + index + '" onclick="saveGuildEdits(' + index + ')"' + (hasPendingEdits ? '' : ' disabled') + '>Save Guild</button>');
    htmlParts.push('      <button class="btn btn-guild-edit" type="button" data-guild-index="' + index + '" onclick="toggleGuildEditMode(' + index + ')">' + (isEditMode ? 'Done' : 'Edit') + '</button>');
    htmlParts.push('    </div>');
    htmlParts.push('  </div>');
    if (isEditMode) htmlParts.push('  <p class="guild-edit-hint">Select a layer to edit</p>');
    htmlParts.push('  <div class="layer-grid" style="display:grid;gap:8px;">');

    layerDefinitions.forEach(layerDef => {
      const layer = getLayerValue(guildItem, layerDef.keys);
      const dirtyKey = `${index}:${layerDef.canonicalKey}`;
      const hasUnsavedLayerEdit = dirtyGuildLayers.has(dirtyKey);
      htmlParts.push('    <div class="guild-layer-card layer-card' + (hasUnsavedLayerEdit ? ' pending-edit' : '') + (isEditMode ? ' selectable' : '') + '"' + (isEditMode ? ' role="button" tabindex="0" data-guild-index="' + index + '" data-layer-key="' + escapeHtml(layerDef.canonicalKey) + '" onclick="openGuildEditModal(' + index + ', \'' + escapeHtml(layerDef.canonicalKey) + '\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();openGuildEditModal(' + index + ', \'' + escapeHtml(layerDef.canonicalKey) + '\');}"' : '') + '>');
      htmlParts.push('      <strong style="font-size:0.95em;">' + escapeHtml(layerDef.label) + (hasUnsavedLayerEdit ? ' <span class="unsaved-edit-badge">Unsaved edit</span>' : '') + '</strong>');
      if (hasUnsavedLayerEdit) {
        const originalLayer = originalGuildLayers.has(dirtyKey) ? originalGuildLayers.get(dirtyKey) : null;
        htmlParts.push('      <div class="guild-layer-comparison">');
        htmlParts.push('        ' + renderComparisonColumn('Original', originalLayer, 'original'));
        htmlParts.push('        ' + renderComparisonColumn('Pending', layer, 'pending'));
        htmlParts.push('      </div>');
      } else {
        htmlParts.push('      <span style="font-size:1.05em;">' + escapeHtml(renderLayerPlant(layer)) + '</span>');
        const meta = renderLayerMeta(layer);
        if (meta) htmlParts.push('      ' + meta);
      }
      htmlParts.push('    </div>');
    });

    htmlParts.push('  </div>');
    htmlParts.push('</div>');
  });

  document.getElementById('sevenLayerGuild').innerHTML = htmlParts.join('\n');
}
