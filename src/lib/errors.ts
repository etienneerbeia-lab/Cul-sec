// Erreur métier renvoyée telle quelle au client (message en français).
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export function fail(status: number, message: string): never {
  throw new ApiError(status, message);
}

// Raccourci : « ce n'est pas le moment » (phase ou tour incorrect).
export function notNow(): never {
  fail(409, "Ce n'est pas le moment.");
}
