import type { ResponseEnvelope, Storage } from '../types'

export const mockedLocalStorage: Storage = (function () {
  const store = new Map<string, any>()

  return {
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key) : null
    },
    removeItem(key: string) {
      return store.delete(key)
    },
    setItem(key: string, value: any) {
      store.set(key, value.toString())
    },
  }
})()

export const valueFromEnvelope = <Value>(
  envelope: ResponseEnvelope<Value>
): Value => envelope.value
