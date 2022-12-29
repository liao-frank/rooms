import Peer, { DataConnection, PeerJSOption } from 'peerjs'

import { createPeer } from './lib/peerHelpers'
import { Serializable } from './types'
import { Member } from './member'

export class Host<T extends Serializable = Serializable> extends Member<T> {
  private readonly connections = new Map</* peerId */ string, DataConnection>()

  protected async connectInternal(
    hostId: string,
    peerOptions?: PeerJSOption
  ): Promise<Peer> {
    const peer = await createPeer(hostId, peerOptions, (peer) => {
      peer.on('connection', (connection) => {
        this.connections.set(connection.peer, connection)

        connection.on('data', (data: unknown) => {
          this.broadcast(data as T)
        })
        connection.on('close', () => {
          this.connections.delete(connection.peer)
        })
      })
    })

    return peer
  }

  protected broadcastInternal(data: T): void {
    for (const connection of this.connections.values()) {
      connection.send(data)
    }

    this.emit('data', data)
  }

  protected getIsHostProtected(): boolean {
    return true
  }
}
