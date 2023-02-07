interface Storage {
  getItem(key: string): unknown | null | Promise<unknown | null>
  setItem(key: string, value: unknown): void | Promise<void>
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

export type StaleWhileRevalidateCache = <ReturnValue>(
  cacheKey: IncomingCacheKey,
  fn: () => ReturnValue,
  configOverrides?: Partial<Config>
) => Promise<ReturnValue>

export type StaticMethods = {
  persist: <CacheValue>(
    cacheKey: IncomingCacheKey,
    cacheValue: CacheValue
  ) => Promise<void>
}
