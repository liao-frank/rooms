import Peer from 'peerjs'

import { getResolver } from '@lib/getResolver'
import { hasOwnProperty } from '@lib/hasOwnProperty'
import { wait } from '@lib/wait'

export const createPeer = (
  id: string,
  options?: Peer.PeerJSOption,
  retries = 0
): Promise<Peer> => {
  const peer = new Peer(id, options)
  const { promise, resolver, rejecter } = getResolver<Peer>()

  const onError = (err: any) => {
    if (hasOwnProperty(err, 'type') && PEER_RETRY_ERRORS.includes(err.type)) {
      if (retries > PEER_RETRY_LIMIT) rejecter(err)

      wait(PEER_RETRY_INTERVAL_MS)
        .then(() => createPeer(id, options, ++retries))
        .then(resolver)
        .catch(rejecter)
    } else {
      rejecter(err)
    }
  }

  peer.on('open', () => {
    peer.off('error', onError)
    resolver(peer)
  })

  peer.on('error', onError)

  return promise
}

const PEER_RETRY_ERRORS = [
  'network',
  'server-error',
  'socket-closed',
  'socket-error',
  'webrtc',
]

const PEER_RETRY_INTERVAL_MS = 1000

const PEER_RETRY_LIMIT = 60
