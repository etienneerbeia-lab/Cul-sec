import type { WordPair } from "./types";

// Each pair: the word everyone (but the impostor) gets, and a close-but-
// different word for the Undercover variant (under 5 players). Add more
// pairs here any time — no other code needs to change.
const RAW_PAIRS: [string, string][] = [
  ["Café", "Thé"],
  ["Chien", "Loup"],
  ["Piscine", "Mer"],
  ["Été", "Printemps"],
  ["Pizza", "Burger"],
  ["Guitare", "Violon"],
  ["Chat", "Tigre"],
  ["Plage", "Montagne"],
  ["Vélo", "Moto"],
  ["Train", "Avion"],
  ["Pomme", "Poire"],
  ["Cinéma", "Théâtre"],
  ["Football", "Rugby"],
  ["Stylo", "Crayon"],
  ["Lune", "Soleil"],
  ["Rivière", "Lac"],
  ["Chocolat", "Vanille"],
  ["Camion", "Voiture"],
  ["Livre", "Journal"],
  ["Fourchette", "Cuillère"],
  ["Sandale", "Basket"],
  ["Tomate", "Poivron"],
  ["Neige", "Pluie"],
  ["Robot", "Ordinateur"],
  ["Piano", "Batterie"],
  ["Cheval", "Âne"],
  ["Fromage", "Yaourt"],
  ["Hôtel", "Auberge"],
  ["Parapluie", "Casquette"],
  ["École", "Bibliothèque"],
  ["Sushi", "Ramen"],
  ["Canard", "Poule"],
  ["Ballon", "Frisbee"],
  ["Miel", "Confiture"],
  ["Forêt", "Jardin"],
  ["Téléphone", "Tablette"],
  ["Bougie", "Lampe"],
  ["Valise", "Sac à dos"],
  ["Camping", "Randonnée"],
  ["Marché", "Supermarché"],
  ["Cravate", "Écharpe"],
  ["Poisson", "Crevette"],
  ["Ascenseur", "Escalier"],
  ["Croissant", "Baguette"],
  ["Perroquet", "Corbeau"],
  ["Kayak", "Canoë"],
  ["Sapin", "Palmier"],
  ["Bracelet", "Collier"],
  ["Casque", "Chapeau"],
  ["Sofa", "Fauteuil"],
  ["Beurre", "Margarine"],
  ["Orage", "Tempête"],
];

export const WORD_PAIRS: WordPair[] = RAW_PAIRS.map(([word, closeWord], i) => ({
  id: `word-${String(i + 1).padStart(3, "0")}`,
  word,
  closeWord,
}));

// Indices vagues que peut donner un bot (ou un Mister White) quand aucun
// indice spécifique n'est connu pour son mot.
const GENERIC_CLUES = [
  "Ça se partage",
  "On en a tous déjà vu",
  "Plutôt agréable",
  "Ça dépend des goûts",
  "Un classique",
  "Souvent le week-end",
  "Ça peut être grand",
  "Ça coûte cher parfois",
  "Les enfants adorent",
  "On en parle souvent",
];

export function botClueFor(word: string | null, used: string[]): string {
  const pair = word ? WORD_PAIRS.find((p) => p.word === word || p.closeWord === word) : undefined;
  const specific = pair ? (pair.word === word ? pair.hints : pair.closeHints) : undefined;
  const pool = [...(specific ?? []), ...GENERIC_CLUES].filter((c) => !used.includes(c.toLowerCase()));
  const list = specific?.length ? specific.filter((c) => !used.includes(c.toLowerCase())) : pool;
  const from = list.length ? list : pool.length ? pool : GENERIC_CLUES;
  return from[Math.floor(Math.random() * from.length)];
}

export function randomWord(): string {
  const p = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];
  return Math.random() < 0.5 ? p.word : p.closeWord;
}
