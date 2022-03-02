import Peer, { DataConnection } from 'peerjs'
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid'

import { createPeer } from '@lib/createPeer'
import { getResolver } from '@lib/getResolver'
import { hasOwnProperty } from '@lib/hasOwnProperty'
import { wait } from '@lib/wait'
import { JsonObject, JsonValue } from '@myTypesjson'

import { Payload, StatePayload, isPayload } from './payload'

export class Room<T extends JsonObject> {
  readonly id: string
  peer?: Peer
  state: T
  status: RoomStatus = 'disconnected'

  private readonly callbacks: {
    [event in RoomEvent]?: Set<RoomEventCallback<T, event>>
  } = {}
  private readonly connections: Set<DataConnection> = new Set()
  private connectPromise?: Promise<Peer>
  private disconnectPromise?: Promise<void>
  private peerOptions?: Peer.PeerJSOption
  private roomOptions: RoomOptions

  constructor(id: string, initialState: T, options?: RoomOptions) {
    this.id = id
    this.roomOptions = { ...ROOM_DEFAULT_OPTIONS, ...options }
    this.state = initialState

    this.handlePayload = this.handlePayload.bind(this)
    this.setupConnection = this.setupConnection.bind(this)
  }

  async connect(options?: Peer.PeerJSOption): Promise<Peer> {
    if (this.status === 'connected' && this.peer) return this.peer
    if (this.connectPromise) return this.connectPromise

    const { promise, rejecter, resolver } = getResolver<Peer>()
    this.peerOptions = options
    this.connectPromise = promise

    if (this.status === 'disconnecting' && this.disconnectPromise)
      await this.disconnectPromise

    this.setStatus('connecting')
    try {
      const peer = await this.internalConnectWithRetries()
      this.peer = peer
      this.connectPromise = undefined
      this.setStatus('connected')

      this.peer.on('error', (error) => {
        if (PEER_RECONNECT_ERRORS.includes(error.type)) return
        this.disconnect()
      })

      resolver(peer)
    } catch (err) {
      this.setStatus('disconnected')
      rejecter(err)
    }

    return promise
  }

  async disconnect(): Promise<void> {
    if (this.status === 'disconnected' && !this.peer) return
    if (this.disconnectPromise) return this.disconnectPromise

    const { promise, resolver } = getResolver<void>()
    this.disconnectPromise = promise

    if (this.status === 'connecting' && this.connectPromise) {
      try {
        await this.connectPromise
      } catch {}
    }

    this.setStatus('disconnecting')
    this.connections.clear()

    const complete = () => {
      this.peer = undefined
      this.setStatus('disconnected')
      this.disconnectPromise = undefined
      resolver()
    }

    if (this.peer) {
      if (this.peer.destroyed) {
        complete()
      } else {
        this.peer.on('close', complete)
      }
      this.peer.destroy()
    } else {
      complete()
    }

    return promise
  }

  on<U extends RoomEvent>(
    event: U,
    callback: RoomEventCallback<T, U>
  ): () => void {
    const set = this.callbacks[event] || new Set<RoomEventCallback<T, U>>()
    // @ts-ignore
    this.callbacks[event] = set.add(callback)

    return () => this.off(event, callback)
  }

  off<U extends RoomEvent>(event: U, callback: RoomEventCallback<T, U>) {
    const set = this.callbacks[event]
    if (!set) return
    // @ts-ignore
    set.delete(callback)
  }

  get isHost(): boolean {
    return this.hostPeerId === this.peer?.id
  }

  private async internalConnectWithRetries(retries = 0): Promise<Peer> {
    try {
      return await this.create()
    } catch (err) {
      if (!hasOwnProperty(err, 'type')) throw err
      if (err.type !== 'unavailable-id') throw err
    }

    try {
      return await this.join()
    } catch (err) {
      if (!hasOwnProperty(err, 'type')) throw err
      if (err.type !== 'peer-unavailable') throw err
    }

    if (retries > ROOM_RETRY_LIMIT) {
      const err = new Error(
        'Neither room id nor room peer were ever available.'
      )
      // NOTE: Additional type helps conform to the shape of PeerJS errors.
      ;(err as any).type = 'unavailable'
      throw err
    }

    await wait(ROOM_RETRY_INTERVAL_MS)
    return this.internalConnectWithRetries(++retries)
  }

  private async create() {
    const peer = await createPeer(this.hostPeerId, this.peerOptions)

    peer.on('connection', this.setupConnection)

    peer.on('disconnect', () => {
      peer.reconnect()
    })

    peer.on('error', (error) => {
      if (!PEER_RECONNECT_ERRORS.includes(error.type)) return
      peer.reconnect()
    })

    return peer
  }

  private async join(): Promise<Peer> {
    const peer = await createPeer(uuidv4(), this.peerOptions)

    const { promise, resolver, rejecter } = getResolver<Peer>()

    const connection = peer.connect(this.hostPeerId, {
      serialization: 'json',
    })

    connection.on('open', () => {
      connection.off('error', rejecter)
      peer.off('error', rejecter)

      this.setupConnection(connection)
      resolver(peer)
    })

    connection.on('error', rejecter)
    peer.on('error', rejecter)

    return promise
  }

  private emit<U extends RoomEvent>(
    event: U,
    ...input: Parameters<RoomEventCallback<T, U>>
  ) {
    const listeners = this.callbacks[event]
    listeners?.forEach((listener) => {
      // @ts-ignore
      listener(...input)
    })
  }

  private setStatus(status: RoomStatus) {
    this.status = status
    this.emit('status', status)
  }

  private setupConnection(connection: DataConnection) {
    connection.on('data', this.handlePayload)

    // Host should catch-up non-hosts.
    if (this.isHost) {
      const catchUpPayload: StatePayload = {
        data: this.state,
        timestamp: Date.now(),
        type: 'state',
      }

      connection.send(catchUpPayload)
    }
    // Non-host should prepare to host if needed.
    else {
      if (connection.peer !== this.hostPeerId) {
        throw new Error('Unexpected connection from peer: ' + connection.peer)
      }

      connection.on('close', () => {
        this.disconnect()
        this.connect()
      })
      connection.on('error', () => {
        if (connection.open) return
        this.disconnect()
        this.connect()
      })
    }

    this.connections.add(connection)
  }

  private handlePayload(payload: JsonValue) {
    if (!isPayload(payload)) {
      const message =
        'Received non-payload data:\n' + JSON.stringify(payload, undefined, 2)
      throw new Error(message)
    }

    switch (payload.type) {
      case 'action':
        if (this.isHost) {
        } else {
        }
        break
      case 'state':
        if (this.isHost) {
        } else {
        }
        break
      default:
        throw new Error('Received unsupported payload type: ' + payload.type)
    }
  }

  private sendPayload(payload: Payload) {
    this.connections.forEach((connection) => {
      if (!connection.open) return
      if (!this.isHost && connection.peer !== this.hostPeerId) return
      connection.send(payload)
    })
  }

  private get hostPeerId() {
    return uuidv5(this.id, PEER_ID_NAMESPACE)
  }
}

export type RoomEvent = typeof ROOM_EVENTS[number]

export type RoomEventCallback<T, U extends RoomEvent> = U extends 'state'
  ? (state: T) => void
  : U extends 'status'
  ? (status: RoomStatus) => void
  : () => void

export type RoomOptions = {}

export type RoomStatus =
  | 'connected'
  | 'connecting'
  | 'disconnecting'
  | 'disconnected'

const PEER_ID_NAMESPACE = 'e81433fd-898d-4843-a59c-8d06af75fd27'

const PEER_RECONNECT_ERRORS = ['disconnected', 'network']

const ROOM_DEFAULT_OPTIONS: RoomOptions = {}

const ROOM_EVENTS = ['state', 'status'] as const

const ROOM_RETRY_INTERVAL_MS = 1000

const ROOM_RETRY_LIMIT = 60
