import type { Metadata } from "next";
import TablesPreview from "@/components/preview/TablesPreview";

// Aperçu des tables Poker et Blackjack (Chill et Soirée) : données fictives, rien côté
// serveur. Page statique, non indexée.
export const metadata: Metadata = {
  title: "Cul-Sec · Tables (aperçu)",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <TablesPreview />;
}
