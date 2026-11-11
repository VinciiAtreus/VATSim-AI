export const ENGINE_VERSION = '0.6.0'
declare const __BUILD_COMMIT__: string
export const BUILD_COMMIT =
  typeof __BUILD_COMMIT__ === 'string' ? __BUILD_COMMIT__ : 'local-development'
