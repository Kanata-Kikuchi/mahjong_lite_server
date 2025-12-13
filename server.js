const WebSocket = require('ws');
const crypto = require('crypto');

const PORT = 3000;

const wss = new WebSocket.Server({ port: PORT });

const rooms = {};

/*
rooms[roomId] = {
  roomId: ,

  rule: ,

  round: ,
  reach: ,
  gameSet: ,
  roundTable: ,
  comment ,
  score: ,

  scoreMemory: ,
  sum ,
  gameScore: ,
  newSeat ,
  
  started ,
  game: ,

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
      scoreMemory: room.scoreMemory,
      sum: room.sum,
      gameScore: room.gameScore,
      newSeat: room.newSeat,
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
    started: false,
    gameNo: 1,
    phase: 'between_games',
    initialScore: null,
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
  room.phase = 'playing';

  broadcastGameState(roomId);
}

function startGame(payload) {
  const roomId = payload.roomId;
  const room = rooms[roomId];
  if (!room) return;

  room.started = true;
  room.phase = 'playing';
  room.initialScore = payload.initialScore;

  const msg = JSON.stringify({
    type: 'game_start',
    payload: {
      roomId: roomId,
      rule: room.rule,
      initialScore: payload.initialScore
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
  room.players.forEach((player, index) => {
    player.seat = seats[index]
  });

  const msg = JSON.stringify({
    type: 'pullout_player',
    payload: {}
  });

  socket.send(msg);

  broadcastRoomState(roomId);
};

function updateSeat(payload) { // 親決め（試合終了→次試合へ）
  const roomId = payload.roomId;
  const room = rooms[roomId];
  if (!room) return;

  // ✅ gameNoはサーバー主導（クライアントから受け取らない）
  room.gameNo = (typeof room.gameNo === 'number') ? (room.gameNo + 1) : 2;

  // ✅ 履歴は「空/undefined/null」で上書きしない
  if (Array.isArray(payload.scoreMemory) && payload.scoreMemory.length > 0) {
    room.scoreMemory = payload.scoreMemory;
  }
  if (Array.isArray(payload.sum) && payload.sum.length > 0) {
    room.sum = payload.sum;
  }
  if (Array.isArray(payload.gameScore) && payload.gameScore.length > 0) {
    room.gameScore = payload.gameScore;
  }

  // ✅ newSeat は必須：席順が壊れると復帰が壊れる
  if (!Array.isArray(payload.newSeat) || payload.newSeat.length !== 4) {
    console.error('updateSeat: invalid newSeat', payload.newSeat);
    return;
  }

  room.newSeat = payload.newSeat;

  // playerId順に並べ替え
  const newPlayers = payload.newSeat
    .map(id => room.players.find(player => player.playerId === id))
    .filter(Boolean);

  const seats = ['ton', 'nan', 'sya', 'pei'];
  newPlayers.forEach((player, index) => {
    player.seat = seats[index];
  });

  room.players = newPlayers;
  room.phase = 'between_games';

  broadcastGameFinish(roomId);
}

function changeSeat(payload) { // ルーム作成時の席決め.
  const roomId = payload.roomId;
  const room = rooms[roomId];

  if (!room) return;

  const order = payload.players.map(p => p.name);

  room.players.sort((a, b) => {
    return order.indexOf(a.name) - order.indexOf(b.name);
  });

  const seats = ['ton', 'nan', 'sya', 'pei'];
  room.players.forEach((player, index) => {
    player.seat = seats[index];
  });

  broadcastRoomState(roomId);
}

function finishSession(payload) {
  const roomId = payload.roomId;
  const room = rooms[roomId];

  if (!room) return;

  const msg = JSON.stringify({
    type: 'navi_root',
    payload: {}
  });

  room.players.forEach(player => {
    if (player.socket.readyState === WebSocket.OPEN) {
      player.socket.send(msg);
    }
  });

  delete rooms[roomId];
}




function sendResumeResult(socket, payload) {
  socket.send(JSON.stringify({
    type: 'resume_result',
    payload
  }));
}

function resumeRoom(socket, payload) {
  const roomId = payload?.roomId;
  const playerId = payload?.playerId;

  if (!roomId || !playerId) {
    sendResumeResult(socket, { ok: false, boot: 'room', reason: 'missing_id' });
    return;
  }

  const room = rooms[roomId];
  if (!room) {
    sendResumeResult(socket, { ok: false, boot: 'room', reason: 'room_not_found' });
    return;
  }

  const player = room.players.find(p => p.playerId === playerId);
  if (!player) {
    sendResumeResult(socket, { ok: false, boot: 'room', reason: 'player_not_found' });
    return;
  }

  player.socket = socket;

  const seatOrder = ['ton','nan','sya','pei'];
  const newSeat = room.newSeat ?? seatOrder
    .map(s => room.players.find(p => p.seat === s)?.playerId)
    .filter(Boolean);

  //
  const resPayload = {
    ok: true,
    boot: room.started ? 'share' : 'room',
    snapshot: { /* 既存 */ }
  };

  console.log('resume_result payload:', resPayload.boot, resPayload.ok, {
    started: room.started,
    phase: room.phase,
    gameNo: room.gameNo,
    players: room.players.length,
  });
  //

  sendResumeResult(socket, {
    ok: true,
    boot: room.started ? 'share' : 'room',

    snapshot: {
      gameNo: room.gameNo,
      phase: room.phase,
      initialScore: room.initialScore,
      rule: room.rule,
      players: room.players.map(p => ({
        playerId: p.playerId,
        name: p.name,
        seat: p.seat,
      })),
 
      newSeat: newSeat,
 
      history: {
        scoreMemory: room.scoreMemory ?? null,
        sum: room.sum ?? null,
        gameScore: room.gameScore ?? null,
      },

      game: (room.phase === 'playing') ? {
        round: room.round,
        reach: room.reach,
        gameSet: room.gameSet,
        roundTable: room.roundTable,
        comment: room.comment,
        score: room.score,
      } : null
    }
  });
}









wss.on('connection', (socket) => {
  console.log('client connected');

  process.on('uncaughtException', err => {
    console.error('UNCAUGHT', err);
  });

  process.on('unhandledRejection', err => {
    console.error('UNHANDLED', err);
  });

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
        startGame(payload);
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
        updateSeat(payload);
        break;

      case 'change_seat':
        console.log('change_seat を受信');
        changeSeat(payload);
        break;

      case 'finish_session':
        console.log('finish_session を受信');
        finishSession(payload);
        break;

      case 'resume_room':
        console.log('resume_room を受信');
        resumeRoom(socket, payload);
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
