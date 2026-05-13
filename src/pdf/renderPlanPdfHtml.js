const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'pdfTemplate.css');
const appleGuildImagePath = path.join(__dirname, '..', '..', 'public', 'ChatGPT Image May 10, 2026, 7 Layer Guild.png');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function toTitleCase(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b([a-z])/g, char => char.toUpperCase())
    .replace(/\bUsda\b/g, 'USDA')
    .replace(/\bPh\b/g, 'pH')
    .replace(/\bPdf\b/g, 'PDF');
}

function cleanDisplayName(value) {
  return toTitleCase(
    String(value ?? '')
      .replace(/\[id:\s*[^\]]+\]/gi, '')
      .replace(/\[(?:proposed|fallback|warning)\]/gi, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\s+$/g, '')
  );
}

function formatDisplayTitle(value) {
  return cleanDisplayName(value);
}

function formatScale(value) {
  return formatDisplayTitle(value) || 'Not Specified';
}

function formatScaleLabel(value) {
  return formatScale(value);
}

function getPlanScale(plan = {}) {
  return plan.siteInfo?.scale || plan.scale || plan.propertySize || '';
}

function formatReason(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

  const labels = {
    'cell salt theme match': 'Cell-Salt Theme Match',
    'zone/climate fallback': 'Zone/Climate Fallback',
    'chosen by you': 'Chosen By You',
    'suggested anchor': 'Suggested Anchor',
    'mineral match': 'Mineral Match'
  };

  return labels[normalized] || formatDisplayTitle(value);
}

function formatPhase(value, key) {
  const yearLabels = {
    year0: 'Year 1',
    year1: 'Year 2',
    year2: 'Year 3'
  };
  const rawPhase = String(value || key || '').trim();
  const normalizedPhase = rawPhase.toLowerCase().replace(/\s+/g, ' ');
  const phaseLabels = {
    'canopy & infrastructure': 'Canopy & Infrastructure',
    'sub-canopy, herbaceous & vines': 'Sub-Canopy, Herbaceous & Vines',
    'ground cover, roots & first harvests': 'Ground Cover, Roots & First Harvests'
  };
  const phaseTitle = phaseLabels[normalizedPhase] || formatDisplayTitle(rawPhase);
  const yearLabel = yearLabels[key] || formatDisplayTitle(key);
  return phaseTitle ? `${yearLabel} — ${phaseTitle}` : yearLabel;
}

function formatSentenceCase(value) {
  const cleaned = String(value ?? '')
    .replace(/\[id:\s*[^\]]+\]/gi, '')
    .replace(/\[(?:proposed|fallback|warning)\]/gi, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s*&\s*/g, ' and ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\busda\b/g, 'USDA')
    .replace(/\bph\b/g, 'pH')
    .replace(/\bpdf\b/g, 'PDF');

  if (!cleaned) return '';
  const sentence = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

function getYearFocus(key, year = {}) {
  const defaults = {
    year0: 'Soil, water, access, mulch, and anchor trees.',
    year1: 'Support species, sub-canopy, shrubs, herbaceous plants, and vines.',
    year2: 'Ground covers, root crops, guild completion, and first harvest rhythms.'
  };
  return year.focus ? formatSentenceCase(year.focus) : defaults[key] || 'Seasonal establishment tasks and site observations.';
}

function getSeasonCue(timing = '') {
  const value = String(timing || '').toLowerCase();
  if (/winter|dormant|month 0|baseline|soil test/.test(value)) return 'Late Winter';
  if (/spring|wet season|rain|plant|month [1-4]/.test(value)) return 'Spring';
  if (/summer|active growth|irrigat|mulch|month [5-8]/.test(value)) return 'Summer';
  if (/fall|autumn|harvest|storage|month (9|10|11|12)/.test(value)) return 'Fall';
  if (/year-round|year round/.test(value)) return 'Year-Round';
  return 'Seasonal Cue';
}

function formatZodiacSign(value) {
  return cleanDisplayName(value);
}

function formatAddress(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const stateNames = new Set([
    'al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'fl', 'ga', 'hi', 'id',
    'il', 'in', 'ia', 'ks', 'ky', 'la', 'me', 'md', 'ma', 'mi', 'mn', 'ms',
    'mo', 'mt', 'ne', 'nv', 'nh', 'nj', 'nm', 'ny', 'nc', 'nd', 'oh', 'ok',
    'or', 'pa', 'ri', 'sc', 'sd', 'tn', 'tx', 'ut', 'vt', 'va', 'wa', 'wv',
    'wi', 'wy', 'dc'
  ]);

  return raw
    .replace(/\s+/g, ' ')
    .split(',')
    .map((part, index) => {
      const trimmed = part.trim().replace(/\.+/g, '.');
      if (!trimmed) return '';
      if (index > 0 && stateNames.has(trimmed.toLowerCase())) return trimmed.toUpperCase();

      return trimmed
        .toLowerCase()
        .replace(/\b([a-z])/g, char => char.toUpperCase())
        .replace(/\b([NSEW])\b\.?/g, '$1.')
        .replace(/\b([A-Z])\.\./g, '$1.')
        .replace(/\bFl\b/g, 'FL')
        .replace(/\bUsa\b/g, 'USA');
    })
    .filter(Boolean)
    .join(', ');
}

function plantName(value) {
  if (!value) return '';
  if (typeof value === 'string') return cleanDisplayName(value);
  return cleanDisplayName(value.name || value.common_name || value.plant || value.id || '');
}

function formatList(values) {
  return asArray(values)
    .map(value => typeof value === 'string' ? cleanDisplayName(value) : plantName(value))
    .filter(Boolean)
    .join(', ');
}

function tags(values) {
  return asArray(values)
    .filter(Boolean)
    .slice(0, 8)
    .map(value => `<span class="tag">${escapeHtml(cleanDisplayName(value))}</span>`)
    .join('');
}

function table(headers, rows, className = '') {
  return `
    <table class="${className}">
      <thead><tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>
  `;
}

function imageToDataUri(filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = ext === '.jpg' || ext === '.jpeg'
      ? 'image/jpeg'
      : ext === '.webp'
        ? 'image/webp'
        : 'image/png';
    const base64 = fs.readFileSync(filePath).toString('base64');
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    return '';
  }
}

function formatSunCalcDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

function buildSunCalcUrl(locationData = {}, date = new Date()) {
  const latitude = Number(locationData.latitude);
  const longitude = Number(locationData.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return '';

  return `https://www.suncalc.org/#/${latitude.toFixed(4)},${longitude.toFixed(4)},17/${formatSunCalcDate(date)}/12:00/1/3`;
}

function hasCoordinates(locationData = {}) {
  return Number.isFinite(Number(locationData.latitude)) && Number.isFinite(Number(locationData.longitude));
}

function isTrustedSunCalcLocation(locationData = {}) {
  return locationData.geocodeConfidence === 'exact' ||
    locationData.geocodeConfidence === 'verified' ||
    locationData.geocodeConfidence === 'user-confirmed' ||
    isMapboxPropertyLevelDisplay(locationData);
}

function isMapboxPropertyLevelDisplay(locationData = {}) {
  const provider = String(locationData.provider || '').toLowerCase();
  const featureType = String(locationData.featureType || '').toLowerCase();
  const accuracy = String(locationData.accuracy || '').toLowerCase();
  const confidence = String(locationData.matchCode?.confidence || '').toLowerCase();

  return provider === 'mapbox' &&
    (locationData.userSelectedAddress || locationData.mapboxId || locationData.providerPlaceId) &&
    featureType === 'address' &&
    ['rooftop', 'parcel', 'point'].includes(accuracy) &&
    (!confidence || ['exact', 'high'].includes(confidence));
}

function formatGeocodeConfidence(locationData = {}) {
  if (isMapboxPropertyLevelDisplay(locationData)) {
    return 'Property-level';
  }

  switch (locationData.geocodeConfidence) {
    case 'exact':
      return 'Exact property-level result';
    case 'verified':
      return 'Provider-verified property-level result';
    case 'user-confirmed':
      return 'User-confirmed';
    case 'approximate':
    case 'city':
      return 'Approximate';
    default:
      return hasCoordinates(locationData) ? 'Unknown - confirm before sun/shadow planning' : 'Unavailable';
  }
}

function formatCoordinateSource(locationData = {}) {
  if (locationData.provider === 'manual' || locationData.userConfirmedCoordinates) return 'Manual';
  if (locationData.provider === 'mapbox') return isMapboxPropertyLevelDisplay(locationData) ? 'Mapbox' : 'Mapbox approximate';
  if (locationData.provider === 'nominatim') return 'Nominatim fallback';
  return locationData.isApproximate ? 'Approximate' : 'Unknown';
}

const shortMedicalDisclaimer = 'Tissue-salt correspondences are used here for planting-design context only, not as medical advice or health guidance.';
const tissueSaltDisclaimer = 'This plan uses Carey/Schuessler tissue-salt correspondences for planting-design context only. It does not provide medical advice, diagnosis, treatment guidance, supplement advice, dosage recommendations, or instructions for using tissue salts for health purposes.';

function renderVineDivider() {
  return `
    <div class="botanical-divider" aria-hidden="true">
      <span class="divider-line"></span>
      <svg class="divider-leaf" viewBox="0 0 112 24" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">
        <path d="M2 15 C24 2, 45 2, 57 13 S91 23, 110 8" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>
        <path d="M24 10 C16 0, 5 3, 7 15 C15 17, 21 15, 24 10Z" fill="currentColor" opacity="0.34"/>
        <path d="M43 8 C36 -2, 24 0, 26 13 C34 15, 40 13, 43 8Z" fill="currentColor" opacity="0.3"/>
        <path d="M66 14 C72 4, 84 4, 86 16 C78 20, 70 19, 66 14Z" fill="currentColor" opacity="0.32"/>
        <path d="M88 12 C94 4, 105 5, 107 16 C100 19, 92 18, 88 12Z" fill="currentColor" opacity="0.28"/>
        <path d="M56 13 C55 8, 59 5, 63 5" fill="none" stroke="currentColor" stroke-width="0.9" stroke-linecap="round" opacity="0.7"/>
      </svg>
      <span class="divider-line"></span>
    </div>
  `;
}

function renderCornerVine(position = 'top-right') {
  return `
    <svg class="corner-vine corner-vine-${escapeHtml(position)}" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">
      <path class="vine-stem" d="M166 14H70C35 14 16 34 16 68v98"/>
      <path class="vine-stem vine-secondary" d="M17 70C34 43 58 34 87 36"/>
      <path class="vine-stem vine-tendril" d="M88 36C106 34 111 51 98 56C87 60 82 48 92 43"/>
      <path class="vine-stem vine-tendril" d="M42 45C33 36 37 24 48 25C58 26 59 38 51 42"/>
      <path class="vine-leaf" d="M44 39C34 18 14 20 15 43C26 50 38 48 44 39Z"/>
      <path class="vine-leaf" d="M72 33C64 14 44 13 43 34C53 43 64 42 72 33Z"/>
      <path class="vine-leaf" d="M29 74C10 63 1 78 11 93C22 92 30 86 29 74Z"/>
      <path class="vine-leaf" d="M96 39C106 22 127 24 127 46C115 51 104 49 96 39Z"/>
      <path class="vine-leaf" d="M55 55C65 41 83 48 79 66C69 69 60 65 55 55Z"/>
      <path class="vine-leaf" d="M17 112C3 102 -6 116 2 130C13 128 19 122 17 112Z"/>
    </svg>
  `;
}

function sectionTitle(title) {
  return `<h2>${escapeHtml(title)}</h2>${renderVineDivider()}`;
}

function renderPlanSummary(plan, propertyMap = {}) {
  const site = plan.siteInfo || {};
  const scaleLabel = formatScaleLabel(getPlanScale(plan));
  const climate = plan.climateData || {};
  const guildCount = asArray(plan.guild).length;
  const plantCount = asArray(plan.recommendedPlants).length;

  return `
    <section class="page">
      ${sectionTitle('Plan Summary')}
      <div class="section-grid">
        <div class="callout">
          <h3>Project Snapshot</h3>
          <p><strong>Scale:</strong> ${escapeHtml(scaleLabel)}</p>
          <p><strong>Primary sun sign:</strong> ${escapeHtml(formatZodiacSign(site.sunSign) || 'Not specified')}</p>
          <p><strong>Guilds:</strong> ${guildCount || 'Pending'}</p>
          <p><strong>Recommended plants:</strong> ${plantCount || 'Pending'}</p>
        </div>
        <div class="callout">
          <h3>Climate Snapshot</h3>
          <p><strong>USDA zone:</strong> ${escapeHtml(climate.hardinessZone || 'Unknown')}</p>
          <p><strong>Köppen climate:</strong> ${escapeHtml(climate.koppenCode || 'Unknown')} ${climate.koppenDescription ? `- ${escapeHtml(climate.koppenDescription)}` : ''}</p>
          <p><strong>Growing season:</strong> ${escapeHtml(climate.growingSeasonDays || 'Unknown')} ${climate.growingSeasonDays ? 'days' : ''}</p>
        </div>
      </div>
      <h3>Design Intent</h3>
      <p>This Complete Food Forest Plan organizes the generated site profile, tissue-salt mineral themes, climate-fit guilds, implementation phases, moon planting guidance, and printable field worksheets into one working document.</p>
      <p>This plan uses a Carey/Schuessler-inspired tissue-salt correspondence framework as one layer of the planting design process.</p>
      <p class="disclaimer">${shortMedicalDisclaimer}</p>
      <h3>Property Map</h3>
      ${renderPropertyMapCard(plan, propertyMap, 'compact')}
    </section>
  `;
}

function renderPropertyMapCard(plan, propertyMap = {}, variant = '') {
  const site = plan.siteInfo || {};
  const loc = plan.locationData || {};
  const address = formatAddress(loc.formattedAddress || site.address) || 'Address not provided';
  const coordinates = hasCoordinates(loc)
    ? `${Number(loc.latitude).toFixed(4)}, ${Number(loc.longitude).toFixed(4)}`
    : 'Not available';
  const propertyLevelMapbox = isMapboxPropertyLevelDisplay(loc);
  const showCoordinateWarning = (loc.isApproximate || loc.geocodeWarning) && !propertyLevelMapbox;
  const mapContent = propertyMap.dataUri
    ? `<img class="property-map-image" src="${propertyMap.dataUri}" alt="Static property map with location marker">`
    : `<div class="property-map-placeholder">Property map unavailable. Coordinates are listed below.</div>`;
  const cardClass = ['property-map-card', variant ? `property-map-card-${variant}` : ''].filter(Boolean).join(' ');

  return `
    <div class="${cardClass}">
      ${mapContent}
      <div class="property-map-details">
        <p><strong>Address:</strong> ${escapeHtml(address)}</p>
        <p><strong>Coordinates:</strong> ${escapeHtml(coordinates)}</p>
        <p><strong>Coordinate source:</strong> ${escapeHtml(formatCoordinateSource(loc))}</p>
        ${loc.accuracy ? `<p><strong>Accuracy:</strong> ${escapeHtml(formatDisplayTitle(loc.accuracy))}</p>` : ''}
        <p><strong>Coordinate confidence:</strong> ${escapeHtml(formatGeocodeConfidence(loc))}</p>
        ${showCoordinateWarning ? `<p class="warning-text">${escapeHtml(loc.geocodeWarning || 'Exact property address was not resolved. Confirm coordinates before using SunCalc or shade planning.')}</p>` : ''}
      </div>
      <p class="map-attribution">${escapeHtml(propertyMap.attribution || 'Map data © OpenStreetMap contributors, imagery/style © Mapbox')}</p>
    </div>
  `;
}

function renderSiteClimate(plan) {
  const site = plan.siteInfo || {};
  const scaleLabel = formatScaleLabel(getPlanScale(plan));
  const loc = plan.locationData || {};
  const propertyLevelMapbox = isMapboxPropertyLevelDisplay(loc);
  const showCoordinateWarning = (loc.isApproximate || loc.geocodeWarning) && !propertyLevelMapbox;
  const climate = plan.climateData || {};
  const frost = climate.frostDates || {};
  const family = asArray(site.familyMembers).map(member => formatZodiacSign(member.sunSign || member.name)).filter(Boolean);

  return `
    <section class="page">
      ${sectionTitle('Site + Climate Profile')}
      ${table(['Field', 'Value'], [
        ['Address', escapeHtml(formatAddress(site.address || loc.formattedAddress) || 'Not provided')],
        ['Geocoded address', escapeHtml(formatAddress(loc.formattedAddress) || 'Not available')],
        ['Coordinates', escapeHtml(hasCoordinates(loc) ? `${Number(loc.latitude).toFixed(4)}, ${Number(loc.longitude).toFixed(4)}` : 'Not available')],
        ['Coordinate source', escapeHtml(formatCoordinateSource(loc))],
        ...(loc.accuracy ? [['Accuracy', escapeHtml(formatDisplayTitle(loc.accuracy))]] : []),
        ['Coordinate confidence', escapeHtml(formatGeocodeConfidence(loc))],
        ...(showCoordinateWarning ? [['Warning', escapeHtml(loc.geocodeWarning || 'Exact property address was not resolved. Confirm coordinates before using SunCalc or shade planning.')]] : []),
        ['Scale', escapeHtml(scaleLabel)],
        ['Sun sign profile', escapeHtml([formatZodiacSign(site.sunSign), ...family].filter(Boolean).join(', ') || 'Not specified')],
        ['USDA hardiness zone', escapeHtml(climate.hardinessZone || 'Unknown')],
        ['Average annual minimum', escapeHtml(climate.avgAnnualMinTempF !== null && climate.avgAnnualMinTempF !== undefined ? `${climate.avgAnnualMinTempF} F / ${climate.avgAnnualMinTempC} C` : 'Unknown')],
        ['Köppen climate', escapeHtml([climate.koppenCode, climate.koppenDescription].filter(Boolean).join(' - ') || 'Unknown')],
        ['Growing season', escapeHtml(climate.growingSeasonDays ? `${climate.growingSeasonDays} days` : 'Unknown')],
        ['Light frost dates', escapeHtml(frost.light ? `${frost.light.avgLastSpringFrost || 'Unknown'} to ${frost.light.avgFirstFallFrost || 'Unknown'}` : 'Unknown')],
        ['Hard frost dates', escapeHtml(frost.hard ? `${frost.hard.avgLastSpringFrost || 'Unknown'} to ${frost.hard.avgFirstFallFrost || 'Unknown'}` : 'Unknown')],
        ['Climate data source', escapeHtml(climate.source || 'Unknown')]
      ])}
    </section>
  `;
}

function renderSunAnalysis(plan) {
  const loc = plan.locationData || {};
  const sunCalcUrl = buildSunCalcUrl(loc);
  const trustedLocation = isTrustedSunCalcLocation(loc);
  let sunCalcContent = '<p class="muted">SunCalc link unavailable because coordinates are missing.</p>';

  if (sunCalcUrl && trustedLocation) {
    sunCalcContent = `
      <p>Use SunCalc to inspect sunrise, sunset, solar noon, seasonal shadows, and sun angle for this property.</p>
      <p><a class="pdf-link-button" href="${escapeHtml(sunCalcUrl)}">View Sun Path for This Property</a></p>
      <p class="small raw-url">${escapeHtml(sunCalcUrl)}</p>
    `;
  } else if (sunCalcUrl) {
    sunCalcContent = `
      <p class="warning">SunCalc link uses approximate coordinates. Confirm the property location before using this for shade planning.</p>
      <p><a class="pdf-link-button" href="${escapeHtml(sunCalcUrl)}">View Approximate Sun Path</a></p>
      <p class="small raw-url">${escapeHtml(sunCalcUrl)}</p>
    `;
  }

  return `
    <section class="page">
      ${sectionTitle('Sun + Shadow Analysis')}
      <div class="callout">
        <p><strong>Coordinates:</strong> ${escapeHtml(hasCoordinates(loc) ? `${Number(loc.latitude).toFixed(4)}, ${Number(loc.longitude).toFixed(4)}` : 'Not available')}</p>
        <p><strong>Coordinate confidence:</strong> ${escapeHtml(formatGeocodeConfidence(loc))}</p>
        <p>Use these coordinates as the reference point for field observation, seasonal shadow mapping, and future printable solar diagrams.</p>
      </div>
      <div class="callout suncalc-callout">
        <h3>Open This Site in SunCalc</h3>
        ${sunCalcContent}
      </div>
      <p>Detailed printable sun/shadow analysis will be expanded in a future PDF version.</p>
      ${table(['Observation', 'Morning', 'Midday', 'Afternoon', 'Notes'], [
        ['Winter shade', '', '', '', ''],
        ['Summer shade', '', '', '', ''],
        ['Wind exposure', '', '', '', ''],
        ['Wet / dry zones', '', '', '', '']
      ])}
    </section>
  `;
}

function renderCellSalts(plan) {
  const salts = asArray(plan.cellSalts?.deficient);
  return `
    <section class="page">
      ${sectionTitle('Carey/Schuessler Tissue-Salt Mineral Themes')}
      <p>The twelve tissue salts are inorganic mineral salts traditionally associated with zodiacal, constitutional, and functional correspondences. In this PDF, those correspondences are used to organize planting themes, guild roles, mineral-cycling plants, accumulator species, support plants, and ecological design emphasis.</p>
      <h3>How These Themes Influence the Guild</h3>
      <p>A tissue-salt correspondence may influence plant selection when a plant is tagged with a matching mineral theme, supports a needed food forest layer, or serves a related ecological role such as mineral cycling, living mulch, biomass production, moisture support, pollinator forage, or anchor-tree support.</p>
      <p>A tissue-salt match does not automatically override climate fit. The strongest recommendations combine hardiness zone, Köppen climate, guild layer, ecological role, and tissue-salt correspondence.</p>
      <p class="disclaimer">${tissueSaltDisclaimer}</p>
      ${salts.length ? table(['Sign', 'Tissue salt / mineral salt', 'Planting-design correspondence'], salts.map(salt => [
        escapeHtml(formatZodiacSign(salt.sign) || ''),
        escapeHtml(salt.cell_salt || ''),
        escapeHtml(salt.function || '')
      ])) : '<p>No tissue-salt mineral themes were included in this plan.</p>'}
    </section>
  `;
}

function renderGuilds(plan) {
  const guilds = asArray(plan.guild);
  const appleGuildImage = imageToDataUri(appleGuildImagePath);
  const layerLabels = {
    layer1_canopy: 'Layer 1 - Canopy',
    layer2_low_tree: 'Layer 2 - Low Tree',
    layer3_shrub: 'Layer 3 - Shrub',
    layer4: 'Layer 4 - Herbaceous',
    layer5: 'Layer 5 - Ground Cover',
    layer6: 'Layer 6 - Root',
    layer7: 'Layer 7 - Vine'
  };

  return `
    <section class="page">
      ${sectionTitle('7-Layer Guild Design')}
      <p class="muted">The illustration below is a visual example. The generated guild tables that follow are based on the current plan data.</p>
      ${appleGuildImage ? `
        <figure class="guild-illustration-figure">
          <img class="guild-illustration" src="${appleGuildImage}" alt="The 7-Layer Apple Guild">
          <figcaption>Visual Example: 7-Layer Apple Guild</figcaption>
        </figure>
      ` : ''}
      ${guilds.length ? guilds.map((guild, index) => `
        <div class="guild-card guild-section">
          <h3>${escapeHtml(cleanDisplayName(guild.name || `Guild ${index + 1}`))}</h3>
          <p><strong>Anchor:</strong> ${escapeHtml(plantName(guild.anchor || guild.layers?.layer1_canopy) || 'Not specified')}</p>
          ${table(['Layer', 'Plant', 'Role / Reason', 'Mineral Themes'], Object.entries(layerLabels).map(([key, label]) => {
            const layer = guild.layers?.[key];
            return [
              escapeHtml(label),
              escapeHtml(plantName(layer) || 'Open'),
              escapeHtml(typeof layer === 'object' ? (formatReason(layer.selection_reason || '') || formatList(layer.functions)) : ''),
              tags(typeof layer === 'object' ? layer.minerals : [])
            ];
          }))}
        </div>
      `).join('') : '<p>No guild data was included in this plan.</p>'}
    </section>
  `;
}

function renderPlants(plan) {
  const plants = asArray(plan.recommendedPlants).slice(0, 60);
  const rows = plants.map(plant => [
    escapeHtml(plantName(plant) || 'Plant'),
    escapeHtml(cleanDisplayName(plant.taxonomy?.layer || plant.layer || plant.preference_group || plant.type || 'General')),
    escapeHtml(formatReason(plant.selection_reason || plant.recommendation_source || plant.matchLabels?.join(', ') || 'Climate and theme fit')),
    tags(plant.minerals || plant.bio_logic?.salts),
    escapeHtml(formatList(plant.functions || plant.roles || plant.permaculture_role?.functions))
  ]);

  return `
    <section class="page">
      ${sectionTitle('Recommended Plants')}
      <p class="muted">Scan this table as a purchasing and substitution shortlist. Confirm local availability, chill-hour needs, nursery quality, and invasive status before buying.</p>
      ${plants.length ? table(['Plant', 'Layer / Type', 'Reason', 'Mineral Themes', 'Correspondence Notes'], rows, 'plants-table') : '<p>No recommended plants were included in this plan.</p>'}
    </section>
  `;
}

function renderWarnings(plan) {
  const warnings = [];
  asArray(plan.guild).forEach(guild => {
    Object.values(guild.layers || {}).forEach(layer => {
      if (layer && typeof layer === 'object' && layer.climate_warning) {
        warnings.push({
          plant: plantName(layer),
          warning: layer.climate_warning.warning || layer.climate_warning.message || 'Climate caution',
          alternatives: asArray(layer.climate_warning.alternatives).map(plantName).filter(Boolean)
        });
      }
    });
    asArray(guild.warnings).forEach(warning => warnings.push({ plant: cleanDisplayName(guild.name || 'Guild'), warning, alternatives: [] }));
  });

  return `
    <section class="page">
      ${sectionTitle('Climate Warnings + Substitutions')}
      ${warnings.length ? table(['Plant / Guild', 'Warning', 'Suggested substitutions'], warnings.map(item => [
        escapeHtml(item.plant),
        escapeHtml(item.warning),
        escapeHtml(formatList(item.alternatives) || 'Use local nursery guidance and climate-fit registry alternatives.')
      ])) : '<p>No explicit climate warnings were generated. Continue checking local frost, chill-hour, rainfall, pest, and nursery guidance before purchasing plants.</p>'}
    </section>
  `;
}

function renderThreeYearPlan(plan) {
  const years = plan.threeYearPlan || {};
  const yearKeys = ['year0', 'year1', 'year2'];
  const yearSections = yearKeys.map((key, index) => {
    const year = years[key] || {};
    const phaseLabel = formatPhase(year.title, key || `year${index}`);
    const tasks = asArray(year.tasks);
    if (!tasks.length) return '';

    const rows = tasks.map(task => [
      '<span class="task-check">□</span>',
      escapeHtml(getSeasonCue(task.timing || year.duration || year.timeframe || '')),
      escapeHtml(task.timing || year.duration || year.timeframe || ''),
      escapeHtml(task.task || ''),
      escapeHtml(formatList(task.plants)),
      escapeHtml(task.details || task.guild_note || '')
    ]);

    return `
      <div class="roadmap-year">
        <div class="roadmap-year-header">
          <h3>${escapeHtml(phaseLabel)}</h3>
          <p><strong>Focus:</strong> ${escapeHtml(getYearFocus(key, year))}</p>
        </div>
        ${table(['', 'Season', 'Timing', 'Task', 'Plants', 'Notes'], rows, 'roadmap-table')}
      </div>
    `;
  }).filter(Boolean).join('');

  return `
    <section class="page implementation-page ornamented botanical-watermark">
      ${renderCornerVine('top-right')}
      ${renderCornerVine('bottom-left')}
      ${sectionTitle('3-Year Implementation Plan')}
      <p>This schedule is organized as a three-year establishment plan. Year 1 focuses on soil, water, access, mulch, and anchor plants. Year 2 fills in support species, mid-story, herbaceous plants, and vines. Year 3 completes ground cover, root crops, living mulch, and first harvest rhythms.</p>
      ${yearSections || '<p>No implementation tasks were included in this plan.</p>'}
    </section>
  `;
}

function renderBudget() {
  const categories = [
    'Soil test / site assessment',
    'Compost / soil amendments',
    'Mulch / wood chips',
    'Canopy trees',
    'Sub-canopy trees',
    'Shrubs',
    'Herbaceous plants',
    'Ground covers',
    'Root crops',
    'Vines',
    'Seeds',
    'Irrigation / hoses / drip',
    'Rain catchment',
    'Tools',
    'Fencing / protection',
    'Trellis / supports',
    'Labels / mapping supplies',
    'Labor',
    'Miscellaneous'
  ];

  return `
    <section class="page budget-page ornamented">
      ${renderCornerVine('top-right')}
      ${renderCornerVine('bottom-left')}
      ${sectionTitle('Budget & Cost Tracker')}
      ${table(['Budget Summary', 'Amount'], [
        ['Estimated Total Budget', '$____'],
        ['Spent So Far', '$____'],
        ['Remaining', '$____'],
        ['Funding Goal', '$____']
      ])}
      ${table(['Item', 'Category', 'Phase', 'Estimated Cost', 'Actual Cost', 'Source', 'Notes'], categories.map(category => [
        '',
        escapeHtml(category),
        '',
        '$',
        '$',
        '',
        ''
      ]))}
    </section>
  `;
}

function renderMoon(plan) {
  const moon = plan.moonCalendar || {};
  const rows = Object.entries(moon).map(([key, value]) => [
    escapeHtml(key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())),
    escapeHtml(value.phase || ''),
    escapeHtml(value.action || ''),
    escapeHtml([...asArray(value.plant), ...asArray(value.tasks)].filter(Boolean).join(', '))
  ]);

  return `
    <section class="page moon-page ornamented">
      ${renderCornerVine('top-right')}
      ${sectionTitle('Moon Planting Guidance')}
      <p>This section gives broad correspondence-based timing guidance for planning, planting, pruning, harvesting, and observation.</p>
      ${rows.length ? table(['Cycle', 'Phase', 'Action', 'Planting / Tasks'], rows) : '<p>No moon planting guidance was included in this plan.</p>'}
    </section>
  `;
}

function blankRows(count, columns) {
  return Array.from({ length: count }, () => Array.from({ length: columns }, () => ''));
}

function renderWorksheets() {
  return `
    <section class="page worksheet-page ornamented botanical-watermark">
      ${renderCornerVine('top-right')}
      ${renderCornerVine('bottom-left')}
      ${sectionTitle('Printable Worksheets')}
      <div class="worksheet-box">
        <h3>Site Notes</h3>
        ${table(['Zone / Feature', 'Observation', 'Action'], blankRows(7, 3), 'worksheet-table tall-rows')}
      </div>
      <div class="worksheet-box">
        <h3>Soil Test Results</h3>
        ${table(['Test Area', 'pH', 'Organic Matter', 'N', 'P', 'K', 'Notes'], blankRows(6, 7), 'worksheet-table')}
      </div>
      <div class="worksheet-box">
        <h3>My 7-Layer Guild</h3>
        ${table(['Layer', 'Selected Plant', 'Role', 'Spacing', 'Notes'], [
          ['Canopy', '', '', '', ''],
          ['Sub-canopy', '', '', '', ''],
          ['Shrub', '', '', '', ''],
          ['Herbaceous', '', '', '', ''],
          ['Ground cover', '', '', '', ''],
          ['Root', '', '', '', ''],
          ['Vine', '', '', '', '']
        ], 'worksheet-table')}
      </div>
    </section>
    <section class="page worksheet-page ornamented botanical-watermark">
      ${renderCornerVine('top-right')}
      ${renderCornerVine('bottom-left')}
      ${sectionTitle('Printable Worksheets')}
      <div class="worksheet-box">
        <h3>Plant Substitutions</h3>
        ${table(['Original Plant', 'Substitution', 'Reason', 'Source', 'Notes'], blankRows(8, 5), 'worksheet-table')}
      </div>
      <div class="worksheet-box">
        <h3>First-Year Budget</h3>
        ${table(['Item', 'Category', 'Estimate', 'Actual', 'Purchased?', 'Notes'], blankRows(9, 6), 'worksheet-table')}
      </div>
      <div class="worksheet-box">
        <h3>Moon Cycle Notes</h3>
        ${table(['Date', 'Moon Phase', 'Task', 'Result / Observation'], blankRows(7, 4), 'worksheet-table tall-rows')}
      </div>
      <div class="worksheet-box">
        <h3>Observation Log</h3>
        ${table(['Date', 'Weather', 'Plant / Area', 'Observation', 'Next Action'], blankRows(8, 5), 'worksheet-table tall-rows')}
      </div>
    </section>
  `;
}

function renderNotes() {
  return `
    <section class="page notes-page ornamented botanical-watermark">
      ${renderCornerVine('top-right')}
      ${renderCornerVine('bottom-left')}
      ${sectionTitle('Notes + Next Steps')}
      ${table(['Done', 'Next step', 'Notes'], [
        ['□', 'Walk the site and mark shade, wet spots, wind exposure, and access paths.', ''],
        ['□', 'Confirm plant availability and local climate fit with a nursery or extension office.', ''],
        ['□', 'Collect or update soil test data before major amendments.', ''],
        ['□', 'Prioritize water, mulch, access, and protection before filling every layer.', ''],
        ['□', 'Update the plan after the first full season of observations.', '']
      ], 'checkbox-list')}
      <p class="footer-note">Generated by the Zodi-Yuga Permaculture Design Generator.</p>
    </section>
  `;
}

function renderPlanPdfHtml(plan, assets = {}) {
  const css = fs.readFileSync(cssPath, 'utf8');
  const site = plan.siteInfo || {};
  const loc = plan.locationData || {};
  const scaleLabel = formatScaleLabel(getPlanScale(plan));
  const generatedAt = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Complete Food Forest Plan</title>
  <style>${css}</style>
</head>
<body>
  <section class="page cover">
    ${renderCornerVine('cover-top-left')}
    ${renderCornerVine('cover-bottom-right')}
    <div class="brand">Zodi-Yuga Permaculture</div>
    <h1>Complete Food Forest Plan</h1>
    <p class="subtitle">A printable food forest design packet for site planning, tissue-salt mineral themes, layered guild design, implementation, budgeting, moon timing, and field notes.</p>
    <div class="cover-meta">
      <div class="meta-card"><span class="meta-label">Site</span><span class="meta-value">${escapeHtml(formatAddress(site.address || loc.formattedAddress) || 'Unnamed site')}</span></div>
      <div class="meta-card"><span class="meta-label">Scale</span><span class="meta-value">${escapeHtml(scaleLabel)}</span></div>
      <div class="meta-card"><span class="meta-label">Sun Sign Theme</span><span class="meta-value">${escapeHtml(formatZodiacSign(site.sunSign) || 'Not specified')}</span></div>
      <div class="meta-card"><span class="meta-label">Generated</span><span class="meta-value">${escapeHtml(generatedAt)}</span></div>
    </div>
  </section>
  ${renderPlanSummary(plan, assets.propertyMap || {})}
  ${renderSiteClimate(plan)}
  ${renderSunAnalysis(plan)}
  ${renderCellSalts(plan)}
  ${renderGuilds(plan)}
  ${renderPlants(plan)}
  ${renderWarnings(plan)}
  ${renderThreeYearPlan(plan)}
  ${renderBudget()}
  ${renderMoon(plan)}
  ${renderWorksheets()}
  ${renderNotes()}
</body>
</html>`;
}

module.exports = { renderPlanPdfHtml };
