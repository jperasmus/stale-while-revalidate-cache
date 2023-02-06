# Stale While Revalidate Cache

This small battle-tested TypeScript library is a storage-agnostic helper that implements a configurable stale-while-revalidate caching strategy for any functions, for any JavaScript environment.

## Installation

The library can be installed from [NPM](https://www.npmjs.com/package/stale-while-revalidate-cache) using your favorite package manager.

To install via `npm`:

```sh
npm install stale-while-revalidate-cache
```

## Usage

At the most basic level, you can import the exported `createStaleWhileRevalidateCache` function that takes some config and gives you back the cache helper.

This cache helper (called `swr` in example below) is an asynchronous function that you can invoke whenever you want to run your cached function. This cache helper takes two arguments, a key to identify the resource in the cache, and the function that should be invoked to retrieve the data that you want to cache. This function would typically fetch content from an external API, but it could be anything like some resource intensive computation that you don't want the user to wait for and a cache value would be acceptable.

The cache helper (`swr`) is also a fully functional event emitter, but more about that later.

```typescript
import { createStaleWhileRevalidateCache } from 'stale-while-revalidate-cache'

const swr = createStaleWhileRevalidateCache({
  storage: window.localStorage,
})

const cacheKey = 'a-cache-key'

const result = await swr(cacheKey, async () => 'some-return-value')
// result: 'some-return-value'

const result2 = await swr(cacheKey, async () => 'some-other-return-value')
// result2: 'some-return-value' <- returned from cache while revalidating to new value for next invocation

const result3 = await swr(cacheKey, async () => 'yet-another-return-value')
// result3: 'some-other-return-value' <- previous value (assuming it was already revalidated and cached by now)
```

### Configuration

The `createStaleWhileRevalidateCache` function takes a single config object, that you can use to configure how your stale-while-revalidate cache should behave. The only mandatory property is the `storage` property, which tells the library where the content should be persisted and retrieved from.

You can also override any of the following configuration values when you call the actual `swr()` helper function by passing a partial config object as a third argument. For example:

```typescript
const cacheKey = 'some-cache-key'
const yourFunction = async () => ({ something: 'useful' })
const configOverrides = {
  maxTimeToLive: 30000,
  minTimeToStale: 3000,
}

const result = await swr(cacheKey, yourFunction, configOverrides)
```

#### storage

The `storage` property can be any object that have `getItem(cacheKey: string)` and `setItem(cacheKey: string, value: any)` methods on it. Because of this, in the browser, you could simply use `window.localStorage` as your `storage` object, but there are many other storage options that satisfies this requirement. Or you can build your own.

For instance, if you want to use Redis on the server:

```javascript
const Redis = require('ioredis')
const {
  createStaleWhileRevalidateCache,
} = require('stale-while-revalidate-cache')

const redis = new Redis()

const storage = {
  async getItem(cacheKey: string) {
    return redis.get(cacheKey)
  },
  async setItem(cacheKey: string, cacheValue: any) {
    // Use px or ex depending on whether you use milliseconds or seconds for your ttl
    // It is recommended to set ttl to your maxTimeToLive (it has to be more than it)
    await redis.set(cacheKey, cacheValue, 'px', ttl)
  },
}

const swr = createStaleWhileRevalidateCache({
  storage,
})
```

#### minTimeToStale

Default: `0`

Milliseconds until a cached value should be considered stale. If a cached value is fresher than the number of milliseconds, it is considered fresh and the task function is not invoked.

#### maxTimeToLive

Default: `Infinity`

Milliseconds until a cached value should be considered expired. If a cached value is expired, it will be discarded and the task function will always be invoked and waited for before returning, ie. no background revalidation.

#### serialize

If your storage mechanism can't directly persist the value returned from your task function, supply a `serialize` method that will be invoked with the result from the task function and this will be persisted to your storage.

A good example is if your task function returns an object, but you are using a storage mechanism like `window.localStorage` that is string-based. For that, you can set `serialize` to `JSON.stringify` and the object will be stringified before it is persisted.

#### deserialize

This property can optionally be provided if you want to deserialize a previously cached value before it is returned.

To continue with the object value in `window.localStorage` example, you can set `deserialize` to `JSON.parse` and the serialized object will be parsed as a plain JavaScript object.

### Static Methods

#### Manually persist to cache

There is a convenience static method made available if you need to manually write to the underlying storage. This method is better than directly writing to the storage because it will ensure the necessary entries are made for timestamp invalidation.

```typescript
const cacheKey = 'your-cache-key'
const cacheValue = { something: 'useful' }

const result = await swr.persist(cacheKey, cacheValue)
```

The value will be passed through the `serialize` method you optionally provided when you instantiated the `swr` helper.

### Event Emitter

The cache helper method returned from the `createStaleWhileRevalidateCache` function is a fully functional event emitter that is an instance of the excellent [Emittery](https://www.npmjs.com/package/emittery) package. Please look at the linked package's documentation to see all the available methods.

The following events will be emitted when appropriate during the lifetime of the cache (all events will always include the `cacheKey` in its payload along with other event-specific properties):

#### invoke

Emitted when the cache helper is invoked with the cache key and function as payload.

#### cacheHit

Emitted when a fresh or stale value is found in the cache. It will not emit for expired cache values. When this event is emitted, this is the value that the helper will return, regardless of whether it will be revalidated or not.

#### cacheExpired

Emitted when a value was found in the cache, but it has expired. The payload will include the old `cachedValue` for your own reference. This cached value will not be used, but the task function will be invoked and waited for to provide the response.

#### cacheStale

Emitted when a value was found in the cache, but it is older than the allowed `minTimeToStale` and it has NOT expired. The payload will include the stale `cachedValue` and `cachedAge` for your own reference.

#### cacheMiss

Emitted when no value is found in the cache for the given key OR the cache has expired. This event can be used to capture the total number of cache misses. When this happens, the returned value is what is returned from your given task function.

#### cacheGetFailed

Emitted when an error occurs while trying to retrieve a value from the given `storage`, ie. if `storage.getItem()` throws.

#### cacheSetFailed

Emitted when an error occurs while trying to persist a value to the given `storage`, ie. if `storage.setItem()` throws. Cache persistence happens asynchronously, so you can't expect this error to bubble up to the main revalidate function. If you want to be aware of this error, you have to subscribe to this event.

#### revalidate

Emitted whenever the task function is invoked. It will always be invoked except when the cache is considered fresh, NOT stale or expired.

#### revalidateFailed

Emitted whenever the revalidate function failed, whether that is synchronously when the cache is bypassed or asynchronously.

### Example

A slightly more practical example.

```typescript
import {
  createStaleWhileRevalidateCache,
  EmitterEvents,
} from 'stale-while-revalidate-cache'
import { metrics } from './utils/some-metrics-util.ts'

const swr = createStaleWhileRevalidateCache({
  storage: window.localStorage, // can be any object with getItem and setItem methods
  minTimeToStale: 5000, // 5 seconds
  maxTimeToLive: 600000, // 10 minutes
  serialize: JSON.stringify, // serialize product object to string
  deserialize: JSON.parse, // deserialize cached product string to object
})

swr.onAny((event, payload) => {
  switch (event) {
    case EmitterEvents.invoke:
      metrics.countInvocations(payload.cacheKey)
      break

    case EmitterEvents.cacheHit:
      metrics.countCacheHit(payload.cacheKey, payload.cachedValue)
      break

    case EmitterEvents.cacheMiss:
      metrics.countCacheMisses(payload.cacheKey)
      break

    case EmitterEvents.cacheExpired:
      metrics.countCacheExpirations(payload)
      break

    case EmitterEvents.cacheGetFailed:
    case EmitterEvents.cacheSetFailed:
      metrics.countCacheErrors(payload)
      break

    case EmitterEvents.revalidateFailed:
      metrics.countRevalidationFailures(payload)
      break

    case EmitterEvents.revalidate:
    default:
      break
  }
})

interface Product {
  id: string
  name: string
  description: string
  price: number
}

async function fetchProductDetails(productId: string): Promise<Product> {
  const response = await fetch(`/api/products/${productId}`)
  const product = (await response.json()) as Product
  return product
}

const productId = 'product-123456'

const product = await swr<Product>(productId, async () =>
  fetchProductDetails(productId)
)

// The returned `product` will be typed as `Product`
```

## License

MIT License
