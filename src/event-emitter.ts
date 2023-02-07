import Emittery from 'emittery'

export type EmitterMethods = typeof Emittery.prototype

export const createEmitter = (): Emittery => {
  return new Emittery()
}

export const extendWithEmitterMethods = <Target>(
  emitter: ReturnType<typeof createEmitter>,
  target: Target
): Target & EmitterMethods => {
  const extended = target as Target & EmitterMethods

  Object.getOwnPropertyNames(emitter.constructor.prototype)
    .filter((name) => name !== 'constructor')
    .forEach((name) => {
      const methodName = name as keyof EmitterMethods
      extended[methodName] = (emitter[methodName] as any).bind(emitter)
    })

  return extended
}
