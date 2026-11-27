export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    name: string,
    message: string,
    readonly headers: Record<string, string> = {},
  ) {
    super(message)
    this.name = name
  }
}

export const notFound = (what: string, id: string) =>
  new HttpError(404, 'NotFoundError', `${what} with id '${id}' not found`)

export const badRequest = (message: string) => new HttpError(400, 'ValidationError', message)

export const unsupportedType = (got: string | undefined, want: string) =>
  new HttpError(415, 'UnsupportedMediaType', `Expected ${want}, got ${got ?? 'none'}`)

export const tooLarge = (message: string) => new HttpError(413, 'ContentTooLarge', message)

export const preconditionFailed = (message: string, headers: Record<string, string> = {}) =>
  new HttpError(412, 'PreconditionFailed', message, headers)

export function mediaEssence(contentType: string | undefined): string | undefined {
  return contentType?.split(';')[0].trim().toLowerCase() || undefined
}

export function requireType(contentType: string | undefined, want: string): void {
  if (mediaEssence(contentType) !== want) throw unsupportedType(contentType, want)
}
