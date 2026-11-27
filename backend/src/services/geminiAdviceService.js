// ============================================
// Gemini Advice Service — Fresh Dynamic Telemetry + Language
// ============================================
import { ADVICE_RESPONSE_SCHEMA, generateWithFailover } from '../config/gemini.js';

const SYSTEM_PROMPT = `You are AuraPulse, a practical visual clean-air advisor.
CRITICAL RULES:
1. Ground every numeric metric in the DATA CONTEXT provided — never invent AQI or PM2.5 numbers.
2. React dynamically to ALL fresh inputs: member age, health_condition, custom_issue notes, home room condition (including custom window/source details), and commute metrics.
3. Keep text ultra-concise and scannable (short headlines and compact tip chips, NOT long paragraphs).
4. Respond strictly in the user's selected language.`;

export async function generateFamilyAdvice({
  locationLabel,
  currentAqi,
  diurnalAnalysis,
  indoorSimulation,
  commuteComparison,
  familyMembers = [],
  homeProfile,
  language = 'English',
}) {
  const dataContext = buildDataContext({
    locationLabel,
    currentAqi,
    diurnalAnalysis,
    indoorSimulation,
    commuteComparison,
    familyMembers,
    homeProfile,
  });

  const userPrompt = `Create a concise, visual, personalized plan in ${language} from these fresh user inputs:
DATA CONTEXT:
${JSON.stringify(dataContext)}

MEMBERS:
${familyMembers
  .map((m) => {
    const issue = m.custom_issue ? `${m.health_condition || 'OTHER'} (${m.custom_issue})` : (m.health_condition || 'NONE');
    return `- ${m.name} (Age: ${m.age}, Health: ${issue})`;
  })
  .join('\n')}`;

  const aiRes = await generateWithFailover({
    contents: userPrompt,
    systemInstruction: SYSTEM_PROMPT,
    responseSchema: ADVICE_RESPONSE_SCHEMA,
    temperature: 0.35,
  });

  if (aiRes.ok && aiRes.data) {
    return {
      success: true,
      advice: aiRes.data,
      model: aiRes.model,
      ai_powered: true,
    };
  }

  return generateFallbackAdvice({
    locationLabel,
    currentAqi,
    diurnalAnalysis,
    familyMembers,
    language,
  });
}

function generateFallbackAdvice({ locationLabel, currentAqi, diurnalAnalysis, familyMembers, language = 'English' }) {
  const aqiVal = currentAqi?.aqi || 180;
  const cleanestWindow = diurnalAnalysis?.cleanest_window?.start_label
    ? `${diurnalAnalysis.cleanest_window.start_label} – ${diurnalAnalysis.cleanest_window.end_label}`
    : '2:00 PM – 4:30 PM';

  const isHi = language === 'Hindi';
  const isTe = language === 'Telugu';

  const familyAdvice = familyMembers.map((m) => {
    const cond = m.health_condition?.toUpperCase() || 'NONE';
    const custom = (m.custom_issue || '').trim();
    let risk_level = custom ? 'HIGH' : 'MODERATE';
    let primary_action = custom
      ? (isHi ? `${custom}: साफ हवा में रहें` : isTe ? `${custom}: ఇంట్లోనే ఉండండి` : `Protect against ${custom}`)
      : (isHi ? `केवल ${cleanestWindow} में बाहर जाएं` : isTe ? `${cleanestWindow} లోనే బయటకు వెళ్ళండి` : `Outdoor time only ${cleanestWindow}`);
    let detailed_tips = isHi
      ? ['बाहर जाने पर N95 मास्क पहनें', 'घर में हवा फिल्टर रखें']
      : isTe
        ? ['బయటకు వెళ్ళేటప్పుడు N95 ధరించండి', 'గది గాలిని ఫిల్టర్ చేయండి']
        : ['Wear N95 outside', 'Run indoor air filter'];

    if (cond === 'ASTHMA' || cond === 'COPD') {
      risk_level = aqiVal > 150 ? 'SEVERE' : 'HIGH';
      primary_action = isHi ? 'इनहेलर पास रखें व अंदर रहें' : isTe ? 'ఇన్హేలర్ దగ్గర ఉంచి లోపలే ఉండండి' : 'Keep inhaler close & stay filtered';
      detailed_tips = isHi
        ? ['सुबह बाहर न जाएं', 'N95 मास्क अनिवार्य', 'धुएं से दूर रहें']
        : isTe
          ? ['ఉదయం బయటకు వెళ్ళకండి', 'N95 మాస్క్ వాడండి', 'పొగకు దూరంగా ఉండండి']
          : ['Skip morning smog', 'Tight N95 outdoors', 'Zero indoor smoke'];
    } else if (cond === 'HEART_CONDITION') {
      risk_level = 'HIGH';
      primary_action = isHi ? 'सुबह की सैर टालें' : isTe ? 'ఉదయం నడక మానేయండి' : 'Skip morning walks';
      detailed_tips = isHi
        ? [`हल्की वॉक ${cleanestWindow} में`, 'दवाइयां समय पर लें']
        : isTe
          ? [`తేలికపాటి నడక ${cleanestWindow} లో`, 'మందులు సమయానికి వేసుకోండి']
          : [`Walk only ${cleanestWindow}`, 'Clean bedroom air'];
    } else if (cond === 'INFANT' || cond === 'PREGNANT' || m.age < 6) {
      risk_level = 'HIGH';
      primary_action = isHi ? 'कमरे की खिड़की बंद रखें' : isTe ? 'గది కిటికీలు మూసి ఉంచండి' : 'Stay indoors, closed windows';
      detailed_tips = isHi
        ? ['ट्रैफिक समय बाहर न जाएं', 'गीले कपड़े से पोंछा']
        : isTe
          ? ['ట్రాఫిక్ వేళల్లో బయటకు వెళ్ళకండి', 'తడి గుడ్డతో శుభ్రం చేయండి']
          : ['Avoid rush traffic', 'Wet-mop floors'];
    }

    return { member_name: m.name, risk_level, primary_action, detailed_tips };
  });

  return {
    success: true,
    advice: {
      overall_summary: isHi
        ? `${locationLabel || 'क्षेत्र'} AQI ${aqiVal} · बाहर जाने का समय ${cleanestWindow}`
        : isTe
          ? `${locationLabel || 'ప్రాంతం'} AQI ${aqiVal} · సురక్షిత సమయం ${cleanestWindow}`
          : `AQI ${aqiVal} in ${locationLabel || 'area'} · Best window ${cleanestWindow}`,
      family_advice: familyAdvice,
      ventilation_advice: isHi ? `खिड़की खोलें: ${cleanestWindow}` : isTe ? `కిటికీలు తెరవండి: ${cleanestWindow}` : `Air room ${cleanestWindow} (20m)`,
      commute_advice: isHi ? 'मेट्रो / एसी वाहन चुनें' : isTe ? 'మెట్రో / ఏసీ వాహనం ఎంచుకోండి' : 'Prefer Metro or AC cabin',
    },
    model: 'aurapulse-expert-rule-engine',
    ai_powered: false,
  };
}

function buildDataContext({ locationLabel, currentAqi, diurnalAnalysis, indoorSimulation, commuteComparison, familyMembers, homeProfile }) {
  const context = {
    location: locationLabel || 'Current Location',
    member_count: familyMembers.length,
  };

  if (currentAqi) {
    context.current_air_quality = {
      aqi: currentAqi.aqi,
      category: currentAqi.aqi_category,
      pm25_ug_m3: currentAqi.pm25,
      pm10_ug_m3: currentAqi.pm10,
      dominant_pollutant: currentAqi.dominant_pollutant,
    };
  }

  if (diurnalAnalysis && !diurnalAnalysis.error) {
    context.diurnal = {
      cleanest_window: diurnalAnalysis.cleanest_window,
      dirtiest_window: diurnalAnalysis.dirtiest_window,
      morning_trap_active: diurnalAnalysis.morning_trap_warning,
    };
  }

  if (indoorSimulation) {
    context.indoor = {
      predicted_indoor_pm25: indoorSimulation.indoor_pm25,
      is_safe: indoorSimulation.is_safe,
      purifier_cadr_needed: indoorSimulation.cadr_needed_for_safe,
      custom_window: homeProfile?.custom_window_desc || homeProfile?.window_seal_type || null,
      custom_source: homeProfile?.custom_source_desc || homeProfile?.indoor_source || null,
    };
  }

  if (commuteComparison) {
    context.commute_safest = {
      mode: commuteComparison.safest_mode,
      dose_ug: commuteComparison.safest_route_summary?.dose_ug,
    };
  }

  return context;
}
