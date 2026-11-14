import { ReactNode, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import { X } from 'lucide-react';
import { DiscoverEvent, DiscoverPlace, KIND_EMOJI } from '../../lib/discover';
import { t } from '../../i18n';

// Carte de Découvrir (2026-11-14) : fond de carte de swisstopo (carte nationale, gratuite, « © swisstopo »), une épingle par
// idée de sortie (emoji de son type) et par événement (corail), regroupées quand on dézoome. Toucher une épingle affiche sa
// fiche en bas de la carte (rendue par DiscoverView). Chargée à la demande (Leaflet n'alourdit pas le reste de l'app).
// Les images de la carte viennent de wmts.geo.admin.ch : le navigateur de la personne les demande à swisstopo.

export type MapItem = { type: 'event'; e: DiscoverEvent } | { type: 'place'; p: DiscoverPlace };

const TILES = 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg';
const SWISS = L.latLngBounds([45.6, 5.7], [47.9, 10.6]);

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const placeIcon = (kind: string) => L.divIcon({
  className: '', iconSize: [30, 30], iconAnchor: [15, 15],
  html: `<div class="evly-pin">${esc(KIND_EMOJI[kind] ?? '📍')}</div>`,
});
const eventIcon = L.divIcon({ className: '', iconSize: [30, 30], iconAnchor: [15, 15], html: '<div class="evly-pin evly-pin-event">🎟️</div>' });

export function DiscoverMap({ items, center, radiusKm, here, renderSelected }: {
  items: MapItem[];
  center: { lat: number; lon: number } | null;
  radiusKm: number | null;
  here: boolean;
  renderSelected: (item: MapItem) => ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<{ pins: L.MarkerClusterGroup; area: L.LayerGroup } | null>(null);
  const [selected, setSelected] = useState<MapItem | null>(null);

  // Création de la carte (une fois)
  useEffect(() => {
    if (!box.current) return;
    const m = L.map(box.current, { zoomControl: true, attributionControl: true, maxBounds: SWISS.pad(0.3), minZoom: 7, maxZoom: 19 });
    L.tileLayer(TILES, {
      maxZoom: 19, attribution: '© <a href="https://www.swisstopo.admin.ch" target="_blank" rel="noopener noreferrer">swisstopo</a>',
    }).addTo(m);
    m.attributionControl.setPrefix(false);
    const pins = L.markerClusterGroup({
      chunkedLoading: true, showCoverageOnHover: false, maxClusterRadius: 50,
      iconCreateFunction: c => L.divIcon({ className: '', iconSize: [36, 36], iconAnchor: [18, 18], html: `<div class="evly-cluster">${c.getChildCount()}</div>` }),
    });
    const area = L.layerGroup();
    m.addLayer(area); m.addLayer(pins);
    m.on('click', () => setSelected(null));
    map.current = m; layers.current = { pins, area };
    m.setView([46.8, 8.2], 8);
    // La colonne peut changer de taille après l'affichage (téléphone, grand écran)
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(box.current);
    return () => { ro.disconnect(); m.remove(); map.current = null; layers.current = null; };
  }, []);

  // Rayon et position choisis
  useEffect(() => {
    const m = map.current, l = layers.current;
    if (!m || !l) return;
    l.area.clearLayers();
    if (center && radiusKm) {
      const circle = L.circle([center.lat, center.lon], { radius: radiusKm * 1000, color: '#ea5a2b', weight: 2, fillOpacity: 0.04, interactive: false }).addTo(l.area);
      if (here) L.circleMarker([center.lat, center.lon], { radius: 7, color: '#fff', weight: 2, fillColor: '#2563eb', fillOpacity: 1, interactive: false }).addTo(l.area);
      m.fitBounds(circle.getBounds(), { padding: [10, 10] });
    }
  }, [center?.lat, center?.lon, radiusKm, here]);

  // Épingles
  useEffect(() => {
    const m = map.current, l = layers.current;
    if (!m || !l) return;
    l.pins.clearLayers();
    setSelected(null);
    const markers: L.Marker[] = [];
    for (const it of items) {
      const o = it.type === 'event' ? it.e : it.p;
      if (o.lat == null || o.lon == null) continue;
      const mk = L.marker([o.lat, o.lon], { icon: it.type === 'event' ? eventIcon : placeIcon(it.p.kind), title: it.type === 'event' ? it.e.title : it.p.name });
      mk.on('click', ev => { L.DomEvent.stopPropagation(ev); setSelected(it); });
      markers.push(mk);
    }
    l.pins.addLayers(markers);
    // Canton entier (pas de rayon) : la carte se cale sur les épingles
    if (!radiusKm && markers.length) m.fitBounds(l.pins.getBounds(), { padding: [20, 20], maxZoom: 13 });
  }, [items]);

  const located = items.filter(it => (it.type === 'event' ? it.e : it.p).lat != null).length;
  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100">
      <style>{`
        .evly-pin { width: 30px; height: 30px; border-radius: 9999px; background: #fff; border: 2px solid #ea5a2b; display: flex; align-items: center;
          justify-content: center; font-size: 16px; line-height: 1; box-shadow: 0 1px 4px rgba(15,23,42,.35); }
        .evly-pin-event { background: #ea5a2b; border-color: #fff; }
        .evly-cluster { width: 36px; height: 36px; border-radius: 9999px; background: #ea5a2b; color: #fff; font: 700 13px Inter, sans-serif; display: flex;
          align-items: center; justify-content: center; border: 3px solid rgba(255,255,255,.85); box-shadow: 0 1px 5px rgba(15,23,42,.4); }
      `}</style>
      <div ref={box} className="h-[65vh] min-h-[340px] max-h-[720px] w-full" />
      {located === 0 && (
        <p className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] bg-white/95 rounded-full px-3 py-1.5 text-xs text-slate-600 shadow">{t('discover.map.empty')}</p>
      )}
      {selected && (
        <div className="absolute left-2 right-2 bottom-2 z-[500] max-h-[60%] overflow-y-auto">
          <div className="relative">
            <button onClick={() => setSelected(null)} aria-label={t('common.close')}
              className="absolute -top-2 -right-1 z-10 w-7 h-7 rounded-full bg-white border border-slate-200 shadow flex items-center justify-center text-slate-500">
              <X size={14} />
            </button>
            {renderSelected(selected)}
          </div>
        </div>
      )}
    </div>
  );
}
