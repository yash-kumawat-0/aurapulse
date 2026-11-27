// ============================================
// Navbar Component — Minimal & Accessible
// ============================================
import { useUser } from '../../context/UserContext.jsx';
import './Navbar.css';

function Navbar() {
  const { language, setLanguage } = useUser();

  return (
    <header>
      <nav className="navbar" aria-label="Primary navigation">
        <div className="navbar-inner">
          <a href="#main-content" className="navbar-brand">
            <span className="navbar-brand-icon" aria-hidden="true">🍃</span>
            <span>AuraPulse</span>
          </a>

          <select
            className="navbar-lang-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            aria-label="Select Language"
          >
            <option value="English">EN</option>
            <option value="Hindi">हिं</option>
            <option value="Telugu">తె</option>
          </select>
        </div>
      </nav>
    </header>
  );
}

export default Navbar;
