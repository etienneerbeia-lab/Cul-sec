import { basicStrategyMove, handValue } from "../blackjack/rules";
import type { Card } from "../game/types";
import type { Croupier } from "./croupiers";

// Réponses de la croupière (sans IA) : on reconnaît l'intention du message
// (salut, conseil, règles, blague...) et on répond avec une phrase tirée au
// sort, en tenant compte de la partie (main du joueur, carte visible du
// croupier). Polie et classe en toutes circonstances : la drague et les
// insultes sont recadrées gentiment.

export type BotStage = "mises" | "jeu" | "banque" | "fin";

export interface BotContext {
  croupier: Croupier;
  playerName: string;
  soiree: boolean; // on mise des gorgées
  hand?: Card[]; // main en cours du joueur
  dealerUp?: Card; // carte visible du croupier
  stage?: BotStage;
  rng?: () => number;
}

// Minuscules, sans accents ni ponctuation : « Ça va ?! » → « ca va ».
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const CARD_NAME: Record<number, string> = { 11: "Valet", 12: "Dame", 13: "Roi", 14: "As" };
const cardName = (c: Card) => CARD_NAME[c.value] ?? String(c.value);

const has = (t: string, words: string[]) => words.some((w) => (w.includes(" ") ? t.includes(w) : new RegExp(`\\b${w}\\b`).test(t)));

function strategyAdvice(ctx: BotContext, pick: <T>(a: T[]) => T): string | null {
  const { hand, dealerUp } = ctx;
  if (ctx.stage !== "jeu" || !hand || hand.length < 2 || !dealerUp) return null;
  const total = handValue(hand);
  if (total > 21) return pick(["Aïe, c'est déjà sauté pour cette main… La prochaine sera la bonne.", "Trop tard pour cette main, elle a sauté. Courage !"]);
  if (total === 21) return pick(["21 ! Tu restes, évidemment. 😉", "Avec 21, on ne touche plus à rien."]);
  const up = cardName(dealerUp);
  const move = basicStrategyMove(hand, dealerUp);
  switch (move) {
    case "split":
      return `Une paire de ${cardName(hand[0])} contre mon ${up} ? Moi, je séparerais.`;
    case "double":
      return hand.length === 2 ? `${total} contre mon ${up}… c'est le moment de doubler !` : `${total} contre mon ${up} : je tirerais une carte.`;
    case "hit":
      return pick([`Avec ${total} contre mon ${up}, je tirerais une carte.`, `${total} contre un ${up} ? Carte, sans hésiter.`]);
    case "stand":
      return pick([`Avec ${total} contre mon ${up}, je resterais.`, `${total} contre un ${up}… laisse-moi prendre le risque, reste.`]);
  }
  return null;
}

export function dealerReply(raw: string, ctx: BotContext): string {
  const rng = ctx.rng ?? Math.random;
  const pick = <T>(a: T[]): T => a[Math.floor(rng() * a.length) % a.length];
  const t = normalize(raw);
  const name = ctx.playerName;
  const me = ctx.croupier.name;
  const flair = (s: string) => (rng() < 0.35 ? `${s} ${pick(ctx.croupier.flair)}` : s);

  // Insultes : on recadre, sans s'énerver.
  if (has(t, ["pute", "salope", "connasse", "conne", "encule", "batard", "fdp", "ta gueule", "nique", "pd", "enfoire"]))
    return pick([
      "On reste courtois à ma table, s'il te plaît.",
      "Doucement… ici, on garde le sourire et la classe.",
      `${name}, on se calme : les cartes n'y sont pour rien.`,
    ]);

  // Drague : réponse classe.
  if (
    has(t, [
      "belle",
      "jolie",
      "canon",
      "sexy",
      "bonnasse",
      "mignonne",
      "charmante",
      "numero",
      "ton 06",
      "insta",
      "snap",
      "rdv",
      "rendez vous",
      "sortir avec",
      "bisou",
      "embrasse",
      "je t aime",
      "epouse",
      "celibataire",
      "chaude",
      "deshabille",
      "nue",
      "mon coeur",
      "cherie",
    ])
  )
    return pick([
      "Merci, c'est gentil 😊 Mais ici, je ne distribue que des cartes.",
      "Flatteur… mais je suis mariée au sabot. 😉",
      `Charmeur, ${name} ! Concentre-toi plutôt sur ta main.`,
      "Je garde mon numéro, tu gardes tes jetons. Marché conclu ? 😄",
    ]);

  // Conseil de jeu (stratégie de base).
  if (
    has(t, [
      "je tire",
      "je reste",
      "tirer",
      "rester",
      "carte ou",
      "je fais quoi",
      "que faire",
      "conseil",
      "tu ferais",
      "doubler",
      "double",
      "split",
      "separer",
      "je prends",
      "aide moi",
    ])
  ) {
    const advice = strategyAdvice(ctx, pick);
    if (advice) return flair(advice);
    if (ctx.stage === "mises") return "Pose d'abord ta mise, je te conseille dès que tu as tes cartes.";
    return pick(["Attends d'avoir tes cartes, je te dirai ce que j'en pense.", "Je te conseillerai quand ce sera ton tour."]);
  }

  // Triche, carte cachée.
  if (has(t, ["triche", "tricheuse", "truque", "arnaque", "magouille"]))
    return pick(["Aucune triche, promis : le sabot est mélangé devant vous.", "Truqué ? Jamais. J'ai juste de la chance… pour la banque. 😇"]);
  if (has(t, ["ta carte", "carte cachee", "tu as quoi", "t as quoi", "ton jeu", "ta main"]))
    return pick(["Ma carte cachée reste cachée jusqu'à mon tour… le suspense fait partie du jeu.", "Patience : je la retourne quand vous avez tous joué."]);

  // Règles.
  if (has(t, ["regle", "regles", "comment on joue", "ca marche comment", "paie", "assurance", "comment ca marche"]))
    return ctx.soiree
      ? "Approche-toi le plus de 21 sans dépasser. Tu bats la banque ? Tu distribues ta mise en gorgées. Tu perds ? Tu bois. Blackjack paie 3 pour 2."
      : "Le but : faire mieux que moi sans dépasser 21. Je reste à 17, le blackjack paie 3 pour 2, et l'assurance est proposée quand je montre un As.";

  // Politesses.
  if (/^(salut|bonjour|bonsoir|coucou|hello|hey|yo|wesh|slt|cc|hola)\b/.test(t))
    return flair(pick([`Bonsoir ${name} ! Installe-toi, je distribue.`, `Salut ${name} ! Prêt(e) à battre la banque ?`, `Bienvenue à ma table, ${name}.`]));
  if (has(t, ["ca va", "comment vas", "tu vas bien", "la forme", "quoi de neuf"]))
    return flair(pick(["Très bien, merci ! Le sabot est chaud ce soir.", "Ça va très bien. Et toi, ça va mieux quand tu gagnes, non ?"]));
  if (has(t, ["comment tu t appelles", "ton nom", "t es qui", "tu es qui", "qui es tu", "ton prenom", "tu t appelles"]))
    return `Moi, c'est ${me}, ta croupière ce soir.`;
  if (has(t, ["bot", "robot", "ia", "chatgpt", "vraie", "humaine"])) return `Je suis ${me}, la croupière de Cul·Sec. Des cartes, pas de secrets. 😉`;
  if (has(t, ["merci", "thx", "thanks"])) return pick(["Avec plaisir !", "Je t'en prie.", "À ton service."]);
  if (has(t, ["bye", "ciao", "a plus", "bonne nuit", "a demain", "je file", "au revoir"]))
    return pick(["Bonne nuit ! Reviens quand tu veux.", "À bientôt à ma table !"]);

  // Émotions de jeu.
  if (has(t, ["gagne", "yes", "trop fort", "gg", "bravo", "enfin", "jackpot", "blackjack", "bj"]))
    return flair(pick(["Bravo ! La chance tourne enfin.", "Joli coup ! La banque s'incline… pour cette fois.", `Bien joué, ${name} !`]));
  if (has(t, ["perdu", "nul", "chiant", "pas de chance", "malchance", "degoute", "saute", "bust", "je deteste", "rage"]))
    return pick([
      "Le sabot n'a pas de mémoire : la prochaine main sera meilleure.",
      "Ça arrive aux meilleurs. On se refait ?",
      "Courage, la roue tourne… enfin, les cartes.",
    ]);

  // Boire (Soirée surtout).
  if (has(t, ["boire", "bois", "boit", "buvons", "buvez", "picole", "gorgee", "gorgees", "biere", "cul sec", "shot", "alcool", "verre", "trinque", "sante"]))
    return ctx.soiree
      ? pick([
          "Je sers les cartes, pas les verres… mais je compte les gorgées. 🍺",
          "Santé ! Et bois de l'eau entre deux mains, hein.",
          "Qui perd boit, c'est la règle de la maison.",
        ])
      : "Ici on joue au Chill : jetons seulement, pas de gorgées. 😌";

  // Blague.
  if (has(t, ["blague", "raconte", "drole", "fais moi rire"]))
    return pick([
      "Pourquoi le croupier ne joue jamais à cache-cache ? Parce qu'il montre toujours une carte. 🃏",
      "Mon métier ? Je distribue des cartes toute la nuit… et personne ne me répond jamais « merci, pareillement ».",
      "Le seul 21 que je n'aime pas, c'est celui de mes clients. 😄",
    ]);

  if (raw.trim().endsWith("?"))
    return pick(["Bonne question ! Mais ici, la vraie question c'est : carte ou pas carte ? 😉", "Hmm… je garde ça pour moi. Faites vos jeux !"]);

  return flair(
    pick([
      `Intéressant, ${name}… mais concentrons-nous sur les cartes. 😄`,
      "Je t'écoute, tout en gardant un œil sur le sabot.",
      "Faites vos jeux, les amis !",
      `Bonne chance pour cette main, ${name}.`,
    ]),
  );
}
