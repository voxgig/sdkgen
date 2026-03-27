export const config = {
  server: {
    host: process.env.HOST || 'localhost',
    port: parseInt(process.env.PORT || '8901', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'error',
  },
  data: {
    initialDataPath: process.env.DATA_PATH || './solar.data.json',
  },
}
