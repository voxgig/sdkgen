export declare class NotFoundError extends Error {
    statusCode: number;
    constructor(resource: string, id: string);
}
export declare class ValidationError extends Error {
    statusCode: number;
    constructor(message: string);
}
