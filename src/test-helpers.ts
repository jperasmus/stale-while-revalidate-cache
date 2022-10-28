export const mockedLocalStorage = (function () {
  let store: Record<string, any> = {}

  return {
    getItem: function (key: string) {
      return store[key] || null
    },
    setItem: function (key: string, value: any) {
      store[key] = value.toString()
    },
    removeItem: function (key: string) {
      delete store[key]
    },
    clear: function () {
      store = {}
    },
  }
})()

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms))
