import type { ResponseEnvelope } from '../types'

export const mockedLocalStorage = (function () {
  let store: Record<string, any> = {}

  return {
    getItem: function (key: string) {
      return store[key] || null
    },
    setItem: function (key: string, value: any) {
      store[key] = value.toString()
    },
    clear: function () {
      store = {}
    },
  }
})()

export const valueFromEnvelope = <Value>(
  envelope: ResponseEnvelope<Value>
): Value => envelope.value
