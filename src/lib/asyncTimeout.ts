export function setTimeoutAsync(timeoutMs: number): TimeoutIdAndPromise
export function setTimeoutAsync(
  cb: () => void,
  timeoutMs: number
): TimeoutIdAndPromise
export function setTimeoutAsync(
  cbOrTimeoutMs: (() => void) | number,
  maybeTimeoutMs?: number
): TimeoutIdAndPromise {
  const cb = typeof cbOrTimeoutMs === 'function' ? cbOrTimeoutMs : () => {}
  const timeoutMs =
    typeof cbOrTimeoutMs === 'number' ? cbOrTimeoutMs : maybeTimeoutMs!

  let timeoutId: NodeJS.Timeout
  const promise = new Promise<void>((resolve) => {
    timeoutId = setTimeout(() => {
      try {
        cb()
      } finally {
        resolve()
      }
    }, timeoutMs)
  })

  return { promise, timeoutId: timeoutId! }
}

interface TimeoutIdAndPromise {
  promise: Promise<void>
  timeoutId: NodeJS.Timeout
}
