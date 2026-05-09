export const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}`);
  },
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}`);
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}${error ? '\n' + (error instanceof Error ? error.stack : JSON.stringify(error, null, 2)) : ''}`);
  },
};
