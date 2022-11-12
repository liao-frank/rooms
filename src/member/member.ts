import EventEmitter from 'eventemitter3'
import Peer, { PeerConnectOption, PeerJSOption } from 'peerjs'
import { v5 as uuidv5 } from 'uuid'

import { Serializable } from '../types'

// This class is a wrapper for Peer within the context of a centralized
// cluster.
export abstract class Member<
  T extends Serializable = Serializable
> extends EventEmitter<NodeEvents<T>> {
  protected peerProtected?: Peer
  private didConnectPrivate = false
  private statusPrivate: Status = Status.Uninitialized

  async connect(
    roomId: string,
    peerOptions?: PeerJSOption,
    connectOptions?: PeerConnectOption
  ): Promise<void> {
    if (this.status === Status.Disconnected) {
      throw new Error('Members cannot reconnect.')
    }
    this.setStatus(Status.Connecting)

    const hostId = Member.getHostId(roomId)

    try {
      const peer = await this.connectInternal(
        hostId,
        peerOptions,
        connectOptions
      )
      this.peerProtected = peer
      this.setStatus(Status.Connected)
      peer.on('disconnected', () => void this.tearDown())
    } catch (err) {
      this.setStatus(Status.Disconnected)
      this.tearDown()
      throw err
    }
  }
  protected abstract connectInternal(
    hostId: string,
    peerOptions?: PeerJSOption,
    connectOptions?: PeerConnectOption
  ): Promise<Peer>

  broadcast(data: T): void {
    if (this.status !== Status.Connected) return
    this.broadcastInternal(data)
  }
  protected abstract broadcastInternal(data: T): void

  protected abstract getIsHostProtected(): boolean

  get didConnect() {
    return this.didConnectPrivate
  }

  get isHost() {
    return this.getIsHostProtected()
  }

  get peer(): Peer | undefined {
    return this.peerProtected
  }

  get status(): Status {
    return this.statusPrivate
  }

  protected setStatus(status: Status): void {
    const prevStatus = this.status
    const prevStatusIndex = STATUS_ORDER.indexOf(this.status)
    const statusIndex = STATUS_ORDER.indexOf(status)
    const isValidOrder =
      statusIndex >= prevStatusIndex && prevStatusIndex >= 0 && statusIndex >= 0

    if (!isValidOrder) {
      throw new Error(
        `Status (${status}) does not conform to the status order. ` +
          `(Previous status was ${prevStatus}.)`
      )
    }

    if (status === prevStatus) return
    if (status === Status.Connected) {
      this.didConnectPrivate = true
    }
    this.statusPrivate = status
    this.emit('status', status)
  }

  tearDown() {
    if (this.peer) this.peer.destroy()
    this.peerProtected = undefined
    this.setStatus(Status.Disconnected)
  }

  private static getHostId(roomId: string) {
    return uuidv5(roomId, HOST_ID_NAMESPACE)
  }
}

interface NodeEvents<T extends Serializable> {
  data: [T]
  status: [Status]
}

export enum Status {
  Uninitialized = 'uninitialized',
  Connecting = 'connecting',
  Connected = 'connected',
  // Final status. Disconnected members cannot reconnect.
  Disconnected = 'disconnected',
}

const HOST_ID_NAMESPACE = '0b5d37ef-71a8-4691-87f3-f380af4f27e0'

const STATUS_ORDER = [
  Status.Uninitialized,
  Status.Connecting,
  Status.Connected,
  Status.Disconnected,
]
