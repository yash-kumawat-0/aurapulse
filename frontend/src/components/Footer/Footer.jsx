// ============================================
// Footer Component — Accessible Headings & Clean UI
// ============================================
import './Footer.css';

const QUICK_TABS = [
  { id: 'dashboard', label: 'Air Quality' },
  { id: 'commute', label: 'Commute Planner' },
  { id: 'family', label: 'Family Plan' },
  { id: 'indoor', label: 'Indoor Air' },
];

const DATA_SOURCES = ['Google Air Quality', 'Open-Meteo', 'OSM & OSRM', 'Gemini AI'];

function Footer({ onSelectTab }) {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-top">
          <div className="footer-brand-col">
            <div className="footer-brand-row">
              <span className="footer-brand-mark" aria-hidden="true">
                🍃
              </span>
              <span className="footer-brand-name">AuraPulse</span>
              <span className="footer-status-pill">
                <span className="footer-status-dot" aria-hidden="true" />
                Live Telemetry
              </span>
            </div>
            <p className="footer-tagline">
              Hyper-local air quality tracking, inhaled commute dose comparison, and personalized clean-air
              guidance.
            </p>
          </div>

          <nav className="footer-col" aria-label="Footer navigation">
            <h2 className="footer-col-title">Explore</h2>
            <ul className="footer-nav-list">
              {QUICK_TABS.map((tab) => (
                <li key={tab.id}>
                  <button type="button" className="footer-nav-btn" onClick={() => onSelectTab?.(tab.id)}>
                    {tab.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="footer-col">
            <h2 className="footer-col-title">Sources & Code</h2>
            <div className="footer-sources">
              {DATA_SOURCES.map((source) => (
                <span key={source} className="footer-source-chip">
                  {source}
                </span>
              ))}
            </div>
            <a
              className="footer-repo-link"
              href="https://github.com/yash-kumawat-0/aurapulse"
              target="_blank"
              rel="noopener noreferrer"
            >
              View on GitHub ↗
            </a>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="footer-disclaimer">
            Environmental awareness guidance only — consult a qualified healthcare professional for medical
            advice.
          </p>
          <span className="footer-copy">© {new Date().getFullYear()} AuraPulse</span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
