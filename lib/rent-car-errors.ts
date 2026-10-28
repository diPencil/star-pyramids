/** Public-safe validation failure, distinct from database/programming errors. */
export class CarInputError extends Error {
  constructor(message: string) { super(message); this.name = 'CarInputError' }
}
