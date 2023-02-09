import type {
  CacheStatus,
  Config,
  IncomingCacheKey,
  ResponseEnvelope,
  StaleWhileRevalidateCache,
  StaticMethods,
} from '../types'
import { CacheResponseStatus, EmitterEvents } from './constants'
import {
  EmitterMethods,
  extendWithEmitterMethods,
  createEmitter,
} from './event-emitter'
import { createTimeCacheKey, getCacheKey, isNil, parseConfig } from './helpers'

export type StaleWhileRevalidate = StaleWhileRevalidateCache &
  EmitterMethods &
  StaticMethods

export function createStaleWhileRevalidateCache(
  config: Config
): StaleWhileRevalidate {
  const cacheConfig = parseConfig(config)
  const emitter = createEmitter()

  async function persistValue<CacheValue>({
    cacheKey,
    cacheValue,
    cacheTime,
    serialize,
    storage,
  }: {
    cacheKey: IncomingCacheKey
    cacheValue: CacheValue
    cacheTime: number
    serialize: NonNullable<Config['serialize']>
    storage: Config['storage']
  }): Promise<void> {
    const key = getCacheKey(cacheKey)
    const timeKey = createTimeCacheKey(key)

    try {
      await Promise.all([
        storage.setItem(key, serialize(cacheValue)),
        storage.setItem(timeKey, cacheTime.toString()),
      ])
    } catch (error) {
      emitter.emit(EmitterEvents.cacheSetFailed, { cacheKey, error })
      throw error
    }
  }

  async function staleWhileRevalidate<FunctionReturnValue>(
    cacheKey: IncomingCacheKey,
    fn: () => FunctionReturnValue,
    configOverrides?: Partial<Config>
  ): Promise<ResponseEnvelope<FunctionReturnValue>> {
    const { storage, minTimeToStale, maxTimeToLive, serialize, deserialize } =
      configOverrides
        ? parseConfig({ ...cacheConfig, ...configOverrides })
        : cacheConfig
    emitter.emit(EmitterEvents.invoke, { cacheKey, fn })

    const key = getCacheKey(cacheKey)
    const timeKey = createTimeCacheKey(key)

    let cacheStatus: CacheStatus = CacheResponseStatus.MISS

    type RetrieveCachedValueResponse = Promise<{
      cachedValue: unknown | null
      cachedAge: number
      cachedAt?: number
      now: number
    }>

    async function retrieveCachedValue(): RetrieveCachedValueResponse {
      const now = Date.now()

      try {
        // eslint-disable-next-line prefer-const
        let [cachedValue, cachedAt] = await Promise.all([
          storage.getItem(key),
          storage.getItem(timeKey),
        ])

        cachedValue = deserialize(cachedValue)

        if (isNil(cachedValue) || isNil(cachedAt)) {
          return { cachedValue: null, cachedAge: 0, now }
        }
        const cachedAge = now - Number(cachedAt)

        if (cachedAge > maxTimeToLive) {
          cacheStatus = CacheResponseStatus.EXPIRED
          emitter.emit(EmitterEvents.cacheExpired, {
            cacheKey,
            cachedAge,
            cachedAt,
            cachedValue,
            maxTimeToLive,
          })
          cachedValue = null
        }

        return { cachedValue, cachedAge, cachedAt: Number(cachedAt), now }
      } catch (error) {
        emitter.emit(EmitterEvents.cacheGetFailed, { cacheKey, error })
        return { cachedValue: null, cachedAge: 0, now }
      }
    }

    async function revalidate({ cacheTime }: { cacheTime: number }) {
      try {
        emitter.emit(EmitterEvents.revalidate, { cacheKey, fn })

        const result = await fn()

        // Intentionally persisting asynchronously and not blocking since there is
        // in any case a chance for a race condition to occur when using an external
        // persistence store, like Redis, with multiple consumers. The impact is low.
        // Error handled in `persistValue` by emitting an event, so only need a no-op here
        persistValue({
          cacheValue: result,
          cacheKey,
          cacheTime,
          serialize,
          storage,
        }).catch(() => {})

        return result
      } catch (error) {
        emitter.emit(EmitterEvents.revalidateFailed, { cacheKey, fn, error })
        throw error
      }
    }

    const { cachedValue, cachedAge, cachedAt, now } =
      await retrieveCachedValue()

    if (!isNil(cachedValue) && !isNil(cachedAt)) {
      cacheStatus = CacheResponseStatus.FRESH
      emitter.emit(EmitterEvents.cacheHit, { cacheKey, cachedValue })

      if (cachedAge >= minTimeToStale) {
        cacheStatus = CacheResponseStatus.STALE
        emitter.emit(EmitterEvents.cacheStale, {
          cacheKey,
          cachedValue,
          cachedAge,
        })
        // Non-blocking so that revalidation runs while stale cache data is returned
        // Error handled in `revalidate` by emitting an event, so only need a no-op here
        revalidate({ cacheTime: Date.now() }).catch(() => {})
      }

      return {
        cachedAt,
        expireAt: cachedAt + maxTimeToLive,
        maxTimeToLive,
        minTimeToStale,
        now,
        staleAt: cachedAt + minTimeToStale,
        status: cacheStatus,
        value: cachedValue as FunctionReturnValue,
      }
    }

    emitter.emit(EmitterEvents.cacheMiss, { cacheKey, fn })

    const revalidateCacheTime = Date.now()
    const result = await revalidate({ cacheTime: revalidateCacheTime })

    return {
      cachedAt: revalidateCacheTime,
      expireAt: revalidateCacheTime + maxTimeToLive,
      maxTimeToLive,
      minTimeToStale,
      now: revalidateCacheTime,
      staleAt: revalidateCacheTime + minTimeToStale,
      status: cacheStatus,
      value: result,
    }
  }

  const persist: StaticMethods['persist'] = <CacheValue>(
    cacheKey: IncomingCacheKey,
    cacheValue: CacheValue
  ) => {
    return persistValue({
      cacheKey,
      cacheValue,
      cacheTime: Date.now(),
      serialize: cacheConfig.serialize,
      storage: cacheConfig.storage,
    })
  }

  staleWhileRevalidate.persist = persist

  return extendWithEmitterMethods(emitter, staleWhileRevalidate)
}
