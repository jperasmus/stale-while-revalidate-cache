import { createStaleWhileRevalidateCache } from '../src'
import { mockedLocalStorage } from './test-helpers'

const validConfig = {
  storage: mockedLocalStorage,
}

describe('createStaleWhileRevalidateCache', () => {
  beforeEach(() => {
    mockedLocalStorage.clear()
  })

  afterAll(() => {
    mockedLocalStorage.clear()
  })

  it(`should throw an error if the config is missing`, () => {
    // @ts-expect-error
    expect(() => createStaleWhileRevalidateCache()).toThrow()
  })

  it(`should create a stale while revalidate cache function`, () => {
    const staleWhileRevalidateCache = createStaleWhileRevalidateCache(
      validConfig
    )
    expect(staleWhileRevalidateCache).toEqual(expect.any(Function))
  })

  it('should invoke given function and persist to storage if not already freshly cached', async () => {
    const staleWhileRevalidateCache = createStaleWhileRevalidateCache(
      validConfig
    )
    const key = 'key'
    const value = 'value'
    const fn = jest.fn(() => value)
    const result = await staleWhileRevalidateCache(key, fn)

    expect(result).toEqual(value)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(mockedLocalStorage.getItem(key)).toEqual(value)
    expect(mockedLocalStorage.getItem(`${key}_time`)).toEqual(
      expect.any(String)
    )
  })

  it('should invoke custom serializer and deserializer methods', async () => {
    const customSerialize = jest.fn(JSON.stringify)
    const customDeserialize = jest.fn(JSON.parse)
    const staleWhileRevalidateCache = createStaleWhileRevalidateCache({
      ...validConfig,
      serialize: customSerialize,
      deserialize: customDeserialize,
    })
    const key = 'key'
    const value = { value: 'value' }
    const fn = jest.fn(() => value)
    const result = await staleWhileRevalidateCache(key, fn)

    expect(result).toEqual(JSON.parse(JSON.stringify(value)))
    expect(fn).toHaveBeenCalledTimes(1)
    expect(customSerialize).toHaveBeenCalledTimes(1)
    expect(customDeserialize).toHaveBeenCalledTimes(1)
    expect(mockedLocalStorage.getItem(key)).toEqual(JSON.stringify(value))
  })

  it('should not revalidate if the value is cached and still fresh', async () => {
    // Set minTimeToStale to 1 second so that the cache is fresh for second invocation
    const staleWhileRevalidateCache = createStaleWhileRevalidateCache({
      ...validConfig,
      minTimeToStale: 1000,
    })
    const key = 'fresh-example'
    const value1 = 'value 1'
    const value2 = 'value 2'
    const fn1 = jest.fn(() => value1)
    const fn2 = jest.fn(() => value2)
    const result1 = await staleWhileRevalidateCache(key, fn1)
    const result2 = await staleWhileRevalidateCache(key, fn2)

    expect(result1).toEqual(value1)
    expect(result2).toEqual(value1)
    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn2).not.toHaveBeenCalled()
  })

  it('should return value from cache while revalidating the value in the background if cache is stale but not dead', async () => {
    // Explicitly set minTimeToStale to 0 and maxTimeToLive to Infinity so that the cache is always stale, but not dead for second invocation
    const staleWhileRevalidateCache = createStaleWhileRevalidateCache({
      ...validConfig,
      minTimeToStale: 0,
      maxTimeToLive: Infinity,
    })
    const key = 'stale-example'
    const value1 = 'value 1'
    const value2 = 'value 2'
    const fn1 = jest.fn(() => value1)
    const fn2 = jest.fn(() => value2)
    const result1 = await staleWhileRevalidateCache(key, fn1)
    const result2 = await staleWhileRevalidateCache(key, fn2)

    expect(result1).toEqual(value1)
    expect(result2).toEqual(value1) // Still return value1 since it is from the cache
    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn2).toHaveBeenCalledTimes(1) // But invoke the function to revalidate the value in the background
  })

  it('should not return a value from cache if it has expired', async () => {
    const staleWhileRevalidateCache = createStaleWhileRevalidateCache({
      ...validConfig,
      minTimeToStale: 1000,
      maxTimeToLive: 2000,
    })
    const key = 'expired-example'
    const value1 = 'value 1'
    const value2 = 'value 2'
    const fn1 = jest.fn(() => value1)
    const fn2 = jest.fn(() => value2)
    const now = Date.now()
    const originalDateNow = Date.now

    Date.now = jest.fn(() => now - 3000) // 3 seconds back in time
    const result1 = await staleWhileRevalidateCache(key, fn1)

    Date.now = originalDateNow // Reset Date.now to original value so that cache for this key is expired
    const result2 = await staleWhileRevalidateCache(key, fn2)

    expect(result1).toEqual(value1)
    expect(result2).toEqual(value2)
    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn2).toHaveBeenCalledTimes(1)
  })
})
