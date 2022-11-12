import Peer, { DataConnection, PeerConnectOption, PeerJSOption } from 'peerjs'
import { v4 as uuidv4 } from 'uuid'

import { connectToPeer } from '../lib/peerHelpers'
import { Serializable } from '../types'
import { Member, Status } from './member'

// Participants are members that are always only connected to a single host
// member.
export class Participant<
  T extends Serializable = Serializable
> extends Member<T> {
  private hostConnection?: DataConnection

  protected async connectInternal(
    hostId: string,
    peerOptions?: PeerJSOption,
    connectOptions?: PeerConnectOption
  ): Promise<Peer> {
    const selfId = uuidv4()
    const peer = new Peer(selfId, peerOptions)
    this.peerProtected = peer

    const connection = await connectToPeer(
      peer,
      hostId,
      connectOptions,
      (connection) => {
        connection.on('data', (data: unknown) => {
          this.emit('data', data as T)
        })
      }
    )

    this.hostConnection = connection
    connection.on('close', () => {
      this.setStatus(Status.Disconnected)
    })

    return peer
  }

  protected broadcastInternal(data: T): void {
    this.hostConnection!.send(data)
  }

  protected getIsHostProtected(): boolean {
    return false
  }
}
