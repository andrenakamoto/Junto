import prisma from '../prisma';
import { GENEVA_TYPE_MAP } from './openagenda';

// Sources créées au démarrage si elles n'existent pas (l'état choisi ensuite dans le panneau admin est gardé).
const ODBL = { license: 'ODbL', licenseUrl: 'https://www.openstreetmap.org/copyright', attribution: '© les contributeurs d’OpenStreetMap' };
const GNS = (cityGroup: string) => ({ url: 'https://geneversleep.ch/partners/evly/feed.json', cityGroup });
const GNS_CREDIT = { license: 'Accord de partenariat', licenseUrl: 'https://geneversleep.ch', attribution: 'Source : GeNEVERsleep' };
const DEFAULT_SOURCES = [
  {
    key: 'openagenda-ville-geneve', name: 'Ville de Genève (OpenAgenda)', type: 'openagenda', region: 'ge', status: 'active', autoPublish: true,
    config: { agendaUid: 17821345, typeField: 'type-devenement', typeMap: GENEVA_TYPE_MAP, familyField: 'publics-cibles', familyValue: 27 },
    license: 'Licence Ouverte 2.0', licenseUrl: 'https://www.data.gouv.fr/pages/legal/licences/etalab-2.0/', attribution: 'Ville de Genève',
  },
  { key: 'osm-ge', name: 'OpenStreetMap – canton de Genève', type: 'osm', region: 'ge', status: 'active', autoPublish: true, config: { area: 'CH-GE' }, ...ODBL },
  { key: 'osm-la', name: 'OpenStreetMap – région de Lausanne', type: 'osm', region: 'la', status: 'active', autoPublish: true, config: { area: 'CH-VD', around: [46.5197, 6.6323, 12000] }, ...ODBL },
  { key: 'osm-vs', name: 'OpenStreetMap – Valais', type: 'osm', region: 'vs', status: 'active', autoPublish: true, config: { area: 'CH-VS' }, ...ODBL },
  { key: 'evly-plans', name: 'Organisateurs EvLY', type: 'plan', region: null, status: 'active', autoPublish: true, config: {}, license: null, licenseUrl: null, attribution: 'Organisateurs sur EvLY' },
  { key: 'manual', name: 'Saisie EvLY', type: 'manual', region: null, status: 'active', autoPublish: true, config: {}, license: null, licenseUrl: null, attribution: null },
  { key: 'partner-eventfrog', name: 'Eventfrog', type: 'partner', region: null, status: 'pending', autoPublish: false, config: {}, license: null, licenseUrl: null, attribution: 'Eventfrog' },
  // GeNEVERsleep (accord du 2026-10-25) : un flux, une source par ville ; à activer dans le panneau admin quand l'adresse est en ligne
  { key: 'partner-geneversleep', name: 'GeNEVERsleep – Genève', type: 'geneversleep', region: 'ge', status: 'pending', autoPublish: true, config: GNS('Genève'), ...GNS_CREDIT },
  { key: 'partner-geneversleep-la', name: 'GeNEVERsleep – Lausanne', type: 'geneversleep', region: 'la', status: 'pending', autoPublish: true, config: GNS('Lausanne'), ...GNS_CREDIT },
  { key: 'partner-ladecadanse', name: 'La Décadanse', type: 'partner', region: null, status: 'pending', autoPublish: false, config: {}, license: null, licenseUrl: null, attribution: 'La Décadanse' },
] as const;

// Lieux genevois vérifiés à la main (absents d'OpenStreetMap ou sans site web)
const MANUAL_PLACES = [
  { externalId: 'escape-lab', region: 'ge', name: 'Escape LAB', kind: 'escape', city: 'Genève', website: 'https://escapelab.ch/', family: false },
  { externalId: 'laser-game-geneve', region: 'ge', name: 'Laser Game Genève', kind: 'laser', city: 'Genève', website: 'https://www.lasergame-geneve.ch/', family: true },
  { externalId: 'gravity-park', region: 'ge', name: 'Gravity Park', kind: 'trampoline', city: 'Meyrin', website: 'https://gravity-park.ch/', family: true },
  { externalId: 'airloop', region: 'ge', name: 'AIRLOOP', kind: 'trampoline', city: 'Lancy', website: 'https://airloop.ch/', family: true },
  { externalId: 'yatouland', region: 'ge', name: 'Yatouland', kind: 'parc', city: 'Genève', website: 'https://yatouland.ch/', family: true },
];

export async function ensureDiscoverSources() {
  for (const s of DEFAULT_SOURCES) {
    await prisma.discoverSource.upsert({ where: { key: s.key }, create: { ...s, config: s.config as any }, update: {} });
  }
  // L'ancienne fiche « partenaire en attente » de GeNEVERsleep devient la source de Genève (son état reste celui choisi)
  const gns = DEFAULT_SOURCES.find(s => s.key === 'partner-geneversleep')!;
  await prisma.discoverSource.updateMany({
    where: { key: 'partner-geneversleep', type: 'partner' },
    data: { name: gns.name, type: gns.type, region: gns.region, autoPublish: gns.autoPublish, config: gns.config as any, license: gns.license, licenseUrl: gns.licenseUrl, attribution: gns.attribution },
  });
  const manual = await prisma.discoverSource.findUnique({ where: { key: 'manual' } });
  if (!manual) return;
  for (const p of MANUAL_PLACES) {
    await prisma.discoverPlace.upsert({ where: { sourceId_externalId: { sourceId: manual.id, externalId: p.externalId } }, create: { ...p, sourceId: manual.id }, update: {} });
  }
}
