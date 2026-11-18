// Horloge alignée sur celle du serveur : les chronos (quiz, votes...) sont
// calculés à partir d'heures serveur, et l'horloge d'un téléphone peut être
// décalée de plusieurs secondes. Mis à jour à chaque rafraîchissement.
let offset = 0;

export function syncClock(serverNow: number, requestStartedAt: number): void {
  const received = Date.now();
  // Le serveur a répondu « à peu près » au milieu de l'aller-retour.
  offset = serverNow - (requestStartedAt + received) / 2;
}

export function serverNow(): number {
  return Date.now() + offset;
}
