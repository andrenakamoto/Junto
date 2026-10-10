// Listes par défaut des jeux, par langue (celle du créateur du Plan) : objets et lieux du Killer,
// mots du mot piège, noms des équipes (même ordre que les couleurs de lib/teams.ts).
import type { Locale } from '../lib/i18n';

export const KILLER_OBJECTS: Record<Locale, string[]> = {
  fr: ['une cuillère', 'un verre', 'une serviette', 'un bouchon', 'un stylo', 'une clé', 'une pièce de monnaie', 'une carte à jouer', 'un citron', 'un élastique', 'une chaussette', 'un ticket'],
  de: ['einen Löffel', 'ein Glas', 'eine Serviette', 'einen Korken', 'einen Kugelschreiber', 'einen Schlüssel', 'eine Münze', 'eine Spielkarte', 'eine Zitrone', 'ein Gummiband', 'eine Socke', 'ein Ticket'],
  it: ['un cucchiaio', 'un bicchiere', 'un tovagliolo', 'un tappo', 'una penna', 'una chiave', 'una moneta', 'una carta da gioco', 'un limone', 'un elastico', 'un calzino', 'un biglietto'],
  en: ['a spoon', 'a glass', 'a napkin', 'a cork', 'a pen', 'a key', 'a coin', 'a playing card', 'a lemon', 'a rubber band', 'a sock', 'a ticket'],
};

export const KILLER_PLACES: Record<Locale, string[]> = {
  fr: ['dans la cuisine', 'à table', 'près d’une fenêtre', 'dans un couloir', 'dehors', 'devant un miroir', 'près de la porte d’entrée', 'assis(e) sur un canapé', 'près du bar', 'dans l’escalier'],
  de: ['in der Küche', 'am Tisch', 'neben einem Fenster', 'in einem Gang', 'draussen', 'vor einem Spiegel', 'bei der Eingangstür', 'auf einem Sofa sitzend', 'an der Bar', 'im Treppenhaus'],
  it: ['in cucina', 'a tavola', 'vicino a una finestra', 'in un corridoio', 'fuori', 'davanti a uno specchio', 'vicino alla porta d’ingresso', 'seduto/a su un divano', 'vicino al bar', 'sulle scale'],
  en: ['in the kitchen', 'at the table', 'near a window', 'in a corridor', 'outside', 'in front of a mirror', 'by the front door', 'sitting on a sofa', 'near the bar', 'on the stairs'],
};

type Levels = { facile: string[]; moyen: string[]; difficile: string[] };
export const TRAP_WORDS: Record<Exclude<Locale, 'fr'>, Levels> = {
  de: {
    facile: ['Ferien', 'Schokolade', 'Regenschirm', 'Geburtstag', 'Schwimmbad', 'Berg', 'Käse', 'Auto', 'Sonne', 'Schnee', 'Kino', 'Kuchen', 'Garten', 'Velo', 'Pizza', 'Kaffee', 'Zug', 'Schuhe', 'Musik', 'Wochenende', 'Brille', 'Koffer', 'Restaurant', 'Flasche', 'Fussball', 'Lied', 'Foto', 'Wald', 'Glace', 'Regen', 'Dessert', 'Spiegel', 'Strand', 'Büro', 'Hund', 'Telefon', 'Küche', 'See', 'Fenster', 'Bäckerei'],
    moyen: ['Giraffe', 'Trampolin', 'Schnurrbart', 'Krokodil', 'U-Boot', 'Handorgel', 'Pyjama', 'Brokkoli', 'Einhorn', 'Vulkan', 'Iglu', 'Känguru', 'Saxofon', 'Papagei', 'Traktor', 'Dinosaurier', 'Kaktus', 'Tornado', 'Astronaut', 'Pirat', 'Schloss', 'Raclette', 'Essiggurke', 'Helikopter', 'Aquarium', 'Kompass', 'Kaugummi', 'Schnecke', 'Pinguin', 'Murmeltier', 'Schmetterling', 'Rutschbahn', 'Hexe', 'Ausserirdischer', 'Grapefruit', 'Brezel', 'Marienkäfer', 'Karaoke', 'Heissluftballon', 'Fondue'],
    difficile: ['Schnabeltier', 'Sansibar', 'Nilpferd', 'Bauchredner', 'Tyrannosaurus', 'Chrysantheme', 'Timbuktu', 'Taucheranzug', 'Abrakadabra', 'Mississippi', 'Briefmarkensammlung', 'Zeppelin', 'Kilt', 'Jodel', 'Pottwal', 'Dudelsack', 'Tutanchamun', 'Xylofon', 'Paparazzi', 'Bumerang', 'Wladiwostok', 'Origami', 'Mammut', 'Ameisenbär', 'Kamtschatka', 'Pelikan', 'Harfe', 'Tiramisu', 'Gondel', 'Bollywood', 'Sumo', 'Makramee', 'Gürteltier', 'Narwal', 'Yeti', 'Fakir', 'Drachen', 'Flamingo', 'Kleopatra', 'Atlantis'],
  },
  it: {
    facile: ['vacanze', 'cioccolato', 'ombrello', 'compleanno', 'piscina', 'montagna', 'formaggio', 'macchina', 'sole', 'neve', 'cinema', 'torta', 'giardino', 'bicicletta', 'pizza', 'caffè', 'treno', 'scarpe', 'musica', 'fine settimana', 'occhiali', 'valigia', 'ristorante', 'bottiglia', 'calcio', 'canzone', 'foto', 'bosco', 'gelato', 'pioggia', 'dolce', 'specchio', 'spiaggia', 'ufficio', 'cane', 'telefono', 'cucina', 'lago', 'finestra', 'panetteria'],
    moyen: ['giraffa', 'trampolino', 'baffi', 'coccodrillo', 'sottomarino', 'fisarmonica', 'pigiama', 'broccolo', 'unicorno', 'vulcano', 'igloo', 'canguro', 'sassofono', 'pappagallo', 'trattore', 'dinosauro', 'cactus', 'tornado', 'astronauta', 'pirata', 'castello', 'raclette', 'cetriolino', 'elicottero', 'acquario', 'bussola', 'chewing-gum', 'lumaca', 'pinguino', 'marmotta', 'farfalla', 'scivolo', 'strega', 'extraterrestre', 'pompelmo', 'brezel', 'coccinella', 'karaoke', 'mongolfiera', 'fonduta'],
    difficile: ['ornitorinco', 'Zanzibar', 'ippopotamo', 'ventriloquo', 'tirannosauro', 'crisantemo', 'Timbuctù', 'scafandro', 'abracadabra', 'Mississippi', 'filatelia', 'zeppelin', 'kilt', 'jodel', 'capodoglio', 'cornamusa', 'Tutankhamon', 'xilofono', 'paparazzi', 'boomerang', 'Vladivostok', 'origami', 'mammut', 'formichiere', 'Kamčatka', 'pellicano', 'arpa', 'tiramisù', 'gondola', 'Bollywood', 'sumo', 'macramè', 'armadillo', 'narvalo', 'yeti', 'fachiro', 'aquilone', 'fenicottero', 'Cleopatra', 'Atlantide'],
  },
  en: {
    facile: ['holiday', 'chocolate', 'umbrella', 'birthday', 'swimming pool', 'mountain', 'cheese', 'car', 'sun', 'snow', 'cinema', 'cake', 'garden', 'bike', 'pizza', 'coffee', 'train', 'shoes', 'music', 'weekend', 'glasses', 'suitcase', 'restaurant', 'bottle', 'football', 'song', 'photo', 'forest', 'ice cream', 'rain', 'dessert', 'mirror', 'beach', 'office', 'dog', 'phone', 'kitchen', 'lake', 'window', 'bakery'],
    moyen: ['giraffe', 'trampoline', 'moustache', 'crocodile', 'submarine', 'accordion', 'pyjamas', 'broccoli', 'unicorn', 'volcano', 'igloo', 'kangaroo', 'saxophone', 'parrot', 'tractor', 'dinosaur', 'cactus', 'tornado', 'astronaut', 'pirate', 'castle', 'raclette', 'gherkin', 'helicopter', 'aquarium', 'compass', 'chewing gum', 'snail', 'penguin', 'marmot', 'butterfly', 'slide', 'witch', 'alien', 'grapefruit', 'pretzel', 'ladybird', 'karaoke', 'hot-air balloon', 'fondue'],
    difficile: ['platypus', 'Zanzibar', 'hippopotamus', 'ventriloquist', 'tyrannosaurus', 'chrysanthemum', 'Timbuktu', 'diving suit', 'abracadabra', 'Mississippi', 'stamp collecting', 'zeppelin', 'kilt', 'yodel', 'sperm whale', 'bagpipes', 'Tutankhamun', 'xylophone', 'paparazzi', 'boomerang', 'Vladivostok', 'origami', 'mammoth', 'anteater', 'Kamchatka', 'pelican', 'harp', 'tiramisu', 'gondola', 'Bollywood', 'sumo', 'macramé', 'armadillo', 'narwhal', 'yeti', 'fakir', 'kite', 'flamingo', 'Cleopatra', 'Atlantis'],
  },
};

export const TEAM_NAMES: Record<Locale, string[]> = {
  fr: ['Rouges', 'Bleus', 'Verts', 'Jaunes', 'Violets', 'Oranges', 'Roses', 'Noirs'],
  de: ['Rot', 'Blau', 'Grün', 'Gelb', 'Violett', 'Orange', 'Rosa', 'Schwarz'],
  it: ['Rossi', 'Blu', 'Verdi', 'Gialli', 'Viola', 'Arancioni', 'Rosa', 'Neri'],
  en: ['Reds', 'Blues', 'Greens', 'Yellows', 'Purples', 'Oranges', 'Pinks', 'Blacks'],
};
