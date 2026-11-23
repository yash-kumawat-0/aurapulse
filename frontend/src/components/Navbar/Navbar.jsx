// ============================================
// Navbar Component — Minimal
// ============================================
import { useUser } from '../../context/UserContext.jsx';
import './Navbar.css';

function Navbar() {
  const { language, setLanguage } = useUser();

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <a href="#" className="navbar-brand">
          <span className="navbar-brand-icon">🍃</span>
          AuraPulse
        </a>

        <select
          className="navbar-lang-select"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          <option value="English">EN</option>
          <option value="Hindi">हिं</option>
          <option value="Telugu">తె</option>
        </select>
      </div>
    </nav>
  );
}

export default Navbar;
