export declare const moonSchemas: {
    list: {
        params: {
            type: string;
            required: string[];
            properties: {
                planet_id: {
                    type: string;
                };
            };
        };
        response: {
            200: {
                type: string;
                items: {
                    $ref: string;
                };
            };
            404: {
                $ref: string;
            };
        };
    };
    get: {
        params: {
            type: string;
            required: string[];
            properties: {
                planet_id: {
                    type: string;
                };
                moon_id: {
                    type: string;
                };
            };
        };
        response: {
            200: {
                $ref: string;
            };
            404: {
                $ref: string;
            };
        };
    };
    create: {
        params: {
            type: string;
            required: string[];
            properties: {
                planet_id: {
                    type: string;
                };
            };
        };
        body: {
            type: string;
            required: string[];
            properties: {
                name: {
                    type: string;
                };
                planet_id: {
                    type: string;
                };
                kind: {
                    type: string;
                };
                diameter: {
                    type: string;
                };
            };
            additionalProperties: boolean;
        };
        response: {
            201: {
                $ref: string;
            };
            400: {
                $ref: string;
            };
            404: {
                $ref: string;
            };
        };
    };
    update: {
        params: {
            type: string;
            required: string[];
            properties: {
                planet_id: {
                    type: string;
                };
                moon_id: {
                    type: string;
                };
            };
        };
        body: {
            type: string;
            properties: {
                id: {
                    type: string;
                };
                name: {
                    type: string;
                };
                planet_id: {
                    type: string;
                };
                kind: {
                    type: string;
                };
                diameter: {
                    type: string;
                };
            };
            additionalProperties: boolean;
        };
        response: {
            200: {
                $ref: string;
            };
            404: {
                $ref: string;
            };
        };
    };
    delete: {
        params: {
            type: string;
            required: string[];
            properties: {
                planet_id: {
                    type: string;
                };
                moon_id: {
                    type: string;
                };
            };
        };
        response: {
            204: {
                type: string;
            };
            404: {
                $ref: string;
            };
        };
    };
};
