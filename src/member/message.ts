import { Serializable } from '../types'

export enum MessageType {
  Broadcast = 'broadcast',
  BroadcastRequest = 'broadcast-request',
}

export interface Message<T extends Serializable> {
  id: number
  type: MessageType
  payload: T
}

export const isMessage = <T extends Serializable>(
  unown: unknown
): unown is Message<T> => {
  // TODO: Improve type check.
  return typeof unown === 'object'
}
