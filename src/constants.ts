export const EmitterEvents = {
  cacheHit: 'cacheHit',
  cacheMiss: 'cacheMiss',
  cacheStale: 'cacheStale',
  cacheExpired: 'cacheExpired',
  cacheGetFailed: 'cacheGetFailed',
  cacheSetFailed: 'cacheSetFailed',
  invoke: 'invoke',
  revalidate: 'revalidate',
  revalidateFailed: 'revalidateFailed',
} as const
