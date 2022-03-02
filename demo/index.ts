import { Room } from '@rooms-js'

const room = new Room('foo', {})

room.connect().then(() => {
  console.log(room.peer?.id, room.isHost)
})

room.on('status', console.log)

window.room = room
