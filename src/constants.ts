export const EmitterEvents = {
  cacheHit: 'cacheHit',
  cacheMiss: 'cacheMiss',
  cacheStale: 'cacheStale',
  cacheExpired: 'cacheExpired',
  cacheGetFailed: 'cacheGetFailed',
  cacheRemoveFailed: 'cacheRemoveFailed',
  cacheSetFailed: 'cacheSetFailed',
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
