// Réglages côté serveur de la croupière. L'IA (Claude) rédige ses répliques
// si une clé d'API est configurée (ANTHROPIC_API_KEY sur Vercel) ; sinon,
// ou si DEALER_LLM=off, elle garde ses réponses toutes faites.

export const DEALER_MODEL = "claude-opus-5-5";

// Temps laissé à l'IA avant d'afficher la réplique de secours.
export const DEALER_LLM_WAIT_MS = 9000;

export function dealerLlmEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY && process.env.DEALER_LLM !== "off";
}
