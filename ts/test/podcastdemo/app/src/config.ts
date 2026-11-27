const MiB = 1024 * 1024

export const DEFAULT_PORT = 8903
export const DEFAULT_TOKEN = 'podcastdemo-local-token'

export const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

export interface Limits {
  audio: number
  artwork: number
  transcript: number
  sessions: number
  sessionTtlMs: number
}

export interface Config {
  host: string
  port: number
  token: string
  logLevel: string
  dataPath?: string
  limits: Limits
}

function intOf(value: string | undefined, fallback: number): number {
  if (undefined === value || '' === value) return fallback
  const n = Number(value)
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new Error(`Not a non-negative integer: ${value}`)
  }
  return n
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    host: env.HOST || 'localhost',
    port: intOf(env.PORT, DEFAULT_PORT),
    token: env.PODCASTDEMO_TOKEN || DEFAULT_TOKEN,
    logLevel: env.LOG_LEVEL || 'error',
    dataPath: env.DATA_PATH || undefined,
    limits: {
      audio: intOf(env.PODCASTDEMO_MAX_AUDIO, 64 * MiB),
      artwork: intOf(env.PODCASTDEMO_MAX_ARTWORK, 1 * MiB),
      transcript: intOf(env.PODCASTDEMO_MAX_TRANSCRIPT, 1 * MiB),
      sessions: intOf(env.PODCASTDEMO_MAX_SESSIONS, 32),
      sessionTtlMs: intOf(env.PODCASTDEMO_SESSION_TTL_MS, 24 * 60 * 60 * 1000),
    },
  }
}
