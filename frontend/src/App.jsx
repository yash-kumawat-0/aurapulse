// ============================================
// App Root — Accessible Single-Page Layout
// ============================================
import { useState } from 'react';
import { UserProvider } from './context/UserContext.jsx';
import { AqiProvider } from './context/AqiContext.jsx';
import Navbar from './components/Navbar/Navbar.jsx';
import HeroLocationBanner from './components/HeroLocationBanner/HeroLocationBanner.jsx';
import AqiSummaryCard from './components/AqiSummaryCard/AqiSummaryCard.jsx';
import DiurnalTimeline from './components/DiurnalTimeline/DiurnalTimeline.jsx';
import FamilyProfileList from './components/FamilyProfileList/FamilyProfileList.jsx';
import FamilyAdviceCard from './components/FamilyAdviceCard/FamilyAdviceCard.jsx';
import IndoorAirSimulator from './components/IndoorAirSimulator/IndoorAirSimulator.jsx';
import CommuteDoseCalculator from './components/CommuteDoseCalculator/CommuteDoseCalculator.jsx';
import WhatsAppShareModal from './components/WhatsAppShareModal/WhatsAppShareModal.jsx';
import Footer from './components/Footer/Footer.jsx';

function App() {
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabs = [
    { id: 'dashboard', label: 'Air Quality', icon: '🌤️' },
    { id: 'commute', label: 'Commute', icon: '🚗' },
    { id: 'family', label: 'Family Plan', icon: '👨‍👩‍👧' },
    { id: 'indoor', label: 'Indoor Air', icon: '🏠' },
  ];

  const handleTabSelect = (tabId, forceTop = false) => {
    setActiveTab(tabId);
    if (forceTop || window.scrollY > 120) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <UserProvider>
      <AqiProvider>
        <div className="app">
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>
          <Navbar />
          <main id="main-content" className="app-main" tabIndex={-1}>
            <HeroLocationBanner activeTab={activeTab} />

            {/* Accessible Tab Navigation */}
            <div className="container">
              <nav aria-label="AuraPulse Core Workflows">
                <div className="tab-nav" role="tablist">
                  {tabs.map((tab) => {
                    const selected = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        id={`tab-${tab.id}`}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        aria-controls={tab.id}
                        className={`tab-btn ${selected ? 'tab-btn--active' : ''}`}
                        onClick={() => handleTabSelect(tab.id)}
                      >
                        <span className="tab-icon" aria-hidden="true">{tab.icon}</span>
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </nav>
            </div>

            {/* Active Workflow Panel */}
            <div className="container tab-content" aria-live="polite">
              {activeTab === 'dashboard' && (
                <section className="tab-panel" id="dashboard" role="tabpanel" aria-labelledby="tab-dashboard">
                  <AqiSummaryCard />
                  <DiurnalTimeline />
                </section>
              )}

              {activeTab === 'commute' && (
                <section className="tab-panel" id="commute" role="tabpanel" aria-labelledby="tab-commute">
                  <CommuteDoseCalculator />
                </section>
              )}

              {activeTab === 'family' && (
                <section className="tab-panel" id="family" role="tabpanel" aria-labelledby="tab-family">
                  <FamilyProfileList />
                  <FamilyAdviceCard />
                </section>
              )}

              {activeTab === 'indoor' && (
                <section className="tab-panel" id="indoor" role="tabpanel" aria-labelledby="tab-indoor">
                  <IndoorAirSimulator />
                </section>
              )}
            </div>

            {/* Floating Compact Corner Share Button */}
            <button
              type="button"
              className="share-fab"
              onClick={() => setShowWhatsAppModal(true)}
              title="Share Air Quality Report"
              aria-label="Share Air Quality Report"
            >
              <span aria-hidden="true">📱</span>
              <span>Share Report</span>
            </button>

            {showWhatsAppModal && (
              <WhatsAppShareModal onClose={() => setShowWhatsAppModal(false)} />
            )}
          </main>
          <Footer onSelectTab={(tabId) => handleTabSelect(tabId, true)} />
        </div>
      </AqiProvider>
    </UserProvider>
  );
}

export default App;
