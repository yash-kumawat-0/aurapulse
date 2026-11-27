// ============================================
// Gemini Indoor Air & Regional DIY Shopping Service
// Responds dynamically to fresh room, custom window/source
// inputs, generating prices, verified store links & stickers.
// ============================================
import { generateWithFailover } from '../config/gemini.js';

const INDOOR_AI_SCHEMA = {
  type: 'object',
  properties: {
    location_detected: { type: 'string' },
    currency_code: { type: 'string' },
    currency_symbol: { type: 'string' },
    visual_badges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          icon: { type: 'string' },
          label: { type: 'string', description: 'Short 2-5 word visual sticker (e.g., Seal Balcony Gap, 215 m³/h Needed).' },
        },
        required: ['icon', 'label'],
      },
    },
    total_diy_estimate: { type: 'string' },
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
                search_query: { type: 'string' },
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
    'visual_badges',
    'total_diy_estimate',
    'diy_parts',
  ],
};

const SYSTEM_PROMPT = `You are AuraPulse's indoor clean-air hardware & local shopping advisor.
React dynamically to the user's EXACT location, room size, custom window setup (if any), and custom indoor pollution source (if any):
1. Infer city/country & local currency accurately.
2. Output 2–4 punchy visual action stickers (short 2–5 word tags with emoji icons) tailored directly to their custom window/source setup.
3. Estimate current local prices and 2–3 real online store platforms operating in that city/country (e.g. Amazon India, Flipkart, JioMart in India; Amazon, Home Depot, Walmart in USA) for the exact Box Fan, MERV-13/HEPA Filter count, and Duct Tape/Cardboard with specific search_query strings.`;

export function buildVerifiedPlatformUrl(platformName, searchQuery) {
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
  customWindowDesc,
  indoorSource,
  customSourceDesc,
  language = 'English',
}) {
  const filterCount = (diyRec?.filters || 4) * (diyRec?.units_needed || 1);
  const fanCount = diyRec?.units_needed || 1;
  const fanSize = diyRec?.fan_size_inch || 20;

  const inputContext = {
    location: { label: locationLabel || 'Local City', latitude: lat ?? null, longitude: lng ?? null },
    room: {
      floor_area_sqft: roomAreaSqft,
      ceiling_height_ft: ceilingHeightFt,
      volume_m3: simulation?.room_volume_m3,
      window_seal: windowSealType === 'other' && customWindowDesc ? customWindowDesc : windowSealType,
      indoor_source: indoorSource === 'other' && customSourceDesc ? customSourceDesc : indoorSource,
    },
    air_quality: {
      outdoor_pm25_ug_m3: outdoorPm25,
      current_indoor_pm25_ug_m3: simulation?.indoor_pm25,
      with_diy_pm25_ug_m3: diySimulation?.indoor_pm25,
      cadr_needed_m3_h: simulation?.cadr_needed_for_safe,
    },
    diy_hardware: { fan_count: fanCount, fan_size_inch: fanSize, filter_count: filterCount },
    language,
  };

  const aiRes = await generateWithFailover({
    contents: `Generate location pricing, live shopping links, and crisp visual action stickers in ${language}:\n${JSON.stringify(inputContext)}`,
    systemInstruction: SYSTEM_PROMPT,
    responseSchema: INDOOR_AI_SCHEMA,
    temperature: 0.35,
  });

  if (aiRes.ok && aiRes.data) {
    return {
      ...aiRes.data,
      diy_parts: normalizePlatformLinks(aiRes.data.diy_parts),
      ai_powered: true,
      model: aiRes.model,
    };
  }

  const india = isLikelyIndia(locationLabel, lat, lng);
  const fanEst = india ? `₹${850 * fanCount} – ₹${1450 * fanCount}` : `$${18 * fanCount} – $${28 * fanCount}`;
  const filterEst = india ? `₹${280 * filterCount} – ₹${520 * filterCount}` : `$${12 * filterCount} – $${18 * filterCount}`;
  const tapeEst = india ? '₹120 – ₹220' : '$5 – $9';
  const totalEst = india
    ? `~₹${(850 * fanCount) + (280 * filterCount) + 120} – ₹${(1450 * fanCount) + (520 * filterCount) + 220}`
    : `~$${(18 * fanCount) + (12 * filterCount) + 5} – $${(28 * fanCount) + (18 * filterCount) + 9}`;

  const badges = [
    { icon: '🌀', label: `Need ${simulation?.cadr_needed_for_safe || 200} m³/h` },
    ...(windowSealType === 'leaky_wood' || windowSealType === 'other'
      ? [{ icon: '🪟', label: customWindowDesc ? customWindowDesc.slice(0, 22) : 'Seal Window Gaps' }]
      : []),
    ...(indoorSource !== 'none'
      ? [{ icon: '🚭', label: customSourceDesc ? `Stop ${customSourceDesc.slice(0, 18)}` : 'Stop Indoor Smoke' }]
      : [{ icon: '✨', label: `Drops to ~${Math.round(diySimulation?.indoor_pm25 || 25)} µg/m³` }]),
  ];

  const fallbackParts = normalizePlatformLinks([
    {
      part_type: 'fan',
      title: `${fanSize}" Box Fan`,
      quantity: fanCount,
      spec_detail: `Qty ${fanCount} · Square airflow`,
      estimated_price: fanEst,
      platform_links: india
        ? [
            { platform_name: 'Amazon.in', estimated_price: `₹${900 * fanCount}`, search_query: `${fanSize} inch box fan high velocity` },
            { platform_name: 'Flipkart', estimated_price: `₹${850 * fanCount}`, search_query: `square box fan high airflow` },
          ]
        : [
            { platform_name: 'Amazon', estimated_price: `$${22 * fanCount}`, search_query: `${fanSize} inch box fan` },
            { platform_name: 'Home Depot', estimated_price: `$${24 * fanCount}`, search_query: `${fanSize} inch box fan` },
          ],
    },
    {
      part_type: 'filter',
      title: 'HEPA / MERV-13 Filters',
      quantity: filterCount,
      spec_detail: `Qty ${filterCount} · ${fanSize}×${fanSize}" panels`,
      estimated_price: filterEst,
      platform_links: india
        ? [
            { platform_name: 'Amazon.in', estimated_price: `₹${350 * filterCount}`, search_query: `HEPA MERV 13 replacement air filter panel` },
            { platform_name: 'Flipkart', estimated_price: `₹${320 * filterCount}`, search_query: `HEPA replacement air purifier filter` },
          ]
        : [
            { platform_name: 'Amazon', estimated_price: `$${14 * filterCount}`, search_query: `${fanSize}x${fanSize}x1 MERV 13 air filter` },
            { platform_name: 'Walmart', estimated_price: `$${13 * filterCount}`, search_query: `${fanSize}x${fanSize}x1 MERV 13 filter` },
          ],
    },
    {
      part_type: 'supplies',
      title: 'Duct Tape + Cardboard',
      quantity: 1,
      spec_detail: 'Seals cube seams airtight',
      estimated_price: tapeEst,
      platform_links: india
        ? [
            { platform_name: 'Amazon.in', estimated_price: '₹150', search_query: 'heavy duty silver duct tape 48mm' },
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
    currency_code: india ? 'INR' : 'USD',
    currency_symbol: india ? '₹' : '$',
    visual_badges: badges,
    total_diy_estimate: totalEst,
    diy_parts: fallbackParts,
    ai_powered: false,
    model: 'aurapulse-pricing-fallback',
  };
}
