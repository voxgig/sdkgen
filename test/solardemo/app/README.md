# Solar System API Server

A Node.js 24 API server built with Fastify that provides RESTful operations for managing planets and moons in a solar system. Data is stored in memory and loaded from a JSON file on startup.

## Requirements

- Node.js 24.x or higher
- npm

## Quick Start

```bash
# Install dependencies
npm install

# Run in development mode (auto-reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run unit tests
npm test

# Run API validation tests (requires server running)
npm run validate

# Run full validation (auto starts/stops server)
npm run validate:full
```

The server will start on `http://localhost:8901` by default.

## API Endpoints

### Planets

#### List all planets
```bash
curl http://localhost:8901/api/planet
```

**Response:** Array of planet objects

#### Get a specific planet
```bash
curl http://localhost:8901/api/planet/earth
```

**Response:** Planet object
```json
{
  "id": "earth",
  "name": "Earth",
  "kind": "rock",
  "diameter": 12756
}
```

#### Create a new planet
```bash
curl -X POST http://localhost:8901/api/planet \
  -H "Content-Type: application/json" \
  -d '{
    "id": "pluto",
    "name": "Pluto",
    "kind": "rock",
    "diameter": 2377
  }'
```

**Response:** Created planet object (201)

#### Update a planet
```bash
curl -X PUT http://localhost:8901/api/planet/pluto \
  -H "Content-Type: application/json" \
  -d '{
    "id": "pluto",
    "name": "Pluto (Dwarf Planet)",
    "kind": "rock",
    "diameter": 2377
  }'
```

**Response:** Updated planet object (200)

#### Delete a planet
```bash
curl -X DELETE http://localhost:8901/api/planet/pluto
```

**Response:** No content (204)

**Note:** Deleting a planet will cascade delete all its moons.

#### Terraform a planet
Start or stop terraforming operations on a planet.

```bash
# Start terraforming
curl -X POST http://localhost:8901/api/planet/mars/terraform \
  -H "Content-Type: application/json" \
  -d '{"start": true}'

# Stop terraforming
curl -X POST http://localhost:8901/api/planet/mars/terraform \
  -H "Content-Type: application/json" \
  -d '{"stop": true}'
```

**Response:**
```json
{
  "ok": true,
  "state": "terraforming"
}
```

#### Forbid a planet
Mark a planet as forbidden or allowed.

```bash
# Forbid a planet
curl -X POST http://localhost:8901/api/planet/venus/forbid \
  -H "Content-Type: application/json" \
  -d '{
    "forbid": true,
    "why": "Dangerous atmosphere"
  }'

# Allow a planet
curl -X POST http://localhost:8901/api/planet/venus/forbid \
  -H "Content-Type: application/json" \
  -d '{"forbid": false}'
```

**Response:**
```json
{
  "ok": true,
  "state": "forbidden"
}
```

### Moons

#### List moons of a planet
```bash
curl http://localhost:8901/api/planet/earth/moon
```

**Response:** Array of moon objects

#### Get a specific moon
```bash
curl http://localhost:8901/api/planet/earth/moon/luna
```

**Response:** Moon object
```json
{
  "id": "luna",
  "name": "Luna",
  "planet_id": "earth",
  "kind": "rock",
  "diameter": 3475
}
```

#### Create a new moon
```bash
curl -X POST http://localhost:8901/api/planet/earth/moon \
  -H "Content-Type: application/json" \
  -d '{
    "id": "luna2",
    "name": "Luna 2",
    "planet_id": "earth",
    "kind": "rock",
    "diameter": 100
  }'
```

**Response:** Created moon object (201)

**Note:** The `planet_id` in the body must match the `planet_id` in the URL path.

#### Update a moon
```bash
curl -X PUT http://localhost:8901/api/planet/earth/moon/luna2 \
  -H "Content-Type: application/json" \
  -d '{
    "id": "luna2",
    "name": "Luna 2 Updated",
    "planet_id": "earth",
    "kind": "ice",
    "diameter": 150
  }'
```

**Response:** Updated moon object (200)

#### Delete a moon
```bash
curl -X DELETE http://localhost:8901/api/planet/earth/moon/luna2
```

**Response:** No content (204)

## Error Responses

### 404 Not Found
```json
{
  "error": "NotFoundError",
  "message": "Planet with id 'unknown' not found"
}
```

### 400 Bad Request
```json
{
  "error": "Validation Error",
  "message": "body must have required property 'name'"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "Something went wrong"
}
```

## Data Schema

### Planet
```typescript
{
  id: string              // Unique identifier
  name: string            // Planet name
  kind: string            // Planet type (rock, gas, etc.)
  diameter: number        // Diameter in kilometers
  terraformState?: string // Optional: idle | terraforming | complete
  forbidState?: string    // Optional: allowed | forbidden
  forbidReason?: string   // Optional: reason for forbidding
}
```

### Moon
```typescript
{
  id: string         // Unique identifier
  name: string       // Moon name
  planet_id: string  // Parent planet ID
  kind: string       // Moon type (rock, ice, etc.)
  diameter: number   // Diameter in kilometers
}
```

## Development

### Project Structure
```
app/
├── src/
│   ├── server.ts           # Main server setup
│   ├── config.ts           # Configuration
│   ├── types.ts            # TypeScript types
│   ├── store/              # Data layer
│   ├── handlers/           # Request handlers
│   ├── routes/             # Route definitions
│   ├── schemas/            # JSON schemas for validation
│   └── utils/              # Utilities
├── test/
│   ├── store/              # Unit tests for stores
│   └── integration/        # Integration tests
├── solar.data.json         # Initial data
└── def/                    # OpenAPI specification
```

### Scripts

**Development:**
- `npm run dev` - Start development server with auto-reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm run server` - Build and start production server
- `npm start` - Start production server (requires build)

**Testing:**
- `npm test` - Run all unit/integration tests
- `npm run test:unit` - Run unit tests only
- `npm run test:integration` - Run integration tests only
- `npm run test:watch` - Run tests in watch mode

**Validation:**
- `npm run validate` - Run API validation tests (server must be running)
- `npm run validate:full` - Build, start server, validate, and cleanup automatically

**Utilities:**
- `npm run typecheck` - Type check without emitting files
- `npm run clean` - Remove dist folder

### Testing

The project uses Node.js built-in test runner (node:test) with two types of tests:

**Unit Tests:** Test individual components in isolation
```bash
npm run test:unit
```

**Integration Tests:** Test full API workflows
```bash
npm run test:integration
```

### API Validation

The project includes a comprehensive validation script (`validate.ts`) that tests all API endpoints using fetch:

**Run with server already running:**
```bash
# Terminal 1: Start server
npm run server

# Terminal 2: Run validation
npm run validate
```

**Run with automatic server management:**
```bash
npm run validate:full
```

The validation script tests:
- ✓ All CRUD operations for planets and moons
- ✓ Custom operations (terraform, forbid)
- ✓ State persistence
- ✓ Error handling (404, 400)
- ✓ Cascade deletes
- ✓ Request validation

**Output:** 20 validation tests covering all API functionality.

### Environment Variables

- `HOST` - Server host (default: localhost)
- `PORT` - Server port (default: 8901)
- `LOG_LEVEL` - Logging level (default: info)
- `NODE_ENV` - Environment (development, production)
- `DATA_PATH` - Path to data file (default: ./solar.data.json)

## Architecture

### Data Storage
- In-memory storage using Map data structures
- Repository pattern for data access
- Data loaded from `solar.data.json` on server startup
- Cascade delete: removing a planet removes all its moons

### Validation
- JSON Schema validation using Fastify's built-in Ajv integration
- Request body, params, and response validation
- OpenAPI 3.0 compliant schemas

### Error Handling
- Custom error classes with HTTP status codes
- Centralized error handler
- Proper error responses with consistent format

## Initial Data

The server comes pre-loaded with:
- 8 planets (Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune)
- 20 moons across various planets

## License

ISC
