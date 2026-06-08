export function createTestPlanet(overrides) {
    return {
        id: 'test-planet',
        name: 'Test Planet',
        kind: 'rock',
        diameter: 5000,
        ...overrides,
    };
}
export function createTestMoon(overrides) {
    return {
        id: 'test-moon',
        name: 'Test Moon',
        planet_id: 'test-planet',
        kind: 'rock',
        diameter: 1000,
        ...overrides,
    };
}
//# sourceMappingURL=setup.js.map