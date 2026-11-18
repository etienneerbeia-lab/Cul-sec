// Questions de culture générale en QCM : la bonne réponse, puis 3 leurres.
// Difficulté : 1 = facile, 2 = moyen, 3 = difficile.
export interface GeneralQuestion {
  id: string;
  difficulty: 1 | 2 | 3;
  category: string;
  prompt: string;
  answer: string;
  wrong: [string, string, string];
}

type Row = [1 | 2 | 3, string, string, string, [string, string, string]];

const ROWS: Row[] = [
  // ---- Sciences & nature ----
  [1, "Sciences", "Quelle planète est surnommée la planète rouge ?", "Mars", ["Vénus", "Jupiter", "Mercure"]],
  [1, "Sciences", "Quel est le symbole chimique de l'or ?", "Au", ["Or", "Ag", "Go"]],
  [1, "Sciences", "Combien de pattes a une araignée ?", "8", ["6", "10", "12"]],
  [1, "Sciences", "Quel gaz les plantes absorbent-elles pour la photosynthèse ?", "Le dioxyde de carbone", ["L'oxygène", "L'azote", "L'hélium"]],
  [1, "Sciences", "Quelle est la plus grande planète du système solaire ?", "Jupiter", ["Saturne", "Neptune", "La Terre"]],
  [1, "Sciences", "Combien d'os compte le corps humain adulte ?", "206", ["156", "256", "306"]],
  [1, "Sciences", "À quelle température l'eau bout-elle au niveau de la mer ?", "100 °C", ["90 °C", "120 °C", "80 °C"]],
  [1, "Nature", "Quel est le plus grand mammifère du monde ?", "La baleine bleue", ["L'éléphant d'Afrique", "Le cachalot", "La girafe"]],
  [1, "Nature", "Quel animal est le plus rapide sur terre ?", "Le guépard", ["Le lion", "L'antilope", "Le lévrier"]],
  [2, "Sciences", "Quel est l'élément chimique le plus abondant dans l'univers ?", "L'hydrogène", ["L'hélium", "L'oxygène", "Le carbone"]],
  [2, "Sciences", "Qui a formulé la théorie de la relativité ?", "Albert Einstein", ["Isaac Newton", "Niels Bohr", "Marie Curie"]],
  [2, "Sciences", "Quel organe produit l'insuline ?", "Le pancréas", ["Le foie", "Les reins", "La rate"]],
  [2, "Sciences", "Combien de temps met la lumière du Soleil pour atteindre la Terre ?", "Environ 8 minutes", ["Environ 8 secondes", "Environ 1 heure", "Environ 1 jour"]],
  [2, "Nature", "Combien de cœurs a une pieuvre ?", "3", ["1", "2", "4"]],
  [2, "Nature", "Quel est le plus grand désert chaud du monde ?", "Le Sahara", ["Le désert de Gobi", "Le Kalahari", "L'Atacama"]],
  [3, "Sciences", "Quel scientifique a découvert la radioactivité naturelle en 1896 ?", "Henri Becquerel", ["Pierre Curie", "Louis Pasteur", "Ernest Rutherford"]],
  [3, "Nature", "Quel arbre produit les glands ?", "Le chêne", ["Le hêtre", "Le châtaignier", "Le noisetier"]],

  // ---- Géographie ----
  [1, "Géographie", "Quel est le plus long fleuve de France ?", "La Loire", ["La Seine", "Le Rhône", "La Garonne"]],
  [1, "Géographie", "Quel est le plus haut sommet d'Europe occidentale ?", "Le mont Blanc", ["Le Cervin", "Le mont Rose", "Le Vignemale"]],
  [1, "Géographie", "Sur quel continent se trouve l'Égypte ?", "L'Afrique", ["L'Asie", "L'Europe", "Le Moyen-Orient"]],
  [1, "Géographie", "Quel océan borde la côte ouest de la France ?", "L'océan Atlantique", ["L'océan Indien", "L'océan Pacifique", "L'océan Arctique"]],
  [2, "Géographie", "Quel pays a la plus grande superficie au monde ?", "La Russie", ["Le Canada", "La Chine", "Les États-Unis"]],
  [2, "Géographie", "Combien de pays partagent une frontière terrestre avec la France métropolitaine ?", "8", ["6", "7", "10"]],
  [2, "Géographie", "Dans quelle ville se trouve la Sagrada Família ?", "Barcelone", ["Madrid", "Séville", "Valence"]],
  [2, "Géographie", "Quel est le plus long fleuve d'Europe ?", "La Volga", ["Le Danube", "Le Rhin", "Le Dniepr"]],
  [3, "Géographie", "Quel est le point culminant de l'Afrique ?", "Le Kilimandjaro", ["Le mont Kenya", "Le Toubkal", "Le Ruwenzori"]],
  [3, "Géographie", "Quel pays compte le plus de fuseaux horaires (territoires compris) ?", "La France", ["La Russie", "Les États-Unis", "Le Royaume-Uni"]],

  // ---- Cinéma, séries, musique ----
  [1, "Cinéma", "Qui a réalisé « Titanic » (1997) ?", "James Cameron", ["Steven Spielberg", "Ridley Scott", "Christopher Nolan"]],
  [1, "Cinéma", "Dans « Le Roi Lion », comment s'appelle le père de Simba ?", "Mufasa", ["Scar", "Rafiki", "Zazu"]],
  [1, "Cinéma", "Quel sorcier a pour meilleurs amis Ron et Hermione ?", "Harry Potter", ["Drago Malefoy", "Neville Londubat", "Gandalf"]],
  [1, "Cinéma", "Dans « Star Wars », qui est le père de Luke Skywalker ?", "Dark Vador", ["Obi-Wan Kenobi", "Yoda", "L'Empereur"]],
  [1, "Cinéma", "Quel film français culte met en scène Amélie Poulain ?", "Le Fabuleux Destin d'Amélie Poulain", ["Les Choristes", "Intouchables", "La Haine"]],
  [2, "Cinéma", "Dans « Bienvenue chez les Ch'tis », quel acteur joue Antoine Bailleul ?", "Dany Boon", ["Kad Merad", "Gad Elmaleh", "Jamel Debbouze"]],
  [2, "Cinéma", "Combien de films compte la saga principale « Le Seigneur des anneaux » de Peter Jackson ?", "3", ["2", "4", "6"]],
  [2, "Séries", "Dans quelle ville se déroule la série « Breaking Bad » ?", "Albuquerque", ["Las Vegas", "Phoenix", "El Paso"]],
  [2, "Séries", "Comment s'appelle le café où se retrouvent les héros de « Friends » ?", "Central Perk", ["MacLaren's", "Monk's Café", "Luke's Diner"]],
  [3, "Cinéma", "Quel film a remporté le premier Oscar du meilleur film ?", "Les Ailes", ["Metropolis", "Le Chanteur de jazz", "Ben-Hur"]],
  [1, "Musique", "Quel groupe a chanté « Bohemian Rhapsody » ?", "Queen", ["The Beatles", "Pink Floyd", "The Rolling Stones"]],
  [1, "Musique", "Quel chanteur est surnommé « le King » ?", "Elvis Presley", ["Michael Jackson", "Johnny Hallyday", "Frank Sinatra"]],
  [1, "Musique", "Combien de cordes a une guitare classique ?", "6", ["4", "5", "7"]],
  [2, "Musique", "Qui a chanté « La Vie en rose » ?", "Édith Piaf", ["Dalida", "Barbara", "Juliette Gréco"]],
  [2, "Musique", "Quel duo français est connu pour « Get Lucky » ?", "Daft Punk", ["Justice", "Air", "Cassius"]],
  [2, "Musique", "De quel pays est originaire le groupe ABBA ?", "La Suède", ["La Norvège", "Le Danemark", "Les Pays-Bas"]],
  [3, "Musique", "Quel compositeur était sourd à la fin de sa vie ?", "Beethoven", ["Mozart", "Bach", "Chopin"]],

  // ---- Sport ----
  [1, "Sport", "Combien de joueurs compte une équipe de football sur le terrain ?", "11", ["10", "12", "9"]],
  [1, "Sport", "Dans quel sport utilise-t-on un volant ?", "Le badminton", ["Le tennis", "Le squash", "Le padel"]],
  [1, "Sport", "Tous les combien d'années ont lieu les Jeux olympiques d'été ?", "4 ans", ["2 ans", "3 ans", "5 ans"]],
  [1, "Sport", "Quelle couleur de maillot porte le leader du Tour de France ?", "Jaune", ["Vert", "Rouge", "Blanc"]],
  [2, "Sport", "Combien de points vaut un essai au rugby à XV ?", "5", ["3", "4", "7"]],
  [2, "Sport", "En quelle année la France a-t-elle gagné sa première Coupe du monde de football ?", "1998", ["1986", "2002", "2006"]],
  [2, "Sport", "Quel tournoi du Grand Chelem se joue sur terre battue ?", "Roland-Garros", ["Wimbledon", "L'US Open", "L'Open d'Australie"]],
  [2, "Sport", "Combien de trous compte un parcours de golf standard ?", "18", ["9", "12", "24"]],
  [3, "Sport", "Quelle est la distance officielle d'un marathon ?", "42,195 km", ["40 km", "42 km", "45,5 km"]],
  [3, "Sport", "Au bowling, combien de quilles faut-il faire tomber pour un strike ?", "10", ["9", "12", "8"]],

  // ---- Gastronomie & boissons ----
  [1, "Gastronomie", "De quel pays est originaire la paella ?", "L'Espagne", ["L'Italie", "Le Portugal", "Le Mexique"]],
  [1, "Gastronomie", "Avec quel fruit fait-on le cidre ?", "La pomme", ["La poire", "Le raisin", "La prune"]],
  [1, "Gastronomie", "Quel fromage est indispensable à une vraie tartiflette ?", "Le reblochon", ["Le comté", "La raclette", "Le beaufort"]],
  [1, "Boissons", "Quel ingrédient principal donne son amertume à la bière ?", "Le houblon", ["L'orge", "La levure", "Le malt"]],
  [2, "Boissons", "De quelle plante est tirée la tequila ?", "L'agave", ["Le cactus", "La canne à sucre", "Le maïs"]],
  [2, "Boissons", "Quel cocktail associe rhum, menthe, citron vert, sucre et eau gazeuse ?", "Le mojito", ["La piña colada", "Le daïquiri", "Le cuba libre"]],
  [2, "Boissons", "Quelle région française est célèbre pour son vin effervescent le plus connu ?", "La Champagne", ["L'Alsace", "La Bourgogne", "Le Bordelais"]],
  [2, "Gastronomie", "Quel est l'ingrédient principal du guacamole ?", "L'avocat", ["Le concombre", "La courgette", "Le petit pois"]],
  [3, "Boissons", "Quel alcool entre dans la composition d'un Spritz traditionnel ?", "L'Apérol", ["Le Campari", "Le Martini", "Le Limoncello"]],
  [3, "Gastronomie", "Quelle épice est la plus chère au monde au poids ?", "Le safran", ["La vanille", "La cardamome", "La cannelle"]],

  // ---- Histoire & société ----
  [1, "Histoire", "Qui était le premier président de la Ve République française ?", "Charles de Gaulle", ["Georges Pompidou", "François Mitterrand", "Vincent Auriol"]],
  [1, "Histoire", "Quel empereur français a été exilé à Sainte-Hélène ?", "Napoléon Ier", ["Napoléon III", "Louis XVI", "Charlemagne"]],
  [1, "Histoire", "Quelle reine fut guillotinée en 1793 ?", "Marie-Antoinette", ["Catherine de Médicis", "Anne d'Autriche", "Joséphine"]],
  [2, "Histoire", "Quel navigateur a atteint l'Amérique en 1492 ?", "Christophe Colomb", ["Vasco de Gama", "Magellan", "Amerigo Vespucci"]],
  [2, "Histoire", "Quelle civilisation a construit le Machu Picchu ?", "Les Incas", ["Les Mayas", "Les Aztèques", "Les Olmèques"]],
  [2, "Histoire", "Qui a peint « La Joconde » ?", "Léonard de Vinci", ["Michel-Ange", "Raphaël", "Botticelli"]],
  [3, "Histoire", "Quel pharaon a fait construire la plus grande pyramide de Gizeh ?", "Khéops", ["Toutânkhamon", "Ramsès II", "Khéphren"]],
  [3, "Art", "Quel peintre a coupé une partie de son oreille ?", "Vincent van Gogh", ["Paul Gauguin", "Claude Monet", "Edvard Munch"]],

  // ---- Divers ----
  [1, "Divers", "Combien de cases compte un échiquier ?", "64", ["36", "49", "100"]],
  [1, "Divers", "Quelle marque a une pomme pour logo ?", "Apple", ["Samsung", "Google", "Microsoft"]],
  [1, "Divers", "Combien y a-t-il de minutes dans une journée ?", "1 440", ["1 200", "1 560", "2 400"]],
  [1, "Divers", "Quel est le personnage principal des jeux « The Legend of Zelda » ?", "Link", ["Zelda", "Ganon", "Mario"]],
  [2, "Divers", "Combien de cartes compte un jeu de tarot ?", "78", ["52", "54", "64"]],
  [2, "Divers", "Quel est le pays d'origine de la marque IKEA ?", "La Suède", ["Le Danemark", "La Norvège", "La Finlande"]],
  [2, "Divers", "Combien de faces a un dé à jouer classique ?", "6", ["4", "8", "12"]],
  [2, "Divers", "Quelle langue est la plus parlée au monde (langue maternelle) ?", "Le chinois mandarin", ["L'anglais", "L'espagnol", "L'hindi"]],
  [3, "Divers", "Combien de touches compte un piano standard ?", "88", ["72", "76", "96"]],
  [3, "Divers", "Quel écrivain a créé le détective Hercule Poirot ?", "Agatha Christie", ["Arthur Conan Doyle", "Georges Simenon", "Maurice Leblanc"]],
];

export const GENERAL_QUESTIONS: GeneralQuestion[] = ROWS.map(([difficulty, category, prompt, answer, wrong], i) => ({
  id: `gen-${String(i + 1).padStart(3, "0")}`,
  difficulty,
  category,
  prompt,
  answer,
  wrong,
}));
