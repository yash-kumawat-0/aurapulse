// ============================================
// AQI Context — Air Quality State
// Loads AQI data independently (current + diurnal)
// so one failing doesn't break the other.
// ============================================
import { createContext, useContext, useState, useCallback } from 'react';
import {
  fetchCurrentAqi,
  fetchDiurnal,
  fetchIndoorSimulation,
  fetchCommuteComparison,
  fetchAdvice,
  fetchSymptomCheck,
} from '../services/api.js';

const AqiContext = createContext(null);

export function AqiProvider({ children }) {
  const [currentAqi, setCurrentAqi] = useState(null);
  const [diurnalData, setDiurnalData] = useState(null);
  const [indoorData, setIndoorData] = useState(null);
  const [commuteData, setCommuteData] = useState(null);
  const [adviceData, setAdviceData] = useState(null);
  const [symptomResult, setSymptomResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadAqiData = useCallback(async (lat, lng) => {
    setLoading(true);
    setError(null);
    try {
      // Fetch current and diurnal independently — if one fails, the other still works
      const [aqiResult, diurnalResult] = await Promise.allSettled([
        fetchCurrentAqi(lat, lng),
        fetchDiurnal(lat, lng),
      ]);

      if (aqiResult.status === 'fulfilled') {
        setCurrentAqi(aqiResult.value.data);
      } else {
        console.warn('Failed to load AQI:', aqiResult.reason);
      }

      if (diurnalResult.status === 'fulfilled') {
        setDiurnalData(diurnalResult.value.data);
      } else {
        console.warn('Failed to load diurnal:', diurnalResult.reason);
      }

      // Only set error if BOTH failed
      if (aqiResult.status === 'rejected' && diurnalResult.status === 'rejected') {
        setError('Could not load air quality data.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadIndoorSimulation = useCallback(async (params) => {
    try {
      const result = await fetchIndoorSimulation(params);
      setIndoorData(result.data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const loadCommuteComparison = useCallback(async (params) => {
    try {
      const result = await fetchCommuteComparison(params);
      setCommuteData(result.data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const loadAdvice = useCallback(async (params) => {
    setLoading(true);
    try {
      const result = await fetchAdvice(params);
      setAdviceData(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkSymptom = useCallback(async (params) => {
    try {
      const result = await fetchSymptomCheck(params);
      setSymptomResult(result.data);
      return result.data;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  return (
    <AqiContext.Provider
      value={{
        currentAqi, diurnalData, indoorData, commuteData, setCommuteData,
        adviceData, symptomResult,
        loading, error,
        loadAqiData, loadIndoorSimulation, loadCommuteComparison, loadAdvice, checkSymptom,
      }}
    >
      {children}
    </AqiContext.Provider>
  );
}

export function useAqi() {
  const ctx = useContext(AqiContext);
  if (!ctx) throw new Error('useAqi must be used within AqiProvider');
  return ctx;
}
