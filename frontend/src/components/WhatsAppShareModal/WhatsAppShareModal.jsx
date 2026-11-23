// ============================================
// WhatsAppShareModal Component
// ============================================
import { useUser } from '../../context/UserContext.jsx';
import { useAqi } from '../../context/AqiContext.jsx';
import './WhatsAppShareModal.css';

function WhatsAppShareModal({ onClose }) {
  const { location } = useUser();
  const { currentAqi, diurnalData } = useAqi();

  const diurnal = diurnalData?.diurnal;

  // Build the bulletin message
  const locationLabel = location?.label || 'Your Area';
  const aqi = currentAqi?.aqi || '—';
  const pm25 = currentAqi?.pm25 ? Math.round(currentAqi.pm25) : '—';
  const cleanWindow = diurnal?.cleanest_window
    ? `${diurnal.cleanest_window.start_label} – ${diurnal.cleanest_window.end_label}`
    : 'Not available';
  const morningWarning = diurnal?.morning_trap_warning
    ? '⚠️ MORNING INVERSION ACTIVE: Avoid outdoor activity before 9 AM. Pollutants are trapped at ground level.'
    : '✅ No severe morning inversion detected today.';

  const bulletin = `🌬️ *AuraPulse — Neighborhood Clean Air Alert*
📍 ${locationLabel}
📅 ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}

📊 *Current Air Quality*
• AQI: ${aqi} | PM2.5: ${pm25} µg/m³
• Category: ${currentAqi?.aqi_category || '—'}

⏰ *Today's Safe Ventilation Window*
${diurnal?.ventilation_recommendation?.window || cleanWindow}

${morningWarning}

✅ *Best Time for Outdoor Activity*
${cleanWindow}

💡 *Quick Tips for Today:*
• Open windows ONLY during the safe ventilation window
• Keep air purifiers running on high during morning hours
• If commuting, prefer metro/bus over two-wheeler today
• Children and elderly: stay indoors until afternoon

🏠 Homes participating in clean air tracking: Share this with your society group!

_Powered by AuraPulse • Google Maps Air Quality API • Gemini AI_`;

  const handleShare = () => {
    const encoded = encodeURIComponent(bulletin);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(bulletin);
  };

  return (
    <div className="whatsapp-overlay" onClick={onClose}>
      <div className="whatsapp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="whatsapp-header">
          <h3>📱 Clean Air Bulletin</h3>
          <button className="whatsapp-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="whatsapp-body">
          <div className="whatsapp-preview">{bulletin}</div>
        </div>
        <div className="whatsapp-actions">
          <button className="whatsapp-share-btn" onClick={handleShare}>
            📤 Share on WhatsApp
          </button>
          <button className="whatsapp-copy-btn" onClick={handleCopy}>
            📋 Copy
          </button>
        </div>
      </div>
    </div>
  );
}

export default WhatsAppShareModal;
