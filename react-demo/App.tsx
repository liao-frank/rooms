import React from 'react'

import { useRoom } from '../src/react/useRoom'

export const App = () => {
  const { state, setState, isHost, status, error } = useRoom<string>(
    'room-id',
    ''
  )
  const errorType = (error as any)?.type

  return (
    <div>
      <div>
        {isHost ? 'Host' : 'Participant'} {status}
      </div>
      {error && (
        <div style={{ color: 'red' }}>
          {error.toString()}
          {errorType && ', ' + errorType}
        </div>
      )}
      <input
        value={state}
        onChange={(event) => void setState(event.target.value || '')}
      />
    </div>
  )
}
