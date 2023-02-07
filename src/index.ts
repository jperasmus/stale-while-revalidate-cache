import {
  Config,
  IncomingCacheKey,
  StaleWhileRevalidateCache,
  StaticMethods,
} from '../types'
import { EmitterEvents } from './constants'
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
    serialize,
    storage,
  }: {
    cacheKey: IncomingCacheKey
    cacheValue: CacheValue
    serialize: Config['serialize']
    storage: Config['storage']
  }) {
    const key = getCacheKey(cacheKey)
    const timeKey = createTimeCacheKey(key)

    try {
      await Promise.all([
        storage.setItem(
          key,
          isFunction(serialize) ? serialize(cacheValue) : cacheValue
        ),
        storage.setItem(timeKey, Date.now().toString()),
      ])
    } catch (error) {
      emitter.emit(EmitterEvents.cacheSetFailed, { cacheKey, error })
    }
  }

  async function staleWhileRevalidate<ReturnValue>(
    cacheKey: IncomingCacheKey,
    fn: () => ReturnValue,
    configOverrides?: Partial<Config>
  ): Promise<ReturnValue> {
    const { storage, minTimeToStale, maxTimeToLive, serialize, deserialize } =
      configOverrides
        ? parseConfig({ ...cacheConfig, ...configOverrides })
        : cacheConfig
    emitter.emit(EmitterEvents.invoke, { cacheKey, fn })

    const key = getCacheKey(cacheKey)
    const timeKey = createTimeCacheKey(key)

    async function retrieveCachedValue() {
      try {
        // eslint-disable-next-line prefer-const
        let [cachedValue, cachedTime] = await Promise.all([
          storage.getItem(key),
          storage.getItem(timeKey),
        ])

        cachedValue = deserialize(cachedValue)

        if (isNil(cachedValue)) {
          return { cachedValue: null, cachedAge: 0 }
        }

        const now = Date.now()
        const cachedAge = now - Number(cachedTime)

        if (cachedAge > maxTimeToLive) {
          emitter.emit(EmitterEvents.cacheExpired, {
            cacheKey,
            cachedAge,
            cachedTime,
            cachedValue,
            maxTimeToLive,
          })
          cachedValue = null
        }

        return { cachedValue, cachedAge }
      } catch (error) {
        emitter.emit(EmitterEvents.cacheGetFailed, { cacheKey, error })
        return { cachedValue: null, cachedAge: 0 }
      }
    }

    async function revalidate() {
      try {
        emitter.emit(EmitterEvents.revalidate, { cacheKey, fn })

        const result = await fn()

        // Intentionally persisting asynchronously and not blocking since there is
        // in any case a chance for a race condition to occur when using an external
        // persistence store, like Redis, with multiple consumers. The impact is low.
        persistValue({ cacheValue: result, cacheKey, serialize, storage })

        return result
      } catch (error) {
        emitter.emit(EmitterEvents.revalidateFailed, { cacheKey, fn, error })
        throw error
      }
    }

    const { cachedValue, cachedAge } = await retrieveCachedValue()

    if (!isNil(cachedValue)) {
      emitter.emit(EmitterEvents.cacheHit, { cacheKey, cachedValue })

      if (cachedAge >= minTimeToStale) {
        emitter.emit(EmitterEvents.cacheStale, {
          cacheKey,
          cachedValue,
          cachedAge,
        })
        // Non-blocking so that revalidation runs while stale cache data is returned
        // Error handled in `revalidate` by emitting an event, so only need a no-op here
        revalidate().catch(() => {})
      }

      return cachedValue as ReturnValue
    }

    emitter.emit(EmitterEvents.cacheMiss, { cacheKey, fn })

    return revalidate()
  }

  const persist = <CacheValue>(
    cacheKey: IncomingCacheKey,
    cacheValue: CacheValue
  ) => {
    return persistValue({
      cacheKey,
      cacheValue,
      serialize: cacheConfig.serialize,
      storage: cacheConfig.storage,
    })
  }

  staleWhileRevalidate.persist = persist

  return extendWithEmitterMethods(emitter, staleWhileRevalidate)
}
