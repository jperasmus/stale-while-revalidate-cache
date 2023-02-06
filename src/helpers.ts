import { Config, IncomingCacheKey } from '../types'

type Fn = (...args: any[]) => any

export const isFunction = (value: unknown): value is Fn =>
  typeof value === 'function'

type Nil = null | undefined

export const isNil = (value: unknown): value is Nil =>
  typeof value === 'undefined' || value === null

export const isPlainObject = (value: unknown) =>
  !!value && typeof value === 'object' && !Array.isArray(value)

export const getCacheKey = (cacheKey: IncomingCacheKey) =>
  isFunction(cacheKey) ? String(cacheKey()) : String(cacheKey)

export const createTimeCacheKey = (cacheKey: string) => `${cacheKey}_time`

export const passThrough = (value: unknown) => value

export function parseConfig(config: Config) {
  if (!isPlainObject(config)) {
    throw new Error('Config is required')
  }

  const storage = config.storage

  if (
    !isPlainObject(storage) ||
    !isFunction(storage.getItem) ||
    !isFunction(storage.setItem)
  ) {
    throw new Error(
      'Storage is required and should satisfy the Config["storage"] type'
    )
  }

  const minTimeToStale = config.minTimeToStale || 0
  const maxTimeToLive =
    Math.min(config.maxTimeToLive!, Number.MAX_SAFE_INTEGER) || Infinity
  const serialize = isFunction(config.serialize)
    ? config.serialize
    : passThrough
  const deserialize = isFunction(config.deserialize)
    ? config.deserialize
    : passThrough

  if (minTimeToStale >= maxTimeToLive) {
    throw new Error('minTimeToStale must be less than maxTimeToLive')
  }

  return {
    storage,
    minTimeToStale,
    maxTimeToLive,
    serialize,
    deserialize,
  }
}
