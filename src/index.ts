import { Config } from '../types'
import {
  EmitterMethods,
  extendWithEmitterMethods,
  getEmitter,
} from './event-emitter'
import { isFunction, isNil, parseConfig } from './helpers'

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

type StaleWhileRevalidateCache = <ReturnValue>(
  cacheKey: string | (() => string),
  fn: () => ReturnValue
) => Promise<ReturnValue>

type StaleWhileRevalidate = StaleWhileRevalidateCache & EmitterMethods

export function createStaleWhileRevalidateCache(
  config: Config
): StaleWhileRevalidate {
  const { storage, minTimeToStale, maxTimeToLive, serialize, deserialize } =
    parseConfig(config)

  const emitter = getEmitter()

  async function staleWhileRevalidate<ReturnValue>(
    cacheKey: string | (() => string),
    fn: () => ReturnValue
  ): Promise<ReturnValue> {
    emitter.emit(EmitterEvents.invoke, { cacheKey, fn })

    const key = isFunction(cacheKey) ? String(cacheKey()) : String(cacheKey)
    const timeKey = `${key}_time`

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

    async function persistValue(result: ReturnValue) {
      try {
        await Promise.all([
          storage.setItem(key, serialize(result)),
          storage.setItem(timeKey, Date.now().toString()),
        ])
      } catch (error) {
        emitter.emit(EmitterEvents.cacheSetFailed, { cacheKey, error })
      }
    }

    async function revalidate() {
      try {
        emitter.emit(EmitterEvents.revalidate, { cacheKey, fn })

        const result = await fn()

        // Intentionally persisting asynchronously and not blocking since there is
        // in any case a chance for a race condition to occur when using an external
        // persistence store, like Redis, with multiple consumers. The impact is low.
        persistValue(result)

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

  return extendWithEmitterMethods(emitter, staleWhileRevalidate)
}
