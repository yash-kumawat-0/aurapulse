// ============================================
// Footer Component
// ============================================
import './Footer.css';

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          🍃 AuraPulse
        </div>

        <p className="footer-disclaimer">
          ⚠️ AuraPulse provides environmental awareness guidance, not medical advice.
          Always consult your doctor for health conditions. Air quality data sourced from
          Google Maps Air Quality API and may have inherent uncertainties.
        </p>

        <div className="footer-links">
          <a className="footer-link" href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a className="footer-link" href="https://promptwars.in" target="_blank" rel="noopener noreferrer">PromptWars</a>
          <a className="footer-link" href="https://developers.google.com" target="_blank" rel="noopener noreferrer">Google for Developers</a>
        </div>

        <div className="footer-credits">
          Built for PromptWars Virtual Challenge 6 — Google for Developers × Hack2Skill •
          Powered by Google Gemini AI + Google Maps Air Quality API
        </div>
      </div>
    </footer>
  );
}

export default Footer;
