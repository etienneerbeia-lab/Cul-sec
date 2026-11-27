"use client";

import BlackjackTableScreen from "../BlackjackTableScreen";
import PokerScreen from "../PokerScreen";
import BlackjackVariantScreen from "./BlackjackVariant";
import PokerVariantScreen from "./PokerVariant";
import { useTablePrefs } from "./store";

// Écrans des tables Chill branchés dans GameRouter : la table actuelle par
// défaut, ou la variante choisie dans le labo (menu ☰, sélecteur caché).

export function PokerScreenSwitch() {
  const prefs = useTablePrefs();
  if (prefs.poker === "actuel") return <PokerScreen />;
  return <PokerVariantScreen variant={prefs.poker} deck={prefs.deck === "auto" ? undefined : prefs.deck} fourColor={prefs.fourColor} />;
}

export function BlackjackScreenSwitch() {
  const prefs = useTablePrefs();
  if (prefs.bj === "actuel") return <BlackjackTableScreen />;
  return <BlackjackVariantScreen variant={prefs.bj} deck={prefs.deck === "auto" ? undefined : prefs.deck} fourColor={prefs.fourColor} />;
}
