// Requires
const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
var async = require('async');

// Globals
const port = process.env.PORT || 3000;
let users = {};
let rooms = {};

// Web server
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/create.html');
});
app.get('/*', (req, res) => {
    res.sendFile(__dirname + '/play.html');
});

// Websocket connection
io.on('connection', (socket) => {
    let connection = createGlobalConnection(socket);

    socket.on('user connect', userId => connectUser(connection, userId));
    socket.on('create room', options => createRoom(connection, options));
    socket.on('start game', roomId => startGame(connection, roomId));
    socket.on('join room', roomId => joinRoom(connection, roomId));
    socket.on('submit guess', guess => processGuess(connection, guess));
    socket.on("disconnect", () => disconnectUser(connection));
});


http.listen(port, () => {
    console.log(`Socket.IO server running at http://localhost:${port}/`);
});

function makeid(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

function checkIfGuessAllowed(room, userId) {
    const currentRound = room.currentRound;
    if (!room.gameRunning || room.players[userId][currentRound]) {
        return false;
    }
    return true;
}

function submitGuess(room, user, guess) {
    const currentRound = room.currentRound;
    room.guesses[currentRound].push({ lat: guess.lat, lon: guess.lon })
    room.players[user][currentRound] = true;
}

function runRoomInfoLoop(roomId) {
    async.whilst(
        function (cb) {
            cb(null, true);
        },
        function (callback) {
            io.to(roomId).emit("stats", {
                players: rooms[roomId].playerCount
            })
            setTimeout(callback, 1000);
        }
    )
}

function startGameLoop(room) {
    let round = 1;
    const duration = rooms[room].duration;
    io.to(room).emit("round", {
        round,
        lat: 51.505,
        lon: -0.09,
        zoom: rooms[room].zooms[round]
    });
    async.whilst(
        function (callbackFunction) {
            // start loop
            // loopStartTime = Date.now();
            callbackFunction(null, rooms[room].currentSeconds >= 0);
        },
        function (callback) {
            //logic
            io.to(room).emit("countdown", rooms[room].currentSeconds);
            waitTime = 1000;
            if (rooms[room].currentSeconds === 0) {
                if (round < rooms[room].rounds) {
                    rooms[room].currentSeconds = duration + 1
                } else {
                    let totalLat = 0;
                    let totalLon = 0;

                    for (let i = 0; i < rooms[room].guesses[round].length; i++) {
                        totalLat += rooms[room].guesses[round][i].lat
                        totalLon += rooms[room].guesses[round][i].lon
                    }
                    rooms[room].lat = totalLat / rooms[room].guesses[round].length;
                    rooms[room].lon = totalLon / rooms[room].guesses[round].length;
                    rooms[room].gameRunning = false;

                    for (let i = 0; i < Object.keys(rooms[room].players).length; i++) {
                        rooms[room].players[Object.keys(rooms[room].players)[i]] = {};
                    }
                    io.to(room).emit("finished", {
                        round,
                        lat: rooms[room].lat,
                        lon: rooms[room].lon,
                        zoom: rooms[room].zooms[round]
                    });
                    rooms[room].currentRound = 0;
                    rooms[room].currentSeconds = rooms[room].duration;

                    return
                }

                let totalLat = 0;
                let totalLon = 0;
                if (rooms[room].guesses[round].length) {
                    for (let i = 0; i < rooms[room].guesses[round].length; i++) {
                        totalLat += rooms[room].guesses[round][i].lat
                        totalLon += rooms[room].guesses[round][i].lon
                    }
                    rooms[room].lat = totalLat / rooms[room].guesses[round].length;
                    rooms[room].lon = totalLon / rooms[room].guesses[round].length;
                }


                round++;
                io.to(room).emit("round", {
                    round,
                    lat: rooms[room].lat,
                    lon: rooms[room].lon,
                    zoom: rooms[room].zooms[round]
                });
            } else if (rooms[room].currentSeconds === 1) {
                waitTime = waitTime + 1000;
            } else if (rooms[room].currentSeconds === duration) {
                rooms[room].currentRound = round;
                rooms[room].guesses[round] = [];
            }
            rooms[room].currentSeconds--;
            setTimeout(callback, waitTime)
        }
    )
}

function createGlobalConnection(socket) {
    users[socket.id] = { socket }
    return users[socket.id];
}

function assignUserId(connection, id) {
    if (id === "create") {
        id = makeid(24);
    }
    connection.userId = id;
}

function makeRoomId() {
    let room = makeid(5);
    while (rooms[room]) {
        room = makeid(5);
    }
    return room;
}

function createRoom(connection, options) {

    let roomId = makeRoomId();
    const rounds = parseInt(options.rounds);
    const duration = parseInt(options.duration);
    const roomName = options.roomName;

    rooms[roomId] = {
        room: roomId, // roomId refactor
        gameRunning: false,
        admin: connection.userId,
        rounds,
        currentRound: 0,
        currentSeconds: duration,
        guesses: {},
        zooms: options.zooms,
        duration,
        players: {},
        lat: 51.505,
        lon: -0.09,
        playerCount: 0,
        roomName
    };

    connection.socket.emit("room created", rooms[roomId]);

    runRoomInfoLoop(roomId);
}

function connectUser(connection, id) {
    assignUserId(connection, id);

    connection.socket.emit("user connected", connection.userId);
}

function startGame(connection, roomId) {
    const room = rooms[roomId];
    if (connection.userId !== room.admin || room.gameRunning) {
        return;
    }

    room.gameRunning = true;
    connection.socket.emit("game started", true);
    startGameLoop(roomId);
}

function joinRoom(connection, roomId) {
    const room = rooms[roomId];

    if (!roomExists(connection, room)) {
        return;
    }

    addPlayerToRoom(room, connection);

    connection.socket.join(roomId);

    let canGuess = checkIfGuessAllowed(room, connection.userId)

    connection.socket.emit("room joined", {
        room: roomId,
        rounds: room.rounds,
        duration: room.duration,
        roomName: room.roomName ?? "WHOMEGALUL",
        admin: (connection.userId === room.admin),
        status: room.gameRunning,
        currentRound: room.currentRound,
        currentSeconds: room.currentSeconds,
        canGuess
    })

    room.playerCount++;
}

function roomExists(connection, room) {
    if (room == undefined) {
        connection.socket.emit("redirect", "/")
        return false;
    }
    return true;
}

function addPlayerToRoom(room, connection) {
    if (room.players[connection.userId] == undefined) {
        room.players[connection.userId] = {}
    }

    connection.room = room.room;
}

function processGuess(connection, guess) {
    const room = rooms[guess.room];

    if (!checkIfGuessAllowed(room, connection.userId)) {
        return;
    }

    submitGuess(room, connection.userId, guess);
}

function disconnectUser(connection) {
    if (connection && connection.room) {
        rooms[connection.room].playerCount--;
    }
    delete connection;
}