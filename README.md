![Logo](docs/rooms.png)

Rooms is a library for synchronizing state among multiple clients without
servers using WebRTC.

Rooms attempts to simplify the creation of multiplayer websites. Think in terms of chatrooms, party games, collaborative whiteboarding, etc.

## React hook

### Basic usage

```ts
// Basic usage is very similar to using 'useState' in React.

// 1. Within a component, call 'useRoom' with an ID specific to that piece of
//    state.
const { state, setState } = useRoom<number>('unique-id', 0)

// 2. Call 'setState' to change the state across all clients that are calling
//    the hook with the same ID.
setState(42)

// That's it! No servers needed. Whenever new clients call the hook, they will
// be automatically synced up with everyone else.
```
