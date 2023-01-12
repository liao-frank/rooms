import { PeerJSOption } from 'peerjs'
import { Dispatch, useEffect, useRef, useState } from 'react'

import Room, { Status } from '../room'

export function useRoomState<State>(
  id: string,
  initialState: State,
  peerOption?: PeerJSOption
): Exclude<RoomState<State>, 'dispatchAction'>

export function useRoomState<State, Actions extends ValidActions<State>>(
  id: string,
  initialState: State,
  actions: Actions,
  peerOption?: PeerJSOption
): RoomState<State, Actions> & {
  dispatchAction: ActionDispatcher<State, Actions>
}

export default function useRoomState<
  State,
  Actions extends ValidActions<State> = {}
>(
  id: string,
  initialState: State,
  actionsOrPeerOption?: Actions | PeerJSOption,
  peerOption?: PeerJSOption
): RoomState<State, Actions> {
  const actions = isValidActions(actionsOrPeerOption)
    ? actionsOrPeerOption
    : undefined
  peerOption =
    peerOption !== undefined
      ? peerOption
      : isValidActions(actionsOrPeerOption)
      ? undefined
      : actionsOrPeerOption

  const roomRef = useRef<Room<Message<State, Actions>> | undefined>()

  if (roomRef.current === undefined) {
    roomRef.current = new Room<Message<State, Actions>>(id)
  }

  const room = roomRef.current
  // A ref is needed to supply the initial effect with up-to-date states.
  const stateRef = useRef<State>(initialState)
  const [state, _setState] = useState<State>(initialState)
  const [status, setStatus] = useState<Status>(Status.Disconnected)
  const [isHost, setIsHost] = useState<boolean>(false)
  const [error, setError] = useState<Error | undefined>()

  function setState(nextState: State): void {
    stateRef.current = nextState
    _setState(nextState)
  }

  useEffect(() => {
    room.on('connection', (connection) => {
      if (!room.isHost) return

      function syncNewParticipant() {
        connection.send({ type: MessageType.SetState, state: stateRef.current })
      }

      if (connection.open) {
        syncNewParticipant()
      } else {
        connection.once('open', syncNewParticipant)
      }
    })

    room.on('status', (status) => {
      setStatus(status)
      setIsHost(room.isHost)

      if (status === Status.Connecting || status === Status.Connected) {
        setError(undefined)
      }
    })

    room.on('data', handleData)
    room.on('error', setError)

    room.connect()

    return () => void room.disconnect()
  }, [room])

  function dispatchAction<Action extends keyof Actions>(
    action: Action,
    ...args: NonStateParameters<Actions[Action]>
  ): void {
    const actionFn = actions?.[action]
    if (actionFn === undefined) return

    room.broadcast({
      type: MessageType.DispatchAction,
      action: action,
      args: args,
    })
  }

  function handleData(data) {
    if (!isMessage<State, Actions>(data)) return
    const message = data

    if (message.type === MessageType.SetState) {
      setState(message.state)
    } else if (message.type === MessageType.DispatchAction) {
      const { action, args } = message
      const actionFn = actions?.[action]

      if (actionFn === undefined) return

      dispatchAction(
        action,
        ...(args as NonStateParameters<Actions[typeof action]>)
      )
    }
  }

  function broadcastState(state: State) {
    room.broadcast({
      type: MessageType.SetState,
      state,
    })
  }

  return {
    isHost,
    state,
    status,
    error,
    setState: broadcastState,
    dispatchAction: actions ? dispatchAction : undefined,
  }
}

function isValidActions<State>(actions): actions is ValidActions<State> {
  for (const action in actions) {
    if (!Array.isArray(actions[action])) return false
  }

  return true
}

function isMessage<State, Actions extends ValidActions<State> = {}>(
  data: any
): data is Message<State, Actions> {
  if (typeof data !== 'object') return false
  if (!Object.values(MessageType).includes(data.type)) return false
  return true
}

interface RoomState<State, Actions extends ValidActions<State> = {}> {
  isHost: boolean
  state: State
  status: Status
  error?: Error
  setState: Dispatch<State>
  dispatchAction?: ActionDispatcher<State, Actions>
}

interface ValidActions<State> {
  [actionName: string]: (state: State, ...args: any[]) => State
}

type ActionDispatcher<State, Actions extends ValidActions<State>> = <
  DispatchedAction extends keyof Actions
>(
  action: DispatchedAction,
  ...args: {
    [Action in keyof Actions]: NonStateParameters<Actions[Action]>
  }[DispatchedAction]
) => void

type NonStateParameters<
  Dispatcher extends (state: any, ...nonStateArgs: any[]) => any
> = Dispatcher extends (state: any, ...nonStateArgs: infer NonStateArgs) => any
  ? NonStateArgs
  : never

enum MessageType {
  SetState = 'set-state',
  DispatchAction = 'dispatch-action',
}

type Message<State, Actions extends ValidActions<State> = {}> =
  | {
      type: MessageType.SetState
      state: State
    }
  | {
      type: MessageType.DispatchAction
      action: keyof Actions
      args: any[]
    }
