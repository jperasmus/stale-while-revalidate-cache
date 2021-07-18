# Stale While Revalidate Cache

This small TypeScript library is a storage-agnostic helper that implements a configurable stale-while-revalidate caching strategy for any functions, for any JavaScript environment.

## Installation

```sh
npm install stale-while-revalidate-cache
```

## Usage

Abstract example.

```typescript
import { createStaleWhileRevalidateCache } from 'stale-while-revalidate-cache'

const swr = createStaleWhileRevalidateCache({
  storage: window.localStorage
})

const result = await swr('a-cache-key', async () => 'some-return-value')
// result: 'some-return-value'

const result2 = await swr('a-cache-key', async () => 'some-other-return-value')
// result2: 'some-return-value' <- returned from cache while revalidating to new value for next invocation

const result3 = await swr('a-cache-key', async () => 'yet-another-return-value')
// result3: 'some-other-return-value' <- previous value (assuming it was already revalidated and cached by now)
```

A slightly more practical example.

```typescript
import { createStaleWhileRevalidateCache } from 'stale-while-revalidate-cache'

const swr = createStaleWhileRevalidateCache({
  storage: window.localStorage, // can be any object with getItem and setItem methods
  minTimeToStale: 5000, // 5 seconds
  maxTimeToLive: 600000, // 10 minutes
  serialize: JSON.stringify, // serialize product object to string
  deserialize: JSON.parse, // deserialize cached product string to object
})

interface Product {
  id: string
  name: string
  description: string
  price: number
}

async function fetchProductDetails(productId: string): Promise<Product> {
  const response = await fetch(`/api/products/${productId}`)
  const product = await response.json() as Product
  return product
}

const product = await swr<Product>('product-123', async () => fetchProductDetails('product-123'))

```

## License

MIT License
