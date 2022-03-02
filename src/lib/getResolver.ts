export const getResolver = <T = any, U = any>(): {
  promise: Promise<T>
  rejecter: (err: U) => void
  resolver: (value: T | PromiseLike<T>) => void
} => {
  let rejecter: (err: any) => void | undefined
  let resolver: ((value: T | PromiseLike<T>) => void) | undefined

  const promise = new Promise<T>((resolve, reject) => {
    rejecter = reject
    resolver = resolve
  })

  return { promise, rejecter: rejecter!, resolver: resolver! }
}
