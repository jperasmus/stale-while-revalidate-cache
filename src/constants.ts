export const EmitterEvents = {
  cacheHit: 'cacheHit',
  cacheMiss: 'cacheMiss',
  cacheStale: 'cacheStale',
  cacheExpired: 'cacheExpired',
  cacheGetFailed: 'cacheGetFailed',
  cacheRemoveFailed: 'cacheRemoveFailed',
  cacheSetFailed: 'cacheSetFailed',
  cacheInFlight: 'cacheInFlight',
  cacheInFlightSettled: 'cacheInFlightSettled',
  invoke: 'invoke',
  revalidate: 'revalidate',
  revalidateFailed: 'revalidateFailed',
} as const

export const CacheResponseStatus = {
  FRESH: 'fresh',
  STALE: 'stale',
  EXPIRED: 'expired',
  MISS: 'miss',
} as const

export const DefaultRetryDelay = {
  MIN_MS: 1000,
  MAX_MS: 30000,
}
