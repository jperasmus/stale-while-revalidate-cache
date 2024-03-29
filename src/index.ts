import type {
  CacheStatus,
  Config,
  IncomingCacheKey,
  ResponseEnvelope,
  RetrieveCachedValueResponse,
  StaleWhileRevalidateCache,
  StaticMethods,
} from '../types'
import { CacheResponseStatus, EmitterEvents } from './constants'
import {
  EmitterMethods,
  extendWithEmitterMethods,
  createEmitter,
} from './event-emitter'
import {
  createTimeCacheKey,
  getCacheKey,
  isNil,
  parseConfig,
  waitFor,
} from './helpers'

export { EmitterEvents }

export type StaleWhileRevalidate = StaleWhileRevalidateCache &
  EmitterMethods &
  StaticMethods

export function createStaleWhileRevalidateCache(
  config: Config
): StaleWhileRevalidate {
  const cacheConfig = parseConfig(config)
  const emitter = createEmitter()
  const inFlightKeys = new Set<string>()

  async function deleteValue({
    cacheKey,
    storage,
  }: {
    cacheKey: IncomingCacheKey
    storage: Config['storage']
  }): Promise<void> {
    const key = getCacheKey(cacheKey)
    const timeKey = createTimeCacheKey(key)

    try {
      if (!storage.removeItem) {
        throw new Error('Storage does not support removeItem method')
      }

      await Promise.all([storage.removeItem(key), storage.removeItem(timeKey)])
    } catch (error) {
      emitter.emit(EmitterEvents.cacheRemoveFailed, { cacheKey, error })
      throw error
    }
  }

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

  async function retrieveValue<CacheValue>({
    cacheKey,
    storage,
    deserialize,
  }: {
    cacheKey: IncomingCacheKey
    storage: Config['storage']
    deserialize: NonNullable<Config['deserialize']>
  }): Promise<RetrieveCachedValueResponse<CacheValue>> {
    const now = Date.now()
    const key = getCacheKey(cacheKey)
    const timeKey = createTimeCacheKey(key)

    try {
      const [cachedValue, cachedAt] = await Promise.all([
        storage.getItem(key),
        storage.getItem(timeKey),
      ])

      if (
        isNil(cachedValue) ||
        isNil(cachedAt) ||
        Number.isNaN(Number(cachedAt))
      ) {
        return { cachedValue: null, cachedAge: 0, now }
      }

      return {
        cachedValue: deserialize(cachedValue) as CacheValue | null,
        cachedAge: now - Number(cachedAt),
        cachedAt: Number(cachedAt),
        now,
      }
    } catch (error) {
      emitter.emit(EmitterEvents.cacheGetFailed, { cacheKey, error })
      throw error
    }
  }

  async function staleWhileRevalidate<CacheValue>(
    cacheKey: IncomingCacheKey,
    fn: () => CacheValue | Promise<CacheValue>,
    configOverrides?: Partial<Config>
  ): Promise<ResponseEnvelope<Awaited<CacheValue>>> {
    const {
      storage,
      minTimeToStale,
      maxTimeToLive,
      serialize,
      deserialize,
      retry,
      retryDelay,
    } = configOverrides
      ? parseConfig({ ...cacheConfig, ...configOverrides })
      : cacheConfig
    emitter.emit(EmitterEvents.invoke, { cacheKey, fn })

    const key = getCacheKey(cacheKey)
    const timeKey = createTimeCacheKey(key)

    let invocationCount = 0
    let cacheStatus: CacheStatus = CacheResponseStatus.MISS

    if (inFlightKeys.has(key)) {
      emitter.emit(EmitterEvents.cacheInFlight, { key, cacheKey })

      let inFlightListener:
        | ((eventData: Record<'key', string>) => void)
        | null = null

      await new Promise((resolve) => {
        inFlightListener = (eventData: Record<'key', string>) => {
          if (eventData.key === key) {
            resolve(eventData)
          }
        }

        emitter.on(EmitterEvents.cacheInFlightSettled, inFlightListener)
      })

      if (inFlightListener) {
        emitter.off(EmitterEvents.cacheInFlightSettled, inFlightListener)
      }
    }

    inFlightKeys.add(key)

    async function retrieveCachedValue(): Promise<
      RetrieveCachedValueResponse<unknown>
    > {
      const now = Date.now()

      try {
        // eslint-disable-next-line prefer-const
        let [cachedValue, cachedAt] = await Promise.all([
          storage.getItem(key),
          storage.getItem(timeKey),
        ])

        if (isNil(cachedValue) || isNil(cachedAt)) {
          return { cachedValue: null, cachedAge: 0, now }
        }

        cachedValue = deserialize(cachedValue)

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
        if (invocationCount === 0) {
          emitter.emit(EmitterEvents.revalidate, { cacheKey, fn })
          inFlightKeys.add(key)
        }

        invocationCount++

        let result: Awaited<CacheValue>

        try {
          result = await fn()
        } catch (error) {
          if (!retry(invocationCount, error)) {
            throw error
          }

          const delay = retryDelay(invocationCount)

          await waitFor(delay)

          return revalidate({ cacheTime })
        }

        // Error handled in `persistValue` by emitting an event, so only need a no-op here
        await persistValue({
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
      } finally {
        inFlightKeys.delete(key)
        emitter.emit(EmitterEvents.cacheInFlightSettled, { cacheKey, key })
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
      } else {
        // When it is a pure cache hit, we are not revalidating, so we can remove the key from the in-flight set
        inFlightKeys.delete(key)
        emitter.emit(EmitterEvents.cacheInFlightSettled, { cacheKey, key })
      }

      return {
        cachedAt,
        expireAt: cachedAt + maxTimeToLive,
        maxTimeToLive,
        minTimeToStale,
        now,
        staleAt: cachedAt + minTimeToStale,
        status: cacheStatus,
        value: cachedValue as Awaited<CacheValue>,
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

  const del: StaticMethods['delete'] = (cacheKey: IncomingCacheKey) => {
    return deleteValue({
      cacheKey,
      storage: cacheConfig.storage,
    })
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

  const retrieve: StaticMethods['retrieve'] = async <CacheValue>(
    cacheKey: IncomingCacheKey
  ) => {
    return retrieveValue<CacheValue>({
      cacheKey,
      storage: cacheConfig.storage,
      deserialize: cacheConfig.deserialize,
    })
  }

  staleWhileRevalidate.delete = del
  staleWhileRevalidate.persist = persist
  staleWhileRevalidate.retrieve = retrieve

  return extendWithEmitterMethods(emitter, staleWhileRevalidate)
}
