import { useRoom } from '@src/index'
import { ConnectionStatus } from '@src/member'
import React, { CSSProperties, PropsWithChildren } from 'react'

export const HostFlair = () => {
  const { isHost, status } = useRoom<null>(ROOM_ID, null)

  return (
    <div
      style={{
        border: '1px solid red',
        padding: '1rem',
        width: 'fit-content',
      }}
    >
      {status === ConnectionStatus.Connected ? (
        <>
          You are a {isHost ? <HostPill /> : <ParticipantPill />} of room{' '}
          {ROOM_ID}
        </>
      ) : (
        'Connecting...'
      )}
    </div>
  )
}

const HostPill = () => {
  return (
    <Pill style={{ backgroundColor: '#D1C4E9', color: '#311B92' }}>Host</Pill>
  )
}

const ParticipantPill = () => {
  return (
    <Pill style={{ backgroundColor: '#E3F2FD', color: '#0D47A1' }}>
      Participant
    </Pill>
  )
}

const Pill = ({
  children,
  style,
}: PropsWithChildren<{ style: CSSProperties }>) => {
  return (
    <span
      style={{
        ...PILL_STYLES,
        ...style,
      }}
    >
      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          height: '100%',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        {children}
      </div>
    </span>
  )
}

const PILL_STYLES: CSSProperties = {
  borderRadius: '1rem',
  display: 'inline-block',
  fontSize: '0.625rem',
  height: '1.25rem',
  letterSpacing: '0.05rem',
  margin: '0 0.125rem',
  padding: '0 0.5625rem 0 0.5rem',
  textTransform: 'uppercase',
  verticalAlign: 'middle',
  width: 'fit-content',
}

const ROOM_ID = '5d47f068-de06-4b0d-bbcd-90ab008c89e5'
