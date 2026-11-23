// ============================================
// HeroLocationBanner — Clean Search with Autocomplete
// ============================================
import { useState, useEffect, useRef } from 'react';
import { useUser } from '../../context/UserContext.jsx';
import { useAqi } from '../../context/AqiContext.jsx';
import { searchPlace, reverseGeocode } from '../../utils/geocoder.js';
import './HeroLocationBanner.css';

function HeroLocationBanner() {
  const { location, setLocation, detectLocation } = useUser();
  const { loadAqiData, loading } = useAqi();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // When location is set via GPS, reverse geocode and load data
  useEffect(() => {
    if (location && !initialized) {
      setInitialized(true);
      setQuery(location.label);
      loadAqiData(location.lat, location.lng);

      // Try to get a readable name
      reverseGeocode(location.lat, location.lng).then((name) => {
        setQuery(name);
        setLocation((prev) => ({ ...prev, label: name }));
      });
    }
  }, [location, initialized, loadAqiData, setLocation]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.length >= 3) {
      debounceRef.current = setTimeout(async () => {
        const results = await searchPlace(value);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      }, 350);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectPlace = (place) => {
    setQuery(place.label);
    setLocation({ lat: place.lat, lng: place.lng, label: place.label });
    loadAqiData(place.lat, place.lng);
    setShowSuggestions(false);
    setInitialized(true);
  };

  const handleDetect = () => {
    setInitialized(false);
    detectLocation();
  };

  return (
    <section className="hero">
      <div className="hero-inner">
        <h1 className="hero-title">Check your air quality</h1>
        <div className="hero-search-wrapper" ref={wrapperRef}>
          <div className="hero-search">
            <svg className="hero-search-icon" viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            <input
              type="text"
              className="hero-search-input"
              placeholder="Search any place..."
              value={query}
              onChange={handleInputChange}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            />
            <button
              type="button"
              className="hero-gps-btn"
              onClick={handleDetect}
              disabled={loading}
              title="Use my location"
            >
              {loading ? (
                <span className="hero-spinner" />
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                  <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
                </svg>
              )}
            </button>
          </div>

          {showSuggestions && (
            <ul className="hero-suggestions">
              {suggestions.map((place, i) => (
                <li key={i}>
                  <button
                    className="hero-suggestion-item"
                    onClick={() => handleSelectPlace(place)}
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" className="hero-suggestion-pin">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                    {place.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {location && (
          <p className="hero-current-loc">
            📍 {location.label}
          </p>
        )}
      </div>
    </section>
  );
}

export default HeroLocationBanner;
