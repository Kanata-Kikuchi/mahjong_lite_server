const WebSocket = require('ws');

const PORT = 3000;

const wss = new WebSocket.Server({ port: PORT });

const rooms = {};

/*
rooms[roomId] = {
  roomId: ,
  rule: ,
  roound: ,
  reach: ,
  game: ,
  gameSet: ,
  roundTable: ,
  gameScore: ,
  score: ,
  players: [
    {
      playerId: ,
      seat: ,
      name: ,
      socket: ,
    },
  ],
};
*/

function generateId(length = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let roomId = '';

  for (let i = 0; i < length; i++) {
    const index = Math.floor(Math.random() * chars.length); // 0 ~ 36の乱数.
    roomId += chars[index]; // 文字列連結.
  }

  return roomId;
}

function broadcastRoomState(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const payload = {
    roomId: room.roomId,
    rule: room.rule,
    players: room.players.map(player => ({
      playerId: player.playerId,
      seat: player.seat,
      name: player.name,
    })),
  };

  const msg = JSON.stringify({
    type: 'room_state',
    payload: payload,
  });

  room.players.forEach(player => {
    if (player.socket.readyState === WebSocket.OPEN) {
      player.socket.send(msg);
    }
  });
}

function broadcastGameState(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const payload = {
    round: room.round,
    reach: room.reach,
    gameSet: room.gameSet,
    roundTable: room.roundTable,
    comment: room.comment,
    score: room.score,
  };

  const msg = JSON.stringify({
    type: 'game_state',
    payload: payload,
  });

  room.players.forEach(player => {
    if (player.socket.readyState === WebSocket.OPEN && player.seat != 'ton') { //  && player.seat != 'ton'.
      player.socket.send(msg);
    }
  });
}

function broadcastGameFinish(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const msg = JSON.stringify({
    type: 'game_finish',
    payload: {
      gameScore: room.gameScore,
      players: room.players,
    },
  });

  room.players.forEach(player => {
    if (player.socket.readyState === WebSocket.OPEN) {
      player.socket.send(msg);
    }
  });
}

function setId(socket, roomId, playerId) {

  const payload = {
    roomId: roomId,
    playerId: playerId
  }

  socket.send(JSON.stringify({
    type: 'set_id',
    payload: payload,
  }));
}

function createRoom(socket, payload) {
  const hostName = payload?.name;
  const rule = payload?.rule;

  if (!hostName || !rule) {
    socket.send(JSON.stringify({
      type: 'error',
      payload: { message: 'serveer.js/ceateRoom/payloadのruleとnameがなかった' },
    }));
    return;
  }

  const roomId = generateId();
  const playerId = crypto.randomUUID();

  rooms[roomId] = {
    roomId: roomId,
    rule: rule,
    players: [
      {
        playerId: playerId,
        seat: 'ton',
        name: hostName,
        socket: socket,
      },
    ],
  };

  socket.send(JSON.stringify({
    type: 'room_created',
    payload: {
      roomId: roomId,
    },
  }));

  setId(socket, roomId, playerId);
  broadcastRoomState(roomId);
}

function joinRoom(socket, payload) {
  const roomId = payload?.roomId;
  const name = payload?.name;

  if (!roomId || !name) {
    socket.send(JSON.stringify({
      type: 'error',
      payload: { message: 'serveer.js/joinRoom/payloadのidとnameがなかった' },
    }));
    return;
  }

  const room = rooms[roomId];
  if (!room) {
    socket.send(JSON.stringify({
      type: 'unknown_room',
      payload: {}
    }));
    return;
  }

  const seats = ['ton', 'nan', 'sya', 'pei'];
  const usedSeats = room.players.map(p => p.seat);
  const freeSeat = seats.find(seat => !usedSeats.includes(seat));

  if (!freeSeat) {
    socket.send(JSON.stringify({
      type: 'error',
      payload: { message: 'serveer.js/joinRoom/満室' },
    }));
    return;
  }

  socket.send(JSON.stringify({
    type: 'success_join',
    payload: {}
  }))

  const playerId = crypto.randomUUID();

  room.players.push({
    playerId: playerId,
    seat: freeSeat,
    name: name,
    socket: socket,
  });

  setId(socket, roomId, playerId);
  broadcastRoomState(roomId);
}

function inputRound(socket, payload) {
  const roomId = payload?.roomId;

  if (!roomId) {
    socket.send(JSON.stringify({
      type: 'error',
      payload: { message: 'serveer.js/input_round/idがない' }
    }));
    return;
  }

  const room = rooms[roomId];

  if (!room) {
    socket.send(JSON.stringify({
      type: 'error',
      payload: { message: 'serveer.js/input_round/ルームIDが一致するものがなかった' }
    }));
    return;
  }

  room.round = payload.round;
  room.reach = payload.reach;
  room.gameSet = payload.gameSet;
  room.roundTable = payload.roundTable;
  room.comment = payload.comment;
  room.score = payload.score;

  broadcastGameState(roomId);
}

function stratGame(payload) {
  const roomId = payload.roomId;
  const room = rooms[roomId];
  if (!room) return;

  const msg = JSON.stringify({
    type: 'game_start',
    payload: {
      roomId: roomId
    }
  });

  room.players.forEach(player => {
    if (player.socket.readyState === WebSocket.OPEN) {
      player.socket.send(msg);
    }
  });
}

function removeRoom(payload) {
  const roomId = payload.roomId;
  const room = rooms[roomId];

  if (!room) return;

  const msg = JSON.stringify({
    type: 'delete_room',
    payload: {}
  });

  room.players.forEach(player => {
    if (player.socket.readyState === WebSocket.OPEN) {
      player.socket.send(msg);
    }
  });

  delete rooms[roomId];
}

function pulloutPlayer(socket, payload) {
  const roomId = payload.roomId;
  const playerId = payload.playerId;
  const room = rooms[roomId];

  if (!room) return;

  room.players = room.players.filter(player =>
    player.playerId !== playerId
  );

  const seats = ['ton', 'nan', 'sya', 'pei'];
  room.playrers.forEach((player, index) => {
    player.seat = seats[index]
  });

  const msg = JSON.stringify({
    type: 'pullout_player',
    payload: {}
  });

  socket.send(msg);

  broadcastRoomState(roomId);
};

function updateSeat(payload) {
  const roomId = payload.roomId;
  const room = rooms[roomId];

  if (!room) return;
  
  const newPlayers = payload.players.map(id =>
    room.players.find(player => player.playerId === id)
  );

  const seats = ['ton', 'nan', 'sya', 'pei'];

  newPlayers.forEach((player, index) => {
    if (player) {
      player.seat = seats[index];
    }
  });

  room.players = newPlayers;
  room.gameScore = payload.gameScore;

  broadcastGameFinish(roomId);
}

wss.on('connection', (socket) => {
  console.log('client connected');

  socket.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (err) {
      socket.send(JSON.stringify({
        type: 'error',
        payload: { message: 'serveer.js/wss.on/受け取ったJSONがエラー' },
      }));
      return;
    }

    const type = msg.type;
    const payload = msg.payload || {};

    switch (type) {
      case 'create_room':
        console.log('create_room を受信');
        createRoom(socket, payload);
        break;

      case 'join_room':
        console.log('join_room を受信');
        joinRoom(socket, payload);
        break;

      case 'input_round':
        console.log('input_round を受信');
        inputRound(socket, payload);
        break;

      case 'start_game':
        console.log('start_game を受信');
        stratGame(payload);
        break;

      case 'remove_room':
        console.log('remove_room を受信');
        removeRoom(payload);
        break;

      case 'exit_room':
        console.log('exit_room を受信');
        pulloutPlayer(socket, payload);
        break;

      case 'initiative_check':
        console.log('initiative_check を受信');
        updateSeat();
        break;

      default:
        socket.send(JSON.stringify({
          type: 'error',
          payload: { message: `serveer.js/wss.on/type: ${type}` },
        }));
        break;
    }
  });

  socket.on('close', () => {
    console.log('client disconnected');
  });

  socket.on('error', (err) => {
    console.error('socket error:', err);
  });
});
