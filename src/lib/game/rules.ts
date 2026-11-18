import type { RoundTypeId } from "./types";

// Règles courtes affichées avant chaque mini-jeu : comment on joue, puis
// qui boit combien. Une ligne = une idée, lisible en 10 secondes.
export interface GameRules {
  how: string[];
  gulps: string[];
}

export const RULES: Record<RoundTypeId, GameRules> = {
  high: {
    how: ["Chacun reçoit une carte cachée.", "À ton tour : suis la mise, relance de 1 ou couche-toi."],
    gulps: ["Te coucher : 1 gorgée.", "Perdants à l'abattage : la mise finale."],
  },
  holdem: {
    how: ["2 cartes chacun, puis flop, turn et river.", "Checke, mise, suis, relance ou couche-toi."],
    gulps: ["Te coucher : le pot.", "Perdants à l'abattage : se partagent le pot."],
  },
  duel: {
    how: ["Deux joueurs tirés au sort retournent chacun une carte.", "La plus forte gagne."],
    gulps: ["Le perdant : 2 gorgées.", "Égalité : 1 chacun."],
  },
  quiz: {
    how: ["Chacun son tour, une question.", "15 secondes pour répondre."],
    gulps: ["Bonne réponse : tu distribues 2 gorgées.", "Mauvaise réponse : tu bois 2."],
  },
  vote: {
    how: ["Un dilemme, deux choix.", "Vote en secret en 15 secondes."],
    gulps: ["Le camp minoritaire : 2 gorgées.", "Pas de vote : 2 gorgées."],
  },
  meme: {
    how: ["Une image, 60 secondes pour la légender.", "Vote pour la légende la plus drôle (pas la tienne)."],
    gulps: ["La moins votée : 2 gorgées.", "Pas de légende : 2 gorgées."],
  },
  dice: {
    how: ["Chacun lance deux dés à son tour."],
    gulps: ["Le plus petit score : 2 gorgées.", "Égalité : on relance, mise doublée."],
  },
  undercover: {
    how: [
      "Tout le monde a le même mot, sauf un imposteur.",
      "Chacun donne un indice, puis on vote pour éliminer.",
    ],
    gulps: ["Imposteur démasqué : il boit 2.", "Imposteur survivant : tous les autres boivent 2."],
  },
  blackjack: {
    how: ["Mise 1 à 5 gorgées, puis affronte la banque.", "Approche-toi de 21 sans dépasser."],
    gulps: ["Perdu : tu bois ta mise.", "Gagné : tu distribues ta mise."],
  },
  golf: {
    how: ["Tire en arrière pour viser, relâche pour frapper.", "6 coups maximum par trou."],
    gulps: ["Chacun boit son rang − 1 (le 1er ne boit pas)."],
  },
  archery: {
    how: ["3 flèches chacun.", "Vise en tenant compte du vent, relâche pour tirer."],
    gulps: ["Chacun boit son rang − 1 (le 1er ne boit pas)."],
  },
};
