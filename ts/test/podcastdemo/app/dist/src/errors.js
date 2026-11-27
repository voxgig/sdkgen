export class HttpError extends Error {
    statusCode;
    headers;
    constructor(statusCode, name, message, headers = {}) {
        super(message);
        this.statusCode = statusCode;
        this.headers = headers;
        this.name = name;
    }
}
export const notFound = (what, id) => new HttpError(404, 'NotFoundError', `${what} with id '${id}' not found`);
export const badRequest = (message) => new HttpError(400, 'ValidationError', message);
export const unsupportedType = (got, want) => new HttpError(415, 'UnsupportedMediaType', `Expected ${want}, got ${got ?? 'none'}`);
export const tooLarge = (message) => new HttpError(413, 'ContentTooLarge', message);
export const preconditionFailed = (message, headers = {}) => new HttpError(412, 'PreconditionFailed', message, headers);
export function mediaEssence(contentType) {
    return contentType?.split(';')[0].trim().toLowerCase() || undefined;
}
export function requireType(contentType, want) {
    if (mediaEssence(contentType) !== want)
        throw unsupportedType(contentType, want);
}
//# sourceMappingURL=errors.js.map