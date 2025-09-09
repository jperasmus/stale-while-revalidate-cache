export interface Storage {
  getItem(key: string): unknown | null | Promise<unknown | null>
  setItem(
    key: string,
    value: unknown,
    persistOptions?: PersistOptions
  ): void | Promise<void>
  removeItem?: (key: string) => unknown | null | Promise<unknown | null>
  [key: string]: any
}

export type RetryFn = (failureCount: number, error?: unknown) => boolean
export type Retry = boolean | number | RetryFn
export type RetryDelayFn = (invocationCount: number) => number
export type RetryDelay = number | RetryDelayFn

export interface Config {
  minTimeToStale?: number
  maxTimeToLive?: number
  storage: Storage
  retry?: Retry
  retryDelay?: RetryDelay
  serialize?: (value: any) => any
  deserialize?: (value: any) => any
}

export type IncomingCacheKey = string | (() => string)

export type CacheStatus = 'fresh' | 'stale' | 'expired' | 'miss'

export type RetrieveCachedValueResponse<CacheValue> = {
  cachedValue: CacheValue | null
  cachedAge: number
  cachedAt?: number
  now: number
}

export type ResponseEnvelope<CacheValue> = {
  value: CacheValue
  status: CacheStatus
  minTimeToStale: number
  maxTimeToLive: number
  now: number
  cachedAt: number
  expireAt: number
  staleAt: number
}

export type PersistOptions = Record<string, any>

export type StaleWhileRevalidateCache = <CacheValue>(
  cacheKey: IncomingCacheKey,
  fn: () => CacheValue | Promise<CacheValue>,
  configOverrides?: Partial<Config>
) => Promise<ResponseEnvelope<Awaited<CacheValue>>>

export type StaticMethods = {
  delete: (cacheKey: IncomingCacheKey) => Promise<void>
  retrieve: <CacheValue>(
    cacheKey: IncomingCacheKey
  ) => Promise<RetrieveCachedValueResponse<CacheValue>>
  persist: <CacheValue>(
    cacheKey: IncomingCacheKey,
    cacheValue: CacheValue,
    persistOptions?: PersistOptions
  ) => Promise<void>
}
