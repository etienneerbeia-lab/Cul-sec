// Règles du Blackjack Table (univers Chill), regroupées ici pour pouvoir
// les ajuster sans toucher au moteur.
export const BJT_RULES = {
  startingBankroll: 500, // € par joueur
  minBet: 5,
  chipValues: [5, 25, 100] as const,
  decks: 6,
  // Le sabot est remélangé avant la manche quand ~75 % des cartes sont sorties.
  reshuffleAt: 0.75,
  // Blackjack payé 3:2. Les montants sont en euros entiers : le gain d'un
  // blackjack est arrondi au-dessus (mise de 5 € → +8 €).
  blackjackPays: 1.5,
  // Le croupier reste sur soft 17 (S17).
  dealerHitsSoft17: false,
  // Le croupier vérifie son blackjack avec un As ou un 10 visible.
  peek: true,
  // Assurance proposée quand le croupier montre un As (avant le peek) :
  // coûte la moitié de la mise (arrondie en dessous), paie 2:1.
  insurance: true,
  insurancePays: 2,
  doubleOnTwoCardsOnly: true,
  doubleAfterSplit: true,
  // Split jusqu'à 3 fois (4 mains). Deux cartes de même valeur (10, V, D, R
  // comptent toutes 10) peuvent être séparées.
  maxHands: 4,
  splitAnyTen: true,
  // As séparés : une seule carte chacun, pas de re-split d'As.
  splitAcesOneCard: true,
  resplitAces: false,
  // Un 21 en 2 cartes obtenu après un split compte comme 21 (payé 1:1).
  // Pas d'abandon (surrender).
  surrender: false,
  betMs: 15000,
  insuranceMs: 15000,
  actionMs: 15000,
  // Pause de fin de manche (en plus du temps de révélation du croupier).
  roundEndMs: 4500,
  // Mode « dernier survivant » : garde-fou pour qu'une partie se termine.
  survivorMaxRounds: 60,
} as const;
