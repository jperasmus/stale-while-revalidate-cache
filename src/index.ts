import { isFunction, parseConfig } from './helpers'
import { Config } from '../types'

export function createStaleWhileRevalidateCache(config: Config) {
  const {
    storage,
    minTimeToStale,
    maxTimeToLive,
    serialize,
    deserialize,
  } = parseConfig(config)

  return async function staleWhileRevalidateCache<ReturnValue extends unknown>(
    cacheKey: string | (() => string),
    fn: () => ReturnValue
  ): Promise<ReturnValue> {
    const key = isFunction(cacheKey) ? String(cacheKey()) : String(cacheKey)
    const timeKey = `${key}_time`

    async function revalidate() {
      const result = await fn()

      await Promise.all([
        storage.setItem(key, serialize(result)),
        storage.setItem(timeKey, Date.now().toString()),
      ])

      return result
    }

    let [cachedValue, cachedTime] = await Promise.all([
      storage.getItem(key),
      storage.getItem(timeKey),
    ])

    cachedValue = deserialize(cachedValue)

    const now = Date.now()
    const cachedAge = now - Number(cachedTime)

    if (cachedAge > maxTimeToLive) {
      cachedValue = null
    }

    if (cachedValue) {
      if (cachedAge >= minTimeToStale) {
        revalidate()
      }

      return cachedValue as ReturnValue
    }

    return revalidate()
  }
}
