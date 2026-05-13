// Client-side Permaculture App Logic
let familyMemberCount = 0;
let generatedPlan = null;
let currentSavedSite = null;
let planDirty = false;
let planSaveStatus = null;
const dirtyGuildLayers = new Set();
const originalGuildLayers = new Map();
let activeGuildEditIndex = null;
let selectedAddress = null;
let addressSuggestTimer = null;
let addressProviderConfig = { mapboxAvailable: false };
let fallbackGeocodeAllowed = false;
let addressSuggestionsCache = [];
const APP_VERSION = 'Prototype v0.1';
const THEME_STORAGE_KEY = 'permacultureTheme';
const LANGUAGE_STORAGE_KEY = 'language';
const I18N = {
  en: {
    documentTitle: 'Permaculture Design Generator',
    appTitle: '🌱 Permaculture Design Generator',
    appSubtitle: 'Symbolic Cell Salt / Mineral Theme Planting Plans',
    languageLabel: 'Language',
    translationNote: 'Spanish is a first-pass prototype translation. Plant names, registry tags, and some generated notes may remain in English.',
    prototypeLabel: 'Prototype / Early Access',
    prototypeNotice: 'Current status: plant recommendations, saved sites, guild edits, planting timeline, and Complete PDF downloads are active. Soil test interpretation is still coming soon.',
    savedSitesButton: '📂 My Saved Sites',
    darkMode: '🌙 Dark mode',
    lightMode: '☀️ Light mode',
    step1Title: 'Step 1: Location & Sun Sign',
    addressSectionTitle: 'Address',
    sunSignsSectionTitle: 'Sun Sign(s)',
    scaleSectionTitle: 'Scale',
    desiredPlantsSectionTitle: 'Desired Plants',
    propertyAddress: 'Property Address *',
    addressPlaceholder: '123 Main St, City, State ZIP',
    addressHelp: 'Used to determine hardiness zone, climate, and frost dates',
    manualCoordinatesLabel: 'Advanced: Enter coordinates manually',
    latitudePlaceholder: 'Latitude',
    longitudePlaceholder: 'Longitude',
    manualCoordinatesHelp: 'Optional but recommended when address lookup is approximate. Manual coordinates override geocoding and are used for climate, SunCalc, and PDF output.',
    addressLookupHelp: 'Select a verified address from the suggestions for accurate SunCalc and shade planning.',
    mapboxUnavailableNotice: 'Verified address search is not configured. Suggestions may be approximate; enter exact coordinates for property-level SunCalc and shade planning.',
    selectedAddressLabel: 'Selected address',
    verifiedAddressState: 'Address verified',
    unverifiedAddressState: 'Address not verified',
    approximateAddressState: 'Approximate location',
    noAddressSuggestions: 'No verified address suggestions found.',
    addressSuggestError: 'Address suggestions unavailable.',
    useTopSuggestion: 'Use top suggestion',
    useApproximateSuggestion: 'Use approximate location',
    approximateSuggestionWarning: 'This match is approximate. It can be used for rough climate planning, but not accurate SunCalc or shade planning.',
    useApproximateAnyway: 'Use approximate location anyway',
    manualCoordinatePrompt: "Can't find your address? Enter coordinates manually.",
    approximateCoordinatePrompt: 'This match is approximate. You can use it for rough climate planning or enter exact coordinates.',
    advancedCoordinateEntry: 'Advanced coordinate entry',
    selectVerifiedAddressRequired: 'Please select a verified address from the suggestions for accurate SunCalc and shade planning.',
    fallbackAddressConfirm: 'Mapbox address verification is not configured. Continue with approximate Nominatim fallback coordinates?',
    coordinateSource: 'Coordinate source',
    coordinateAccuracy: 'Accuracy',
    sourceMapbox: 'Mapbox verified',
    sourceManual: 'Manual',
    sourceNominatim: 'Nominatim fallback',
    sourceApproximate: 'Approximate',
    sunSignLabel: 'Your Sun Sign *',
    sunSignPlaceholder: 'Select your sun sign...',
    sunSignHelp: 'Uses your sun sign and neighboring signs as symbolic mineral / cell-salt themes',
    familyMembersLabel: 'Family Members (Optional)',
    familyMembersHelp: 'Add sun signs for family members to combine symbolic mineral / cell-salt themes',
    addFamilyMember: '+ Add Family Member',
    projectScale: 'Project Scale *',
    scalePlaceholder: 'Select scale...',
    desiredPlants: 'Desired Canopy Trees / Plants (optional)',
    desiredPlantsPlaceholder: 'e.g., Apple, Peach, Pawpaw',
    desiredPlantsHelp: 'Enter one or more desired canopy plants, separated by commas. Example: apple, peach, pear. Leave blank for suggested anchors.',
    next: 'Next →',
    step2Title: 'Step 2: Review & Generate',
    soilComingSoonTitle: 'Soil Test Integration — Coming Soon',
    soilComingSoonText: 'We’re preparing soil-test upload and interpretation tools. For now, generate the plan without soil-test inputs.',
    back: '← Back',
    generatePlan: '🌱 Generate Plan',
    resultsTitle: 'Your Permaculture Plan',
    saveChanges: 'Save Changes',
    saveAsNew: 'Save As New',
    openPlantingScale: 'Open Planting Timeline',
    testingPrompt: 'Testing this?',
    testingText: 'Note confusing recommendations, missing plants, bad zone matches, or features you expected. Early feedback will guide the next registry and editing passes.',
    siteInfoTitle: '📍 Site Information',
    sunAnalysisTitle: '☀️ Sun Analysis for Plants',
    cellSaltTitle: '🧪 Symbolic Cell Salt / Mineral Themes',
    howToRead: 'How to read this:',
    cellSaltDisclaimer: 'This prototype uses a Carey / Schüssler-inspired symbolic framework. It treats the sun sign and neighboring signs as mineral or cell-salt themes for planting design. These traditional associations are shown for symbolic planting-design context only. They are not health claims, diagnosis, treatment guidance, or supplement advice.',
    cellSaltNote: 'These symbolic mineral / cell-salt themes are based on your sun sign(s) and neighboring signs. Recommended plants are associated with these registry tags and mineral-theme metadata.',
    aiGuildsTitle: '🤖 AI-Designed Plant Guilds',
    sevenLayerGuildTitle: '🌿 7-Layer Edible Guild',
    whatIsGuild: 'What is a guild?',
    guildExplanation: 'A guild is a small plant community built around an anchor plant. The seven layers are canopy, sub-canopy, shrub, herbaceous, ground cover, root, and vine. Strong guilds balance food production, soil building, pollinator support, living mulch, nutrient cycling, and climate fit. Editing a layer swaps a plant while preserving the design role when possible.',
    recommendedPlantsTitle: '🌿 Recommended Plants',
    recommendedPlantsHelp: 'These candidates are ranked from the current plan\'s mineral themes plus available registry metadata. Use filters to inspect the list by role, layer, plant type, or traditional mineral/cell-salt notes. Review and save the plan before considering the list finalized.',
    freePreview: 'Free preview:',
    freePreviewText: 'This page shows a limited shortlist of recommended plants so you can review the plan structure and climate fit. The Complete PDF Plan includes the expanded plant list, plant profiles, substitutions, and detailed implementation notes.',
    finishedReviewing: 'Finished reviewing plant recommendations?',
    completePlanPrompt: 'Want the complete planting plan?',
    completePlanText: 'The Complete PDF Plan unlocks the expanded recommendation list, detailed plant notes, alternatives, and a printable implementation schedule.',
    threeYearTitle: '📅 3-Year Implementation Plan',
    moonTitle: '🌙 Basic Moon Planting Guidance',
    startOver: 'Start Over',
    printPdf: 'Download Complete PDF Plan',
    downloadCompletePdf: 'Download Complete PDF Plan',
    downloadingPdf: 'Generating PDF...',
    pdfExportNote: 'Generates a printable Complete Food Forest Plan PDF from the current plan.',
    footerText: 'Carey / Schüssler-inspired symbolic cell-salt themes for planting design',
    modalSavedSitesTitle: '📂 My Saved Sites',
    loadingSavedSites: 'Loading saved sites...',
    editGuildLayer: 'Edit Guild Layer',
    layerToEdit: 'Layer to edit',
    currentPlant: 'Current plant',
    noPlantsSelected: 'No plants selected yet',
    replacementPlant: 'Replacement plant',
    chooseLayer: 'Choose a layer to load compatible plants.',
    cancel: 'Cancel',
    apply: 'Apply',
    remove: 'Remove',
    memberNamePlaceholder: 'Name (optional)',
    generateLoadingTitle: 'Generating your permaculture plan...',
    generateLoadingText: 'Analyzing location, cell-salt themes, and planting schedules',
    fillRequired: 'Please fill in all required fields',
    generateErrorPrefix: 'Error generating plan: ',
    noPlanPlantingScale: 'Generate or open a saved plan first.',
    address: 'Address',
    scale: 'Scale',
    primarySunSign: 'Primary Sun Sign',
    familyMembers: 'Family Members',
    coordinates: 'Coordinates',
    geocoded: 'Geocoded',
    coordinateConfidence: 'Coordinate confidence',
    coordinateApproximate: 'Approximate city-level result',
    coordinateExact: 'Exact property-level result',
    coordinateUserConfirmed: 'User-confirmed coordinates',
    coordinateLegacyApproximate: 'Legacy approximate coordinates',
    coordinateUnknown: 'Unknown',
    approximateLocationWarning: 'Address resolved only to an approximate location. Enter exact latitude/longitude for accurate SunCalc and sun/shadow planning.',
    approximateCoordinatesWarning: 'Approximate coordinates: this location resolved to a city/area, not a confirmed property point. Enter exact latitude/longitude and regenerate before using SunCalc or shade planning.',
    legacyCoordinatesWarning: 'This saved plan was created before coordinate confirmation. Coordinates may be city-level. Enter exact latitude/longitude and regenerate before using SunCalc or shade planning.',
    regenerateCoordinatesPrompt: 'Enter exact latitude/longitude, then click Generate Plan again. Save the updated plan afterward.',
    editCoordinatesButton: 'Enter exact coordinates',
    hardinessZone: 'USDA Hardiness Zone',
    avgMin: 'avg min',
    koppenClimate: 'Köppen Climate',
    growingSeason: 'Est. Growing Season',
    days: 'days',
    frostDates: 'Frost Dates (30-yr avg)',
    lastSpringFrost: 'Last spring frost (32°F/0°C)',
    firstFallFrost: 'First fall frost (32°F/0°C)',
    frostFreeDays: 'Frost-free days',
    lastHardFrost: 'Last hard frost (28°F/-2°C)',
    firstHardFrost: 'First hard frost (28°F/-2°C)',
    hardFrostFreeDays: 'Hard frost-free days',
    yearsDataPrefix: 'Based on',
    yearsDataSuffix: 'years of data (1991–2020)',
    source: 'Source',
    nearestKoppen: 'nearest Köppen point',
    locationWarning: 'Location warning',
    locationMapUnavailable: 'Location map unavailable',
    locationUnavailable: 'Location unavailable.',
    locationUnavailableText: 'Recommended plants require a valid USDA hardiness zone. Please enter a valid City and State (e.g., "Duluth, MN") and try again.',
    planMineralThemes: 'Plan mineral themes',
    noMineralThemes: 'No symbolic mineral themes selected or mapped.',
    fewerMappedPlants: 'Some mineral themes may have fewer mapped plants in the current registry. The app prioritizes climate-fit and mapped matches where available.',
    unmappedContext: 'Some climate-fit plants are shown even though their cell-salt profile is not mapped yet. These are included for USDA zone, Köppen climate, layer role, and guild diversity - not because they directly match a symbolic cell-salt theme.',
    sortBy: 'Sort by',
    bestMatch: 'Best match',
    plantName: 'Plant name',
    role: 'Role',
    mineralCellSalt: 'Mineral / Cell Salt',
    layer: 'Layer',
    filterByRole: 'Filter by role',
    allRoles: 'All roles',
    filterByMineral: 'Filter by mineral',
    allMinerals: 'All minerals',
    filterByPlantType: 'Filter by plant type',
    allTypes: 'All types',
    resetFilters: 'Reset filters',
    usedInPlanNote: 'Used in this plan means the plant already appears in one of the generated guild layers. Additional candidates are compatible plants that match mineral, climate, or role needs but were not placed in the guild.',
    recommendedUsed: 'Recommended plants used in this plan',
    additionalCandidates: 'Additional recommended candidates',
    noRecommendedMatches: 'No recommended plants match the current filters.',
    showing: 'Showing',
    of: 'of',
    recommendedPlants: 'recommended plants',
    matchingFilters: 'matching current filters',
    climateFitUnmapped: 'Climate-fit recommendation. Cell-salt profile not mapped yet.',
    climateDiversity: 'Climate fit and guild diversity.',
    themeMatch: 'Theme match',
    mineralProfileUnmapped: 'Mineral profile not mapped yet',
    traditionalCellSaltNote: 'Traditional cell-salt note',
    whyShown: 'Why shown',
    layerType: 'Layer/type',
    climate: 'Climate',
    zones: 'Zones',
    metadataNotMapped: 'Metadata not mapped yet',
    timelinePlantsNote: 'These plants are pulled from the generated guild layers and may appear in more than one task because they serve multiple establishment roles.',
    canopyInfrastructure: 'Canopy & Infrastructure',
    monthsZeroTwelve: 'Months 0-12',
    task: 'Task',
    plants: 'Plants',
    recommendedAnchors: 'Recommended anchors',
    experimentalUserSelectedAnchor: 'Experimental user-selected anchor',
    experimentalUserSelectedAnchors: 'Experimental user-selected anchors',
    year1: 'Year 1',
    year2: 'Year 2',
    moonGuidanceNote: 'This prototype shows basic moon-phase planting guidance. A full date-based planting calendar with crop-specific timing is planned.',
    waxingMoon: 'Waxing Moon',
    waningMoon: 'Waning Moon',
    newMoon: 'New Moon',
    fullMoon: 'Full Moon',
    action: 'Action',
    newMoonDefault: 'Rest, observe, plan, or sow hardy greens where seasonally appropriate.',
    fullMoonDefault: 'Harvest herbs, observe plant vigor, or sow quick greens where seasonally appropriate.',
    summerPeak: 'Summer Peak',
    equinox: 'Equinox',
    winterLow: 'Winter Low',
    sunAngle: 'Sun Angle',
    shadow: 'Shadow',
    impact: 'Impact',
    plantingRecommendations: 'Planting Recommendations',
    forTree: 'for 10ft tree',
    noSavedSites: 'No saved sites yet.',
    saveSitePrompt: 'Generate a plan and click "Save As New" to store it here.',
    unnamedSite: 'Unnamed Site',
    noDescription: 'No description',
    updated: 'Updated',
    created: 'Created',
    open: '📂 Open',
    errorLoadingSites: 'Error loading sites: ',
    siteNotFound: 'Site not found',
    incompleteSite: 'Site data is incomplete (no plan found).',
    errorLoadingSite: 'Error loading site: ',
    deleteConfirmSuffix: 'This cannot be undone.',
    errorDeletingSite: 'Error deleting site: ',
    unsavedChanges: 'Unsaved changes',
    unsavedChangesTo: 'Unsaved changes to saved site:',
    saved: 'Saved:',
    loadedSavedSite: 'Loaded saved site:',
    notSavedYet: 'Not saved yet',
    siteSaveFailed: 'Site save failed',
    noPlanToSave: 'No plan to save. Generate a plan first.',
    enterSiteName: 'Enter a name for this site:',
    siteSaved: 'Site saved successfully!',
    errorSavingSite: 'Error saving site: ',
    changesSaved: 'Changes saved successfully!',
    errorSavingChanges: 'Error saving changes: ',
    pdfAlert: 'Generate or load a plan first.',
    pdfExportFailed: 'PDF export failed: ',
    edit: 'Edit',
    done: 'Done',
    saveGuild: 'Save Guild',
    selectLayerToEdit: 'Select a layer to edit',
    unsavedEdit: 'Unsaved edit',
    original: 'Original',
    pending: 'Pending',
    compatibleNeedsZone: 'Compatible replacements need a generated plan with a USDA zone.',
    loadingReplacements: 'Loading compatible replacements...',
    failedLoadCandidates: 'Failed to load replacement candidates',
    noCompatibleReplacements: 'No compatible replacements found for this layer.',
    compatibleReplacementAvailable: 'compatible replacement available.',
    compatibleReplacementsAvailable: 'compatible replacements available.',
    suggested: 'Suggested',
    chosenByYou: 'Chosen by you',
    climateWarning: 'climate warning',
    experimentalAnchor: 'experimental anchor',
    canopyAnchor: 'Canopy anchor',
    mineralMatch: 'Mineral match',
    climateFitSupport: 'Climate fit · Support plant',
    otherMinerals: 'Other minerals:',
    mineralProfile: 'Mineral profile:',
    noneMapped: 'None mapped',
    notMappedYet: 'Not mapped yet',
    climateNote: 'Climate note'
  },
  es: {
    documentTitle: 'Generador de Diseño de Permacultura',
    appTitle: '🌱 Generador de Diseño de Permacultura',
    appSubtitle: 'Planes de siembra con temas simbólicos de sales celulares / minerales',
    languageLabel: 'Idioma',
    translationNote: 'El español es una traducción inicial de prototipo. Los nombres de plantas, etiquetas del registro y algunas notas generadas pueden permanecer en inglés.',
    prototypeLabel: 'Prototipo / Acceso temprano',
    prototypeNotice: 'Estado actual: las recomendaciones de plantas, los sitios guardados, la edición de gremios, la línea de tiempo de siembra y las descargas del PDF completo están activas. La interpretación de análisis de suelo aún llegará pronto.',
    savedSitesButton: '📂 Mis sitios guardados',
    darkMode: '🌙 Modo oscuro',
    lightMode: '☀️ Modo claro',
    step1Title: 'Paso 1: Ubicación y signo solar',
    addressSectionTitle: 'Dirección',
    sunSignsSectionTitle: 'Signo(s) solar(es)',
    scaleSectionTitle: 'Escala',
    desiredPlantsSectionTitle: 'Plantas deseadas',
    propertyAddress: 'Dirección del terreno *',
    addressPlaceholder: '123 Main St, ciudad, estado, código postal',
    addressHelp: 'Se usa para determinar zona de rusticidad, clima y fechas de heladas',
    manualCoordinatesLabel: 'Avanzado: ingresar coordenadas manualmente',
    latitudePlaceholder: 'Latitud',
    longitudePlaceholder: 'Longitud',
    manualCoordinatesHelp: 'Opcional pero recomendado cuando la búsqueda de dirección es aproximada. Las coordenadas manuales reemplazan la geocodificación y se usan para clima, SunCalc y PDF.',
    addressLookupHelp: 'Selecciona una dirección verificada de las sugerencias para una planificación precisa de SunCalc y sombra.',
    mapboxUnavailableNotice: 'La búsqueda de direcciones verificadas no está configurada. Las sugerencias pueden ser aproximadas; ingresa coordenadas exactas para SunCalc y planificación de sombra a nivel de propiedad.',
    selectedAddressLabel: 'Dirección seleccionada',
    verifiedAddressState: 'Dirección verificada',
    unverifiedAddressState: 'Dirección no verificada',
    approximateAddressState: 'Ubicación aproximada',
    noAddressSuggestions: 'No se encontraron sugerencias de dirección verificadas.',
    addressSuggestError: 'Las sugerencias de dirección no están disponibles.',
    useTopSuggestion: 'Usar la primera sugerencia',
    useApproximateSuggestion: 'Usar ubicación aproximada',
    approximateSuggestionWarning: 'Esta coincidencia es aproximada. Puede usarse para planificación climática general, pero no para SunCalc ni planificación de sombra precisa.',
    useApproximateAnyway: 'Usar ubicación aproximada de todos modos',
    manualCoordinatePrompt: '¿No encuentras tu dirección? Ingresa coordenadas manualmente.',
    approximateCoordinatePrompt: 'Esta coincidencia es aproximada. Puedes usarla para planificación climática general o ingresar coordenadas exactas.',
    advancedCoordinateEntry: 'Entrada avanzada de coordenadas',
    selectVerifiedAddressRequired: 'Selecciona una dirección verificada de las sugerencias para una planificación precisa de SunCalc y sombra.',
    fallbackAddressConfirm: 'La verificación de direcciones de Mapbox no está configurada. ¿Continuar con coordenadas aproximadas de Nominatim?',
    coordinateSource: 'Fuente de coordenadas',
    coordinateAccuracy: 'Precisión',
    sourceMapbox: 'Mapbox verificado',
    sourceManual: 'Manual',
    sourceNominatim: 'Nominatim de respaldo',
    sourceApproximate: 'Aproximada',
    sunSignLabel: 'Tu signo solar *',
    sunSignPlaceholder: 'Selecciona tu signo solar...',
    sunSignHelp: 'Usa tu signo solar y los signos vecinos como temas simbólicos de minerales / sales celulares',
    familyMembersLabel: 'Integrantes de la familia (opcional)',
    familyMembersHelp: 'Agrega signos solares de familiares para combinar temas simbólicos de minerales / sales celulares',
    addFamilyMember: '+ Agregar familiar',
    projectScale: 'Escala del proyecto *',
    scalePlaceholder: 'Selecciona la escala...',
    desiredPlants: 'Árboles de dosel / plantas deseadas (opcional)',
    desiredPlantsPlaceholder: 'ej., Manzano, Durazno, Pawpaw',
    desiredPlantsHelp: 'Ingresa una o más plantas de dosel deseadas, separadas por comas. Ejemplo: manzano, durazno, peral. Déjalo en blanco para recibir sugerencias.',
    next: 'Siguiente →',
    step2Title: 'Paso 2: Revisar y generar',
    soilComingSoonTitle: 'Integración de análisis de suelo — Próximamente',
    soilComingSoonText: 'Estamos preparando herramientas para subir e interpretar análisis de suelo. Por ahora, genera el plan sin datos de suelo.',
    back: '← Atrás',
    generatePlan: '🌱 Generar plan',
    resultsTitle: 'Tu plan de permacultura',
    saveChanges: 'Guardar cambios',
    saveAsNew: 'Guardar como nuevo',
    openPlantingScale: 'Abrir calendario de siembra',
    testingPrompt: '¿Estás probando esto?',
    testingText: 'Anota recomendaciones confusas, plantas faltantes, malas coincidencias de zona o funciones que esperabas. Los comentarios tempranos guiarán las próximas mejoras del registro y la edición.',
    siteInfoTitle: '📍 Información del sitio',
    sunAnalysisTitle: '☀️ Análisis solar para plantas',
    cellSaltTitle: '🧪 Temas simbólicos de sales celulares / minerales',
    howToRead: 'Cómo leer esto:',
    cellSaltDisclaimer: 'Este prototipo usa un marco simbólico inspirado en Carey / Schüssler. Trata el signo solar y los signos vecinos como temas de minerales o sales celulares para el diseño de siembra. Estas asociaciones tradicionales se muestran solo como contexto simbólico para diseño de siembra. No son afirmaciones de salud, diagnóstico, guía de tratamiento ni consejo sobre suplementos.',
    cellSaltNote: 'Estos temas simbólicos de minerales / sales celulares se basan en tu signo solar y signos vecinos. Las plantas recomendadas se asocian con estas etiquetas del registro y metadatos de temas minerales.',
    aiGuildsTitle: '🤖 Gremios de plantas diseñados por IA',
    sevenLayerGuildTitle: '🌿 Gremio comestible de 7 capas',
    whatIsGuild: '¿Qué es un gremio?',
    guildExplanation: 'Un gremio es una pequeña comunidad vegetal construida alrededor de una planta ancla. Las siete capas son dosel, subdosel, arbusto, herbácea, cobertura del suelo, raíz y trepadora. Los gremios fuertes equilibran producción de alimentos, formación de suelo, apoyo a polinizadores, cobertura viva, ciclo de nutrientes y ajuste climático. Editar una capa cambia una planta mientras conserva el rol de diseño cuando es posible.',
    recommendedPlantsTitle: '🌿 Plantas recomendadas',
    recommendedPlantsHelp: 'Estos candidatos se ordenan a partir de los temas minerales del plan actual y los metadatos disponibles del registro. Usa los filtros para revisar la lista por rol, capa, tipo de planta o notas tradicionales de minerales/sales celulares. Revisa y guarda el plan antes de considerar la lista final.',
    freePreview: 'Vista previa gratuita:',
    freePreviewText: 'Esta página muestra una lista limitada de plantas recomendadas para que puedas revisar la estructura del plan y el ajuste climático. El Plan PDF Completo incluye la lista ampliada de plantas, perfiles, sustituciones y notas detalladas de implementación.',
    finishedReviewing: '¿Terminaste de revisar las recomendaciones de plantas?',
    completePlanPrompt: '¿Quieres el plan completo de siembra?',
    completePlanText: 'El Plan PDF Completo desbloquea la lista ampliada de recomendaciones, notas detalladas de plantas, alternativas y un calendario imprimible de implementación.',
    threeYearTitle: '📅 Plan de implementación de 3 años',
    moonTitle: '🌙 Guía básica de siembra lunar',
    startOver: 'Empezar de nuevo',
    printPdf: 'Descargar plan PDF completo',
    downloadCompletePdf: 'Descargar plan PDF completo',
    downloadingPdf: 'Generando PDF...',
    pdfExportNote: 'Genera un Plan PDF completo imprimible desde el plan actual.',
    footerText: 'Temas simbólicos de sales celulares inspirados en Carey / Schüssler para diseño de siembra',
    modalSavedSitesTitle: '📂 Mis sitios guardados',
    loadingSavedSites: 'Cargando sitios guardados...',
    editGuildLayer: 'Editar capa del gremio',
    layerToEdit: 'Capa para editar',
    currentPlant: 'Planta actual',
    noPlantsSelected: 'Aún no hay plantas seleccionadas',
    replacementPlant: 'Planta de reemplazo',
    chooseLayer: 'Elige una capa para cargar plantas compatibles.',
    cancel: 'Cancelar',
    apply: 'Aplicar',
    remove: 'Quitar',
    memberNamePlaceholder: 'Nombre (opcional)',
    generateLoadingTitle: 'Generando tu plan de permacultura...',
    generateLoadingText: 'Analizando ubicación, temas de sales celulares y calendarios de siembra',
    fillRequired: 'Completa todos los campos obligatorios',
    generateErrorPrefix: 'Error al generar el plan: ',
    noPlanPlantingScale: 'Genera o abre un plan guardado primero.',
    address: 'Dirección',
    scale: 'Escala',
    primarySunSign: 'Signo solar principal',
    familyMembers: 'Integrantes de la familia',
    coordinates: 'Coordenadas',
    geocoded: 'Geocodificado',
    coordinateConfidence: 'Confianza de coordenadas',
    coordinateApproximate: 'Resultado aproximado a nivel de ciudad',
    coordinateExact: 'Resultado exacto del terreno',
    coordinateUserConfirmed: 'Coordenadas confirmadas por usuario',
    coordinateLegacyApproximate: 'Coordenadas aproximadas heredadas',
    coordinateUnknown: 'Desconocida',
    approximateLocationWarning: 'La dirección se resolvió solo a una ubicación aproximada. Ingresa latitud/longitud exactas para SunCalc y planificación de sol/sombra.',
    approximateCoordinatesWarning: 'Coordenadas aproximadas: esta ubicación se resolvió a una ciudad/área, no a un punto confirmado del terreno. Ingresa latitud/longitud exactas y vuelve a generar antes de usar SunCalc o planificar sombra.',
    legacyCoordinatesWarning: 'Este plan guardado fue creado antes de la confirmación de coordenadas. Las coordenadas pueden ser de ciudad. Ingresa latitud/longitud exactas y vuelve a generar antes de usar SunCalc o planificar sombra.',
    regenerateCoordinatesPrompt: 'Ingresa latitud/longitud exactas, luego haz clic en Generar plan otra vez. Guarda el plan actualizado después.',
    editCoordinatesButton: 'Ingresar coordenadas exactas',
    hardinessZone: 'Zona de rusticidad USDA',
    avgMin: 'mín. promedio',
    koppenClimate: 'Clima Köppen',
    growingSeason: 'Temporada de crecimiento estimada',
    days: 'días',
    frostDates: 'Fechas de heladas (promedio de 30 años)',
    lastSpringFrost: 'Última helada de primavera (32°F/0°C)',
    firstFallFrost: 'Primera helada de otoño (32°F/0°C)',
    frostFreeDays: 'Días sin heladas',
    lastHardFrost: 'Última helada fuerte (28°F/-2°C)',
    firstHardFrost: 'Primera helada fuerte (28°F/-2°C)',
    hardFrostFreeDays: 'Días sin heladas fuertes',
    yearsDataPrefix: 'Basado en',
    yearsDataSuffix: 'años de datos (1991–2020)',
    source: 'Fuente',
    nearestKoppen: 'punto Köppen más cercano',
    locationWarning: 'Advertencia de ubicación',
    locationMapUnavailable: 'Mapa de ubicación no disponible',
    locationUnavailable: 'Ubicación no disponible.',
    locationUnavailableText: 'Las plantas recomendadas requieren una zona de rusticidad USDA válida. Ingresa una ciudad y estado válidos (ej., "Duluth, MN") e inténtalo de nuevo.',
    planMineralThemes: 'Temas minerales del plan',
    noMineralThemes: 'No se seleccionaron ni mapearon temas minerales simbólicos.',
    fewerMappedPlants: 'Algunos temas minerales pueden tener menos plantas mapeadas en el registro actual. La app prioriza el ajuste climático y las coincidencias mapeadas cuando están disponibles.',
    unmappedContext: 'Algunas plantas con buen ajuste climático se muestran aunque su perfil de sales celulares aún no esté mapeado. Se incluyen por zona USDA, clima Köppen, rol de capa y diversidad del gremio, no porque coincidan directamente con un tema simbólico de sales celulares.',
    sortBy: 'Ordenar por',
    bestMatch: 'Mejor coincidencia',
    plantName: 'Nombre de planta',
    role: 'Rol',
    mineralCellSalt: 'Mineral / sal celular',
    layer: 'Capa',
    filterByRole: 'Filtrar por rol',
    allRoles: 'Todos los roles',
    filterByMineral: 'Filtrar por mineral',
    allMinerals: 'Todos los minerales',
    filterByPlantType: 'Filtrar por tipo de planta',
    allTypes: 'Todos los tipos',
    resetFilters: 'Restablecer filtros',
    usedInPlanNote: 'Usada en este plan significa que la planta ya aparece en una de las capas del gremio generado. Los candidatos adicionales son plantas compatibles que coinciden con necesidades minerales, climáticas o de rol, pero no fueron colocadas en el gremio.',
    recommendedUsed: 'Plantas recomendadas usadas en este plan',
    additionalCandidates: 'Candidatos adicionales recomendados',
    noRecommendedMatches: 'Ninguna planta recomendada coincide con los filtros actuales.',
    showing: 'Mostrando',
    of: 'de',
    recommendedPlants: 'plantas recomendadas',
    matchingFilters: 'que coinciden con los filtros actuales',
    climateFitUnmapped: 'Recomendación con ajuste climático. Perfil de sales celulares aún no mapeado.',
    climateDiversity: 'Ajuste climático y diversidad del gremio.',
    themeMatch: 'Coincidencia de tema',
    mineralProfileUnmapped: 'Perfil mineral aún no mapeado',
    traditionalCellSaltNote: 'Nota tradicional de sales celulares',
    whyShown: 'Por qué se muestra',
    layerType: 'Capa/tipo',
    climate: 'Clima',
    zones: 'Zonas',
    metadataNotMapped: 'Metadatos aún no mapeados',
    timelinePlantsNote: 'Estas plantas vienen de las capas del gremio generado y pueden aparecer en más de una tarea porque cumplen varios roles de establecimiento.',
    canopyInfrastructure: 'Dosel e infraestructura',
    monthsZeroTwelve: 'Meses 0-12',
    task: 'Tarea',
    plants: 'Plantas',
    recommendedAnchors: 'Anclas recomendadas',
    experimentalUserSelectedAnchor: 'Ancla experimental seleccionada por el usuario',
    experimentalUserSelectedAnchors: 'Anclas experimentales seleccionadas por el usuario',
    year1: 'Año 1',
    year2: 'Año 2',
    moonGuidanceNote: 'Este prototipo muestra una guía básica de siembra por fases lunares. Se planea un calendario completo por fecha con tiempos específicos por cultivo.',
    waxingMoon: 'Luna creciente',
    waningMoon: 'Luna menguante',
    newMoon: 'Luna nueva',
    fullMoon: 'Luna llena',
    action: 'Acción',
    newMoonDefault: 'Descansa, observa, planifica o siembra hojas verdes resistentes donde sea apropiado para la temporada.',
    fullMoonDefault: 'Cosecha hierbas, observa el vigor de las plantas o siembra hojas verdes rápidas donde sea apropiado para la temporada.',
    summerPeak: 'Pico de verano',
    equinox: 'Equinoccio',
    winterLow: 'Mínimo de invierno',
    sunAngle: 'Ángulo solar',
    shadow: 'Sombra',
    impact: 'Impacto',
    plantingRecommendations: 'Recomendaciones de siembra',
    forTree: 'para un árbol de 10 pies',
    noSavedSites: 'Aún no hay sitios guardados.',
    saveSitePrompt: 'Genera un plan y haz clic en "Guardar como nuevo" para guardarlo aquí.',
    unnamedSite: 'Sitio sin nombre',
    noDescription: 'Sin descripción',
    updated: 'Actualizado',
    created: 'Creado',
    open: '📂 Abrir',
    errorLoadingSites: 'Error al cargar sitios: ',
    siteNotFound: 'Sitio no encontrado',
    incompleteSite: 'Los datos del sitio están incompletos (no se encontró un plan).',
    errorLoadingSite: 'Error al cargar el sitio: ',
    deleteConfirmSuffix: 'Esto no se puede deshacer.',
    errorDeletingSite: 'Error al eliminar el sitio: ',
    unsavedChanges: 'Cambios sin guardar',
    unsavedChangesTo: 'Cambios sin guardar en el sitio guardado:',
    saved: 'Guardado:',
    loadedSavedSite: 'Sitio guardado cargado:',
    notSavedYet: 'Aún no guardado',
    siteSaveFailed: 'No se pudo guardar el sitio',
    noPlanToSave: 'No hay plan para guardar. Genera un plan primero.',
    enterSiteName: 'Ingresa un nombre para este sitio:',
    siteSaved: '¡Sitio guardado correctamente!',
    errorSavingSite: 'Error al guardar el sitio: ',
    changesSaved: '¡Cambios guardados correctamente!',
    errorSavingChanges: 'Error al guardar cambios: ',
    pdfAlert: 'Genera o carga un plan primero.',
    pdfExportFailed: 'Error al exportar PDF: ',
    edit: 'Editar',
    done: 'Listo',
    saveGuild: 'Guardar gremio',
    selectLayerToEdit: 'Selecciona una capa para editar',
    unsavedEdit: 'Edición sin guardar',
    original: 'Original',
    pending: 'Pendiente',
    compatibleNeedsZone: 'Los reemplazos compatibles necesitan un plan generado con una zona USDA.',
    loadingReplacements: 'Cargando reemplazos compatibles...',
    failedLoadCandidates: 'No se pudieron cargar candidatos de reemplazo',
    noCompatibleReplacements: 'No se encontraron reemplazos compatibles para esta capa.',
    compatibleReplacementAvailable: 'reemplazo compatible disponible.',
    compatibleReplacementsAvailable: 'reemplazos compatibles disponibles.',
    suggested: 'Sugerida',
    chosenByYou: 'Elegida por ti',
    climateWarning: 'advertencia climática',
    experimentalAnchor: 'ancla experimental',
    canopyAnchor: 'Ancla de dosel',
    mineralMatch: 'Coincidencia mineral',
    climateFitSupport: 'Ajuste climático · Planta de apoyo',
    otherMinerals: 'Otros minerales:',
    mineralProfile: 'Perfil mineral:',
    noneMapped: 'Ninguno mapeado',
    notMappedYet: 'Aún no mapeado',
    climateNote: 'Nota climática'
  }
};
let currentLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'es' ? 'es' : 'en';
const GUILD_LAYER_DEFINITIONS = [
  { label: '1. Canopy', canonicalKey: 'layer1_canopy', keys: ['layer1_canopy'] },
  { label: '2. Sub-Canopy', canonicalKey: 'layer2_low_tree', keys: ['layer2_low_tree'] },
  { label: '3. Shrub', canonicalKey: 'layer3_shrub', keys: ['layer3_shrub'] },
  { label: '4. Herbaceous', canonicalKey: 'layer4', keys: ['layer4', 'layer4_herbaceous'] },
  { label: '5. Ground Cover', canonicalKey: 'layer5', keys: ['layer5', 'layer5_ground_cover', 'layer6_soil_surface'] },
  { label: '6. Root', canonicalKey: 'layer6', keys: ['layer6', 'layer6_rhizosphere', 'layer5_rhizosphere'] },
  { label: '7. Vine', canonicalKey: 'layer7', keys: ['layer7', 'layer7_vertical'] }
];

function t(key) {
  return I18N[currentLanguage]?.[key] || I18N.en[key] || key;
}

function applyTranslations() {
  document.documentElement.lang = currentLanguage;
  document.title = t('documentTitle');

  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });

  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder));
  });

  const languageSelect = document.getElementById('languageSelect');
  if (languageSelect) languageSelect.value = currentLanguage;
  applyTheme(document.body.classList.contains('dark-mode') ? 'dark' : getPreferredTheme());
}

function setLanguage(language) {
  currentLanguage = language === 'es' ? 'es' : 'en';
  localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
  applyTranslations();
  if (generatedPlan) displayResults(generatedPlan);
  updateSaveStateIndicator();
}

function getGuildLayerLabel(layerDef) {
  const labels = {
    layer1_canopy: currentLanguage === 'es' ? '1. Dosel' : '1. Canopy',
    layer2_low_tree: currentLanguage === 'es' ? '2. Subdosel' : '2. Sub-Canopy',
    layer3_shrub: currentLanguage === 'es' ? '3. Arbusto' : '3. Shrub',
    layer4: currentLanguage === 'es' ? '4. Herbácea' : '4. Herbaceous',
    layer5: currentLanguage === 'es' ? '5. Cobertura del suelo' : '5. Ground Cover',
    layer6: currentLanguage === 'es' ? '6. Raíz' : '6. Root',
    layer7: currentLanguage === 'es' ? '7. Trepadora' : '7. Vine'
  };
  return labels[layerDef?.canonicalKey] || layerDef?.label || '';
}

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.body.classList.toggle('dark-mode', isDark);
  document.body.classList.toggle('theme-dark', isDark);
  document.body.classList.toggle('theme-light', !isDark);
  updatePlantingTimelineButtonImages(isDark);
  updatePdfDownloadButtonImages(isDark);

  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.textContent = isDark ? t('lightMode') : t('darkMode');
  }
}

function updatePlantingTimelineButtonImages(isDark) {
  const src = isDark
    ? '/Open%20in%20Timeline%20button.png'
    : '/light%20mode%20timeline%20button.png';

  document.querySelectorAll('.planting-timeline-image-btn img').forEach(img => {
    img.src = src;
  });
}

function updatePdfDownloadButtonImages(isDark) {
  const src = isDark ? '/PDF%20dark.png' : '/PDF%20light.png';

  document.querySelectorAll('.pdf-download-image-btn img').forEach(img => {
    img.src = src;
  });
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
  applyTranslations();
  loadAddressProviderConfig();
  setupAddressAutocomplete();
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

async function loadAddressProviderConfig() {
  try {
    const response = await fetch('/api/address-config');
    if (response.ok) {
      addressProviderConfig = await response.json();
    }
  } catch (error) {
    addressProviderConfig = { mapboxAvailable: false };
  }
  updateAddressProviderNotice();
}

function updateAddressProviderNotice() {
  const notice = document.getElementById('addressProviderNotice');
  if (!notice) return;
  notice.classList.toggle('hidden', Boolean(addressProviderConfig.mapboxAvailable));
}

function setupAddressAutocomplete() {
  const addressInput = document.getElementById('address');
  if (!addressInput) return;

  addressInput.addEventListener('input', () => {
    if (selectedAddress && addressInput.value !== (selectedAddress.label || selectedAddress.placeName || selectedAddress.formattedAddress)) {
      selectedAddress = null;
      fallbackGeocodeAllowed = false;
      updateAddressStatus();
    }
    clearAddressWarning();

    window.clearTimeout(addressSuggestTimer);
    const query = addressInput.value.trim();
    if (query.length < 3) {
      renderAddressSuggestions([]);
      showManualCoordinatePrompt(false);
      return;
    }

    addressSuggestTimer = window.setTimeout(() => fetchAddressSuggestions(query), 300);
  });

  addressInput.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    const topSuggestion = addressSuggestionsCache[0];
    if (!topSuggestion) return;
    event.preventDefault();
    selectAddressSuggestion(topSuggestion);
  });

  document.addEventListener('click', event => {
    const suggestions = document.getElementById('addressSuggestions');
    const addressGroup = event.target.closest('.form-group');
    if (suggestions && !addressGroup?.contains(suggestions) && event.target.id !== 'address') {
      suggestions.classList.add('hidden');
    }
  });
}

function setAdvancedCoordinatesVisible(visible, open = false) {
  const advanced = document.getElementById('advancedCoordinates') || document.querySelector('.advanced-coordinates');
  if (!advanced) return;
  advanced.classList.toggle('hidden', !visible);
  if (open) advanced.open = true;
}

function showManualCoordinatePrompt(visible, messageKey = 'manualCoordinatePrompt') {
  const prompt = document.getElementById('manualCoordinatePrompt');
  if (!prompt) return;

  if (!visible) {
    prompt.innerHTML = '';
    prompt.classList.add('hidden');
    return;
  }

  prompt.innerHTML = `
    <span>${escapeHtml(t(messageKey))}</span>
    <button class="manual-coordinate-link" type="button" id="showAdvancedCoordinatesBtn">${escapeHtml(t('advancedCoordinateEntry'))}</button>
  `;
  prompt.classList.remove('hidden');
  document.getElementById('showAdvancedCoordinatesBtn')?.addEventListener('click', () => {
    setAdvancedCoordinatesVisible(true, true);
  });
}

function updateAddressStatus() {
  const status = document.getElementById('addressStatus');
  if (!status) return;

  if (selectedAddress) {
    const propertyLevel = isPropertyLevelSuggestion(selectedAddress);
    status.textContent = `${propertyLevel ? t('verifiedAddressState') : t('approximateAddressState')}: ${selectedAddress.label || selectedAddress.placeName || ''}`;
    status.classList.remove('unverified', 'verified', 'approximate');
    status.classList.add(propertyLevel ? 'verified' : 'approximate');
  } else {
    status.textContent = t('unverifiedAddressState');
    status.classList.remove('verified', 'approximate');
    status.classList.add('unverified');
  }
}

function isPropertyLevelSuggestion(suggestion = {}) {
  const provider = String(suggestion.provider || '').toLowerCase();
  const featureType = String(suggestion.featureType || '').toLowerCase();
  const accuracy = String(suggestion.accuracy || '').toLowerCase();
  const confidence = String(suggestion.matchCode?.confidence || '').toLowerCase();
  return provider === 'mapbox' &&
    featureType === 'address' &&
    ['rooftop', 'parcel', 'point'].includes(accuracy) &&
    (!confidence || ['exact', 'high'].includes(confidence));
}

function clearAddressWarning() {
  const warning = document.getElementById('addressWarning');
  if (!warning) return;
  warning.innerHTML = '';
  warning.classList.add('hidden');
}

function showApproximateAddressWarning(suggestion) {
  const warning = document.getElementById('addressWarning');
  if (!warning) return;
  warning.innerHTML = `
    <span>${escapeHtml(t('approximateSuggestionWarning'))}</span>
    <button class="btn btn-secondary btn-small" type="button" id="useApproximateAddressBtn">${escapeHtml(t('useApproximateAnyway'))}</button>
  `;
  warning.classList.remove('hidden');
  showManualCoordinatePrompt(true, 'approximateCoordinatePrompt');
  document.getElementById('useApproximateAddressBtn')?.addEventListener('click', () => {
    selectAddressSuggestion(suggestion);
  });
}

async function fetchAddressSuggestions(query) {
  const suggestions = document.getElementById('addressSuggestions');
  if (!suggestions) return;

  try {
    const response = await fetch(`/api/address-suggest?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('suggest failed');
    const data = await response.json();
    const results = Array.isArray(data) ? data : [];
    addressSuggestionsCache = results;
    if (!results.length) {
      suggestions.innerHTML = `<div class="address-suggestion empty">${t('noAddressSuggestions')}</div>`;
      suggestions.classList.remove('hidden');
      showManualCoordinatePrompt(query.length >= 5);
      return;
    }
    setAdvancedCoordinatesVisible(hasManualCoordinateInput(), false);
    showManualCoordinatePrompt(false);
    renderAddressSuggestions(results);
  } catch (error) {
    suggestions.innerHTML = `<div class="address-suggestion empty">${t('addressSuggestError')}</div>`;
    suggestions.classList.remove('hidden');
    showManualCoordinatePrompt(true);
  }
}

function renderAddressSuggestions(suggestions = []) {
  const container = document.getElementById('addressSuggestions');
  if (!container) return;
  addressSuggestionsCache = suggestions;

  if (!suggestions.length) {
    container.innerHTML = '';
    container.classList.add('hidden');
    return;
  }

  const topSuggestionIsPropertyLevel = isPropertyLevelSuggestion(suggestions[0]);
  container.innerHTML = `
    <div class="address-suggestions-actions">
      <button class="btn btn-secondary btn-small" type="button" id="useTopAddressSuggestion">${escapeHtml(topSuggestionIsPropertyLevel ? t('useTopSuggestion') : t('useApproximateSuggestion'))}</button>
    </div>
    ${suggestions.map((suggestion, index) => `
    <button class="address-suggestion ${index === 0 ? 'top-suggestion' : ''} ${isPropertyLevelSuggestion(suggestion) ? 'verified-suggestion' : 'approximate-suggestion'}" type="button" data-address-suggestion-index="${index}">
      <span>${escapeHtml(suggestion.label || suggestion.placeName || suggestion.address || '')}</span>
      <small>${escapeHtml([suggestion.provider, suggestion.accuracy, suggestion.featureType].filter(Boolean).join(' · '))}</small>
    </button>
  `).join('')}`;
  container.classList.remove('hidden');
  document.getElementById('useTopAddressSuggestion')?.addEventListener('click', () => {
    selectAddressSuggestion(suggestions[0]);
  });
  container.querySelectorAll('[data-address-suggestion-index]').forEach(button => {
    button.addEventListener('click', () => {
      const suggestion = suggestions[Number(button.dataset.addressSuggestionIndex)];
      selectAddressSuggestion(suggestion);
    });
  });
}

function selectAddressSuggestion(suggestion) {
  selectedAddress = suggestion;
  fallbackGeocodeAllowed = false;
  clearAddressWarning();
  showManualCoordinatePrompt(false);
  setAdvancedCoordinatesVisible(hasManualCoordinateInput(), false);
  const addressInput = document.getElementById('address');
  if (addressInput) {
    addressInput.value = suggestion.label || suggestion.placeName || suggestion.formattedAddress || suggestion.address || '';
  }
  document.getElementById('addressSuggestions')?.classList.add('hidden');
  updateAddressStatus();
}

function ensureAddressReadyForPlanning() {
  if (selectedAddress || hasManualCoordinateInput()) {
    return true;
  }

  const topSuggestion = addressSuggestionsCache[0];
  if (topSuggestion) {
    if (isPropertyLevelSuggestion(topSuggestion)) {
      selectAddressSuggestion(topSuggestion);
      return true;
    }
    showApproximateAddressWarning(topSuggestion);
    updateAddressStatus();
    return false;
  }

  if (addressProviderConfig.mapboxAvailable) {
    clearAddressWarning();
    alert(t('selectVerifiedAddressRequired'));
    return false;
  }

  if (!fallbackGeocodeAllowed && !confirm(t('fallbackAddressConfirm'))) {
    return false;
  }
  fallbackGeocodeAllowed = true;
  return true;
}

function hasManualCoordinateInput() {
  const latitude = document.getElementById('latitude')?.value.trim() || '';
  const longitude = document.getElementById('longitude')?.value.trim() || '';
  return Boolean(latitude && longitude);
}

function goToStep2() {
  const address = document.getElementById('address').value;
  const sunSign = document.getElementById('sunSign').value;
  const scale = document.getElementById('scale').value;
  const latitude = document.getElementById('latitude')?.value.trim() || '';
  const longitude = document.getElementById('longitude')?.value.trim() || '';

  if (!address || !sunSign || !scale) {
    alert(t('fillRequired'));
    return;
  }

  if ((latitude && !longitude) || (!latitude && longitude)) {
    alert('Enter both latitude and longitude, or leave both blank.');
    return;
  }

  if (latitude || longitude) {
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
      alert('Latitude must be between -90 and 90, and longitude must be between -180 and 180.');
      return;
    }
  }

  if (!ensureAddressReadyForPlanning()) {
    return;
  }

  if (selectedAddress || hasManualCoordinateInput()) {
    fallbackGeocodeAllowed = false;
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
    <input type="text" placeholder="${t('memberNamePlaceholder')}" class="member-name">
    <select class="member-sign" required>
      <option value="">${t('sunSignPlaceholder')}</option>
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
    <button class="remove-btn" onclick="removeFamilyMember(this)">${t('remove')}</button>
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
  const latitude = document.getElementById('latitude')?.value.trim() || '';
  const longitude = document.getElementById('longitude')?.value.trim() || '';

  if (!selectedAddress && !hasManualCoordinateInput()) {
    if (!ensureAddressReadyForPlanning()) return;
  }

  // Gather all data
  const userData = {
    address: document.getElementById('address').value,
    sunSign: document.getElementById('sunSign').value,
    scale: document.getElementById('scale').value,
    userDesiredPlants: document.getElementById('userDesiredPlants').value.trim() || null,
    familyMembers: []
  };

  if (latitude && longitude) {
    userData.latitude = Number(latitude);
    userData.longitude = Number(longitude);
  } else if (selectedAddress) {
    userData.selectedAddress = selectedAddress;
  } else if (fallbackGeocodeAllowed) {
    userData.allowFallbackGeocode = true;
  }

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
      <h3>${t('generateLoadingTitle')}</h3>
      <p>${t('generateLoadingText')}</p>
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

    generatedPlan = normalizeLocationConfidenceForDisplay(await response.json());
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
    alert(t('generateErrorPrefix') + error.message);
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

function formatCoordinatePair(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

function formatGeocodeConfidence(loc = {}) {
  switch (loc.geocodeConfidence) {
    case 'exact':
      return t('coordinateExact');
    case 'verified':
      return t('verifiedAddressState');
    case 'user-confirmed':
      return t('coordinateUserConfirmed');
    case 'legacy-approximate':
      return t('coordinateLegacyApproximate');
    case 'city':
    case 'approximate':
      return t('coordinateApproximate');
    default:
      return t('coordinateUnknown');
  }
}

function formatCoordinateSource(loc = {}) {
  if (loc.provider === 'manual' || loc.userConfirmedCoordinates) return t('sourceManual');
  if (loc.provider === 'mapbox' && !loc.isApproximate) return t('sourceMapbox');
  if (loc.provider === 'nominatim') return t('sourceNominatim');
  return t('sourceApproximate');
}

function hasUsableCoordinates(loc = {}) {
  return Number.isFinite(Number(loc.latitude)) && Number.isFinite(Number(loc.longitude));
}

function isBroadGeocodeLocation(loc = {}) {
  const broadTokens = new Set([
    'boundary', 'administrative', 'city', 'town', 'village', 'hamlet',
    'county', 'municipality', 'locality', 'suburb', 'neighbourhood',
    'postcode', 'region', 'state'
  ]);
  return [loc.resultClass, loc.resultType, loc.addressType]
    .map(value => String(value || '').trim().toLowerCase())
    .some(value => broadTokens.has(value));
}

function looksLikeAreaOnlyAddress(loc = {}) {
  const formatted = String(loc.formattedAddress || '').trim();
  if (!formatted) return false;
  return !/\d/.test(formatted) && /\b(city|county|village|town|united states|florida|kentucky|dunnellon|benton)\b/i.test(formatted);
}

function normalizeLocationConfidenceForDisplay(plan = {}) {
  if (!plan.locationData) return plan;

  const loc = plan.locationData;
  if (loc.userConfirmedCoordinates === true || loc.geocodeConfidence === 'user-confirmed') {
    loc.userConfirmedCoordinates = true;
    loc.isApproximate = false;
    loc.geocodeConfidence = 'user-confirmed';
    loc.geocodeWarning = loc.geocodeWarning || '';
    return plan;
  }

  const missingConfidence = !loc.geocodeConfidence || loc.isApproximate === undefined;
  const legacyLooksApproximate = hasUsableCoordinates(loc) && (
    missingConfidence ||
    isBroadGeocodeLocation(loc) ||
    looksLikeAreaOnlyAddress(loc)
  );

  if (legacyLooksApproximate) {
    loc.isApproximate = true;
    loc.geocodeConfidence = missingConfidence ? 'legacy-approximate' : 'approximate';
    loc.geocodeWarning = missingConfidence
      ? t('legacyCoordinatesWarning')
      : (loc.geocodeWarning || t('approximateCoordinatesWarning'));
    loc.userConfirmedCoordinates = false;
  }

  return plan;
}

function restoreLoadedSiteForm(plan = {}) {
  normalizeLocationConfidenceForDisplay(plan);
  const site = plan.siteInfo || {};
  const loc = plan.locationData || {};
  const addressInput = document.getElementById('address');
  const latitudeInput = document.getElementById('latitude');
  const longitudeInput = document.getElementById('longitude');
  const sunSignInput = document.getElementById('sunSign');
  const scaleInput = document.getElementById('scale');
  const desiredPlantsInput = document.getElementById('userDesiredPlants');

  if (addressInput) addressInput.value = site.address || loc.formattedAddress || '';
  if (sunSignInput) sunSignInput.value = site.sunSign || '';
  if (scaleInput) scaleInput.value = site.scale || '';
  if (desiredPlantsInput) desiredPlantsInput.value = site.userDesiredPlants || '';

  if (latitudeInput && longitudeInput) {
    if (loc.userConfirmedCoordinates && Number.isFinite(Number(loc.latitude)) && Number.isFinite(Number(loc.longitude))) {
      latitudeInput.value = Number(loc.latitude);
      longitudeInput.value = Number(loc.longitude);
    } else {
      latitudeInput.value = '';
      longitudeInput.value = '';
    }
  }

  selectedAddress = loc.userSelectedAddress ? {
    id: loc.providerPlaceId || loc.mapboxId || '',
    label: loc.formattedAddress || site.address || '',
    address: loc.formattedAddress || site.address || '',
    placeName: loc.formattedAddress || site.address || '',
    formattedAddress: loc.formattedAddress || site.address || '',
    provider: loc.provider,
    providerPlaceId: loc.providerPlaceId,
    mapboxId: loc.mapboxId,
    featureType: loc.featureType,
    accuracy: loc.accuracy,
    matchCode: loc.matchCode,
    latitude: loc.latitude,
    longitude: loc.longitude
  } : null;
  updateAddressStatus();
}

function showCoordinateRegenerationForm() {
  if (generatedPlan) {
    restoreLoadedSiteForm(generatedPlan);
  }
  document.getElementById('results')?.classList.add('hidden');
  document.getElementById('step2')?.classList.add('hidden');
  document.getElementById('step1')?.classList.remove('hidden');
  const advanced = document.querySelector('.advanced-coordinates');
  if (advanced) advanced.open = true;
  document.getElementById('latitude')?.focus();
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

function uniqueValues(values) {
  return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))];
}

function getPlantingScalePlants(plan = generatedPlan) {
  const guilds = Array.isArray(plan?.guild) ? plan.guild : (plan?.guild ? [plan.guild] : []);
  const guildPlants = guilds.flatMap(guild => {
    const layers = guild?.layers || guild || {};
    return GUILD_LAYER_DEFINITIONS.map(layerDef => getGuildLayerValue(guild, layerDef.keys))
      .map(layer => {
        if (!layer) return '';
        if (typeof layer === 'string') return layer.split('[')[0].trim();
        return layer.id || layer.common_name || layer.name || layer.plant || '';
      });
  });
  const recommendedPlants = (plan?.recommendedPlants || []).map(getRecommendedPlantName);
  return uniqueValues([...guildPlants, ...recommendedPlants]).slice(0, 24);
}

function getPlantingScaleBaseUrl() {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:5173/planting/';
  }
  return 'https://zodiyuga.com/app-timeline/planting/';
}

function buildPlantingScaleUrl(plan = generatedPlan, options = {}) {
  const url = new URL(getPlantingScaleBaseUrl());
  url.searchParams.set('source', 'permaculture');

  const projectId = options.projectId || currentSavedSite?.siteId;
  const guildId = options.guildId || currentSavedSite?.siteId || '';
  const plants = getPlantingScalePlants(plan);
  const salts = uniqueValues((plan?.cellSalts?.deficient || []).map(salt => salt.cell_salt));

  const params = {
    projectId,
    guildId,
    plants: plants.join(','),
    zone: plan?.climateData?.hardinessZone,
    koppen: plan?.climateData?.koppenCode,
    sunSign: plan?.siteInfo?.sunSign,
    salts: salts.join(','),
    layer: options.layer,
    phase: options.phase || plan?.threeYearPlan?.year0?.title
  };

  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  return url.toString();
}

function openPlantingScale(options = {}) {
  if (!generatedPlan) {
    alert(t('noPlanPlantingScale'));
    return;
  }

  window.open(buildPlantingScaleUrl(generatedPlan, options), '_blank', 'noopener');
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

function classifyCanopyAlternatives(alternatives = [], plan = generatedPlan) {
  const names = Array.isArray(alternatives) ? alternatives.map(name => String(name || '').trim()).filter(Boolean) : [];
  const guilds = Array.isArray(plan?.guild) ? plan.guild : [];
  const layerByName = new Map();
  const canopyLayers = new Set(['canopy', 'sub_canopy', 'low_tree', 'layer1_canopy', 'layer2_low_tree']);
  const shrubSupportPattern = /(aronia|chokeberry|currant|gooseberry|honeyberry|haskap|raspberry|blackberry|serviceberry|saskatoon)/i;

  guilds.forEach(guild => {
    Object.entries(guild?.layers || {}).forEach(([layerKey, layer]) => {
      const name = String(layer?.name || layer?.common_name || layer?.plant || '').trim().toLowerCase();
      if (!name) return;
      layerByName.set(name, String(layer?.taxonomy_layer || layer?.taxonomy?.layer || layerKey || '').toLowerCase());
    });
  });

  return names.reduce((groups, name) => {
    const layer = layerByName.get(name.toLowerCase()) || '';
    if (canopyLayers.has(layer) || /cherry|plum|apple|pear|chestnut|walnut|pecan|persimmon|mulberry/i.test(name)) {
      groups.canopy.push(name);
    } else if (shrubSupportPattern.test(name)) {
      groups.support.push(name);
    } else {
      groups.support.push(name);
    }
    return groups;
  }, { canopy: [], support: [] });
}

function formatSentenceList(items = []) {
  const cleanItems = items.filter(Boolean);
  if (cleanItems.length <= 2) return cleanItems.join(cleanItems.length === 2 ? ' and ' : '');
  return `${cleanItems.slice(0, -1).join(', ')}, and ${cleanItems[cleanItems.length - 1]}`;
}

function renderClimateAlternativeText(alternatives = [], plan = generatedPlan) {
  const groups = classifyCanopyAlternatives(alternatives, plan);
  const parts = [];
  if (groups.canopy.length) {
    parts.push(`Better-fit canopy or low-tree alternatives include ${formatSentenceList(groups.canopy.slice(0, 5))}.`);
  }
  if (groups.support.length) {
    parts.push(`Additional cold-climate woody support crops include ${formatSentenceList(groups.support.slice(0, 3))}.`);
  }
  return parts.length ? ` ${parts.join(' ')}` : '';
}

function renderCanopyClimateWarnings(plan = generatedPlan) {
  const warnings = getCanopyClimateWarnings(plan);
  if (!warnings.length) return '';

  return warnings.map(({ plantName, warning }) => {
    const alternatives = renderClimateAlternativeText(warning.alternatives, plan);
    const normalizedReason = warning.reason
      ? String(warning.reason)
      : `${plantName} may be marginal for this mapped site climate.`;
    return `<div class="implementation-climate-note"><strong>Climate note:</strong> ${escapeHtml(normalizedReason)}${escapeHtml(alternatives)}</div>`;
  }).join('');
}

function getExperimentalCanopySummary(plan = generatedPlan) {
  const guilds = Array.isArray(plan?.guild) ? plan.guild : [];
  const experimental = [];
  const recommended = [];
  const addUnique = (list, name) => {
    const cleanName = String(name || '').trim();
    if (!cleanName || cleanName.toLowerCase() === 'none') return;
    if (list.some(existing => existing.toLowerCase() === cleanName.toLowerCase())) return;
    list.push(cleanName);
  };

  guilds.forEach(guild => {
    const canopy = guild?.layers?.layer1_canopy;
    const name = canopy?.name || canopy?.common_name || canopy?.plant;
    if (canopy?.climate_fit === 'warning' || canopy?.climate_warning) {
      addUnique(experimental, name);
    } else {
      addUnique(recommended, name);
    }
  });

  return { experimental, recommended };
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

function getEdgeClimateContext(plan = generatedPlan) {
  const climate = plan?.climateData || {};
  const koppenCode = String(climate.koppenCode || '');
  const zone = Number.parseInt(climate.hardinessZone, 10);
  const frostFreeDays = Number(climate?.frostDates?.light?.avgFrostFreeDays || climate?.growingSeasonDays || 0);
  return /^(Dfa|Dfb|Dfc|Dfd|ET|EF)/.test(koppenCode) ||
    (Number.isFinite(zone) && zone <= 5) ||
    (frostFreeDays > 0 && frostFreeDays < 150);
}

function getEdgeClimateCaution(plant = {}, plan = generatedPlan, layerKey = '') {
  if (!getEdgeClimateContext(plan) || !plant || typeof plant !== 'object') return null;

  const id = String(plant.id || plant.plant || '').toLowerCase();
  const name = String(plant.name || plant.common_name || plant.plant || '').toLowerCase();
  const type = String(plant.taxonomy_type || plant.type || '').toLowerCase();
  const layer = String(plant.taxonomy_layer || plant.taxonomy?.layer || layerKey || '').toLowerCase();
  const roles = [
    ...(Array.isArray(plant.roles) ? plant.roles : []),
    ...(Array.isArray(plant.functions) ? plant.functions : [])
  ].map(role => String(role).toLowerCase());
  const token = `${id} ${name} ${type} ${layer} ${roles.join(' ')}`;
  const coldFitPattern = /(apple|sour[_\s-]*cherry|cornelian[_\s-]*cherry|nanking[_\s-]*cherry|american[_\s-]*plum|chokecherry|crabapple|serviceberry|saskatoon|honeyberry|haskap|aronia|chokeberry|currant|gooseberry|raspberry|strawberry|fox[_\s-]*grape|hardy[_\s-]*kiwi|kiwiberry|hops|schisandra|groundnut|apios|nettle|dandelion|yarrow|comfrey|sorrel|white[_\s-]*clover|rhubarb|asparagus|horseradish|beet|cabbage|kale|chard|barley|oats|rye)/;
  const isVine = /(^|[_\s-])(vine|layer7|vertical[_\s-]*growth|trellis)([_\s-]|$)/.test(token);
  const isTree = /(canopy|sub[_\s-]*canopy|low[_\s-]*tree|fruit[_\s-]*tree|nut[_\s-]*tree|tree[_\s-]*crop|cornelian[_\s-]*cherry|nanking[_\s-]*cherry|sour[_\s-]*cherry|american[_\s-]*plum|chokecherry|crabapple|apple)/.test(token);
  const isShrub = !isTree && /(^|[_\s-])(shrub|berry[_\s-]*shrub|bramble|hedgerow)([_\s-]|$)/.test(token);
  const isBerryShrub = /(berry[_\s-]*shrub|bramble|berry[_\s-]*production|fruit[_\s-]*production|blackberry|currant|gooseberry|aronia|chokeberry|raspberry)/.test(token);
  const isSoilSupportHerb = !isBerryShrub && /(dynamic[_\s-]*accumulator|compost[_\s-]*activator|soil[_\s-]*building|potassium[_\s-]*mining|nutrient[_\s-]*accumulator|nettle|comfrey|dandelion|horsetail|yarrow)/.test(token);

  if (/(watermelon|cucumber|zucchini|pumpkin|squash|melon)/.test(token)) {
    return {
      label: 'Short-season annual',
      tone: 'warning',
      message: 'Use starts, row cover, low tunnel, greenhouse, or warm microclimate.'
    };
  }

  if (isSoilSupportHerb) {
    return {
      label: 'Dynamic accumulator / soil support',
      tone: 'fit',
      message: ''
    };
  }

  if (/(blackberry|raspberry|bramble|cane[_\s-]*fruit)/.test(token)) {
    return {
      label: 'Cold-site cane fruit note',
      tone: 'fit',
      message: 'Use locally proven cold-hardy cultivar.'
    };
  }

  if (coldFitPattern.test(token)) {
    const label = isVine
      ? 'Cold-hardy vine'
      : isShrub
        ? 'Cold-hardy shrub'
        : isTree
          ? 'Cold-climate tree crop'
          : 'Short-season adapted';
    return {
      label,
      tone: 'fit',
      message: ''
    };
  }

  if (/(peach|apricot|persimmon|pecan|walnut|chestnut|pear|mulberry)/.test(token)) {
    return {
      label: 'Edge tree crop',
      tone: 'warning',
      message: 'Use only with locally proven cultivar, protected microclimate, or season extension.'
    };
  }

  return null;
}

function getInvasiveRiskCaution(plant = {}) {
  if (!plant || typeof plant !== 'object') return null;
  const token = [
    plant.id,
    plant.name,
    plant.common_name,
    plant.plant
  ].filter(Boolean).join(' ').toLowerCase();

  if (/(^|\s)autumn[_\s-]*olive(_|\s|$)/.test(token)) {
    return {
      label: 'Invasive risk',
      message: 'Check local regulations and avoid planting where it may spread.'
    };
  }

  return null;
}

function getGuildLayerRoleLabel(layer = {}, layerKey = '') {
  if (!layer || typeof layer !== 'object') return '';
  const id = String(layer.id || layer.plant || '').toLowerCase();
  const name = String(layer.name || layer.common_name || layer.plant || '').toLowerCase();
  const type = String(layer.taxonomy_type || layer.type || '').toLowerCase();
  const roles = [
    ...(Array.isArray(layer.roles) ? layer.roles : []),
    ...(Array.isArray(layer.functions) ? layer.functions : [])
  ].map(role => String(role).toLowerCase());
  const token = `${id} ${name} ${type} ${roles.join(' ')}`;

  if (layerKey === 'layer3_shrub' && /(nettle|comfrey|dandelion|horsetail|yarrow|dynamic[_\s-]*accumulator|compost[_\s-]*activator|soil[_\s-]*building|potassium[_\s-]*mining)/.test(token)) {
    return currentLanguage === 'es' ? 'Capa de apoyo: acumuladora herbácea alta' : 'Support layer: tall herbaceous accumulator';
  }
  if (layerKey === 'layer3_shrub') return currentLanguage === 'es' ? 'Rol de capa: arbusto/apoyo' : 'Layer role: shrub/support layer';
  if (layerKey === 'layer2_low_tree') return currentLanguage === 'es' ? 'Rol de capa: árbol bajo/subdosel' : 'Layer role: low-tree/sub-canopy layer';
  if (layerKey === 'layer4') return currentLanguage === 'es' ? 'Rol de capa: herbácea' : 'Layer role: herbaceous layer';
  if (layerKey === 'layer5') return currentLanguage === 'es' ? 'Rol de capa: cobertura del suelo/cobertura viva' : 'Layer role: ground-cover/living-mulch layer';
  if (layerKey === 'layer6') return currentLanguage === 'es' ? 'Rol de capa: raíz/rizosfera' : 'Layer role: root/rhizosphere layer';
  if (layerKey === 'layer7') return currentLanguage === 'es' ? 'Rol de capa: trepadora/vertical' : 'Layer role: vine/vertical layer';
  return '';
}

function getRecommendedPlantCategory(plant) {
  const layer = plant?.taxonomy_layer || '';
  const type = plant?.taxonomy_type || '';
  const roles = new Set(getRecommendedPlantRoles(plant));
  const hasSoilBuilderRole = ['dynamic_accumulator', 'compost_activator', 'potassium_mining', 'nutrient_accumulator', 'soil_building', 'biomass', 'chop_and_drop']
    .some(role => roles.has(role));

  if (roles.has('root_crop') || roles.has('rhizome_crop') || roles.has('tuber_crop') || roles.has('edible_tuber')) return { value: 'root', label: 'Root / rhizome crop' };
  if (roles.has('edible_stem') || roles.has('moisture_crop') || /perennial_vegetable/.test(type)) return { value: 'perennial_vegetable', label: 'Perennial vegetable' };
  if (roles.has('dynamic_accumulator') || roles.has('compost_activator') || roles.has('potassium_mining')) return { value: 'soil_building', label: 'Dynamic accumulator / soil support' };
  if (roles.has('leafy_green') || roles.has('edible_greens') || roles.has('edible_leaf') || roles.has('edible_leaves')) return { value: 'leafy_green', label: 'Leafy green / herbaceous crop' };
  if (roles.has('berry_production') || /berry|bramble/.test(type)) return { value: 'berry_shrub', label: 'Berry shrub / woody crop' };
  if (roles.has('fruit_production') && layer === 'shrub') return { value: 'berry_shrub', label: 'Berry shrub / woody crop' };
  if (roles.has('fruit_production') && (layer === 'canopy' || layer === 'low_tree' || layer === 'sub_canopy' || /fruit_tree/.test(type))) return { value: 'fruit_tree', label: 'Fruit / tree crop' };
  if (roles.has('nutrient_accumulator')) return { value: 'nutrient_accumulator', label: 'Nutrient accumulator / edible crop' };
  if (/perennial_herb|culinary_herb|medicinal_herb/.test(type) && hasSoilBuilderRole) return { value: 'soil_building', label: 'Perennial herb / soil support' };
  if (layer === 'shrub' || /shrub/.test(type)) return { value: 'shrub', label: 'Shrub / hedge crop' };
  if (layer === 'ground_cover' || roles.has('living_mulch') || roles.has('ground_cover')) return { value: 'ground_cover', label: 'Ground cover / living mulch' };
  if (layer === 'vine' || roles.has('vertical_growth')) return { value: 'vine', label: 'Vine / trellis crop' };
  if (roles.has('nut_production')) return { value: 'nut_tree', label: 'Nut tree / woody crop' };
  if (roles.has('nitrogen_fixation')) return { value: 'nitrogen_fixer', label: 'Nitrogen fixer / soil support' };
  if (['dynamic_accumulator', 'soil_building', 'biomass', 'chop_and_drop'].some(role => roles.has(role))) return { value: 'soil_building', label: 'Soil-building support' };
  if (roles.has('pollinator_forage') || roles.has('aromatic') || roles.has('medicinal') || roles.has('pest_deterrent') || roles.has('culinary_herb')) return { value: 'herb_pollinator', label: 'Herb / pollinator support' };

  if (layer === 'canopy' || /fruit_tree|nut_tree/.test(type)) return { value: 'canopy_tree', label: 'Canopy / tree crop' };
  if (layer === 'low_tree' || layer === 'sub_canopy') return { value: 'low_tree', label: 'Low tree / understory' };
  if (layer === 'shrub') return { value: 'shrub', label: 'Shrub / hedge crop' };
  if (layer === 'root' || /rhizome|root/.test(type)) return { value: 'root', label: 'Root / rhizome crop' };
  return { value: plant?.recommendation_source === 'climate_fallback' ? 'climate_support' : (plant?.preference_group || 'general'), label: 'Climate-fit support plant' };
}

function formatCellSaltExplanation(explanation = '') {
  const replacement = currentLanguage === 'es'
    ? 'Usando $1 tema$2 de sales celulares/minerales como apoyo simbólico para el diseño de siembra.'
    : 'Using $1 cell-salt/mineral theme$2 as symbolic planting-design support.';
  return String(explanation || '').replace(
    /Supplementing\s+(\d+)\s+cell\s+salt(s?)\./i,
    replacement
  );
}

function softenCellSaltStaticCopy() {
  const note = document.querySelector('#cellSaltsCard > p.note');
  if (!note) return;
  if (/cell salts are deficient/i.test(note.textContent || '')) {
    note.textContent = 'These are symbolic cell-salt/mineral themes highlighted by the selected sun signs and neighboring signs in a Carey / Schüssler-inspired planting-design framework. Matching registry tags help explain the planting logic; this is not medical guidance.';
  }
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
  const visiblePlants = [...visibleUsedPlants, ...visibleAdditionalPlants];
  const visibleCount = visibleUsedPlants.length + visibleAdditionalPlants.length;
  const showUnmappedNote = shouldShowUnmappedRecommendationNote(plants);
  const showGlobalUnmappedNote = Boolean(showUnmappedNote);
  const visibleMinerals = new Set(visiblePlants.flatMap(getRecommendedPlantMinerals).map(mineral => String(mineral).toLowerCase()));
  const missingVisibleMinerals = mineralNeeds.filter(mineral => !visibleMinerals.has(String(mineral).toLowerCase()));
  const needsHtml = mineralNeeds.length
    ? mineralNeeds.map(mineral => `<span class="recommendation-tag mineral-tag">${escapeHtml(mineral)}</span>`).join('')
    : `<span class="recommendation-empty">${t('noMineralThemes')}</span>`;
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
      <strong>${t('planMineralThemes')}</strong>
      <div class="recommendation-tags">${needsHtml}</div>
      ${missingVisibleMinerals.length ? `<p class="note">${t('fewerMappedPlants')}</p>` : ''}
    </div>
    ${showUnmappedNote ? `
      <div class="educational-note recommendation-context-note">
        ${t('unmappedContext')}
      </div>
    ` : ''}
    <div class="recommended-controls">
      <label>
        <span>${t('sortBy')}</span>
        <select id="recommendedSort" onchange="renderRecommendedPlants(generatedPlan)">
          <option value="best"${selectedSort === 'best' ? ' selected' : ''}>${t('bestMatch')}</option>
          <option value="plant"${selectedSort === 'plant' ? ' selected' : ''}>${t('plantName')}</option>
          <option value="role"${selectedSort === 'role' ? ' selected' : ''}>${t('role')}</option>
          <option value="mineral"${selectedSort === 'mineral' ? ' selected' : ''}>${t('mineralCellSalt')}</option>
          <option value="layer"${selectedSort === 'layer' ? ' selected' : ''}>${t('layer')}</option>
        </select>
      </label>
      <label>
        <span>${t('filterByRole')}</span>
        <select id="recommendedRoleFilter" onchange="renderRecommendedPlants(generatedPlan)">
          <option value="">${t('allRoles')}</option>
          ${roles.map(role => `<option value="${escapeHtml(role)}"${selectedRole === role ? ' selected' : ''}>${escapeHtml(formatPlantToken(role))}</option>`).join('')}
        </select>
      </label>
      <label>
        <span>${t('filterByMineral')}</span>
        <select id="recommendedMineralFilter" onchange="renderRecommendedPlants(generatedPlan)">
          <option value="">${t('allMinerals')}</option>
          ${minerals.map(mineral => `<option value="${escapeHtml(mineral)}"${selectedMineral === mineral ? ' selected' : ''}>${escapeHtml(mineral)}</option>`).join('')}
        </select>
      </label>
      <label>
        <span>${t('filterByPlantType')}</span>
        <select id="recommendedTypeFilter" onchange="renderRecommendedPlants(generatedPlan)">
          <option value="">${t('allTypes')}</option>
          ${categories.map(category => `<option value="${escapeHtml(category.value)}"${selectedType === category.value ? ' selected' : ''}>${escapeHtml(category.label)}</option>`).join('')}
        </select>
      </label>
      <button class="btn btn-small" type="button" onclick="resetRecommendedPlantFilters()">${t('resetFilters')}</button>
    </div>
    ${filteredPlants.length ? `<p class="note">${t('usedInPlanNote')}</p>` : ''}
    ${renderRecommendationGroup(t('recommendedUsed'), visibleUsedPlants)}
    ${renderRecommendationGroup(t('additionalCandidates'), visibleAdditionalPlants)}
    ${!filteredPlants.length ? `<p class="note">${t('noRecommendedMatches')}</p>` : ''}
    ${filteredPlants.length > visibleCount ?
      `<p class="note">${t('showing')} ${visibleCount} ${t('of')} ${filteredPlants.length} ${t('recommendedPlants')}${plants.length !== filteredPlants.length ? ' ' + t('matchingFilters') : ''}.</p>` : ''}
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
  const edgeCaution = getEdgeClimateCaution(plant, plan);
  const mapped = plant.metadata_mapped !== false && Boolean(plant.id || plant.common_name || plant.name);
  const isClimateFallback = plant.recommendation_source === 'climate_fallback';
  const normalizeLabel = value => String(value || '').trim().toLowerCase();
  const categoryLabelKey = normalizeLabel(category.label);
  const shouldShowEdgeCaution = Boolean(edgeCaution) && normalizeLabel(edgeCaution.label) !== categoryLabelKey;
  const displayMatchLabels = (isClimateFallback
    ? matchLabels.filter(label => !/cell-salt mapping/i.test(label))
    : matchLabels
  )
    .filter(label => normalizeLabel(label) !== categoryLabelKey)
    .slice(0, 3);
  const fallbackMineralNote = isClimateFallback && minerals.length === 0
    ? t('climateFitUnmapped')
    : '';
  const whyShown = options.showGlobalUnmappedNote && fallbackMineralNote
    ? (plant.recommendation_source === 'climate_fallback' ? t('climateDiversity') : plant.recommendation_reason || '')
    : fallbackMineralNote || plant.recommendation_reason || '';

  return `
    <div class="plant-item recommended-plant-card">
      <div class="recommended-card-header">
        <h4>${escapeHtml(formatPlantToken(name))}</h4>
        ${supportsDeficiency ? `<span class="recommendation-badge helps">${t('themeMatch')}</span>` : ''}
      </div>
      ${plant.botanical_name ? `<p class="recommended-botanical">${escapeHtml(plant.botanical_name)}</p>` : ''}
      ${minerals.length || !isClimateFallback ? `<div class="recommendation-tags">
        ${minerals.length
          ? minerals.map(mineral => `<span class="recommendation-tag mineral-tag">${escapeHtml(mineral)}</span>`).join('')
          : `<span class="recommendation-tag muted-tag">${t('mineralProfileUnmapped')}</span>`}
      </div>` : ''}
      ${displayMatchLabels.length ? `<div class="recommendation-tags">${displayMatchLabels.map(label => `<span class="recommendation-tag ${/fallback|climate fit|diversity/i.test(label) ? 'preference-tag' : 'role-tag'}">${escapeHtml(label)}</span>`).join('')}</div>` : ''}
      ${shouldShowEdgeCaution ? `<div class="recommendation-tags"><span class="recommendation-tag ${edgeCaution.tone === 'fit' ? 'preference-tag' : 'warning-tag'}">${escapeHtml(edgeCaution.label)}</span></div>` : ''}
      ${roles.length ? `<div class="recommendation-tags">${roles.map(role => `<span class="recommendation-tag role-tag">${escapeHtml(formatPlantToken(role))}</span>`).join('')}</div>` : ''}
      <div class="recommendation-tags"><span class="recommendation-tag preference-tag">${escapeHtml(category.label)}</span></div>
      ${supportFunctions.length ? `<p class="recommended-meta"><strong>${t('traditionalCellSaltNote')}:</strong> ${escapeHtml(supportFunctions.join('; '))}</p>` : ''}
      ${whyShown ? `<p class="recommended-meta"><strong>${t('whyShown')}:</strong> ${escapeHtml(whyShown)}</p>` : ''}
      ${edgeCaution?.message ? `<p class="recommended-meta"><strong>${escapeHtml(edgeCaution.label)}:</strong> ${escapeHtml(edgeCaution.message)}</p>` : ''}
      ${layerParts.length ? `<p class="recommended-meta"><strong>${t('layerType')}:</strong> ${escapeHtml(layerParts.join(' / '))}</p>` : ''}
      ${plant.climate_affinity ? `<p class="recommended-meta"><strong>${t('climate')}:</strong> ${escapeHtml(plant.climate_affinity)}${Array.isArray(plant.zones) && plant.zones.length ? ` · ${t('zones')} ${escapeHtml(plant.zones.join('-'))}` : ''}</p>` : ''}
      ${!mapped ? `<p class="recommended-meta"><strong>${t('metadataNotMapped')}</strong></p>` : ''}
    </div>
  `;
}

function displayResults(plan) {
  normalizeLocationConfidenceForDisplay(plan);
  document.getElementById('step2').classList.add('hidden');
  document.getElementById('results').classList.remove('hidden');
  softenCellSaltStaticCopy();

  // Site Info
  const loc = plan.locationData || {};
  const geoFailed = loc.error;
  const climate = plan.climateData || {};
  const coordinateText = formatCoordinatePair(loc.latitude, loc.longitude);
  const confidenceText = loc.geocodeConfidence ? formatGeocodeConfidence(loc) : '';
  const coordinateSourceText = coordinateText ? formatCoordinateSource(loc) : '';
  const coordinateDisplay = loc.userConfirmedCoordinates
    ? `${coordinateText} — user confirmed`
    : coordinateText;
  const geocodeWarning = loc.isApproximate
    ? (loc.geocodeConfidence === 'legacy-approximate'
      ? t('legacyCoordinatesWarning')
      : t('approximateCoordinatesWarning'))
    : '';

  // Build climate info HTML
  let climateHTML = '';
  if (climate.hardinessZone) {
    climateHTML += `<p><strong>🌡️ ${t('hardinessZone')}:</strong> ${climate.hardinessZone}`;
    if (climate.avgAnnualMinTempF !== null) {
      climateHTML += ` <small>(${t('avgMin')} ${climate.avgAnnualMinTempF}°F / ${climate.avgAnnualMinTempC}°C)</small>`;
    }
    climateHTML += `</p>`;
  }
  if (climate.koppenCode) {
    climateHTML += `<p><strong>🌍 ${t('koppenClimate')}:</strong> ${climate.koppenCode} — ${climate.koppenDescription || ''}</p>`;
  }
  if (climate.growingSeasonDays) {
    climateHTML += `<p><strong>📅 ${t('growingSeason')}:</strong> ~${climate.growingSeasonDays} ${t('days')}</p>`;
  }
  if (climate.frostDates && climate.frostDates.light) {
    const fd = climate.frostDates;
    climateHTML += `<div style="margin-top:10px;"><strong>🧊 ${t('frostDates')}:</strong></div>`;
    if (fd.light.avgLastSpringFrost) {
      climateHTML += `<p style="margin-left:8px;margin-top:4px;">🌱 ${t('lastSpringFrost')}: <strong>${fd.light.avgLastSpringFrost}</strong></p>`;
      climateHTML += `<p style="margin-left:8px;">🍂 ${t('firstFallFrost')}: <strong>${fd.light.avgFirstFallFrost}</strong></p>`;
      climateHTML += `<p style="margin-left:8px;">📊 ${t('frostFreeDays')}: ~${fd.light.avgFrostFreeDays} ${t('days')}/year</p>`;
    }
    if (fd.hard.avgLastSpringFrost) {
      climateHTML += `<p style="margin-left:8px;margin-top:6px;">❄️ ${t('lastHardFrost')}: <strong>${fd.hard.avgLastSpringFrost}</strong></p>`;
      climateHTML += `<p style="margin-left:8px;">❄️ ${t('firstHardFrost')}: <strong>${fd.hard.avgFirstFallFrost}</strong></p>`;
      climateHTML += `<p style="margin-left:8px;">📊 ${t('hardFrostFreeDays')}: ~${fd.hard.avgFrostFreeDays} ${t('days')}/year</p>`;
    }
    climateHTML += `<p class="note" style="margin-left:8px;font-size:0.8em;">${t('yearsDataPrefix')} ${fd.light.dataYears || 0} ${t('yearsDataSuffix')}</p>`;
  }
  if (climate.source) {
    climateHTML += `<p class="note" style="font-size:0.85em;color:var(--text-light);">${t('source')}: ${climate.source}${climate.koppenDistanceKm ? ` (${t('nearestKoppen')} ${climate.koppenDistanceKm} km away)` : ''}</p>`;
  }

  document.getElementById('siteInfo').innerHTML = `
    <p><strong>${t('address')}:</strong> ${plan.siteInfo.address}</p>
    <p><strong>${t('scale')}:</strong> ${plan.siteInfo.scale}</p>
    <p><strong>${t('primarySunSign')}:</strong> ${plan.siteInfo.sunSign}</p>
    ${plan.siteInfo.familyMembers.length > 0 ?
      `<p><strong>${t('familyMembers')}:</strong> ${plan.siteInfo.familyMembers.map(m => m.sunSign).join(', ')}</p>` : ''}
    ${coordinateText ? `<p><strong>${t('coordinates')}:</strong> ${escapeHtml(coordinateDisplay)}</p>` : ''}
    ${coordinateSourceText ? `<p><strong>${t('coordinateSource')}:</strong> ${escapeHtml(coordinateSourceText)}</p>` : ''}
    ${loc.accuracy ? `<p><strong>${t('coordinateAccuracy')}:</strong> ${escapeHtml(loc.accuracy)}</p>` : ''}
    ${confidenceText ? `<p><strong>${t('coordinateConfidence')}:</strong> ${confidenceText}</p>` : ''}
    ${loc.formattedAddress ? `<p><strong>${t('geocoded')}:</strong> ${escapeHtml(loc.formattedAddress)}</p>` : ''}
    ${loc.isApproximate ? `<div class="note geocode-warning">⚠️ <strong>${t('locationWarning')}:</strong> ${escapeHtml(geocodeWarning)}<br>${escapeHtml(t('regenerateCoordinatesPrompt'))}<br><button class="btn btn-secondary coordinate-fix-btn" type="button" onclick="showCoordinateRegenerationForm()">${t('editCoordinatesButton')}</button></div>` : ''}
    ${climateHTML ? `<div class="climate-info" style="margin-top:12px;padding:10px;background:var(--info-bg);border-left:3px solid var(--success-border);border-radius:4px;">${climateHTML}</div>` : ''}
    ${geoFailed ? `<p class="note" style="background:var(--warning-bg);border-color:var(--danger-border);">⚠️ <strong>${t('locationWarning')}:</strong> ${escapeHtml(loc.error)}</p>` : ''}
  `;

  // Render map and sun analysis
  if (coordinateText) {
    renderMap(Number(loc.latitude), Number(loc.longitude), plan.siteInfo.address);
    drawPlantSunAnalysis(Number(loc.latitude), Number(loc.longitude), climate);
  } else {
    document.getElementById('siteMap').innerHTML = `<p class="note">${t('locationMapUnavailable')}</p>`;
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
        ⚠️ <strong>${t('locationUnavailable')}</strong> ${t('locationUnavailableText')}
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
      <p class="note">${t('timelinePlantsNote')}</p>
      <div class="year-section">
        <h4>${planData.year0.title || t('canopyInfrastructure')}</h4>
        <p><em>${planData.year0.duration || planData.year0.timeframe || t('monthsZeroTwelve')}</em></p>
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
            const isCanopyTask = /canopy|tree.?plant/i.test(task.task || '');
            const canopySummary = isCanopyTask ? getExperimentalCanopySummary(plan) : { recommended: [], experimental: [] };
            const climateWarningHtml = /canopy|tree.?plant/i.test(task.task || '')
              ? renderCanopyClimateWarnings(plan)
              : '';
            return `
            <div class="task-item">
              <strong>${task.task || t('task')} - ${task.timing || ''}</strong>
              ${isCanopyTask && canopySummary.experimental.length ? `
                ${canopySummary.recommended.length ? `<p>${t('recommendedAnchors')}: ${canopySummary.recommended.join(', ')}</p>` : ''}
                <p>${canopySummary.experimental.length === 1 ? t('experimentalUserSelectedAnchor') : t('experimentalUserSelectedAnchors')}: ${canopySummary.experimental.join(', ')}</p>
              ` : (displayPlants.length ? `<p>${t('plants')}: ${displayPlants.join(', ')}</p>` : '')}
              <p>${task.details || ''}</p>
              ${climateWarningHtml}
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="year-section">
        <h4>${planData.year1.title || t('year1')}</h4>
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
              ${dp1.length ? `<p>${t('plants')}: ${dp1.join(', ')}</p>` : ''}
              <p>${task.details || ''}</p>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="year-section">
        <h4>${planData.year2.title || t('year2')}</h4>
        <p><em>${planData.year2.duration || 'Year 3'}</em></p>
        <p>${planData.year2.focus || ''}</p>
        <div style="margin-top: 15px">
          ${planData.year2.tasks.map(task => {
            const rawP2 = task.plants || [];
            const seen2 = new Set();
            const dp2 = rawP2.map(p => typeof p === 'object' ? (p.common_name || p.name || JSON.stringify(p)) : p).filter(p => { const k=p.toLowerCase(); return seen2.has(k)?false:(seen2.add(k),true); });
            return `
            <div class="task-item">
              <strong>${task.task || t('task')} - ${task.timing || ''}</strong>
              ${dp2.length ? `<p>${t('plants')}: ${dp2.join(', ')}</p>` : ''}
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
      ${t('moonGuidanceNote')}
    </div>
    <div class="moon-phase">
      <div class="moon-card">
        <h4>🌒 ${t('waxingMoon')}</h4>
        <p><em>${moon.waxingMoon.phase}</em></p>
        <p><strong>${t('action')}:</strong> ${moon.waxingMoon.action}</p>
        <ul>
          ${moon.waxingMoon.plant.map(p => `<li>${p}</li>`).join('')}
        </ul>
      </div>

      <div class="moon-card">
        <h4>🌗 ${t('waningMoon')}</h4>
        <p><em>${moon.waningMoon.phase}</em></p>
        <p><strong>${t('action')}:</strong> ${moon.waningMoon.action}</p>
        <ul>
          ${moon.waningMoon.plant.map(p => `<li>${p}</li>`).join('')}
          ${moon.waningMoon.tasks.map(t => `<li>${t}</li>`).join('')}
        </ul>
      </div>

      <div class="moon-card">
        <h4>🌑 ${t('newMoon')}</h4>
        <p><strong>${t('action')}:</strong> ${moon.newMoon.action}</p>
        <ul>
          <li>${t('newMoonDefault')}</li>
        </ul>
      </div>

      <div class="moon-card">
        <h4>🌕 ${t('fullMoon')}</h4>
        <p><strong>${t('action')}:</strong> ${moon.fullMoon.action}</p>
        <ul>
          <li>${t('fullMoonDefault')}</li>
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
  return date.toLocaleTimeString(currentLanguage === 'es' ? 'es-419' : 'en-US', { hour: '2-digit', minute: '2-digit' });
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
    guildsDiv.innerHTML = `<p style="color:var(--danger-text);font-weight:bold;padding:12px;background:var(--warning-bg);border:1px solid var(--danger-border);border-radius:4px;">⚠️ ${currentLanguage === 'es' ? 'La IA no pudo generar gremios. Inténtalo de nuevo.' : 'AI failed to generate guilds. Please try again.'}</p>`;
    return;
  }

  const layerLabels = {
    layer1_canopy: currentLanguage === 'es' ? '🌳 Capa 1 — Dosel' : '🌳 Layer 1 — Canopy',
    layer2_low_tree: currentLanguage === 'es' ? '🌿 Capa 2 — Árbol bajo' : '🌿 Layer 2 — Low Tree',
    layer3_shrub: currentLanguage === 'es' ? '🫐 Capa 3 — Arbusto' : '🫐 Layer 3 — Shrub',
    layer4_herbaceous: currentLanguage === 'es' ? '🌱 Capa 4 — Herbácea' : '🌱 Layer 4 — Herbaceous',
    layer5_rhizosphere: currentLanguage === 'es' ? '🥔 Capa 5 — Rizosfera' : '🥔 Layer 5 — Rhizosphere',
    layer6_soil_surface: currentLanguage === 'es' ? '🍀 Capa 6 — Superficie del suelo' : '🍀 Layer 6 — Soil Surface',
    layer7_vertical: currentLanguage === 'es' ? '🧗 Capa 7 — Vertical' : '🧗 Layer 7 — Vertical'
  };

  guildsDiv.innerHTML = `
    ${aiData.summary ? `<div class="note" style="margin-bottom:20px">
      <strong>${currentLanguage === 'es' ? 'Resumen de IA' : 'AI Summary'}:</strong> ${aiData.summary}
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
      <h4 style="margin-top:20px;color:var(--primary)">🌱 ${currentLanguage === 'es' ? 'Siembra asociada' : 'Companion Planting'}</h4>
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
      <h4 style="margin-top:20px;color:var(--primary)">📅 ${currentLanguage === 'es' ? 'Consejos de tiempo' : 'Timing Advice'}</h4>
      <div class="note">${aiData.timingAdvice}</div>
    ` : ''}

    ${aiData.soilAmendments && aiData.soilAmendments.length > 0 ? `
      <h4 style="margin-top:20px;color:var(--primary)">🧪 ${currentLanguage === 'es' ? 'Enmiendas del suelo' : 'Soil Amendments'}</h4>
      <ul style="margin-left:20px">
        ${aiData.soilAmendments.map(amend => `<li>${typeof amend === 'object' ? `${amend.issue}: ${amend.solution}` : amend}</li>`).join('')}
      </ul>
    ` : ''}

    ${aiData.waterManagement ? `
      <h4 style="margin-top:20px;color:var(--primary)">💧 ${currentLanguage === 'es' ? 'Manejo del agua' : 'Water Management'}</h4>
      <div class="note">${aiData.waterManagement}</div>
    ` : ''}

    ${aiData.beneficialInsectHabitat ? `
      <h4 style="margin-top:20px;color:var(--primary)">🐞 ${currentLanguage === 'es' ? 'Hábitat para insectos benéficos' : 'Beneficial Insect Habitat'}</h4>
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
    },
    {
      saveChangesBtn: document.getElementById('footerSaveChangesBtn'),
      saveAsNewBtn: document.getElementById('footerSaveAsNewBtn')
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
      ? `${t('unsavedChangesTo')} ${currentSavedSite.name}`
      : t('unsavedChanges');
    indicator.classList.add('dirty');
    indicator.classList.remove('hidden');
    updateSaveControls();
    return;
  }

  if (currentSavedSite?.name && planSaveStatus === 'saved') {
    indicator.textContent = `${t('saved')} ${currentSavedSite.name}`;
    indicator.classList.add('saved');
    indicator.classList.remove('hidden');
    updateSaveControls();
    return;
  }

  if (currentSavedSite?.name) {
    indicator.textContent = `${t('loadedSavedSite')} ${currentSavedSite.name}`;
    indicator.classList.add('saved');
    indicator.classList.remove('hidden');
    updateSaveControls();
    return;
  }

  indicator.textContent = t('notSavedYet');
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
      longitude: generatedPlan.locationData?.longitude,
      isApproximate: generatedPlan.locationData?.isApproximate,
      geocodeConfidence: generatedPlan.locationData?.geocodeConfidence,
      geocodeWarning: generatedPlan.locationData?.geocodeWarning,
      userConfirmedCoordinates: generatedPlan.locationData?.userConfirmedCoordinates
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
      throw new Error(data.error || t('siteSaveFailed'));
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
    alert(t('noPlanToSave'));
    return;
  }

  const rawSiteName = prompt(t('enterSiteName'), generatedPlan.siteInfo.address.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase());
  const siteName = rawSiteName ? rawSiteName.trim() : '';
  if (!siteName) return;

  const siteId = makeSiteIdFromName(siteName);
  persistSite(siteId, siteName, { createdAt: new Date().toISOString() })
    .then(() => {
      alert(t('siteSaved'));
      if (!document.getElementById('savedSitesModal')?.classList.contains('hidden')) showSavedSites();
    })
  .catch(err => alert(t('errorSavingSite') + err.message));
}

function saveChanges() {
  if (!generatedPlan) {
    alert(t('noPlanToSave'));
    return;
  }

  if (!currentSavedSite?.siteId) {
    saveAsNewSite();
    return;
  }

  persistSite(currentSavedSite.siteId, currentSavedSite.name, { createdAt: currentSavedSite.createdAt })
    .then(() => {
      alert(t('changesSaved'));
      if (!document.getElementById('savedSitesModal')?.classList.contains('hidden')) showSavedSites();
    })
    .catch(err => alert(t('errorSavingChanges') + err.message));
}

function setPdfDownloadState(isDownloading) {
  ['downloadPdfTopBtn', 'downloadPdfBottomBtn'].forEach(id => {
    const button = document.getElementById(id);
    if (!button) return;
    button.disabled = isDownloading;
    button.classList.toggle('is-loading', isDownloading);
    button.setAttribute('aria-label', isDownloading ? t('downloadingPdf') : t('downloadCompletePdf'));
    button.title = isDownloading ? t('downloadingPdf') : t('downloadCompletePdf');
  });
}

async function downloadPlan() {
  if (!generatedPlan) {
    alert(t('pdfAlert'));
    return;
  }

  normalizeLocationConfidenceForDisplay(generatedPlan);
  setPdfDownloadState(true);

  try {
    const response = await fetch('/api/generated-plan/export/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: generatedPlan })
    });

    if (!response.ok) {
      let message = 'Unable to generate PDF';
      try {
        const errorData = await response.json();
        message = errorData.error || message;
      } catch (parseError) {
        // Keep the generic message if the server did not return JSON.
      }
      throw new Error(message);
    }

    const pdfBlob = await response.blob();
    const downloadUrl = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'zodi-yuga-food-forest-plan.pdf';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    alert(t('pdfExportFailed') + error.message);
  } finally {
    setPdfDownloadState(false);
  }
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
  const isHighLatitudeSun = Number(summerAlt) < 60 || Number(winterAlt) < 15;
  const summerImpact = isHighLatitudeSun
    ? 'Long summer days provide strong growing light, but the sun remains lower than in temperate/tropical sites. Use warm, wind-protected exposures for fruiting crops.'
    : 'Intense overhead light. High evaporation, short shadows. Fruit trees and canopy plants thrive.';
  const equinoxImpact = isHighLatitudeSun
    ? 'Moderate-to-low sun angle creates longer shadows. Prioritize southern exposure and avoid shading young plants with buildings, fences, or mature trees.'
    : 'Balanced light. Moderate shadows. Ideal for most vegetables and understory plants.';
  const zoneNumber = parseInt(String(climate?.hardinessZone || '').match(/^(\d+)/)?.[1] || '0', 10);
  const koppenCode = String(climate?.koppenCode || '');
  const frostFreeDays = Number(climate?.frostDates?.light?.avgFrostFreeDays || climate?.growingSeasonDays || 0);
  const isTropical = koppenCode.startsWith('A') || zoneNumber >= 12;
  const isColdSubarctic = /^(Dfc|Dfd|ET|EF)/.test(koppenCode) || (frostFreeDays > 0 && frostFreeDays < 150);
  const isWarmFrostFree = isTropical || zoneNumber >= 10 || climate?.frostDates?.light?.frostFree === true;
  const winterImpact = isWarmFrostFree
    ? (currentLanguage === 'es'
      ? 'La luz estacional más baja todavía importa, pero es poco probable que haya heladas. Usa protección contra viento, acolchado y riego de temporada seca para plantas tropicales jóvenes.'
      : 'Lower seasonal light still matters, but frost is unlikely. Use wind protection, mulch, and dry-season irrigation planning for young tropical plants.')
    : (currentLanguage === 'es'
      ? 'Luz de ángulo bajo y sombras largas. La exposición sur es clave. Protege plantas sensibles de las heladas.'
      : 'Low-angle light, long shadows. Southern exposure critical. Protect tender plants from frost.');
  const localizedSummerImpact = currentLanguage === 'es'
    ? (isHighLatitudeSun
      ? 'Los días largos de verano ofrecen buena luz de crecimiento, pero el sol permanece más bajo que en sitios templados o tropicales. Usa exposiciones cálidas y protegidas del viento para cultivos de fruto.'
      : 'Luz intensa desde arriba. Alta evaporación y sombras cortas. Los árboles frutales y plantas de dosel prosperan.')
    : summerImpact;
  const localizedEquinoxImpact = currentLanguage === 'es'
    ? (isHighLatitudeSun
      ? 'El ángulo solar moderado a bajo crea sombras más largas. Prioriza exposición sur y evita sombrear plantas jóvenes con edificios, cercas o árboles maduros.'
      : 'Luz equilibrada. Sombras moderadas. Ideal para la mayoría de hortalizas y plantas de sotobosque.')
    : equinoxImpact;
  const recommendationItems = isColdSubarctic
    ? (currentLanguage === 'es' ? [
        '<li><strong>Microclimas orientados al sur:</strong> Prioriza los lugares más cálidos y protegidos para frutales, bayas y camas con extensión de temporada.</li>',
        '<li><strong>Manejo de viento y nieve:</strong> Usa cercas, setos y estructuras para reducir el viento invernal, capturar nieve aislante y proteger árboles jóvenes.</li>',
        '<li><strong>Cultivos de temporada corta:</strong> Prefiere variedades tempranas y anuales de ciclo corto; usa almácigos, manta térmica, túneles bajos o invernadero para cultivos de calor.</li>',
        '<li><strong>Protección contra fauna:</strong> Cerca o protege árboles jóvenes y bayas donde puedan ramonear ciervos, conejos u otros animales.</li>',
        '<li><strong>Calentamiento y drenaje del suelo:</strong> Usa camas elevadas, manejo del acolchado y montículos bien drenados donde el suelo frío o húmedo retrase la primavera.</li>'
      ] : [
        '<li><strong>South-facing microclimates:</strong> Prioritize the warmest protected sites for fruit trees, berries, and season-extension beds.</li>',
        '<li><strong>Wind and snow management:</strong> Use fences, hedges, and structures to reduce winter wind, catch insulating snow, and protect young trees.</li>',
        '<li><strong>Short-season crops:</strong> Favor early-ripening cultivars and short-season annuals; use starts, row cover, low tunnels, or greenhouse space for warm-season crops.</li>',
        '<li><strong>Wildlife protection:</strong> Fence or cage young trees and berry plantings where moose, deer, rabbits, or voles may browse trunks and shoots.</li>',
        '<li><strong>Soil warming and drainage:</strong> Use raised beds, mulch timing, and well-drained planting mounds where cold or wet soil delays spring growth.</li>'
      ])
    : isWarmFrostFree
    ? (currentLanguage === 'es' ? [
        '<li><strong>Árboles tropicales jóvenes:</strong> Usa acolchado, protección contra viento y sombra temporal por la tarde mientras se establecen las raíces.</li>',
        '<li><strong>Riego de temporada seca:</strong> Agrupa cultivos con alta demanda de agua donde líneas de goteo o captación de lluvia puedan sostenerlos.</li>',
        '<li><strong>Cobertura viva del suelo:</strong> Mantén el suelo cubierto con camote, maní perenne u otra cobertura viva para reducir calor y erosión.</li>',
        '<li><strong>Exposición al viento:</strong> Coloca plantas sensibles detrás de arbustos, palmas, setos u otra estructura que filtre el viento. En sitios costeros o propensos a salinidad, protege también las plantas sensibles del rocío salino o riego con sales.</li>',
        '<li><strong>Cultivos de sotobosque:</strong> Usa banana, taro, jengibre, cúrcuma, cacao o café donde haya sombra parcial y humedad.</li>'
      ] : [
        '<li><strong>Young tropical trees:</strong> Use mulch, wind protection, and temporary afternoon shade while roots establish.</li>',
        '<li><strong>Dry-season irrigation:</strong> Group thirsty crops where drip lines or rain catchment can support them.</li>',
        '<li><strong>Living soil cover:</strong> Keep ground covered with sweet potato, perennial peanut, or other living mulch to reduce heat and erosion.</li>',
        '<li><strong>Wind exposure:</strong> Place sensitive plants behind shrubs, palms, hedges, or other wind-filtering structure. In coastal or salt-prone sites, also protect sensitive plants from salt spray or salty irrigation.</li>',
        '<li><strong>Understory crops:</strong> Use bananas, taro, ginger, turmeric, cacao, or coffee where partial shade and moisture are available.</li>'
      ])
    : (currentLanguage === 'es' ? [
        '<li><strong>Camas orientadas al sur:</strong> Más soleadas todo el año. Buenas para frutales, tomates, pimientos y calabazas.</li>',
        '<li><strong>Camas orientadas al este:</strong> Sol de mañana y sombra de tarde. Buenas para hojas verdes, hierbas y fresas.</li>',
        '<li><strong>Camas orientadas al oeste:</strong> Sol caliente de tarde. Buenas para hierbas mediterráneas y perennes resistentes a sequía.</li>',
        '<li><strong>Camas orientadas al norte:</strong> Más frescas y sombreadas. Mejores para plantas tolerantes a sombra: hostas, helechos, hongos.</li>',
        '<li><strong>Bajo árboles caducifolios:</strong> Sol pleno en invierno cuando no tienen hojas y sombra moteada en verano. Perfecto para sotobosque amante de sombra.</li>'
      ] : [
        '<li><strong>South-facing beds:</strong> Sunniest all year. Best for fruit trees, tomatoes, peppers, squash.</li>',
        '<li><strong>East-facing beds:</strong> Morning sun, afternoon shade. Good for leafy greens, herbs, strawberries.</li>',
        '<li><strong>West-facing beds:</strong> Hot afternoon sun. Good for Mediterranean herbs, drought-tolerant perennials.</li>',
        '<li><strong>North-facing beds:</strong> Coolest, most shade. Best for shade-tolerant plants: hostas, ferns, mushrooms.</li>',
        '<li><strong>Under deciduous trees:</strong> Full sun in winter (when bare), dappled shade in summer. Perfect for shade-loving understory.</li>'
      ]);

  // Shadow length for a 10ft tree
  function shadowLength(sunAltDeg) {
    if (sunAltDeg <= 0) return '∞';
    return (10 / Math.tan(sunAltDeg * toRad)).toFixed(1) + ' ft';
  }

  container.innerHTML = `
    <div class="sun-analysis-grid">
      <div class="sun-card sun-summer">
        <h4>☀️ ${t('summerPeak')} (Jun 21)</h4>
        <p><strong>${t('sunAngle')}:</strong> ${summerAlt}° above horizon</p>
        <p><strong>${t('shadow')}:</strong> ${shadowLength(summerAlt)} ${t('forTree')}</p>
        <p><strong>${t('impact')}:</strong> ${localizedSummerImpact}</p>
      </div>

      <div class="sun-card sun-equinox">
        <h4>🌿 ${t('equinox')} (Mar/Sept)</h4>
        <p><strong>${t('sunAngle')}:</strong> ${equinoxAlt}° above horizon</p>
        <p><strong>${t('shadow')}:</strong> ${shadowLength(equinoxAlt)} ${t('forTree')}</p>
        <p><strong>${t('impact')}:</strong> ${localizedEquinoxImpact}</p>
      </div>

      <div class="sun-card sun-winter">
        <h4>❄️ ${t('winterLow')} (Dec 21)</h4>
        <p><strong>${t('sunAngle')}:</strong> ${winterAlt}° above horizon</p>
        <p><strong>${t('shadow')}:</strong> ${shadowLength(winterAlt)} ${t('forTree')}</p>
        <p><strong>${t('impact')}:</strong> ${winterImpact}</p>
      </div>
    </div>

    <div class="sun-recommendations">
      <h4>🌱 ${t('plantingRecommendations')}</h4>
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
  listContainer.innerHTML = `<p class="note">${t('loadingSavedSites')}</p>`;

  fetch('/api/sites')
    .then(res => res.json())
    .then(sites => {
      if (!sites || sites.length === 0) {
        listContainer.innerHTML = `
          <div class="empty-state">
            <p><strong>${t('noSavedSites')}</strong></p>
            <p>${t('saveSitePrompt')}</p>
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
            <h4>${escapeHtml(site.name || t('unnamedSite'))}</h4>
            <p>${escapeHtml(site.description || t('noDescription'))}</p>
            <p class="site-meta">
              ${site.updated ? t('updated') + ': ' + formatDate(site.updated) : (site.created ? t('created') + ': ' + formatDate(site.created) : '')}
            </p>
          </div>
          <div class="saved-site-actions">
            <button class="btn btn-primary" onclick="loadSite('${escapeHtml(site.siteId)}')">${t('open')}</button>
            <button class="btn btn-danger" onclick="deleteSite('${escapeHtml(site.siteId)}')">🗑️</button>
          </div>
        </div>
      `).join('');
    })
    .catch(err => {
      listContainer.innerHTML = `<p class="note" style="color:var(--danger-text);">${t('errorLoadingSites')}${escapeHtml(err.message)}</p>`;
    });
}

function closeSavedSites() {
  document.getElementById('savedSitesModal').classList.add('hidden');
}

function loadSite(siteId) {
  fetch(`/api/sites/${encodeURIComponent(siteId)}`)
    .then(res => {
      if (!res.ok) throw new Error(t('siteNotFound'));
      return res.json();
    })
    .then(siteData => {
      const plan = siteData.plan;
      if (!plan) {
        alert(t('incompleteSite'));
        return;
      }
      if (!plan.locationData && siteData.location) {
        plan.locationData = { ...siteData.location };
      } else if (plan.locationData && siteData.location) {
        plan.locationData = {
          ...siteData.location,
          ...plan.locationData
        };
      }
      normalizeLocationConfidenceForDisplay(plan);
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
      restoreLoadedSiteForm(plan);
      document.getElementById('step1').classList.add('hidden');
      document.getElementById('step2').classList.add('hidden');
      document.getElementById('results').classList.remove('hidden');

      // Render the plan
      displayResults(plan);
      updateSaveStateIndicator();

      // Close modal
      closeSavedSites();
    })
    .catch(err => alert(t('errorLoadingSite') + err.message));
}

function deleteSite(siteId) {
  if (!confirm(`Delete "${siteId}"? ${t('deleteConfirmSuffix')}`)) return;

  fetch(`/api/sites/${encodeURIComponent(siteId)}`, { method: 'DELETE' })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showSavedSites(); // Refresh list
      } else {
        alert('Error: ' + data.error);
      }
    })
    .catch(err => alert(t('errorDeletingSite') + err.message));
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
    return d.toLocaleDateString(currentLanguage === 'es' ? 'es-419' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
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
  if (!layer) return t('noPlantsSelected');
  if (typeof layer === 'string') {
    const value = layer.trim();
    return value && value.toLowerCase() !== 'none' ? value : t('noPlantsSelected');
  }
  if (Array.isArray(layer)) return layer.length ? layer.join(', ') : t('noPlantsSelected');
  return layer.name || layer.plant || layer.common_name || t('noPlantsSelected');
}

function getPlanGuildCanopyNames(plan) {
  const rawGuild = plan?.guild;
  const guilds = Array.isArray(rawGuild) ? rawGuild : (rawGuild ? [rawGuild] : []);
  const seen = new Set();
  const names = [];

  guilds.forEach(guildItem => {
    const canopy = getGuildLayerValue(guildItem, ['layer1_canopy']);
    const name = getGuildLayerPlantLabel(canopy);
    if (!name || name === t('noPlantsSelected') || name.toLowerCase() === 'none') return;

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
  const { experimental, recommended } = getExperimentalCanopySummary(plan);
  const recommendedList = formatList(recommended);
  const experimentalList = formatList(experimental);
  const canopyTask = year0.tasks.find(task => /canopy|tree.?plant/i.test(task.task || ''));

  if (canopyNames.length > 1) {
    const focusParts = [];
    if (recommended.length) focusParts.push(`establish ${recommendedList} as recommended canopy anchors`);
    if (experimental.length) focusParts.push(`track ${experimentalList} as ${experimental.length === 1 ? 'an experimental user-selected anchor' : 'experimental user-selected anchors'}`);
    year0.focus = focusParts.length
      ? focusParts.join('; ')
      : `Establish ${canopyList} as the canopy anchors`;
    if (canopyTask) {
      canopyTask.task = experimental.length
        ? 'Canopy Tree Planting - Recommended & Experimental Anchors'
        : 'Canopy Tree Planting - Plant Primary Anchors';
      canopyTask.plants = canopyNames;
      canopyTask.details = experimental.length
        ? `${recommended.length ? `${recommendedList} ${recommended.length === 1 ? 'is' : 'are'} the recommended canopy ${recommended.length === 1 ? 'anchor' : 'anchors'} for the guild system. ` : ''}${experimentalList} ${experimental.length === 1 ? 'is' : 'are'} listed as experimental; see the climate note for site-fit context.`
        : `${canopyList} are the primary canopy anchors for the guild system. Plant with spacing appropriate to each species and site conditions.`;
    }
  } else {
    year0.focus = experimental.length
      ? `Track ${experimentalList} as an experimental user-selected anchor`
      : `Establish ${canopyNames[0]} as the system anchor`;
    if (canopyTask) {
      canopyTask.plants = [canopyNames[0]];
      canopyTask.task = experimental.length
        ? 'Canopy Tree Planting - Experimental Anchor'
        : canopyTask.task;
      canopyTask.details = experimental.length
        ? `${experimentalList} is listed as an experimental canopy anchor; see the climate note for site-fit context.`
        : `${canopyNames[0]} is the primary canopy anchor for the guild system. Plant with spacing appropriate to the species and site conditions.`;
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
    .map(layerDef => `<option value="${escapeHtml(layerDef.canonicalKey)}">${escapeHtml(getGuildLayerLabel(layerDef))}</option>`)
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
    status.textContent = t('compatibleNeedsZone');
    replacementSelect.disabled = true;
    return;
  }

  status.textContent = t('loadingReplacements');
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
      throw new Error(errorData.error || t('failedLoadCandidates'));
    }

    const data = await response.json();
    const candidates = Array.isArray(data.candidates) ? data.candidates : [];
    if (!candidates.length) {
      status.textContent = t('noCompatibleReplacements');
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
    status.textContent = `${candidates.length} ${candidates.length === 1 ? t('compatibleReplacementAvailable') : t('compatibleReplacementsAvailable')}`;
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
    if (!layer) return t('noPlantsSelected');
    if (typeof layer === 'string') {
      const value = layer.trim();
      return value && value.toLowerCase() !== 'none' ? value : t('noPlantsSelected');
    }
    if (Array.isArray(layer)) return layer.length ? layer.join(', ') : t('noPlantsSelected');
    return layer.name || layer.plant || layer.common_name || t('noPlantsSelected');
  };

  const renderLayerMeta = (layer, layerKey = '') => {
    if (!layer || typeof layer !== 'object' || Array.isArray(layer)) return '';

    let label = '';
    let badgeClass = '';
    if (layer.tier === 'Anchor') {
      const isChosen = layer.selection_reason === 'Chosen by you';
      const hasClimateWarning = Boolean(layer.climate_warning);
      label = (isChosen ? t('chosenByYou') : t('suggested')) + (hasClimateWarning ? ` · ${t('climateWarning')} · ${t('experimentalAnchor')}` : ` · ${t('canopyAnchor')}`);
      badgeClass = hasClimateWarning ? 'climate-warning' : (isChosen ? 'chosen-by-you' : 'suggested-anchor');
    } else if (layer.tier === 'A') {
      label = t('mineralMatch') + (layer.salt_content ? ' · ' + layer.salt_content : '');
      badgeClass = 'mineral-match';
    } else if (layer.tier === 'B') {
      label = t('climateFitSupport');
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
    const mineralLabel = layer.salt_content ? `${t('otherMinerals')} ` : `${t('mineralProfile')} `;
    const mineralValue = mineralText
      ? mineralText
      : (layer.salt_content ? t('noneMapped') : t('notMappedYet'));
    const roleValue = roleText || t('notMappedYet');
    const edgeCaution = getEdgeClimateCaution(layer, generatedPlan, layerKey);
    const invasiveCaution = getInvasiveRiskCaution(layer);
    const layerRoleLabel = getGuildLayerRoleLabel(layer, layerKey);

    const metaParts = [];
    if (label) metaParts.push('<span class="guild-badge ' + escapeHtml(badgeClass) + '">' + escapeHtml(label) + '</span>');
    if (invasiveCaution) metaParts.push('<span class="guild-badge climate-warning">' + escapeHtml(invasiveCaution.label) + '</span>');
    if (edgeCaution) {
      const edgeBadgeClass = edgeCaution.tone === 'fit' ? 'climate-fit' : 'climate-warning';
      metaParts.push('<span class="guild-badge ' + edgeBadgeClass + '">' + escapeHtml(edgeCaution.label) + '</span>');
    }
    metaParts.push('<span>' + escapeHtml(mineralLabel) + escapeHtml(mineralValue) + '</span>');
    if (layerRoleLabel) metaParts.push('<span>' + escapeHtml(layerRoleLabel) + '</span>');
    metaParts.push('<span>' + t('role') + ': ' + escapeHtml(roleValue) + '</span>');
    if (invasiveCaution) {
      metaParts.push(
        '<div class="guild-climate-warning">' +
          '<span><strong>' + escapeHtml(invasiveCaution.label) + ':</strong> ' + escapeHtml(invasiveCaution.message) + '</span>' +
        '</div>'
      );
    }
    if (edgeCaution?.message) {
      metaParts.push(
        '<div class="guild-climate-warning">' +
          '<span><strong>' + escapeHtml(edgeCaution.label) + ':</strong> ' + escapeHtml(edgeCaution.message) + '</span>' +
        '</div>'
      );
    }
    if (layer.climate_warning) {
      const warning = layer.climate_warning;
      const alternativeText = renderClimateAlternativeText(warning.alternatives, generatedPlan).trim();
      const alternatives = alternativeText
        ? '<span>' + escapeHtml(alternativeText) + '</span>'
        : '';
      metaParts.push(
        '<div class="guild-climate-warning">' +
          '<span><strong>' + t('climateNote') + ':</strong> ' + escapeHtml(warning.reason || 'This user-selected canopy may be marginal for the mapped site climate.') + '</span>' +
          alternatives +
        '</div>'
      );
    }

    return metaParts.length
      ? '<div class="guild-plant-meta">' + metaParts.join('') + '</div>'
      : '';
  };

  const renderComparisonColumn = (label, layer, className, layerKey = '') => {
    const plantName = renderLayerPlant(layer);
    const meta = renderLayerMeta(layer, layerKey);
    return '<div class="guild-comparison-column ' + className + '">' +
      '<div class="guild-comparison-label">' + escapeHtml(label) + '</div>' +
      '<div class="guild-comparison-plant">' + escapeHtml(plantName) + '</div>' +
      (meta || '<div class="guild-plant-meta"><span>' + t('mineralProfile') + ' ' + t('notMappedYet') + '</span><span>' + t('role') + ': ' + t('notMappedYet') + '</span></div>') +
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
    const canopyLayer = getLayerValue(guildItem, ['layer1_canopy']);
    const isExperimentalGuild = canopyLayer?.selection_reason === 'Chosen by you' && canopyLayer?.climate_fit === 'warning';
    const hasPendingEdits = hasPendingGuildEdits(index);
    const isEditMode = activeGuildEditIndex === index;
    htmlParts.push('<div class="seven-layer-card guild-card' + (hasPendingEdits ? ' pending-edit' : '') + (isEditMode ? ' edit-mode' : '') + '">');
    htmlParts.push('  <div class="guild-card-header">');
    htmlParts.push('    <h4 style="margin:0;">' + escapeHtml(title) + (isExperimentalGuild ? ' <span class="guild-badge climate-warning">Experimental</span>' : '') + '</h4>');
    htmlParts.push('    <div class="guild-card-actions">');
    htmlParts.push('      <button class="btn btn-guild-save' + (hasPendingEdits ? '' : ' hidden') + '" type="button" data-guild-index="' + index + '" onclick="saveGuildEdits(' + index + ')"' + (hasPendingEdits ? '' : ' disabled') + '>' + t('saveGuild') + '</button>');
    htmlParts.push('      <button class="btn btn-guild-edit" type="button" data-guild-index="' + index + '" onclick="toggleGuildEditMode(' + index + ')">' + (isEditMode ? t('done') : t('edit')) + '</button>');
    htmlParts.push('    </div>');
    htmlParts.push('  </div>');
    if (isEditMode) htmlParts.push('  <p class="guild-edit-hint">' + t('selectLayerToEdit') + '</p>');
    htmlParts.push('  <div class="layer-grid" style="display:grid;gap:8px;">');

    layerDefinitions.forEach(layerDef => {
      const layer = getLayerValue(guildItem, layerDef.keys);
      const dirtyKey = `${index}:${layerDef.canonicalKey}`;
      const hasUnsavedLayerEdit = dirtyGuildLayers.has(dirtyKey);
      htmlParts.push('    <div class="guild-layer-card layer-card' + (hasUnsavedLayerEdit ? ' pending-edit' : '') + (isEditMode ? ' selectable' : '') + '"' + (isEditMode ? ' role="button" tabindex="0" data-guild-index="' + index + '" data-layer-key="' + escapeHtml(layerDef.canonicalKey) + '" onclick="openGuildEditModal(' + index + ', \'' + escapeHtml(layerDef.canonicalKey) + '\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();openGuildEditModal(' + index + ', \'' + escapeHtml(layerDef.canonicalKey) + '\');}"' : '') + '>');
      htmlParts.push('      <strong style="font-size:0.95em;">' + escapeHtml(getGuildLayerLabel(layerDef)) + (hasUnsavedLayerEdit ? ' <span class="unsaved-edit-badge">' + t('unsavedEdit') + '</span>' : '') + '</strong>');
      if (hasUnsavedLayerEdit) {
        const originalLayer = originalGuildLayers.has(dirtyKey) ? originalGuildLayers.get(dirtyKey) : null;
        htmlParts.push('      <div class="guild-layer-comparison">');
        htmlParts.push('        ' + renderComparisonColumn(t('original'), originalLayer, 'original', layerDef.canonicalKey));
        htmlParts.push('        ' + renderComparisonColumn(t('pending'), layer, 'pending', layerDef.canonicalKey));
        htmlParts.push('      </div>');
      } else {
        htmlParts.push('      <span style="font-size:1.05em;">' + escapeHtml(renderLayerPlant(layer)) + '</span>');
        const meta = renderLayerMeta(layer, layerDef.canonicalKey);
        if (meta) htmlParts.push('      ' + meta);
      }
      htmlParts.push('    </div>');
    });

    htmlParts.push('  </div>');
    htmlParts.push('</div>');
  });

  document.getElementById('sevenLayerGuild').innerHTML = htmlParts.join('\n');
}
