\
![Rooms logo](https://i.imgur.com/Ioau0V2.png)

_Rooms_ is a library for serverless synchronization of state across multiple clients using [WebRTC](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API). Rooms attempts to simplify the creation of multiplayer websites. Think in terms of chatrooms, party games, collaborative whiteboarding, etc.

There are currently only two main exports: the `Room` class and the `useRoomState` React hook. Please check out the rest of the documentation for examples. To test out the examples, you can open those pages in a new tab or window, or invite a friend to test with.

**Check out the full documentation at [https://liao-frank.github.io/rooms](https://liao-frank.github.io/rooms/?path=/docs/basics-getting-started--page)**

## FAQ

_**What is a "room"?**_

At a high level, a room is a group of clients that are all connected to each other through a host client. Any client can broadcast data to the other clients by sending the data through the host client.

_**Is Rooms really serverless?**_

Practically, yes. There is no server setup or configuration necessary to use Rooms. Almost all communication is client-to-client.

Technically, no. There are minimal server interactions needed for WebRTC, but these servers are cheap since most of the communication is client-to-client. _Rooms_ is built on top of [PeerJS](https://peerjs.com/) which provides its own free servers.

Check out these [MDN docs](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API) to learn more about WebRTC.
