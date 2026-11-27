import type { Metadata } from "next";
import TablesPreview from "@/components/casino/variants/TablesPreview";

// Comparateur des variantes de table (labo) : données fictives, rien côté
// serveur. Page statique, non indexée.
export const metadata: Metadata = {
  title: "Cul-Sec · Tables (aperçu)",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <TablesPreview />;
}
