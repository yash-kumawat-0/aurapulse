// ============================================
// WhatsAppShareModal Component — Accessible Dialog & Safe Links
// ============================================
import { useEffect, useState } from 'react';
import { useUser } from '../../context/UserContext.jsx';
import { useAqi } from '../../context/AqiContext.jsx';
import './WhatsAppShareModal.css';

function WhatsAppShareModal({ onClose }) {
  const { location } = useUser();
  const { currentAqi, diurnalData } = useAqi();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const diurnal = diurnalData?.diurnal;
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
    window.open(`https://wa.me/?text=${encoded}`, '_blank', 'noopener,noreferrer');
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(bulletin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="whatsapp-overlay">
      <button
        type="button"
        className="whatsapp-backdrop-btn"
        aria-label="Close clean air bulletin"
        onClick={onClose}
      />
      <div className="whatsapp-modal" role="dialog" aria-modal="true" aria-labelledby="whatsapp-modal-title">
        <div className="whatsapp-header">
          <h2 id="whatsapp-modal-title">📱 Clean Air Bulletin</h2>
          <button
            type="button"
            className="whatsapp-close-btn"
            onClick={onClose}
            aria-label="Close clean air bulletin"
          >
            ✕
          </button>
        </div>
        <div className="whatsapp-body">
          <div className="whatsapp-preview">{bulletin}</div>
        </div>
        <div className="whatsapp-actions">
          <button type="button" className="whatsapp-share-btn" onClick={handleShare}>
            📤 Share on WhatsApp
          </button>
          <button type="button" className="whatsapp-copy-btn" onClick={handleCopy}>
            {copied ? '✓ Copied!' : '📋 Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default WhatsAppShareModal;
