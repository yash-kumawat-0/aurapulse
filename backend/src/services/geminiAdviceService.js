// ============================================
// Gemini Advice Service (Multi-Key Failover + Context Rich)
// Translates telemetry + commute + indoor state into
// personalized, dynamic family plans via Gemini.
// ============================================
import { ADVICE_RESPONSE_SCHEMA, generateWithFailover } from '../config/gemini.js';

const SYSTEM_PROMPT = `You are AuraPulse, a compassionate and practical air quality advisor for families.

ABSOLUTE RULES:
1. NEVER invent, calculate, or guess any number. All numbers are provided to you in the DATA CONTEXT below — use them exactly as given.
2. NEVER mention specific medical dosages, drug names, or treatment plans. You are NOT a doctor.
3. Speak in simple, warm, practical language tailored strictly to each member's age and health condition.
4. Use 12-hour time format (e.g., "2:00 PM") when citing outdoor windows.
5. Keep each tip to 1-2 sentences maximum and make recommendations noticeably responsive to the location AQI, family profile, and target language.`;

/**
 * Generates a structured family action plan using Gemini with automatic failover.
 */
export async function generateFamilyAdvice({
  locationLabel,
  currentAqi,
  diurnalAnalysis,
  indoorSimulation,
  commuteComparison,
  familyMembers = [],
  language = 'English',
  overrideKey,
}) {
  const dataContext = buildDataContext({
    locationLabel,
    currentAqi,
    diurnalAnalysis,
    indoorSimulation,
    commuteComparison,
    familyMembers,
  });

  const userPrompt = `Generate today's personalized air quality action plan for this household.

Respond strictly in language: ${language}

DATA CONTEXT (use these numbers exactly; do not modify or recalculate):
${JSON.stringify(dataContext, null, 2)}

FAMILY MEMBERS:
${familyMembers.map((m) => `- ${m.name} (Age: ${m.age}, Condition: ${m.health_condition || 'NONE'})`).join('\n')}

Return JSON strictly adhering to the schema.`;

  const aiRes = await generateWithFailover({
    contents: userPrompt,
    systemInstruction: SYSTEM_PROMPT,
    responseSchema: ADVICE_RESPONSE_SCHEMA,
    overrideKey,
    temperature: 0.3,
  });

  if (aiRes.ok && aiRes.data) {
    return {
      success: true,
      advice: aiRes.data,
      model: aiRes.model,
      ai_powered: true,
      key_slot: aiRes.key_slot,
      key_source: aiRes.key_source,
      prompt_preview: `Location: ${locationLabel || 'Current'} · AQI ${currentAqi?.aqi} · ${familyMembers.length} member(s) · Language: ${language}`,
      input_context: dataContext,
    };
  }

  return generateFallbackAdvice({
    locationLabel,
    currentAqi,
    diurnalAnalysis,
    indoorSimulation,
    commuteComparison,
    familyMembers,
    language,
    fallbackReason: aiRes.reason,
    inputContext: dataContext,
  });
}

function generateFallbackAdvice({
  locationLabel,
  currentAqi,
  diurnalAnalysis,
  familyMembers,
  language = 'English',
  fallbackReason,
  inputContext,
}) {
  const aqiVal = currentAqi?.aqi || 180;
  const cleanestWindow = diurnalAnalysis?.cleanest_window?.start_label
    ? `${diurnalAnalysis.cleanest_window.start_label} – ${diurnalAnalysis.cleanest_window.end_label}`
    : '2:00 PM – 4:30 PM';

  const isHi = language === 'Hindi';
  const isTe = language === 'Telugu';

  const familyAdvice = familyMembers.map((m) => {
    const cond = m.health_condition?.toUpperCase() || 'NONE';
    let risk_level = 'MODERATE';
    let primary_action = isHi
      ? `बाहरी गतिविधियों को केवल ${cleanestWindow} की सबसे साफ हवा वाली विंडो में रखें।`
      : isTe
        ? `బయటి కార్యకలాపాలను ${cleanestWindow} స్వచ్ఛమైన గాలి సమయంలో మాత్రమే పెట్టుకోండి.`
        : `Reschedule outdoor exertion strictly to the ${cleanestWindow} clean-air window.`;
    let detailed_tips = isHi
      ? ['यात्रा के दौरान कार/कैब में एयर रीसर्क्युलेशन ऑन रखें।', 'घर लौटने के बाद साफ पानी से चेहरा और आंखें धोएं।']
      : isTe
        ? ['ప్రయాణంలో వాహనం ఏసీ రీసర్క్యులేషన్ మోడ్‌లో ఉంచండి.', 'ఇంటికి వచ్చాక శుభ్రమైన నీటితో ముఖం కడుక్కోండి.']
        : ['Keep vehicle cabin AC on recirculation during traffic.', 'Wash face and rinse eyes after returning indoors.'];

    if (cond === 'ASTHMA' || cond === 'COPD') {
      risk_level = aqiVal > 150 ? 'SEVERE' : 'HIGH';
      primary_action = isHi
        ? 'इनहेलर पास रखें और फिल्टर की हुई हवा वाले कमरे में ही रहें।'
        : isTe
          ? 'ఇన్హేలర్ అందుబాటులో ఉంచి శుభ్రమైన గాలి గదిలోనే ఉండండి.'
          : 'Keep rescue inhaler handy and stay inside a filtered room.';
      detailed_tips = isHi
        ? ['सुबह 9:30 बजे से पहले बाहर न निकलें।', 'बाहर जाना जरूरी हो तो फिट किया हुआ N95 मास्क पहनें।', 'अगरबत्ती या तेज धुएं से बचें।']
        : isTe
          ? ['ఉదయం 9:30 ముందు బయటకు వెళ్ళకండి.', 'బయటకు వెళ్ళాల్సి వస్తే N95 మాస్క్ తప్పనిసరిగా ధరించండి.', 'ఇంట్లో ధూపం లేదా పొగ రాకుండా చూసుకోండి.']
          : ['Avoid stepping outside before 9:30 AM morning inversion clears.', 'Wear a tight N95/FFP2 respirator outdoors.', 'Avoid indoor incense or frying smoke.'];
    } else if (cond === 'HEART_CONDITION') {
      risk_level = 'HIGH';
      primary_action = isHi
        ? 'सुबह की तेज सैर रद्द करें और साफ कमरे में आराम करें।'
        : isTe
          ? 'ఉదయం నడక మానేసి ఇంటి లోపలే విశ్రాంతి తీసుకోండి.'
          : 'Skip early morning walks and rest in cleaner indoor air.';
      detailed_tips = isHi
        ? [`हल्की वॉक केवल ${cleanestWindow} के बीच करें।`, 'दवाइयां नियमित समय पर लें।']
        : isTe
          ? [`తేలికపాటి నడక ${cleanestWindow} మధ్యలో మాత్రమే చేయండి.`, 'మందులు సమయానికి తీసుకోండి.']
          : [`Schedule light movement only between ${cleanestWindow}.`, 'Keep prescribed blood-pressure/cardiac routine steady.'];
    } else if (cond === 'INFANT' || cond === 'PREGNANT' || m.age < 6) {
      risk_level = 'HIGH';
      primary_action = isHi
        ? 'कमरे की खिड़कियां बंद रखें और धुएं से दूर रहें।'
        : isTe
          ? 'గది కిటికీలు మూసివేసి ట్రాఫిక్ పొగకు దూరంగా ఉండండి.'
          : 'Keep nursery air clean and minimize roadside traffic exposure.';
      detailed_tips = isHi
        ? ['पीक ट्रैफिक के दौरान खिड़कियां बंद रखें।', 'झाड़ू की जगह गीले पोंछे का उपयोग करें।']
        : isTe
          ? ['ట్రాఫిక్ సమయంలో కిటికీలు మూసి ఉంచండి.', 'చీపురుకు బదులు తడి గుడ్డతో తుడవండి.']
          : ['Close windows during peak morning rush.', 'Wet-mop floors instead of dry sweeping.'];
    }

    return {
      member_name: m.name,
      risk_level,
      primary_action,
      detailed_tips,
    };
  });

  const overall_summary = isHi
    ? `${locationLabel || 'आपके क्षेत्र'} में वर्तमान AQI ${aqiVal} है। सुबह हवा में प्रदूषक फंसे रहते हैं, इसलिए बाहरी काम ${cleanestWindow} में करें।`
    : isTe
      ? `${locationLabel || 'మీ ప్రాంతం'} ప్రస్తుత AQI ${aqiVal}. ఉదయం పొగమంచు ఎక్కువగా ఉంటుంది, కాబట్టి బయటి పనులు ${cleanestWindow}లో చేయండి.`
      : `Current AQI in ${locationLabel || 'your area'} is ${aqiVal} (${currentAqi?.aqi_category || 'Unhealthy'}). Morning atmospheric trapping keeps PM2.5 elevated — plan outdoor steps during ${cleanestWindow}.`;

  const ventilation_advice = isHi
    ? `ताजी हवा के लिए खिड़कियां केवल 20–30 मिनट (${cleanestWindow}) में खोलें।`
    : isTe
      ? `గాలి కోసం కిటికీలను ${cleanestWindow} మధ్యలో కేవలం 20–30 నిమిషాలు తెరవండి.`
      : `Open windows for 20–30 minutes only during ${cleanestWindow} to air out indoor air safely.`;

  const commute_advice = isHi
    ? 'खुले दोपहिया के बजाय मेट्रो या एसी वाहन चुनें ताकि फेफड़ों में धुआं कम जाए।'
    : isTe
      ? 'బైక్ కంటే మెట్రో లేదా ఏసీ వాహనంలో ప్రయాణించి కాలుష్య ప్రభావాన్ని తగ్గించండి.'
      : 'Choose enclosed Metro or AC cabin travel over open two-wheelers to cut particulate inhalation.';

  return {
    success: true,
    advice: {
      overall_summary,
      family_advice: familyAdvice,
      ventilation_advice,
      commute_advice,
    },
    model: 'aurapulse-expert-rule-engine',
    ai_powered: false,
    fallback_reason: fallbackReason || null,
    key_slot: null,
    prompt_preview: `Fallback used (${fallbackReason || 'no API key'}) · Language: ${language}`,
    input_context: inputContext,
  };
}

function buildDataContext({ locationLabel, currentAqi, diurnalAnalysis, indoorSimulation, commuteComparison, familyMembers }) {
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
      ventilation_advice: diurnalAnalysis.ventilation_recommendation,
      morning_trap_active: diurnalAnalysis.morning_trap_warning,
    };
  }

  if (indoorSimulation) {
    context.indoor = {
      predicted_indoor_pm25: indoorSimulation.indoor_pm25,
      io_ratio_percent: indoorSimulation.io_ratio_percent,
      is_safe: indoorSimulation.is_safe,
      purifier_cadr_needed: indoorSimulation.cadr_needed_for_safe,
    };
  }

  if (commuteComparison) {
    context.commute_safest = {
      mode: commuteComparison.safest_mode || commuteComparison.comparison?.safer_route,
      dose_ug: commuteComparison.safest_route_summary?.dose_ug,
    };
  }

  return context;
}
