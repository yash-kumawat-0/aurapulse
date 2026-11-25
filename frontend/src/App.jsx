// ============================================
// App Root — Minimal Single-Page Layout
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

  return (
    <UserProvider>
      <AqiProvider>
        <div className="app">
          <Navbar />
          <main className="app-main">
            <HeroLocationBanner />

            {/* Tab Navigation */}
            <div className="container">
              <nav className="tab-nav">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={`tab-btn ${activeTab === tab.id ? 'tab-btn--active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <span className="tab-icon">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="container tab-content">
              {activeTab === 'dashboard' && (
                <section className="tab-panel" id="dashboard">
                  <AqiSummaryCard />
                  <DiurnalTimeline />
                </section>
              )}

              {activeTab === 'commute' && (
                <section className="tab-panel" id="commute">
                  <CommuteDoseCalculator />
                </section>
              )}

              {activeTab === 'family' && (
                <section className="tab-panel" id="family">
                  <FamilyProfileList />
                  <FamilyAdviceCard />
                </section>
              )}

              {activeTab === 'indoor' && (
                <section className="tab-panel" id="indoor">
                  <IndoorAirSimulator />
                </section>
              )}
            </div>

            {/* Share Button — always visible */}
            <div className="container share-section">
              <button
                className="share-btn"
                onClick={() => setShowWhatsAppModal(true)}
              >
                📱 Share Air Quality Report
              </button>
            </div>

            {showWhatsAppModal && (
              <WhatsAppShareModal onClose={() => setShowWhatsAppModal(false)} />
            )}
          </main>
          <Footer />
        </div>
      </AqiProvider>
    </UserProvider>
  );
}

export default App;
