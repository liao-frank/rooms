/**
 * Helpers for PeerJS.
 */
import Peer, { DataConnection, PeerConnectOption, PeerJSOption } from 'peerjs'

import { setTimeoutAsync } from './asyncTimeout'

/**
 * Connect to a peer with timeouts and retries with exponential backoff.
 * @param peer A peer, not necessarily finished connecting to the peer server.
 * @param otherPeerId
 * @param options
 * @returns A promise for an open data connection.
 */
export const connectToPeer = async (
  peer: Peer,
  otherPeerId: string,
  options?: PeerConnectOption,
  presetupConnection?: (connection: DataConnection) => void
): Promise<DataConnection> => {
  const attemptedConnections: DataConnection[] = []
  let connected = false
  let timeoutId: NodeJS.Timeout | undefined
  let currentTry = 0

  return new Promise(async (resolve, reject) => {
    // Listen for appropriate peer errors.
    const onPeerError = (error: Error) => {
      const type = (error as any).type
      const canContinue =
        type !== PeerErrorType.PeerUnavailable &&
        !FATAL_PEER_ERROR_TYPES.has(type)

      if (canContinue) return

      peer.off('error', onPeerError)
      attemptedConnections.forEach(destroyConnection)
      if (timeoutId) clearTimeout(timeoutId)
      reject(error)
    }
    peer.on('error', onPeerError)

    // Begin attempting connections.
    while (!connected && currentTry < CONNECT_TRY_LIMIT) {
      if (peer.disconnected) reject('Peer is disconnected.')

      currentTry++

      const connection = peer.connect(otherPeerId, options) as
        | DataConnection
        | undefined

      if (connection) {
        attemptedConnections.push(connection)
        presetupConnection?.(connection)

        // On successful connection, clean up timeout and other connection
        // attempts.
        connection.once('open', () => {
          connected = true
          if (timeoutId) clearTimeout(timeoutId)
          for (const otherConnection of attemptedConnections) {
            if (otherConnection === connection) continue
            destroyConnection(otherConnection)
          }
          peer.off('error', onPeerError)
          resolve(connection)
        })
      }

      const timeoutMs = CONNECT_BASE_TIMEOUT_MS * Math.pow(2, currentTry - 1)
      const timeoutIdAndPromise = setTimeoutAsync(timeoutMs)
      timeoutId = timeoutIdAndPromise.timeoutId

      await timeoutIdAndPromise.promise
    }

    attemptedConnections.forEach(destroyConnection)
    peer.off('error', onPeerError)
    reject(`Connection from peer ${peer.id} to ${otherPeerId} timed out.`)
  })
}

/**
 * Creates a peer and awaits its connection to the peer server. Uses
 * timeouts and retries with exponential backoff.
 * @param id
 * @param options
 * @returns A promise for a peer that is already connected to the peer server.
 */
export const createPeer = async (
  id: string,
  options?: PeerJSOption,
  presetupPeer?: (peer: Peer) => void,
  retriesLeft = CREATE_PEER_RETRY_LIMIT
): Promise<Peer> => {
  if (retriesLeft < 0) {
    throw new Error('Failed to create and connect peer to peer server.')
  }

  const peer = new Peer(id, options)
  presetupPeer?.(peer)
  const timeoutInterval =
    CREATE_PEER_TIMEOUT_MS * Math.pow(2, CREATE_PEER_RETRY_LIMIT - retriesLeft)

  return new Promise((resolve, reject) => {
    const handleOpen = () => {
      cleanup()
      resolve(peer)
    }
    var handleError = (err: Error) => {
      const type = (err as any).type
      if (!FATAL_PEER_ERROR_TYPES.has(type)) return

      cleanup(true)
      reject(err)
    }
    const timeoutId = setTimeout(() => {
      cleanup(true)
      resolve(createPeer(id, options, presetupPeer, retriesLeft - 1))
    }, timeoutInterval)

    var cleanup = (fail = false) => {
      if (fail) peer.destroy()
      peer.off('open', handleOpen)
      peer.off('error', handleError)
      clearTimeout(timeoutId)
    }

    peer.once('open', handleOpen)
    peer.on('error', handleError)
  })
}

export const destroyConnection = (connection: DataConnection): void => {
  connection.removeAllListeners()
  connection.close()
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

const CONNECT_BASE_TIMEOUT_MS = 1_000

const CONNECT_TRY_LIMIT = 6

const CREATE_PEER_TIMEOUT_MS = 2_000

const CREATE_PEER_RETRY_LIMIT = 4

const FATAL_PEER_ERROR_TYPES: Set<PeerErrorType> = new Set([
  PeerErrorType.BrowserIncompatible,
  PeerErrorType.InvalidID,
  PeerErrorType.InvalidKey,
  PeerErrorType.SslUnavailable,
  PeerErrorType.ServerError,
  PeerErrorType.SocketError,
  PeerErrorType.SocketClosed,
  PeerErrorType.UnavailableID,
])
