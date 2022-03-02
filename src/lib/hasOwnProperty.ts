export const hasOwnProperty = <X extends any, Y extends PropertyKey>(
  obj: X,
  prop: Y
): obj is X & Record<Y, unknown> => {
  if (!obj) return false
  if (typeof obj !== 'object') return false

  // TODO: Remove cast and fix typing.
  return (obj as Object).hasOwnProperty(prop)
}
