![Logo](docs/rooms.png)

Rooms is a client library for synchronizing state among multiple clients without servers.

Rooms attempts to simplify the creation of multiplayer websites. Think in terms of chatrooms, party games, collaborative whiteboarding, etc.

## Status

In progress and unpublished.

## Usage

```ts
import {Room} from 'rooms'

const roomCode = 'some-random-code'

// This is the initial state if the current client is the first to join.
const initialState = {
  count: 0,
}

// Setup the room.
const room = new Room(roomCode, initialState)

  // Register actions.
  .register('increment', (prevState) => ({
    ...prevState,
    count: prevState.count + 1,
  })
  .register('decrement', (prevState) => ({
    ...prevState,
    count: prevState.count - 1,
  })

  // Listen for updates.
  .on('state', (state) => {
    console.log('State was updated: ', state)
  })
  .on('status', (status) => {
    if (status !== 'connected') return
    console.log('Successfully joined room!')
  })

  // Connect.
  .connect()

// Finally, whenever any connected client clicks these buttons, the state will
// update for everyone.
document
  .querySelector('button#increment')
  .addEventListener('click', () => room.emit('increment'))

document
  .querySelector('button#decrement')
  .addEventListener('click', () => room.emit('decrement'))
```

## FAQ

> How is _Rooms_ serverless?

Under the hood, Rooms uses WebRTC which is not technically a serverless technology. Rooms is called a "serverless" library because of:

1. The nature of WebRTC, being generally serverless once P2P connections are established
2. The existence of free, reputable TURN servers
3. The plug-and-play nature of the library

> How secure is Rooms i.e. tolerant to malicious parties?

It's not.

The original idea for Rooms was to be a reliable distributed state library. Each client would be connected to each other client, and a consensus algorithm would be applied to sync everyone up.

The weak point of this approach is that a "doorman" is required to introduce new clients to the rest of the clients. The unbalanced power and the questionable integrity of the doorman role was not representative of a truly distributed system, so this approach was ditched.

_Rooms_ is now just a host-participant system but the logic around managing the host role is abstracted away. Users should only need to understand the concept of 'joining a room'.

There are no promises against malicious clients given the host role.

> How reliable is _Rooms_ i.e. tolerant to network issues, etc?

_Rooms_ is Redux-like in that it uses actions and pure reducers. Keeping a history of states then makes it easy to handle out-of-order action requests.

If action requests go completely missing, problems will eventually be resolved by way of intermittent sync requests.

> How performant is _Rooms_?

State updates are performed with actions and pure reducers. _Rooms_ also sends out intermittent state sync requests but in a lazy fashion. Therefore, all packets sent by _Rooms_ should be fairly small even in rooms with large states.
