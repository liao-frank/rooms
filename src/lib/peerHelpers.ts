/**
 * Helpers for PeerJS.
 */
import Peer, { DataConnection, PeerConnectOption, PeerJSOption } from 'peerjs'

/**
 * Connect to a peer with timeouts and retries with exponential backoff.
 * @param peer A peer, not necessarily finished connecting to the peer server.
 * @param otherPeerId
 * @param options
 * @returns A promise for an open data connection.
 */
export const connectToPeer = (
  peer: Peer,
  otherPeerId: string,
  options?: PeerConnectOption,
  presetupConnection?: (connection: DataConnection) => void
): Promise<DataConnection> => {
  if (peer.disconnected) {
    throw new Error('Peer is disconnected and cannot connect to others.')
  }

  const connections: DataConnection[] = []
  const timeoutSlotIds: number[] = []
  const timeoutIntervals = new Array(CONNECT_RETRY_LIMIT)
    .fill(null)
    .map((_, index) => CONNECT_BASE_TIMEOUT_MS * Math.pow(2, index + 1) - 1_000)

  const disposeConnections = (ignoreConnection?: DataConnection) => {
    for (const connection of connections) {
      if (connection !== ignoreConnection) {
        destroyConnection(connection)
      }
    }
    connections.splice(0, connections.length)
    Object.freeze(connections)
  }
  const disposeTimeouts = () => {
    for (const id of timeoutSlotIds) {
      clearTimeout(id)
    }
    timeoutSlotIds.splice(0, timeoutSlotIds.length)
    Object.freeze(timeoutSlotIds)
  }

  const connect = (resolve: (connection: DataConnection) => void): void => {
    // NOTE: Fix for incorrect typing.
    const connection = peer.connect(otherPeerId, options)

    // Connection can potentially be undefined if a connection to the given peer
    // already exists. This can happen when a previous connection has succeeded
    // but hasn't emitted the 'open' event yet.
    if (!connection) {
      return
    }

    presetupConnection?.(connection)

    connections.push(connection)
    connection.once('open', () => {
      disposeConnections(connection)
      disposeTimeouts()
      resolve(connection)
    })
  }

  return new Promise((resolve, reject) => {
    // Setup final timeout and rejection.
    const finalTimeoutId = setTimeout(() => {
      reject(`Connection from peer ${peer.id} to ${otherPeerId} timed out.`)
      disposeConnections()
      disposeTimeouts()
    }, CONNECT_BASE_TIMEOUT_MS * Math.pow(2, CONNECT_RETRY_LIMIT))
    timeoutSlotIds.push(finalTimeoutId)

    // If peer errors out, stop connecting immediately.
    const onPeerError = (err: Error) => {
      const type = (err as any).type
      const canContinue =
        type !== PeerErrorType.PeerUnavailable &&
        !FATAL_PEER_ERROR_TYPES.has(type)

      if (canContinue) return

      reject(err)
      peer.off('error', onPeerError)
      disposeConnections()
      disposeTimeouts()
    }
    peer.on('error', onPeerError)

    // If connections time out, retry with exponential backoff. Keep previous
    // connections in case they eventually connect.
    connect(resolve)
    for (const interval of timeoutIntervals) {
      const id = setTimeout(() => void connect(resolve), interval)
      timeoutSlotIds.push(id)
    }
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

const CONNECT_RETRY_LIMIT = 5

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
