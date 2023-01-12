import EventEmitter from 'eventemitter3'
import Peer, { DataConnection, PeerConnectOption, PeerJSOption } from 'peerjs'
import { v4 as uuidv4 } from 'uuid'

export default class Room<T> extends EventEmitter<RoomEvents<T>> {
  readonly id: string
  private readonly connections = new Map</*peerId*/ string, DataConnection>()
  private peer?: Peer

  constructor(id: string) {
    super()
    this.id = id
  }

  async connect(
    peerOption?: PeerJSOption,
    connectOption?: PeerConnectOption
  ): Promise<Peer> {
    if (this.peer) return this.peer
    this.emit('status', Status.Connecting)

    try {
      this.peer = await createRoomPeer(this.id, peerOption, connectOption)
    } catch (error) {
      if (typeof error === 'string') error = new Error(error)
      this.emit('error', error as Error)
      throw error
    }

    const peer = this.peer!
    const isHost = peer.id === this.id

    if (isHost) {
      peer.on('connection', (connection) => {
        this.connections.set(connection.peer, connection)

        connection.on('data', (data) => void this.broadcast(data as T))

        this.emit('connection', connection)
      })
      peer.on('disconnected', () => void this.reconnect())
    } else {
      const hostConnection = peer.connections[this.id][0]! as DataConnection
      this.connections.set(this.id, hostConnection)

      hostConnection.on('data', (data) => void this.emit('data', data as T))
      hostConnection.on('close', () => void this.reconnect())

      this.emit('connection', hostConnection)
    }

    this.peer = peer
    this.emit('status', Status.Connected)
    return peer
  }

  broadcast(data: T) {
    if (this.isHost) {
      this.emit('data', data)
    }

    // If the client is currently a participant, there should only be one
    // connection.
    for (const connection of this.connections.values()) {
      connection.send(data)
    }
  }

  disconnect() {
    this.reset()
    this.emit('status', Status.Disconnected)
  }

  reconnect() {
    this.reset()
    this.connect()
  }

  private reset() {
    this.peer?.destroy()
    this.peer = undefined
    this.connections.clear()
  }

  get isConnected(): boolean {
    return !!this.peer
  }

  get isHost(): boolean {
    return this.peer?.id === this.id
  }
}

export enum Status {
  Connected = 'connected',
  Connecting = 'connecting',
  Disconnected = 'disconnected',
}

interface RoomEvents<T> {
  connection: [DataConnection]
  data: [T]
  error: [Error]
  status: [Status]
}

async function createRoomPeer(
  id: string,
  peerOption?: PeerJSOption,
  connectOption?: PeerConnectOption
): Promise<Peer> {
  let currentAttempts = 0

  while (currentAttempts < CREATE_ROOM_PEER_ATTEMPT_LIMIT) {
    // Connect as host.
    try {
      return await createHostPeer(id, peerOption)
    } catch (error) {
      const type = (error as any).type
      if (FATAL_PEER_ERRORS.has(type)) throw error
    }

    // Connect as participant.
    try {
      return await createParticipantPeer(id, peerOption, connectOption)
    } catch (error) {
      const type = (error as any).type
      if (FATAL_PEER_ERRORS.has(type)) throw error
    }

    currentAttempts++
  }

  throw new Error('Exceeded connection retry limit.')
}

function createParticipantPeer(
  peerId: string,
  peerOption?: PeerJSOption,
  connectOption?: PeerConnectOption
): Promise<Peer> {
  const peer = new Peer(uuidv4(), peerOption)
  let connection: DataConnection | undefined
  let timeoutSlot: ReturnType<typeof setTimeout> | undefined

  return new Promise((_resolve, _reject) => {
    function resolve() {
      connection!.off('error', reject)
      if (timeoutSlot) clearTimeout(timeoutSlot)
      peer.off('error', reject)
      _resolve(peer)
    }

    function reject(error: any) {
      connection?.removeAllListeners()
      if (timeoutSlot) clearTimeout(timeoutSlot)
      peer.removeAllListeners()
      peer.destroy()
      _reject(error)
    }

    timeoutSlot = setTimeout(
      () => void reject('Timed out.'),
      CREATE_PEER_TIMEOUT_MS
    )

    peer.once('error', reject)
    peer.on('open', () => {
      // Reset timeout.
      clearTimeout(timeoutSlot)
      timeoutSlot = setTimeout(
        () => void reject('Timed out.'),
        CREATE_PEER_TIMEOUT_MS
      )

      connection = peer.connect(peerId, connectOption)
      connection.once('open', resolve)
      connection.once('error', reject)
    })
  })
}

function createHostPeer(
  peerId: string,
  peerOption?: PeerJSOption
): Promise<Peer> {
  const peer = new Peer(peerId, peerOption)
  let timeoutSlot: ReturnType<typeof setTimeout> | undefined

  return new Promise((_resolve, _reject) => {
    function resolve() {
      if (timeoutSlot) clearTimeout(timeoutSlot)
      peer.off('error', reject)
      _resolve(peer)
    }

    function reject(error: any) {
      if (timeoutSlot) clearTimeout(timeoutSlot)
      peer.removeAllListeners()
      peer.destroy()
      _reject(error)
    }

    timeoutSlot = setTimeout(
      () => void reject('Timed out.'),
      CREATE_PEER_TIMEOUT_MS
    )

    peer.once('open', resolve)
    peer.once('error', reject)
  })
}

// Copy of peer error types as enum.
export enum PeerErrorType {
  BrowserIncompatible = 'browser-incompatible',
  Disconnected = 'disconnected',
  InvalidID = 'invalid-id',
  InvalidKey = 'invalid-key',
  Network = 'network',
  PeerUnavailable = 'peer-unavailable',
  SslUnavailable = 'ssl-unavailable',
  ServerError = 'server-error',
  SocketError = 'socket-error',
  SocketClosed = 'socket-closed',
  UnavailableID = 'unavailable-id',
  WebRTC = 'webrtc',
}

const CREATE_PEER_TIMEOUT_MS = 5_000

const CREATE_ROOM_PEER_ATTEMPT_LIMIT = 2

const FATAL_PEER_ERRORS: Set<PeerErrorType> = new Set([
  PeerErrorType.BrowserIncompatible,
  PeerErrorType.InvalidID,
  PeerErrorType.InvalidKey,
  PeerErrorType.SslUnavailable,
  PeerErrorType.ServerError,
  PeerErrorType.SocketError,
  PeerErrorType.SocketClosed,
])
