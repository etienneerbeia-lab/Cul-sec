import type { WordPair } from "./types";

// Chaque paire : le mot des civils, le mot proche de l'Undercover (moins de
// 5 joueurs), puis des indices plausibles pour chacun — utilisés par les
// bots (et jamais montrés tels quels aux humains).
type Raw = [string, string, string[], string[]];

const RAW: Raw[] = [
  ["Café", "Thé", ["Expresso", "Matin", "Tasse", "Arabica"], ["Infusion", "Sachet", "Anglais", "Théière"]],
  ["Chien", "Loup", ["Laisse", "Aboie", "Fidèle", "Niche"], ["Meute", "Hurle", "Forêt", "Sauvage"]],
  ["Piscine", "Mer", ["Chlore", "Plongeoir", "Bassin", "Maître-nageur"], ["Vagues", "Sel", "Marée", "Plage"]],
  ["Pizza", "Burger", ["Italie", "Four", "Fromage", "Part"], ["Steak", "Pain", "Frites", "Américain"]],
  ["Guitare", "Violon", ["Cordes", "Rock", "Médiator", "Accords"], ["Archet", "Orchestre", "Classique", "Menton"]],
  ["Chat", "Tigre", ["Ronronne", "Litière", "Moustaches", "Croquettes"], ["Rayures", "Jungle", "Félin", "Inde"]],
  ["Vélo", "Moto", ["Pédales", "Tour de France", "Guidon", "Selle"], ["Casque", "Moteur", "Vitesse", "Permis"]],
  ["Train", "Avion", ["Rails", "Gare", "Wagon", "Contrôleur"], ["Ailes", "Aéroport", "Hôtesse", "Décollage"]],
  ["Pomme", "Poire", ["Newton", "Croquer", "Tarte", "Verger"], ["Williams", "Juteuse", "Forme", "Belle-Hélène"]],
  ["Cinéma", "Théâtre", ["Popcorn", "Écran", "Salle", "Film"], ["Scène", "Rideau", "Acteurs", "Molière"]],
  ["Football", "Rugby", ["Ballon rond", "But", "Penalty", "Mbappé"], ["Ovale", "Essai", "Mêlée", "Toulouse"]],
  ["Lune", "Soleil", ["Nuit", "Croissant", "Marée", "Astronaute"], ["Chaleur", "Lumière", "Été", "Bronzer"]],
  ["Chocolat", "Vanille", ["Cacao", "Noir", "Tablette", "Pâques"], ["Gousse", "Crème", "Glace", "Madagascar"]],
  ["Fourchette", "Cuillère", ["Dents", "Piquer", "Couvert", "Pâtes"], ["Soupe", "Creux", "Café", "Remuer"]],
  ["Neige", "Pluie", ["Blanc", "Ski", "Bonhomme", "Flocon"], ["Parapluie", "Gouttes", "Mouillé", "Nuage"]],
  ["Piano", "Batterie", ["Touches", "Noir et blanc", "Mozart", "Pédale"], ["Baguettes", "Rythme", "Cymbale", "Bruit"]],
  ["Fromage", "Yaourt", ["Camembert", "Raclette", "Plateau", "Cave"], ["Pot", "Petite cuillère", "Fruits", "Lait"]],
  ["Hôtel", "Camping", ["Chambre", "Réception", "Clé", "Étoiles"], ["Tente", "Sac de couchage", "Nature", "Barbecue"]],
  ["Sushi", "Ramen", ["Riz", "Poisson cru", "Baguettes", "Wasabi"], ["Bouillon", "Nouilles", "Bol", "Japon"]],
  ["Miel", "Confiture", ["Abeille", "Ruche", "Doré", "Ours"], ["Fraise", "Pot", "Tartine", "Grand-mère"]],
  ["Téléphone", "Tablette", ["Appel", "Poche", "Sonnerie", "SMS"], ["Écran", "Grand", "Netflix", "Tactile"]],
  ["Bougie", "Lampe", ["Flamme", "Cire", "Anniversaire", "Romantique"], ["Ampoule", "Interrupteur", "Chevet", "Lumière"]],
  ["Croissant", "Pain au chocolat", ["Beurre", "Boulangerie", "Lune", "Feuilleté"], ["Chocolatine", "Barres", "Goûter", "Débat"]],
  ["Kayak", "Canoë", ["Pagaie", "Rivière", "Gilet", "Rapides"], ["Indien", "Lac", "Balade", "Pagaie"]],
  ["Plage", "Montagne", ["Sable", "Serviette", "Crème solaire", "Coquillage"], ["Sommet", "Randonnée", "Altitude", "Chalet"]],
  ["Bière", "Vin", ["Mousse", "Pinte", "Houblon", "Pression"], ["Cave", "Raisin", "Bouchon", "Rouge"]],
  ["Whisky", "Rhum", ["Écosse", "Glaçons", "Tourbé", "Fût"], ["Pirate", "Antilles", "Mojito", "Canne"]],
  ["Champagne", "Prosecco", ["Bulles", "Fête", "Coupe", "Reims"], ["Italie", "Spritz", "Pétillant", "Moins cher"]],
  ["Apéro", "Brunch", ["Chips", "Saucisson", "Soir", "Verre"], ["Dimanche", "Œufs", "Tard", "Pancakes"]],
  ["Karaoké", "Concert", ["Micro", "Faux", "Paroles", "Bar"], ["Scène", "Billet", "Foule", "Groupe"]],
  ["Discothèque", "Bar", ["Piste", "DJ", "Videur", "Danser"], ["Comptoir", "Serveur", "Happy hour", "Tabouret"]],
  ["Mariage", "Anniversaire", ["Alliance", "Robe blanche", "Témoin", "Mairie"], ["Bougies", "Gâteau", "Cadeau", "Âge"]],
  ["Noël", "Nouvel An", ["Sapin", "Cadeaux", "Père", "Décembre"], ["Minuit", "Résolutions", "Feux d'artifice", "Compte à rebours"]],
  ["Vampire", "Zombie", ["Crocs", "Sang", "Cercueil", "Ail"], ["Cerveau", "Marche lente", "Apocalypse", "Morsure"]],
  ["Pirate", "Viking", ["Bateau", "Trésor", "Jambe de bois", "Perroquet"], ["Casque", "Scandinavie", "Hache", "Drakkar"]],
  ["Docteur", "Infirmier", ["Ordonnance", "Stéthoscope", "Cabinet", "Diagnostic"], ["Piqûre", "Hôpital", "Garde", "Soins"]],
  ["Pompier", "Policier", ["Incendie", "Échelle", "Sirène", "Calendrier"], ["Menottes", "Amende", "Uniforme", "Enquête"]],
  ["Avocat", "Juge", ["Plaidoirie", "Client", "Défense", "Robe"], ["Marteau", "Verdict", "Tribunal", "Peine"]],
  ["Netflix", "YouTube", ["Série", "Abonnement", "Binge", "Canapé"], ["Vidéo", "Youtubeur", "Gratuit", "Pub"]],
  ["Instagram", "TikTok", ["Photo", "Story", "Filtre", "Influenceur"], ["Danse", "Vidéo courte", "Algorithme", "Trend"]],
  ["Batman", "Superman", ["Gotham", "Chauve-souris", "Riche", "Masque"], ["Cape", "Krypton", "Voler", "Lunettes"]],
  ["Harry Potter", "Le Seigneur des anneaux", ["Poudlard", "Baguette", "Sorcier", "Cicatrice"], ["Anneau", "Hobbit", "Gandalf", "Mordor"]],
  ["Paris", "Londres", ["Tour Eiffel", "Baguette", "Seine", "Métro"], ["Big Ben", "Pluie", "Thé", "Reine"]],
  ["Ski", "Snowboard", ["Bâtons", "Piste", "Tire-fesses", "Chasse-neige"], ["Planche", "Freestyle", "Glisse", "Jeune"]],
  ["Tennis", "Ping-pong", ["Raquette", "Roland-Garros", "Filet", "Court"], ["Table", "Petite balle", "Chine", "Garage"]],
  ["Échecs", "Dames", ["Roi", "Cavalier", "Mat", "Stratégie"], ["Pions", "Damier", "Sauter", "Simple"]],
  ["Avion", "Hélicoptère", ["Ailes", "Piste", "Voyage", "Hublot"], ["Hélice", "Stationnaire", "Secours", "Bruit"]],
  ["Lion", "Tigre", ["Crinière", "Roi", "Savane", "Afrique"], ["Rayures", "Asie", "Jungle", "Orange"]],
  ["Dauphin", "Requin", ["Intelligent", "Saute", "Gentil", "Clic"], ["Dents", "Aileron", "Danger", "Dents de la mer"]],
  ["Poulet", "Dinde", ["Rôti", "Nuggets", "Dimanche", "Cuisse"], ["Noël", "Farcie", "Thanksgiving", "Grosse"]],
  ["Sel", "Poivre", ["Mer", "Salière", "Blanc", "Salé"], ["Moulin", "Noir", "Épice", "Piquant"]],
  ["Ketchup", "Mayonnaise", ["Tomate", "Rouge", "Frites", "Heinz"], ["Œuf", "Blanc", "Frites", "Huile"]],
  ["Crêpe", "Gaufre", ["Bretagne", "Poêle", "Chandeleur", "Nutella"], ["Carreaux", "Belgique", "Gaufrier", "Fête foraine"]],
  ["Lunettes", "Lentilles", ["Monture", "Nez", "Myope", "Opticien"], ["Œil", "Invisible", "Solution", "Jetable"]],
  ["Montre", "Réveil", ["Poignet", "Heure", "Bracelet", "Suisse"], ["Matin", "Sonnerie", "Table de nuit", "Snooze"]],
  ["Jean", "Jogging", ["Denim", "Bleu", "Poches", "Levi's"], ["Sport", "Confort", "Élastique", "Canapé"]],
  ["Baskets", "Talons", ["Sport", "Lacets", "Nike", "Confort"], ["Hauts", "Soirée", "Mal aux pieds", "Élégant"]],
  ["Parfum", "Déodorant", ["Flacon", "Odeur", "Cadeau", "Luxe"], ["Aisselles", "Spray", "Transpiration", "Matin"]],
  ["Bain", "Douche", ["Baignoire", "Mousse", "Détente", "Long"], ["Rapide", "Pommeau", "Matin", "Cabine"]],
  ["Pâtes", "Riz", ["Italie", "Al dente", "Bolognaise", "Spaghetti"], ["Grain", "Asie", "Sushi", "Cuiseur"]],
  ["Frites", "Chips", ["Belgique", "Friteuse", "Moules", "Ketchup"], ["Paquet", "Apéro", "Croustillant", "Sachet"]],
  ["Plombier", "Électricien", ["Fuite", "Tuyau", "Robinet", "Mario"], ["Câbles", "Courant", "Disjoncteur", "Ampoule"]],
  ["Été", "Printemps", ["Vacances", "Chaleur", "Juillet", "Glace"], ["Fleurs", "Avril", "Renouveau", "Oiseaux"]],
  ["Rivière", "Lac", ["Courant", "Pont", "Pêche", "Coule"], ["Calme", "Pédalo", "Annecy", "Rive"]],
  ["Camion", "Bus", ["Routier", "Livraison", "Remorque", "Autoroute"], ["Arrêt", "Ticket", "Passagers", "Ligne"]],
  ["Robot", "Ordinateur", ["Métal", "Bras", "Futur", "Androïde"], ["Clavier", "Écran", "Souris", "Bureau"]],
  ["Ascenseur", "Escalier", ["Bouton", "Étages", "Panne", "Musique"], ["Marches", "Sport", "Rampe", "Monter"]],
  ["Casque", "Écouteurs", ["Oreilles", "Gros", "Musique", "Arceau"], ["Sans fil", "Petits", "Poche", "Bluetooth"]],
  ["Glace", "Sorbet", ["Cornet", "Crème", "Vanille", "Été"], ["Fruit", "Léger", "Citron", "Sans lait"]],
  ["Saucisson", "Jambon", ["Apéro", "Tranches", "Couteau", "Sec"], ["Sandwich", "Rose", "Blanc", "Cru"]],
];

const toPairs = (prefix: string, raw: Raw[]): WordPair[] =>
  raw.map(([word, closeWord, hints, closeHints], i) => ({
    id: `${prefix}-${String(i + 1).padStart(3, "0")}`,
    word,
    closeWord,
    hints,
    closeHints,
  }));

export const WORD_PAIRS: WordPair[] = toPairs("word", RAW);

// Paires du mode 18+ : assez proches pour que l'Undercover se fonde dans
// la masse, assez crues pour que les indices fassent rire.
const RAW_ADULT: Raw[] = [
  ["Menottes", "Bandeau", ["Métal", "Clé", "Police", "Attaché(e)"], ["Yeux", "Noir", "Surprise", "Soie"]],
  ["Capote", "Lubrifiant", ["Latex", "Pharmacie", "Taille", "Protection"], ["Glisse", "Tube", "Froid", "Fraise"]],
  ["Plan cul", "Coup d'un soir", ["Régulier", "Sans attaches", "SMS", "Mardi"], ["Bar", "Inconnu(e)", "Matin", "Taxi"]],
  ["Nude", "Sexto", ["Photo", "Miroir", "Flou", "Supprimer"], ["Message", "Emoji", "Aubergine", "Tard"]],
  ["Strip-tease", "Lap dance", ["Musique", "Vêtements", "Lent", "Chaise"], ["Genoux", "Billet", "Club", "Proche"]],
  ["Tinder", "Bumble", ["Swipe", "Flamme", "Match", "Bio"], ["Jaune", "Abeille", "Premier message", "Appli"]],
  ["Vibromasseur", "Plug", ["Piles", "Bruit", "Tiroir", "Bzzz"], ["Petit", "Silicone", "Derrière", "Bijou"]],
  ["Levrette", "Missionnaire", ["Derrière", "Genoux", "Animal", "Fesses"], ["Classique", "Face à face", "Dimanche", "Lit"]],
  ["Suçon", "Fessée", ["Cou", "Écharpe", "Violet", "Lycée"], ["Main", "Claque", "Rouge", "Coquin"]],
  ["Lingerie", "Porte-jarretelles", ["Dentelle", "Soutien-gorge", "Cadeau", "Saint-Valentin"], ["Bas", "Pinces", "Cabaret", "Cuisses"]],
  ["Plan à trois", "Échangisme", ["Trois", "Lit trop petit", "Fantasme", "Pote"], ["Couples", "Club", "Clés", "Libertin"]],
  ["Préliminaires", "Massage", ["Avant", "Bisous", "Patience", "Échauffement"], ["Huile", "Dos", "Mains", "Détente"]],
  ["Walk of shame", "Gueule de bois", ["Matin", "Robe de la veille", "Talons", "Rue"], ["Tête", "Eau", "Aspirine", "Lit"]],
  ["Love hôtel", "Motel", ["Japon", "Heure", "Néons", "Discret"], ["Route", "Parking", "Américain", "Nuit"]],
  ["Pornhub", "OnlyFans", ["Gratuit", "Navigation privée", "Catégories", "Orange"], ["Abonnement", "Créateur", "Bleu", "Payer"]],
  ["Orgasme", "Fou rire", ["Cri", "Fin", "Frissons", "Simuler"], ["Larmes", "Ventre", "Incontrôlable", "Contagieux"]],
  ["Jacuzzi", "Sauna", ["Bulles", "Chaud", "Hôtel", "Bikini"], ["Serviette", "Sueur", "Bois", "Finlande"]],
  ["Kamasutra", "Cinquante nuances de Grey", ["Positions", "Inde", "Livre", "Souplesse"], ["Film", "Cravate", "Fouet", "Milliardaire"]],
  ["Pelle", "Bisou dans le cou", ["Langue", "Boîte de nuit", "Longue", "Baveux"], ["Frissons", "Nuque", "Doux", "Oreille"]],
  ["Booty call", "Premier date", ["2 h du mat", "Dispo ?", "Rapide", "Texto"], ["Restau", "Stress", "Parfum", "Addition"]],
  ["Huile de massage", "Chantilly", ["Mains", "Glisse", "Odeur", "Bougies"], ["Bombe", "Sucré", "Lécher", "Fraises"]],
  ["Fouet", "Plume", ["Cuir", "Clac", "Dominer", "Cheval"], ["Chatouilles", "Douce", "Oiseau", "Léger"]],
  ["Cabine d'essayage", "Toilettes de boîte", ["Rideau", "Miroir", "Magasin", "Vendeur"], ["Queue", "Musique", "Collant", "Videur"]],
  ["Cougar", "Sugar daddy", ["Expérience", "Jeune", "Chasseuse", "Mature"], ["Argent", "Cadeaux", "Riche", "Voyage"]],
  ["Jeu de rôle", "Déguisement", ["Infirmière", "Scénario", "Personnage", "Imagination"], ["Costume", "Halloween", "Perruque", "Masque"]],
  ["Strip poker", "Action ou vérité", ["Cartes", "Perdre", "Vêtements", "Bluff"], ["Défi", "Question", "Gage", "Ado"]],
  ["String", "Boxer", ["Ficelle", "Fesses", "Dentelle", "Inconfortable"], ["Coton", "Large", "Caleçon", "Élastique"]],
  ["Ghosting", "Râteau", ["Silence", "Disparu", "Vu", "Fantôme"], ["Non", "Vent", "Honte", "Bar"]],
  ["Sex-friend", "Crush", ["Ami", "Avantages", "Régulier", "Sans prise de tête"], ["Cœur", "Timide", "Regard", "Secret"]],
  ["Body count", "Liste d'ex", ["Nombre", "Mentir", "Compter", "Tabou"], ["Noms", "Prénoms", "Toxique", "Souvenirs"]],
];

export const WORD_PAIRS_ADULT: WordPair[] = toPairs("wordx", RAW_ADULT);
export const ALL_WORD_PAIRS: WordPair[] = [...WORD_PAIRS, ...WORD_PAIRS_ADULT];

// Indices vagues pour un Mister White (qui n'a pas de mot).
const GENERIC_CLUES = [
  "Ça se partage",
  "On en a tous déjà vu",
  "Plutôt agréable",
  "Ça dépend des goûts",
  "Un classique",
  "Souvent le week-end",
  "Ça peut être grand",
  "Les enfants adorent",
  "On en parle souvent",
  "Ça se trouve partout",
];

export function botClueFor(word: string | null, used: string[]): string {
  const fresh = (list: string[]) => list.filter((c) => !used.includes(c.toLowerCase()));
  const pair = word ? ALL_WORD_PAIRS.find((p) => p.word === word || p.closeWord === word) : undefined;
  const specific = pair ? (pair.word === word ? pair.hints : pair.closeHints) : undefined;
  // Mister White s'inspire des indices déjà donnés par les autres.
  const pool = specific?.length ? fresh(specific) : [...fresh(GENERIC_CLUES)];
  const from = pool.length ? pool : GENERIC_CLUES;
  return from[Math.floor(Math.random() * from.length)];
}

export function randomWord(): string {
  const p = ALL_WORD_PAIRS[Math.floor(Math.random() * ALL_WORD_PAIRS.length)];
  return Math.random() < 0.5 ? p.word : p.closeWord;
}
