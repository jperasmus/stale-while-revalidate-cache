import {
  isFunction,
  isPlainObject, parseConfig, passThrough
} from './helpers'
import { mockedLocalStorage } from './test-helpers'

describe('isFunction', () => {
  it('should return true if the given value is a function', () => {
    expect(isFunction(() => {})).toBe(true)
    expect(isFunction(function() {})).toBe(true)
    expect(isFunction(async function() {})).toBe(true)
    // eslint-disable-next-line no-new-func
    expect(isFunction(new Function())).toBe(true)
  })

  it('should return false if the given value is not a function', () => {
    expect(isFunction(null)).toBe(false)
    expect(isFunction(undefined)).toBe(false)
    expect(isFunction(0)).toBe(false)
    expect(isFunction('')).toBe(false)
    expect(isFunction({})).toBe(false)
    expect(isFunction([])).toBe(false)
    expect(isFunction(Symbol())).toBe(false)
  })
})

describe('isPlainObject', () => {
  it('should return true if the given value is a plain object', () => {
    expect(isPlainObject({})).toBe(true)
    // eslint-disable-next-line no-new-object
    expect(isPlainObject(new Object())).toBe(true)
  })

  it('should return false if the given value is not a plain object', () => {
    expect(isPlainObject(null)).toBe(false)
    expect(isPlainObject(undefined)).toBe(false)
    expect(isPlainObject(0)).toBe(false)
    expect(isPlainObject('')).toBe(false)
    expect(isPlainObject(Symbol())).toBe(false)
    expect(isPlainObject([])).toBe(false)
    expect(isPlainObject(() => {})).toBe(false)
    expect(isPlainObject(async function() {})).toBe(false)
    // eslint-disable-next-line no-new-func
    expect(isPlainObject(new Function())).toBe(false)
  })
})

describe('passThrough', () => {
  it('should return the given value', () => {
    const noop = () => {}

    expect(passThrough(null)).toBe(null)
    expect(passThrough(undefined)).toBe(undefined)
    expect(passThrough(0)).toBe(0)
    expect(passThrough('')).toBe('')
    expect(passThrough({})).toEqual({})
    expect(passThrough([])).toEqual([])
    expect(passThrough(noop)).toEqual(noop)
  })
})

describe('parseConfig', () => {
  it('should throw an error if the given value is not a plain object', () => {
    const invalidConfigs = [
      null,
      undefined,
      0,
      '',
      Symbol(),
      [],
      async function() {},
      // eslint-disable-next-line no-new-func
      new Function(),
    ]

    invalidConfigs.forEach(invalidConfig => {
      // @ts-expect-error
      expect(() => parseConfig(invalidConfig)).toThrowError()
    })
  })

  it('should throw an error if a valid storage object is not provided', () => {
    const invalidConfigs = [
      {},
      { storage: null },
      { storage: undefined },
      { storage: 0 },
      { storage: '' },
      { storage: Symbol() },
      { storage: [] },
      { storage: async function() {} },
      // eslint-disable-next-line no-new-func
      { storage: new Function() },
      { storage: { getItem: null, setItem: null } },
    ]

    invalidConfigs.forEach(invalidConfig => {
      // @ts-expect-error
      expect(() => parseConfig(invalidConfig)).toThrowError()
    })
  })

  it('should throw an error if the minTimeToStale is greater or equal to maxTimeToLive', () => {
    const invalidConfigs = [
      { storage: mockedLocalStorage, minTimeToStale: 10, maxTimeToLive: 5 },
      { storage: mockedLocalStorage, minTimeToStale: 10, maxTimeToLive: 10 },
    ]

    invalidConfigs.forEach(invalidConfig => {
      expect(() => parseConfig(invalidConfig)).toThrowError()
    })
  })

  it('should set sensible defaults', () => {
    const config = parseConfig({ storage: mockedLocalStorage })
    expect(config.storage).toBe(mockedLocalStorage)
    expect(config.minTimeToStale).toBe(0)
    expect(config.maxTimeToLive).toBe(Infinity)
    expect(config.serialize).toBe(passThrough)
    expect(config.deserialize).toBe(passThrough)
  })

  it('should allow custom serialize and deserialize methods', () => {
    const customSerialize = jest.fn(() => 'serialized')
    const customDeserialize = jest.fn(() => 'deserialized')
    const config = parseConfig({
      storage: mockedLocalStorage,
      serialize: customSerialize,
      deserialize: customDeserialize,
    })
    expect(config.serialize).toBe(customSerialize)
    expect(config.deserialize).toBe(customDeserialize)
  })
})
