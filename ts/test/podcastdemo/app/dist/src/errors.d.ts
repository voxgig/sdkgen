export declare class HttpError extends Error {
    readonly statusCode: number;
    readonly headers: Record<string, string>;
    constructor(statusCode: number, name: string, message: string, headers?: Record<string, string>);
}
export declare const notFound: (what: string, id: string) => HttpError;
export declare const badRequest: (message: string) => HttpError;
export declare const unsupportedType: (got: string | undefined, want: string) => HttpError;
export declare const tooLarge: (message: string) => HttpError;
export declare const preconditionFailed: (message: string, headers?: Record<string, string>) => HttpError;
export declare function mediaEssence(contentType: string | undefined): string | undefined;
export declare function requireType(contentType: string | undefined, want: string): void;
