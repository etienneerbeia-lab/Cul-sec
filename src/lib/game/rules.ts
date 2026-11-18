import type { RoundTypeId } from "./types";

// Règles courtes affichées avant chaque mini-jeu : comment on joue, puis
// qui boit combien. Une ligne = une idée, lisible en 10 secondes.
export interface GameRules {
  how: string[];
  gulps: string[];
}

export const RULES: Record<RoundTypeId, GameRules> = {
  high: {
    how: [
      "Une carte est retournée. À ton tour, parie : la suivante sera plus haute ou plus basse ?",
      "Chaque bon pari fait grossir la série (jusqu'à 6) et passe la main.",
    ],
    gulps: ["Tu te trompes (ou carte égale) : tu bois toute la série.", "La série repart ensuite à 1."],
  },
  holdem: {
    how: [
      "2 cartes chacun, puis le flop, le turn et la river. Le pot démarre à 2.",
      "Checke ou mise 1 ; face à une mise : suis, relance de 1 (2 fois max) ou couche-toi.",
    ],
    gulps: [
      "Te coucher : tu bois le pot, sans les mises que tu refuses de suivre.",
      "Abattage : chaque perdant boit le pot (10 max = cul sec).",
    ],
  },
  duel: {
    how: [
      "Deux joueurs tirés au sort retournent une carte chacun : la plus forte gagne.",
      "Égalité ? Bataille ! On retourne une nouvelle carte.",
      "Les autres parient avant sur le vainqueur.",
    ],
    gulps: ["Le perdant : 2 gorgées, +2 par bataille.", "Mauvais pari (ou pas de pari) : 1 gorgée."],
  },
  quiz: {
    how: ["5 questions à choix multiples, tout le monde répond en même temps.", "12 secondes par question, une seule réponse."],
    gulps: ["Mauvaise réponse ou pas de réponse : 1 gorgée.", "Le meilleur de la manche fait boire 3 gorgées à qui il veut."],
  },
  vote: {
    how: [
      "Tu préfères : deux choix, vote en secret (20 s).",
      "Ou Qui de nous… : vote pour le joueur le plus susceptible de… (pas toi !).",
    ],
    gulps: [
      "Tu préfères : le camp minoritaire boit 2 ; égalité, tout le monde boit 1.",
      "Qui de nous : 1 gorgée par voix reçue (5 max).",
      "Pas de vote : 2 gorgées.",
    ],
  },
  meme: {
    how: ["Une image, 45 secondes pour écrire la légende la plus drôle.", "Puis vote pour ta préférée (pas la tienne)."],
    gulps: ["Légende la moins votée : 2 gorgées (égalité générale : personne).", "Pas de légende : 2 gorgées."],
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
