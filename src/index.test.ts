import { createStaleWhileRevalidateCache } from './index'
import { createTimeCacheKey } from './helpers'
import { mockedLocalStorage, valueFromEnvelope } from './test-helpers'
import { EmitterEvents } from './constants'

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

  describe('Config', () => {
    it(`should throw an error if the config is missing`, () => {
      // @ts-expect-error calling function without config
      expect(() => createStaleWhileRevalidateCache()).toThrow()
    })

    it(`should create a stale while revalidate cache function`, () => {
      const swr = createStaleWhileRevalidateCache(validConfig)
      expect(swr).toEqual(expect.any(Function))
    })

    it('should allow overriding the cache config per invocation', async () => {
      const swr = createStaleWhileRevalidateCache(validConfig)
      const configOverrides = {
        minTimeToStale: 1000,
        maxTimeToLive: 2000,
      }
      const key = 'expired-config-override-example'
      const value1 = 'value 1'
      const value2 = 'value 2'
      const fn1 = jest.fn(() => value1)
      const fn2 = jest.fn(() => value2)
      const now = Date.now()
      const originalDateNow = Date.now

      Date.now = jest.fn(() => now - 3000) // 3 seconds back in time
      const envelope1 = await swr(key, fn1, configOverrides)

      Date.now = originalDateNow // Reset Date.now to original value so that cache for this key is expired
      const envelope2 = await swr(key, fn2, configOverrides)

      expect(valueFromEnvelope(envelope1)).toEqual(value1)
      expect(valueFromEnvelope(envelope2)).toEqual(value2)
      expect(fn1).toHaveBeenCalledTimes(1)
      expect(fn2).toHaveBeenCalledTimes(1)
    })
  })

  describe('Cache revalidation logic', () => {
    it('should invoke given function and persist to storage if not already freshly cached', async () => {
      const swr = createStaleWhileRevalidateCache(validConfig)
      const key = 'key'
      const value = 'value'
      const fn = jest.fn(async () => value)
      const result = await swr<string>(key, async () => await fn())

      expect(result).toMatchObject({
        value,
        status: 'miss',
        minTimeToStale: 0,
        maxTimeToLive: Infinity,
        now: expect.any(Number),
        cachedAt: expect.any(Number),
        expireAt: Infinity,
        staleAt: expect.any(Number),
      })
      expect(fn).toHaveBeenCalledTimes(1)
      expect(mockedLocalStorage.getItem(key)).toEqual(value)
      expect(mockedLocalStorage.getItem(createTimeCacheKey(key))).toEqual(
        expect.any(String)
      )
    })

    it('should invoke custom serializer and deserializer methods when reading from cache', async () => {
      const customSerialize = jest.fn(JSON.stringify)
      const customDeserialize = jest.fn(JSON.parse)
      const swr = createStaleWhileRevalidateCache({
        ...validConfig,
        serialize: customSerialize,
        deserialize: customDeserialize,
      })
      const key = 'key'
      const value = { value: 'value' }
      const fn = jest.fn(() => value)
      const result = await swr(key, fn)

      expect(result).toMatchObject({
        value: JSON.parse(JSON.stringify(value)),
        status: 'miss',
        minTimeToStale: 0,
        maxTimeToLive: Infinity,
        now: expect.any(Number),
        cachedAt: expect.any(Number),
        expireAt: Infinity,
        staleAt: expect.any(Number),
      })
      expect(fn).toHaveBeenCalledTimes(1)
      expect(customSerialize).toHaveBeenCalledTimes(1)
      expect(customDeserialize).toHaveBeenCalledTimes(0)
      expect(mockedLocalStorage.getItem(key)).toEqual(JSON.stringify(value))

      const result2 = await swr(key, fn)

      expect(result2).toMatchObject({
        value: JSON.parse(JSON.stringify(value)),
        status: 'stale',
        minTimeToStale: 0,
        maxTimeToLive: Infinity,
        now: expect.any(Number),
        cachedAt: expect.any(Number),
        expireAt: Infinity,
        staleAt: expect.any(Number),
      })
      expect(fn).toHaveBeenCalledTimes(2)
      expect(customSerialize).toHaveBeenCalledTimes(2)
      expect(customDeserialize).toHaveBeenCalledTimes(1)
      expect(mockedLocalStorage.getItem(key)).toEqual(JSON.stringify(value))
    })

    it('should not invoke custom deserializer method when cache value of undefined returned', async () => {
      const customSerialize = jest.fn(JSON.stringify)
      const customDeserialize = jest.fn(JSON.parse)
      const swr = createStaleWhileRevalidateCache({
        ...validConfig,
        storage: {
          ...validConfig.storage,
          getItem() {
            return undefined
          },
        },
        serialize: customSerialize,
        deserialize: customDeserialize,
      })
      const key = 'key'
      const value = { value: 'value' }
      const fn = jest.fn(() => value)
      const result = await swr(key, fn)

      expect(result).toMatchObject({
        value: JSON.parse(JSON.stringify(value)),
        status: 'miss',
        minTimeToStale: 0,
        maxTimeToLive: Infinity,
        now: expect.any(Number),
        cachedAt: expect.any(Number),
        expireAt: Infinity,
        staleAt: expect.any(Number),
      })
      expect(fn).toHaveBeenCalledTimes(1)
      expect(customSerialize).toHaveBeenCalledTimes(1)
      expect(customDeserialize).toHaveBeenCalledTimes(0)
      expect(mockedLocalStorage.getItem(key)).toEqual(JSON.stringify(value))
    })


    it('should not revalidate if the value is cached and still fresh', async () => {
      // Set minTimeToStale to 1 second so that the cache is fresh for second invocation
      const swr = createStaleWhileRevalidateCache({
        ...validConfig,
        minTimeToStale: 1000,
      })
      const key = 'fresh-example'
      const value1 = 'value 1'
      const value2 = 'value 2'
      const fn1 = jest.fn(() => value1)
      const fn2 = jest.fn(() => value2)
      const result1 = await swr(key, fn1)
      const result2 = await swr(key, fn2)

      expect(result1).toMatchObject({
        value: value1,
        status: 'miss',
        minTimeToStale: 1000,
        maxTimeToLive: Infinity,
        now: expect.any(Number),
        cachedAt: expect.any(Number),
        expireAt: Infinity,
        staleAt: expect.any(Number),
      })
      expect(result2).toMatchObject({
        value: value1,
        status: 'fresh',
        minTimeToStale: 1000,
        maxTimeToLive: Infinity,
        now: expect.any(Number),
        cachedAt: expect.any(Number),
        expireAt: Infinity,
        staleAt: expect.any(Number),
      })
      expect(fn1).toHaveBeenCalledTimes(1)
      expect(fn2).not.toHaveBeenCalled()
    })

    it('should return value from cache while revalidating the value in the background if cache is stale but not dead', async () => {
      // Explicitly set minTimeToStale to 0 and maxTimeToLive to Infinity so that the cache is always stale, but not dead for second invocation
      const swr = createStaleWhileRevalidateCache({
        ...validConfig,
        minTimeToStale: 0,
        maxTimeToLive: Infinity,
      })
      const key = 'stale-example'
      const value1 = 'value 1'
      const value2 = 'value 2'
      const fn1 = jest.fn(() => value1)
      const fn2 = jest.fn(() => value2)
      const result1 = await swr(key, fn1)
      const result2 = await swr(key, fn2)

      expect(result1).toMatchObject({
        value: value1,
        status: 'miss',
        minTimeToStale: 0,
        maxTimeToLive: Infinity,
        now: expect.any(Number),
        cachedAt: expect.any(Number),
        expireAt: Infinity,
        staleAt: expect.any(Number),
      })
      expect(result2).toMatchObject({
        value: value1, // Still return value1 since it is from the cache
        status: 'stale',
        minTimeToStale: 0,
        maxTimeToLive: Infinity,
        now: expect.any(Number),
        cachedAt: expect.any(Number),
        expireAt: Infinity,
        staleAt: expect.any(Number),
      })
      expect(fn1).toHaveBeenCalledTimes(1)
      expect(fn2).toHaveBeenCalledTimes(1) // But invoke the function to revalidate the value in the background
    })

    it('should not return a value from cache if it has expired', async () => {
      const swr = createStaleWhileRevalidateCache({
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
      const result1 = await swr(key, fn1)

      Date.now = originalDateNow // Reset Date.now to original value so that cache for this key is expired
      const result2 = await swr(key, fn2)

      expect(result1).toMatchObject({
        value: value1,
        status: 'miss',
        minTimeToStale: 1000,
        maxTimeToLive: 2000,
        now: expect.any(Number),
        cachedAt: expect.any(Number),
        expireAt: expect.any(Number),
        staleAt: expect.any(Number),
      })
      expect(result2).toMatchObject({
        value: value2,
        status: 'expired',
        minTimeToStale: 1000,
        maxTimeToLive: 2000,
        now: expect.any(Number),
        cachedAt: expect.any(Number),
        expireAt: expect.any(Number),
        staleAt: expect.any(Number),
      })
      expect(fn1).toHaveBeenCalledTimes(1)
      expect(fn2).toHaveBeenCalledTimes(1)
    })

    it('should deduplicate any concurrent requests with the same key', async () => {
      // Explicitly set minTimeToStale to 1_000 and maxTimeToLive to Infinity so that the cache is not stale, but also not dead for second invocation
      const swr = createStaleWhileRevalidateCache({
        ...validConfig,
        minTimeToStale: 1_000,
        maxTimeToLive: Infinity,
      })
      const key = 'duplicate-example'
      const value1 = 'value 1'
      const value2 = 'value 2'
      const fn1 = jest.fn(() => value1)
      const fn2 = jest.fn(() => value2)

      const promise1 = swr(key, fn1)
      const promise2 = swr(key, fn2)
      const [result1, result2] = await Promise.all([promise1, promise2])

      expect(result1).toMatchObject({
        value: value1,
        status: 'miss',
        minTimeToStale: 1_000,
        maxTimeToLive: Infinity,
        now: expect.any(Number),
        cachedAt: expect.any(Number),
        expireAt: Infinity,
        staleAt: expect.any(Number),
      })
      expect(result2).toMatchObject({
        value: value1, // Still return value1 since it is from the cache
        status: 'fresh',
        minTimeToStale: 1_000,
        maxTimeToLive: Infinity,
        now: expect.any(Number),
        cachedAt: expect.any(Number),
        expireAt: Infinity,
        staleAt: expect.any(Number),
      })
      expect(fn1).toHaveBeenCalledTimes(1)
      expect(fn2).not.toHaveBeenCalled()
    })
  })

  describe('EmitterEvents', () => {
    it(`should emit an '${EmitterEvents.revalidateFailed}' event if the cache is stale but not dead and the revalidation request fails`, () => {
      return new Promise<void>(async (resolve) => {
        // Explicitly set minTimeToStale to 0 and maxTimeToLive to Infinity so that the cache is always stale, but not dead for second invocation
        const swr = createStaleWhileRevalidateCache({
          ...validConfig,
          minTimeToStale: 0,
          maxTimeToLive: Infinity,
        })
        const key = 'stale-example'
        const value1 = 'value 1'
        const error = new Error('beep boop')
        const fn1 = jest.fn(() => value1)
        const fn2 = jest.fn(() => {
          throw error
        })

        const result1 = await swr(key, fn1)

        expect(result1).toMatchObject({
          value: value1,
          status: 'miss',
          minTimeToStale: 0,
          maxTimeToLive: Infinity,
          now: expect.any(Number),
          cachedAt: expect.any(Number),
          expireAt: Infinity,
          staleAt: expect.any(Number),
        })

        swr.once(EmitterEvents.revalidateFailed).then((payload) => {
          expect(payload).toEqual({
            cacheKey: key,
            fn: fn2,
            error,
          })
          resolve()
        })

        const result2 = await swr(key, fn2)

        expect(result2).toMatchObject({
          value: value1, // Still return value1 since it is from the cache
          status: 'stale',
          minTimeToStale: 0,
          maxTimeToLive: Infinity,
          now: expect.any(Number),
          cachedAt: expect.any(Number),
          expireAt: Infinity,
          staleAt: expect.any(Number),
        })
        expect(fn1).toHaveBeenCalledTimes(1)
        expect(fn2).toHaveBeenCalledTimes(1) // But invoke the function to revalidate the value in the background
      })
    })

    it(`should emit an '${EmitterEvents.invoke}' event when called`, (done) => {
      const swr = createStaleWhileRevalidateCache(validConfig)
      const key = 'key'
      const value = 'value'
      const fn = jest.fn(() => value)

      swr.once(EmitterEvents.invoke).then((payload) => {
        expect(payload).toEqual({
          cacheKey: key,
          fn,
        })
        done()
      })

      swr(key, fn)
    })

    it(`should emit a '${EmitterEvents.cacheHit}' event when the value is found in the cache`, (done) => {
      const swr = createStaleWhileRevalidateCache({
        ...validConfig,
        minTimeToStale: 10000,
      })
      const key = () => 'key'
      const value = 'value'
      const fn = jest.fn(() => value)

      // Manually set the value in the cache
      swr.persist(key, value).then(() => {
        swr.once(EmitterEvents.cacheHit).then((payload) => {
          expect(payload).toEqual({
            cacheKey: key,
            cachedValue: value,
          })
          done()
        })

        swr(key, fn)
      })
    })

    it(`should emit a '${EmitterEvents.cacheMiss}' event when the value is not found in the cache`, (done) => {
      const swr = createStaleWhileRevalidateCache(validConfig)
      const key = () => 'key'
      const value = 'value'
      const fn = jest.fn(() => value)

      swr.once(EmitterEvents.cacheMiss).then((payload) => {
        expect(payload).toEqual({
          cacheKey: key,
          fn,
        })
        done()
      })

      swr(key, fn)
    })

    it(`should emit '${EmitterEvents.cacheHit}', '${EmitterEvents.cacheStale}' and '${EmitterEvents.revalidate}' events when the cache is stale but not expired`, async () => {
      const swr = createStaleWhileRevalidateCache({
        ...validConfig,
        minTimeToStale: 0,
        maxTimeToLive: Infinity,
      })
      const key = 'key'
      const oldValue = 'old value'
      const value = 'value'
      const fn = jest.fn(() => value)

      const now = Date.now()
      const originalDateNow = Date.now
      Date.now = jest.fn(() => now)

      // Manually set the value in the cache
      await Promise.all([
        validConfig.storage.setItem(key, oldValue),
        validConfig.storage.setItem(
          createTimeCacheKey(key),
          (now - 10000).toString()
        ),
      ])

      const events: Record<any, any> = {}

      swr.onAny((event: any, payload) => {
        events[event] = payload
      })

      await swr(key, fn)

      Date.now = originalDateNow

      expect(events).toMatchInlineSnapshot(`
        {
          "cacheHit": {
            "cacheKey": "key",
            "cachedValue": "old value",
          },
          "cacheStale": {
            "cacheKey": "key",
            "cachedAge": 10000,
            "cachedValue": "old value",
          },
          "invoke": {
            "cacheKey": "key",
            "fn": [MockFunction] {
              "calls": [
                [],
              ],
              "results": [
                {
                  "type": "return",
                  "value": "value",
                },
              ],
            },
          },
          "revalidate": {
            "cacheKey": "key",
            "fn": [MockFunction] {
              "calls": [
                [],
              ],
              "results": [
                {
                  "type": "return",
                  "value": "value",
                },
              ],
            },
          },
        }
      `)
    })

    it(`should emit '${EmitterEvents.cacheGetFailed}' event when an error is thrown when retrieving from the storage and continue as-if cache is expired`, (done) => {
      const error = new Error('storage read error')
      const swr = createStaleWhileRevalidateCache({
        ...validConfig,
        storage: {
          ...validConfig.storage,
          getItem() {
            throw error
          },
        },
        minTimeToStale: 0,
        maxTimeToLive: Infinity,
      })
      const key = () => 'storage-get-error'
      const value = 'value'
      const fn = jest.fn(() => value)

      expect.assertions(2)

      swr.once(EmitterEvents.cacheGetFailed).then((payload) => {
        expect(payload).toEqual({
          cacheKey: key,
          error,
        })
        done()
      })

      swr(key, fn).then((result) => {
        expect(result).toMatchObject({
          value,
          status: 'miss',
        })
      })
    })

    it(`should emit '${EmitterEvents.cacheSetFailed}' event when an error is thrown when persisting to the storage`, (done) => {
      const error = new Error('storage persist error')
      const swr = createStaleWhileRevalidateCache({
        ...validConfig,
        storage: {
          ...validConfig.storage,
          setItem() {
            throw error
          },
        },
        minTimeToStale: 0,
        maxTimeToLive: Infinity,
      })
      const key = () => 'storage-set-error'
      const value = 'value'
      const fn = jest.fn(() => value)

      expect.assertions(2)

      swr.once(EmitterEvents.cacheSetFailed).then((payload) => {
        expect(payload).toEqual({
          cacheKey: key,
          error,
        })
        done()
      })

      swr(key, fn).then((result) => {
        expect(result).toMatchObject({
          value,
          status: 'miss',
        })
      })
    })
  })

  describe('swr.persist()', () => {
    it('should persist given cache value for given key including the time cache key', async () => {
      const swr = createStaleWhileRevalidateCache(validConfig)

      const key = 'persist key'
      const value = 'value'

      expect(mockedLocalStorage.getItem(key)).toEqual(null)
      expect(mockedLocalStorage.getItem(createTimeCacheKey(key))).toEqual(null)

      await swr.persist(key, value)

      expect(mockedLocalStorage.getItem(key)).toEqual(value)
      expect(mockedLocalStorage.getItem(createTimeCacheKey(key))).toEqual(
        expect.any(String)
      )

      const fn = jest.fn(() => 'something else')
      const result = await swr(key, fn)

      expect(result).toMatchObject({
        value,
        status: 'stale',
        minTimeToStale: 0,
        maxTimeToLive: Infinity,
        now: expect.any(Number),
        cachedAt: expect.any(Number),
        expireAt: Infinity,
        staleAt: expect.any(Number),
      })
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })

  describe('swr.delete()', () => {
    it('should remove the cache value for given key including the time cache key', async () => {
      const swr = createStaleWhileRevalidateCache(validConfig)

      const key = 'delete key'
      const value = 'value'

      expect(mockedLocalStorage.getItem(key)).toEqual(null)
      expect(mockedLocalStorage.getItem(createTimeCacheKey(key))).toEqual(null)

      await swr.persist(key, value)

      expect(mockedLocalStorage.getItem(key)).toEqual(value)
      expect(mockedLocalStorage.getItem(createTimeCacheKey(key))).toEqual(
        expect.any(String)
      )

      await swr.delete(key)

      expect(mockedLocalStorage.getItem(key)).toEqual(null)
      expect(mockedLocalStorage.getItem(createTimeCacheKey(key))).toEqual(null)
    })
  })
})
