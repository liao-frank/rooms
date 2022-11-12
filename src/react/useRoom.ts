import { Dispatch, useEffect, useRef, useState } from 'react'

import { Status } from '../member/member'
import { Serializable } from '../types'
import { useMember } from './useMember'

export function useRoom<T extends Serializable>(
  id: string,
  initialState: T
): Exclude<Room<T>, 'dispatchAction'>

export function useRoom<T extends Serializable>(
  id: string,
  initialState: T,
  actions: Actions<T>
): Room<T> & { dispatchAction: DispatchAction }

export function useRoom<T extends Serializable>(
  id: string,
  initialState: T,
  actions?: Actions<T>
): Room<T> {
  const { member, status, error } = useMember<Message<T>>(id)
  const [state, _setState] = useState<T>(initialState)
  const setStateInternal = (nextState: T) => {
    _setState(nextState)
    stateRef.current = nextState
  }
  const stateRef = useRef<T>(initialState)

  // Create broadcasters i.e. state update requests.
  const setState = (nextState: T) => {
    member.broadcast({ type: MessageType.SetState, payload: nextState })
  }
  const dispatchAction = (actionName: string) => {
    member.broadcast({ type: MessageType.DispatchAction, payload: actionName })
  }

  // Setup broadcast listeners i.e. effective state updates.
  useEffect(() => {
    member.removeAllListeners('data')

    member.on('data', (data) => {
      if (!isMessage<T>(data)) return

      // Fully update state on set-state messages.
      if (data.type === MessageType.SetState) {
        setStateInternal(data.payload)
        return
      }

      // Dispatch actions on dispatch-action messages.
      if (data.type === MessageType.DispatchAction) {
        if (!actions) return

        const action = actions[data.payload]
        if (!action) return

        const nextState = action(state)
        setStateInternal(nextState)
        return
      }
    })
  }, [member, actions])

  // If host, setup participant sync on connection.
  useEffect(() => {
    if (!member.isHost) return

    member.once('status', (status) => {
      if (status !== Status.Connected) return

      member.broadcast({
        type: MessageType.SetState,
        payload: stateRef.current,
      })

      member.peer!.on('connection', (connection) => {
        connection.once('open', () => {
          connection.send({
            type: MessageType.SetState,
            payload: stateRef.current,
          })
        })
      })
    })
  }, [member])

  return {
    state,
    setState,
    isHost: member.isHost && status === Status.Connected,
    status,
    dispatchAction: actions ? dispatchAction : undefined,
    error,
  }
}

const isMessage = <T extends Serializable>(data: any): data is Message<T> => {
  if (typeof data !== 'object') return false
  if (!Object.values(MessageType).includes(data.type)) return false
  if (data.payload === undefined) return false
  if (data.type === 'dispatch-action' && typeof data.payload !== 'string')
    return false
  // TODO: Enforce T for set-state messages.
  return true
}

interface Room<T> {
  state: T
  setState: Dispatch<T>
  isHost: boolean
  status: Status
  dispatchAction?: DispatchAction
  error?: Error
}

enum MessageType {
  SetState = 'set-state',
  DispatchAction = 'dispatch-action',
}

type Message<T extends Serializable> =
  | {
      type: MessageType.SetState
      payload: T
    }
  | {
      type: MessageType.DispatchAction
      payload: string
    }

type Actions<T> = { [name: string]: (state: T) => T }

type DispatchAction = (actionName: string) => void
