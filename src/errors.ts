/** Thrown when input or options cannot be converted. */
export class JsonToTypesError extends Error {
  override readonly name = "JsonToTypesError";

  constructor(message: string) {
    super(message);
  }
}
