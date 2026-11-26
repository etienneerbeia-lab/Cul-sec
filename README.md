# Cul-Sec

Jeux de soirée à boire, multijoueur : chacun joue sur son téléphone.
Next.js 16 · React 19 · Tailwind 4 · Upstash Redis · PWA.

À consommer avec modération.

## Les mini-jeux

| Jeu | Joueurs | En bref |
|---|---|---|
| Plus ou Moins 🃏 | 1+ | Plus haute ou plus basse ? Une erreur et on boit toute la série. |
| Poker ♠️ | 2+ | Texas Hold'em ; se coucher = boire le pot (sans les mises refusées). |
| Bataille ⚔️ | 2+ | Duel de cartes, « bataille ! » en cas d'égalité, paris des spectateurs. |
| Culture G 🧠 | 1+ | 5 QCM chronométrés pour tout le monde en même temps. |
| Tu préfères / Qui de nous 🗳️ | 3+ | Vote secret ; la minorité ou le désigné boit. Mode 18+ 🌶️ optionnel dans le salon. |
| Mèmes 😂 | 3+ | Légende la plus drôle, vote, la moins drôle boit. |
| 421 🎲 | 2+ | 3 dés, 3 lancers, on garde ce qu'on veut. |
| Undercover 🕵️ | 4+ | Un imposteur, des indices, un vote. |
| Blackjack 🎰 | 1+ | Contre la banque, on mise ses gorgées. |
| Tir à l'arc 🏹 | 1+ | 3 flèches, vent, vraie cible à 10 anneaux. |
| Réflexe ⚡ | 2+ | Rouge… vert ! Le plus lent boit, le faux départ boit double. |

## Univers Chill / Casino

Dans le salon, l'hôte choisit l'univers : **Soirée** (les mini-jeux ci-dessus)
ou **Chill**, des jeux casino sans gorgées, joués avec des jetons.

| Jeu | Joueurs | En bref |
|---|---|---|
| Poker ♠️ | 2-8 | Texas Hold'em No Limit, tournoi express : 1 000 jetons, blindes 10/20 qui doublent toutes les 2 min. |
| Blackjack Table 🎰 | 1-8 | Toute la table contre le croupier, 500 € chacun ; 5 / 10 / 15 manches ou dernier survivant. Règles dans `src/lib/bjtable/config.ts`. |

8 places assises au plus ; les suivants regardent. Fin de partie : classement,
puis « Rejouer » dans le même salon.

Les règles complètes sont dans le menu (☰) pendant la partie (`src/lib/game/rules.ts`) ;
l'écran d'intro de chaque manche se limite à une phrase d'accroche.

On peut lancer une partie seul : des bots (🤖) gérés par le serveur
complètent la table. À plusieurs, un jeu sans assez de joueurs est sauté
(l'hôte peut ajouter des bots).

## Architecture

- `src/lib/store.ts` : un salon = un document Redis versionné ; toute
  écriture est conditionnelle (script Lua) et rejouée en cas de conflit.
- `src/lib/games/*` : un module par mini-jeu (`start`, `act`, `pending`,
  `auto`). `src/lib/game/room.ts` applique les actions et fait avancer la
  partie (bots, délais, hôte absent) à chaque requête.
- `src/lib/game/view.ts` : ce que chaque joueur a le droit de voir.
- `src/components/ui/*` : design system ; `src/components/games/*` : un
  écran par mini-jeu.
- `src/lib/chips` : module jetons partagé par les jeux casino (soldes,
  mises engagées, règlement entre joueurs ou contre la banque, éliminations,
  classement).
- `src/lib/casino` : univers Chill (catalogue, lancement, fin de partie,
  cartes compactes) ; `src/lib/poker` : moteur Hold'em, pots, bots, blindes ;
  `src/lib/bjtable` : Blackjack Table ; `src/lib/blackjack/rules.ts` : règles
  pures communes aux deux blackjacks.
- `src/app/sw.js/route.ts` : service worker versionné par build.

## Variables d'environnement

- `KV_REST_API_URL` / `KV_REST_API_TOKEN` : base Upstash Redis (injectées par Vercel).

## Développement local

Sans compte Upstash, on peut utiliser un `redis-server` local derrière un petit
proxy REST compatible Upstash :

```bash
redis-server --daemonize yes
```

```bash
node scripts/dev-redis-proxy.mjs
```

```bash
KV_REST_API_URL=http://localhost:8079 KV_REST_API_TOKEN=dev npm run dev
```

## Tests

```bash
npm test
```

Tests unitaires : jetons, évaluateur de mains, side pots, moteur de poker,
Blackjack Table, cadre Chill, et un instantané déterministe du Poker et du Blackjack Soirée
(non-régression).

```bash
npm run test:engine
```

Simule des soirées complètes avec des bots, pour chaque mini-jeu et de 1 à 8 joueurs.

```bash
HUMANS=4 ROUNDS=10 npm run test:api
```

Joue une soirée de bout en bout via l'API HTTP (serveur local lancé).

```bash
npx tsx scripts/sim-poker.ts
```

Simule des centaines de tournois de Poker (vrai moteur, horloge virtuelle,
temps de réflexion humains) et donne leur durée.
