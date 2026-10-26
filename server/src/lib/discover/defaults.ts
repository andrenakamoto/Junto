import prisma from '../prisma';
import { GENEVA_TYPE_MAP } from './openagenda';
import { fillMissingCoords } from './geo';
import { CANTONS, REGIONS } from './model';

// Sources créées au démarrage si elles n'existent pas (l'état choisi ensuite dans le panneau admin est gardé).
const ODBL = { license: 'ODbL', licenseUrl: 'https://www.openstreetmap.org/copyright', attribution: '© les contributeurs d’OpenStreetMap' };
const GNS_FEED = 'https://geneversleep.ch/partners/evly/feed.json';
const GNS_CREDIT = { license: 'Accord de partenariat', licenseUrl: 'https://geneversleep.ch', attribution: 'Source : GeNEVERsleep' };
const DEFAULT_SOURCES = [
  {
    key: 'openagenda-ville-geneve', name: 'Ville de Genève (OpenAgenda)', type: 'openagenda', region: 'ge', status: 'active', autoPublish: true,
    config: { agendaUid: 17821345, typeField: 'type-devenement', typeMap: GENEVA_TYPE_MAP, familyField: 'publics-cibles', familyValue: 27 },
    license: 'Licence Ouverte 2.0', licenseUrl: 'https://www.data.gouv.fr/pages/legal/licences/etalab-2.0/', attribution: 'Ville de Genève',
  },
  // Idées de sorties : un canton par source, toute la Suisse depuis le 2026-10-25 (avant : Genève, Vaud autour de Lausanne, Valais)
  ...REGIONS.map(r => ({ key: `osm-${r}`, name: `OpenStreetMap – ${CANTONS[r].name}`, type: 'osm', region: r, status: 'active', autoPublish: true, config: { area: CANTONS[r].iso }, ...ODBL })),
  { key: 'evly-plans', name: 'Organisateurs EvLY', type: 'plan', region: null, status: 'active', autoPublish: true, config: {}, license: null, licenseUrl: null, attribution: 'Organisateurs sur EvLY' },
  { key: 'manual', name: 'Saisie EvLY', type: 'manual', region: null, status: 'active', autoPublish: true, config: {}, license: null, licenseUrl: null, attribution: null },
  // Eventfrog (Public API, accord du 2026-10-26) : toute la Suisse, une seule source ; chaque événement rangé d'après sa ville
  { key: 'partner-eventfrog', name: 'Eventfrog (toute la Suisse)', type: 'eventfrog', region: 'ge', status: 'pending', autoPublish: true, config: { country: 'CH' },
    license: 'Conditions de l’API Eventfrog', licenseUrl: 'https://eventfrog.ch/fr/agb.html', attribution: 'Source : Eventfrog' },
  // GeNEVERsleep (accord du 2026-10-25) : une source pour tout le flux, toutes villes (chaque événement rangé d'après sa ville) ; à
  // activer dans le panneau admin quand l'adresse est en ligne
  { key: 'partner-geneversleep', name: 'GeNEVERsleep', type: 'geneversleep', region: 'ge', status: 'pending', autoPublish: true, config: { url: GNS_FEED }, ...GNS_CREDIT },
  { key: 'partner-ladecadanse', name: 'La Décadanse', type: 'partner', region: null, status: 'pending', autoPublish: false, config: {}, license: null, licenseUrl: null, attribution: 'La Décadanse' },
];

// Lieux genevois vérifiés à la main (absents d'OpenStreetMap ou sans site web)
const MANUAL_PLACES = [
  { externalId: 'escape-lab', region: 'ge', name: 'Escape LAB', kind: 'escape', city: 'Genève', website: 'https://escapelab.ch/', family: false },
  { externalId: 'laser-game-geneve', region: 'ge', name: 'Laser Game Genève', kind: 'laser', city: 'Genève', website: 'https://www.lasergame-geneve.ch/', family: true },
  { externalId: 'gravity-park', region: 'ge', name: 'Gravity Park', kind: 'trampoline', city: 'Meyrin', website: 'https://gravity-park.ch/', family: true },
  { externalId: 'airloop', region: 'ge', name: 'AIRLOOP', kind: 'trampoline', city: 'Lancy', website: 'https://airloop.ch/', family: true },
  { externalId: 'yatouland', region: 'ge', name: 'Yatouland', kind: 'parc', city: 'Genève', website: 'https://yatouland.ch/', family: true },
];

// Sources de base : recréées au démarrage, donc pas supprimables dans le panneau admin (seulement désactivables)
export const DEFAULT_SOURCE_KEYS = new Set(DEFAULT_SOURCES.map(s => s.key));

export async function ensureDiscoverSources() {
  for (const s of DEFAULT_SOURCES) {
    await prisma.discoverSource.upsert({ where: { key: s.key }, create: { ...s, config: s.config as any }, update: {} });
  }
  // OpenStreetMap Vaud : l'ancienne source limitée à Lausanne couvre désormais tout le canton (synchronisée au prochain passage)
  await prisma.discoverSource.updateMany({ where: { key: 'osm-la', name: 'OpenStreetMap – région de Lausanne' }, data: { name: 'OpenStreetMap – canton de Vaud', config: { area: 'CH-VD' }, lastSyncAt: null } });
  // GeNEVERsleep : l'ancienne fiche « partenaire en attente », puis la source « Genève » du 25 octobre, deviennent la source unique
  // de tout le flux (son état reste celui choisi) ; l'ancienne source « Lausanne » disparaît avec ses événements
  const gns = DEFAULT_SOURCES.find(s => s.key === 'partner-geneversleep')!;
  const gnsLa = await prisma.discoverSource.findUnique({ where: { key: 'partner-geneversleep-la' }, select: { id: true } });
  if (gnsLa) {
    await prisma.discoverEvent.deleteMany({ where: { sourceId: gnsLa.id } });
    await prisma.discoverSource.delete({ where: { id: gnsLa.id } });
  }
  await prisma.discoverSource.updateMany({
    where: { key: 'partner-geneversleep', OR: [{ type: 'partner' }, { name: 'GeNEVERsleep – Genève' }] },
    data: { name: gns.name, type: gns.type, region: gns.region, autoPublish: gns.autoPublish, config: gns.config as any, license: gns.license, licenseUrl: gns.licenseUrl, attribution: gns.attribution },
  });
  // L'ancienne fiche « partenaire en attente » d'Eventfrog devient le connecteur de l'API (son état reste celui choisi)
  const ef = DEFAULT_SOURCES.find(s => s.key === 'partner-eventfrog')!;
  await prisma.discoverSource.updateMany({
    where: { key: 'partner-eventfrog', type: 'partner' },
    data: { name: ef.name, type: ef.type, region: ef.region, autoPublish: ef.autoPublish, config: ef.config as any, license: ef.license, licenseUrl: ef.licenseUrl, attribution: ef.attribution },
  });
  const manual = await prisma.discoverSource.findUnique({ where: { key: 'manual' } });
  if (!manual) return;
  for (const p of MANUAL_PLACES) {
    await prisma.discoverPlace.upsert({ where: { sourceId_externalId: { sourceId: manual.id, externalId: p.externalId } }, create: { ...p, sourceId: manual.id }, update: {} });
  }
  await fillMissingCoords(prisma).catch(e => console.error('[discover] positions', e));
}
