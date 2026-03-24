import { useState } from "react";
import { Navigation } from "lucide-react";

const ADDRESS = "Calle San Vicente Mártir, 24, 46002 Valencia";
const COORDS = "39.4700,-0.3773";
const GOOGLE_MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADDRESS)}`;
const APPLE_MAPS_URL = `https://maps.apple.com/?q=${encodeURIComponent(ADDRESS)}&ll=${COORDS}`;

const MapBlock = () => {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="relative w-full aspect-video md:aspect-[21/9] rounded overflow-hidden border border-border">
      <iframe
        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3080.0!2d-0.3773!3d39.4700!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xd604f4cf0efb06f%3A0x0!2sCalle%20San%20Vicente%20M%C3%A1rtir%2C%2024%2C%2046002%20Valencia!5e0!3m2!1sen!2ses!4v1700000000000"
        width="100%"
        height="100%"
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        title="Ubicación de Elias Masaje en Valencia"
      />
      {/* Clickable overlay */}
      <button
        onClick={() => setShowPicker(true)}
        className="absolute inset-0 z-10 bg-transparent cursor-pointer"
        aria-label="Open in maps app"
      />
      {showPicker && <MapPickerOverlay onClose={() => setShowPicker(false)} />}
    </div>
  );
};

export const MapPickerOverlay = ({ onClose }: { onClose: () => void }) => (
  <>
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />
    <div className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-2xl border border-border shadow-xl p-6 w-[min(90vw,320px)] space-y-3">
      <h3 className="font-display text-lg text-center mb-4">Open in…</h3>
      <a
        href={GOOGLE_MAPS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-border hover:bg-secondary transition-colors"
        onClick={onClose}
      >
        <Navigation size={18} className="text-primary" />
        <span className="text-sm font-body font-medium">Google Maps</span>
      </a>
      <a
        href={APPLE_MAPS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-border hover:bg-secondary transition-colors"
        onClick={onClose}
      >
        <Navigation size={18} className="text-primary" />
        <span className="text-sm font-body font-medium">Apple Maps</span>
      </a>
      <button
        onClick={onClose}
        className="w-full text-center text-xs text-muted-foreground py-2 hover:text-foreground transition-colors"
      >
        Cancel
      </button>
    </div>
  </>
);

export default MapBlock;
