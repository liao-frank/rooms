import { PeerConnectOption, PeerJSOption } from 'peerjs'
import { useCallback, useEffect, useState } from 'react'

import { PeerErrorType } from '../lib/peerHelpers'
import { Host } from '../member/host'
import { Member, Status } from '../member/member'
import { Participant } from '../member/participant'
import { Serializable } from '../types'

export const useMember = <T extends Serializable>(
  roomId: string
): {
  member: Member<T>
  status: Status
  error?: Error
} => {
  const [status, setStatus] = useState<Status>(Status.Connecting)
  const [error, setError] = useState<Error>()

  const initialMember = didRecentlyStopHosting()
    ? new Participant()
    : new Host()
  const [member, _setMember] = useState<Member<T>>(initialMember)
  const setMember = ({ nextMember }: { nextMember: Member<T> }) => {
    if (error) return

    member.tearDown()
    _setMember(nextMember)
  }

  // Setup re-host delay.
  const setStoppedHostingTimestamp = useCallback(() => {
    if (!member.isHost) return
    const timestampStr = Date.now().toString()
    localStorage.setItem(STOPPED_HOSTING_TIMESTAMP_KEY, timestampStr)
  }, [])
  useEffect(() => {
    window.addEventListener('unload', setStoppedHostingTimestamp)

    return () => {
      setStoppedHostingTimestamp()
      window.removeEventListener('unload', setStoppedHostingTimestamp)
    }
  }, [])

  useEffect(() => {
    if (error) return

    // Propagate status as state.
    member.on('status', (status) => {
      setStatus(status)
    })

    // If disconnected, retry and rotate between host and participant as
    // necessary.
    member.on('status', (status) => {
      if (status !== Status.Disconnected) return
      // If never connected, let error catching handle retries.
      if (!member.didConnect) return

      if (member.isHost) {
        setMember({ nextMember: new Participant() })
      } else {
        setMember({ nextMember: new Host() })
      }
    })

    member
      .connect(roomId, PEER_JS_OPTIONS, PEER_CONNECT_OPTIONS)
      .catch((error) => {
        const { isHost } = member

        if (isHost && error.type === PeerErrorType.UnavailableID) {
          setMember({ nextMember: new Participant() })
        } else if (!isHost && error.type === PeerErrorType.PeerUnavailable) {
          setMember({ nextMember: new Host() })
        } else {
          setError(error)
        }
      })

    return () => void member.tearDown()
  }, [member])

  return { member, status, error }
}

const didRecentlyStopHosting = (): boolean => {
  const timestampStr =
    localStorage.getItem(STOPPED_HOSTING_TIMESTAMP_KEY) || '0'
  const timestamp = Number.parseInt(timestampStr)
  return Date.now() - timestamp < RE_HOST_DELAY_MS
}

/**
 * If closing the webpage as the host, the user must wait the specified time
 * before immediately connecting as host again. Otherwise, they begin by
 * attempting to connect as a participant.
 *
 * This is to prevent a host from refreshing the webpage, resetting their state,
 * reconnecting as host, and accidentally forcing all participants to reset
 * their state too.
 */
const RE_HOST_DELAY_MS = 3_000

const STOPPED_HOSTING_TIMESTAMP_KEY = '6c6febee-d2e7-4849-8176-9d0c8263b2ef'

const PEER_JS_OPTIONS: PeerJSOption = {
  // Uncomment the line below for PeerJS logs.
  // debug: 3,
}

const PEER_CONNECT_OPTIONS: PeerConnectOption = {
  reliable: true,
}
