export declare const planetSchemas: {
    list: {
        response: {
            200: {
                type: string;
                items: {
                    $ref: string;
                };
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
        body: {
            type: string;
            required: string[];
            properties: {
                name: {
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
    terraform: {
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
            properties: {
                start: {
                    type: string;
                };
                stop: {
                    type: string;
                };
            };
            additionalProperties: boolean;
        };
        response: {
            200: {
                type: string;
                properties: {
                    ok: {
                        type: string;
                    };
                    state: {
                        type: string;
                    };
                };
            };
            404: {
                $ref: string;
            };
        };
    };
    forbid: {
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
                forbid: {
                    type: string;
                };
                why: {
                    type: string;
                };
            };
            additionalProperties: boolean;
        };
        response: {
            200: {
                type: string;
                properties: {
                    ok: {
                        type: string;
                    };
                    state: {
                        type: string;
                    };
                };
            };
            404: {
                $ref: string;
            };
        };
    };
};
