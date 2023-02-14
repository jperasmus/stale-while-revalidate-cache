export interface Storage {
  getItem(key: string): unknown | null | Promise<unknown | null>
  setItem(key: string, value: unknown): void | Promise<void>
  removeItem?: (key: string) => unknown | null | Promise<unknown | null>
  [key: string]: any
}

export interface Config {
  minTimeToStale?: number
  maxTimeToLive?: number
  storage: Storage
  serialize?: (value: any) => any
  deserialize?: (value: any) => any
}

export type IncomingCacheKey = string | (() => string)

export type CacheStatus = 'fresh' | 'stale' | 'expired' | 'miss'

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

export type StaleWhileRevalidateCache = <FunctionReturnValue>(
  cacheKey: IncomingCacheKey,
  fn: () => FunctionReturnValue,
  configOverrides?: Partial<Config>
) => Promise<ResponseEnvelope<FunctionReturnValue>>

export type StaticMethods = {
  delete: (cacheKey: IncomingCacheKey) => Promise<void>
  persist: <CacheValue>(
    cacheKey: IncomingCacheKey,
    cacheValue: CacheValue
  ) => Promise<void>
}
