import { useRoomState } from '@src/index'
import { Status } from '@src/room'
import React, { useEffect, useState } from 'react'

// Shows fun facts while connecting to the sample room.
export const LoadingTip = () => {
  const { status } = useRoomState<null>(ROOM_ID, null)

  // Even if the client connects to the room quickly, show the loading tip for
  // a minimum amount of time to avoid flashing.
  const [minLoadingTimePassed, setMinLoadingTimePassed] =
    useState<boolean>(false)

  useEffect(() => {
    const slotId = setTimeout(() => {
      void setMinLoadingTimePassed(true)
    }, MIN_LOADING_TIME_MS)

    return () => clearTimeout(slotId)
  }, [])

  const showLoadingTip = status !== Status.Connected || !minLoadingTimePassed

  return (
    <>
      <style>
        {`
      .⏳:after {
        animation: 1400ms linear infinite ⏳;
        content: '⏳';
        display: inline-block;
      }

      @keyframes ⏳ {
        0% {
          content: '⏳';
          transform: rotate(0deg);
        }
        50% {
          content: '⌛';
          transform: rotate(0deg);
        }
        100% {
          content: '⌛';
          transform: rotate(180deg);
        }
      }
      `}
      </style>
      <div
        style={{
          border: '1px solid red',
          height: '4rem', // Set height explicitly to avoid reflow on rerender.
          padding: '1rem',
          width: 'fit-content',
        }}
      >
        {showLoadingTip ? (
          <>
            Fun fact: Pangolins are the only known mammals covered with scales
            <div style={{ marginTop: '0.5rem' }}>
              Connecting... <span className="⏳"></span>
            </div>
          </>
        ) : (
          'You are connected to room ' + ROOM_ID
        )}
      </div>
    </>
  )
}

const ROOM_ID = 'eb32db6d-5619-488c-a4b1-1f8f1f045348'

const MIN_LOADING_TIME_MS = 1_400
