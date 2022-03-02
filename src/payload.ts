import { JsonObject, JsonValue } from '@myTypes/json'
import { StrictlyExtends } from '@myTypes/utility'

export interface ActionPayload
  extends StrictlyExtends<BasePayload, ActionPayload> {
  data: string
  type: 'action'
}

export interface BasePayload {
  data?: JsonValue
  timestamp: number
  type: PayloadType
}

export interface StatePayload<T extends JsonObject = {}>
  extends StrictlyExtends<BasePayload, StatePayload<T>> {
  data: {
    [key in keyof T]: JsonValue
  }
  type: 'state'
}

export type Payload = ActionPayload | StatePayload

export type PayloadType = typeof PAYLOAD_TYPES[number]

export const isPayload = (value: any): value is Payload => {
  if (!value) return false

  if (typeof value !== 'object') return false

  if (!('timestamp' in value)) return false
  if (typeof value.timestamp !== 'number') return false

  if (!('type' in value)) return false
  if (!PAYLOAD_TYPES.includes(value['type'])) return false

  return true
}

const PAYLOAD_TYPES = ['action', 'state'] as const
