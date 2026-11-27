// ============================================
// Gemini Indoor Air & Location DIY Shopping Service
// Generates location-aware fan/filter/tape pricing,
// platform recommendations, and verified live buy links.
// ============================================
import { generateWithFailover } from '../config/gemini.js';

const INDOOR_AI_SCHEMA = {
  type: 'object',
  properties: {
    location_detected: {
      type: 'string',
      description: 'City and country inferred from provided location context (e.g., Pune, India).',
    },
    currency_code: {
      type: 'string',
      description: '3-letter ISO currency code for user location (e.g., INR, USD, GBP, EUR).',
    },
    currency_symbol: {
      type: 'string',
      description: 'Currency symbol matching currency_code (e.g., ₹, $, £, €).',
    },
    one_line_verdict: {
      type: 'string',
      description: '1 concise actionable sentence combining room volume, PM2.5 drop, and purifier target.',
    },
    total_diy_estimate: {
      type: 'string',
      description: 'Total estimated cost range in local currency to build the DIY purifier (e.g., ₹1,500 – ₹2,100).',
    },
    diy_parts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          part_type: { type: 'string', enum: ['fan', 'filter', 'supplies'] },
          title: { type: 'string' },
          quantity: { type: 'integer' },
          spec_detail: { type: 'string' },
          estimated_price: { type: 'string' },
          platform_links: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                platform_name: { type: 'string' },
                estimated_price: { type: 'string' },
                search_query: {
                  type: 'string',
                  description: 'Specific shopping search query for this exact fan/filter size on this platform.',
                },
              },
              required: ['platform_name', 'estimated_price', 'search_query'],
            },
          },
        },
        required: ['part_type', 'title', 'quantity', 'spec_detail', 'estimated_price', 'platform_links'],
      },
    },
  },
  required: [
    'location_detected',
    'currency_code',
    'currency_symbol',
    'one_line_verdict',
    'total_diy_estimate',
    'diy_parts',
  ],
};

const SYSTEM_PROMPT = `You are AuraPulse's indoor clean-air hardware & local shopping advisor.
Given the user's location (city/coordinates), room volume, indoor/outdoor PM2.5, required CADR (m³/h), and DIY purifier fan/filter quantities:
1. Infer the user's country/city and local currency accurately.
2. Estimate realistic current local prices for the exact Box Fan size, MERV-13 / True HEPA Filters, and Duct Tape/Cardboard needed.
3. Recommend 2–3 popular online shopping platforms actively operating in that country/city (e.g., Amazon India, Flipkart, JioMart for India; Amazon, Home Depot, Walmart for USA; Amazon UK, Argos for UK; Amazon.de for Germany).
4. Provide clean, specific search_query strings for each item on each platform so users immediately land on matching products.`;

/**
 * Builds deterministic verified HTTPS platform search URLs from AI-chosen
 * platform names & search queries — prevents dead/hallucinated /dp/ 404 product links.
 */
function buildVerifiedPlatformUrl(platformName, searchQuery) {
  const name = String(platformName || '').toLowerCase();
  const q = encodeURIComponent(String(searchQuery || 'HEPA air purifier filter').trim());

  if (name.includes('amazon') && (name.includes('in') || name.includes('india'))) {
    return `https://www.amazon.in/s?k=${q}`;
  }
  if (name.includes('amazon') && name.includes('uk')) {
    return `https://www.amazon.co.uk/s?k=${q}`;
  }
  if (name.includes('amazon') && name.includes('de')) {
    return `https://www.amazon.de/s?k=${q}`;
  }
  if (name.includes('amazon')) {
    return `https://www.amazon.com/s?k=${q}`;
  }
  if (name.includes('flipkart')) {
    return `https://www.flipkart.com/search?q=${q}`;
  }
  if (name.includes('jiomart')) {
    return `https://www.jiomart.com/search/${q}`;
  }
  if (name.includes('blinkit')) {
    return `https://blinkit.com/s/?q=${q}`;
  }
  if (name.includes('bigbasket')) {
    return `https://www.bigbasket.com/ps/?q=${q}`;
  }
  if (name.includes('home depot') || name.includes('homedepot')) {
    return `https://www.homedepot.com/s/${q}`;
  }
  if (name.includes('walmart')) {
    return `https://www.walmart.com/search?q=${q}`;
  }
  if (name.includes('lowe')) {
    return `https://www.lowes.com/search?searchTerm=${q}`;
  }
  if (name.includes('target')) {
    return `https://www.target.com/s?searchTerm=${q}`;
  }
  if (name.includes('argos')) {
    return `https://www.argos.co.uk/search/${q}/`;
  }
  return `https://www.google.com/search?tbm=shop&q=${q}`;
}

function normalizePlatformLinks(rawParts = []) {
  return rawParts.map((part) => ({
    ...part,
    platform_links: (part.platform_links || []).map((link) => ({
      platform_name: link.platform_name,
      estimated_price: link.estimated_price,
      search_query: link.search_query,
      url: buildVerifiedPlatformUrl(link.platform_name, link.search_query),
    })),
  }));
}

function isLikelyIndia(locationLabel, lat, lng) {
  const lbl = String(locationLabel || '').toLowerCase();
  if (/india|pune|mumbai|delhi|bengaluru|bangalore|hyderabad|chennai|kolkata|noida|gurgaon|jaipur|ahmedabad/.test(lbl)) {
    return true;
  }
  const la = parseFloat(lat);
  const lo = parseFloat(lng);
  return !Number.isNaN(la) && !Number.isNaN(lo) && la >= 6 && la <= 37 && lo >= 68 && lo <= 98;
}

/**
 * Generates AI-powered local DIY purifier parts pricing & online purchase links.
 */
export async function generateIndoorAiShoppingAndPlan({
  locationLabel,
  lat,
  lng,
  outdoorPm25,
  simulation,
  diySimulation,
  diyRec,
  roomAreaSqft,
  ceilingHeightFt,
  windowSealType,
  indoorSource,
  language = 'English',
  overrideKey,
}) {
  const filterCount = (diyRec?.filters || 4) * (diyRec?.units_needed || 1);
  const fanCount = diyRec?.units_needed || 1;
  const fanSize = diyRec?.fan_size_inch || 20;

  const inputContext = {
    location: {
      label: locationLabel || 'Local City',
      latitude: lat ?? null,
      longitude: lng ?? null,
    },
    room: {
      floor_area_sqft: roomAreaSqft,
      ceiling_height_ft: ceilingHeightFt,
      volume_m3: simulation?.room_volume_m3,
      window_seal_type: windowSealType,
      indoor_source: indoorSource,
    },
    air_quality: {
      outdoor_pm25_ug_m3: outdoorPm25,
      predicted_indoor_pm25_ug_m3: simulation?.indoor_pm25,
      with_diy_purifier_pm25_ug_m3: diySimulation?.indoor_pm25,
      cadr_needed_m3_h: simulation?.cadr_needed_for_safe,
    },
    diy_hardware_needed: {
      box_fan_count: fanCount,
      fan_size_inch: fanSize,
      filter_count: filterCount,
      filter_grade: 'MERV-13 or True HEPA Panel Filter',
    },
    language,
  };

  const promptText = `Estimate current regional prices and online store links for the DIY purifier parts in ${inputContext.location.label}, and summarize the room plan in ${language}.
DATA CONTEXT:
${JSON.stringify(inputContext, null, 2)}`;

  const aiRes = await generateWithFailover({
    contents: promptText,
    systemInstruction: SYSTEM_PROMPT,
    responseSchema: INDOOR_AI_SCHEMA,
    overrideKey,
    temperature: 0.25,
  });

  if (aiRes.ok && aiRes.data) {
    return {
      ...aiRes.data,
      diy_parts: normalizePlatformLinks(aiRes.data.diy_parts),
      ai_powered: true,
      model: aiRes.model,
      key_slot: aiRes.key_slot,
      key_source: aiRes.key_source,
      prompt_preview: `${inputContext.location.label} · ${simulation?.room_volume_m3} m³ room · Need ${simulation?.cadr_needed_for_safe} m³/h (${fanCount}× ${fanSize}" fan, ${filterCount}× filters)`,
      input_context: inputContext,
    };
  }

  // Regional deterministic fallback if all keys exhaust
  const india = isLikelyIndia(locationLabel, lat, lng);
  const currencyCode = india ? 'INR' : 'USD';
  const currencySymbol = india ? '₹' : '$';
  const fanEst = india ? `₹${850 * fanCount} – ₹${1450 * fanCount}` : `$${18 * fanCount} – $${28 * fanCount}`;
  const filterEst = india ? `₹${280 * filterCount} – ₹${520 * filterCount}` : `$${12 * filterCount} – $${18 * filterCount}`;
  const tapeEst = india ? '₹120 – ₹220' : '$5 – $9';
  const totalEst = india
    ? `~₹${(850 * fanCount) + (280 * filterCount) + 120} – ₹${(1450 * fanCount) + (520 * filterCount) + 220}`
    : `~$${(18 * fanCount) + (12 * filterCount) + 5} – $${(28 * fanCount) + (18 * filterCount) + 9}`;

  const fallbackParts = normalizePlatformLinks([
    {
      part_type: 'fan',
      title: `${fanSize}-inch Box / High-Velocity Square Fan`,
      quantity: fanCount,
      spec_detail: `Qty ${fanCount} · Square housing fits filter cleanly`,
      estimated_price: fanEst,
      platform_links: india
        ? [
            { platform_name: 'Amazon India', estimated_price: `₹${900 * fanCount}`, search_query: `${fanSize} inch box fan high airflow` },
            { platform_name: 'Flipkart', estimated_price: `₹${850 * fanCount}`, search_query: `square box fan high speed` },
          ]
        : [
            { platform_name: 'Amazon', estimated_price: `$${22 * fanCount}`, search_query: `${fanSize} inch box fan` },
            { platform_name: 'Home Depot', estimated_price: `$${24 * fanCount}`, search_query: `${fanSize} inch box fan` },
          ],
    },
    {
      part_type: 'filter',
      title: 'MERV-13 / HEPA Air Filter Panels',
      quantity: filterCount,
      spec_detail: `Qty ${filterCount} · ${fanSize}×${fanSize}×1 in MERV-13 / HEPA`,
      estimated_price: filterEst,
      platform_links: india
        ? [
            { platform_name: 'Amazon India', estimated_price: `₹${350 * filterCount}`, search_query: `HEPA MERV 13 replacement air filter panel` },
            { platform_name: 'Flipkart', estimated_price: `₹${320 * filterCount}`, search_query: `HEPA replacement air purifier filter` },
          ]
        : [
            { platform_name: 'Amazon', estimated_price: `$${14 * filterCount}`, search_query: `${fanSize}x${fanSize}x1 MERV 13 air filter` },
            { platform_name: 'Walmart', estimated_price: `$${13 * filterCount}`, search_query: `${fanSize}x${fanSize}x1 MERV 13 filter` },
          ],
    },
    {
      part_type: 'supplies',
      title: 'Heavy-Duty Duct Tape + Cardboard Base',
      quantity: 1,
      spec_detail: '1 roll wide tape to seal all cube seams airtight',
      estimated_price: tapeEst,
      platform_links: india
        ? [
            { platform_name: 'Amazon India', estimated_price: '₹150', search_query: 'heavy duty silver duct tape 48mm' },
            { platform_name: 'Flipkart', estimated_price: '₹135', search_query: 'heavy duty duct tape' },
          ]
        : [
            { platform_name: 'Amazon', estimated_price: '$6', search_query: 'heavy duty duct tape' },
            { platform_name: 'Home Depot', estimated_price: '$6', search_query: 'duct tape' },
          ],
    },
  ]);

  return {
    location_detected: locationLabel || (india ? 'India' : 'United States'),
    currency_code: currencyCode,
    currency_symbol: currencySymbol,
    one_line_verdict: `${simulation?.room_volume_m3} m³ room drops from ${Math.round(simulation?.indoor_pm25 || 0)} to ~${Math.round(diySimulation?.indoor_pm25 || 0)} µg/m³ using ${diyRec?.estimated_cadr * fanCount} m³/h DIY filtration.`,
    total_diy_estimate: totalEst,
    diy_parts: fallbackParts,
    ai_powered: false,
    model: 'aurapulse-pricing-fallback',
    fallback_reason: aiRes.reason || null,
    key_slot: null,
    prompt_preview: `Fallback used (${aiRes.reason || 'no API key'})`,
    input_context: inputContext,
  };
}
