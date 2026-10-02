const ts = () => new Date().toISOString();
export const logger = {
  info: (...a: any[]) => console.log(`[${ts()}] INFO `, ...a),
  warn: (...a: any[]) => console.warn(`[${ts()}] WARN `, ...a),
  error: (...a: any[]) => console.error(`[${ts()}] ERROR`, ...a),
  debug: (...a: any[]) => { if (process.env.NODE_ENV !== 'production') console.log(`[${ts()}] DEBUG`, ...a); },
};
