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
