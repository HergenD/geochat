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
app.get('/style', (req, res) => {
    res.sendFile(__dirname + '/css/style.css');
});
app.get('/js/create', (req, res) => {
    res.sendFile(__dirname + '/js/create.js');
});
app.get('/js/play', (req, res) => {
    res.sendFile(__dirname + '/js/play.js');
});
app.get('/*', (req, res) => {
    res.sendFile(__dirname + '/play.html');
});

// Websocket connection router
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

function initializeGameLoop(room) {
    room.currentRound = 1;
    room.gameRunning = true;
    io.to(room.room).emit("round", {
        round: room.currentRound,
        lat: 51.505,
        lon: -0.09,
        zoom: room.zooms[room.currentRound]
    });
}

function calculateAverageLatLon(room) {
    let totalLat = 0;
    let totalLon = 0;
    const round = room.currentRound;

    for (let i = 0; i < room.guesses[round].length; i++) {
        totalLat += room.guesses[round][i].lat
        totalLon += room.guesses[round][i].lon
    }

    if (room.guesses[round].length) {
        room.lat = totalLat / room.guesses[round].length;
        room.lon = totalLon / room.guesses[round].length;
    }
}

function resetRoom(room) {
    room.gameRunning = false;
    for (let i = 0; i < Object.keys(room.players).length; i++) {
        room.players[Object.keys(room.players)[i]] = {};
    }
    room.guesses = {};

    room.currentRound = 0;
    room.currentSeconds = room.duration;
}

function checkIfLastRound(room) {
    if (room.currentRound < room.rounds) {
        return false;
    }
    
    calculateAverageLatLon(room);

    io.to(room.room).emit("finished", {
        round: room.currentRound,
        lat: room.lat,
        lon: room.lon,
        zoom: room.zooms[room.currentRound]
    });

    resetRoom(room);

    return true;
}

function roundEnd(room) {
    room.currentSeconds = room.duration + 1
    calculateAverageLatLon(room);

    room.currentRound++;

    io.to(room.room).emit("round", {
        round: room.currentRound,
        lat: room.lat,
        lon: room.lon,
        zoom: room.zooms[room.currentRound]
    });
    return true;
}

function roundStart(room) {
    room.guesses[room.currentRound] = [];
}

function startGameLoop(roomId) {
    const room = rooms[roomId];
    initializeGameLoop(room)

    async.whilst(
        function (cb) {
            cb(null, room.currentSeconds >= 0);
        },
        function (callback) {

            io.to(roomId).emit("countdown", room.currentSeconds);

            let waitTime = 1000;

            switch (room.currentSeconds) {
                case 0:
                    if (checkIfLastRound(room)) {
                        return;
                    }
                    roundEnd(room);
                    break;
                case 1:
                    waitTime += 1000;
                    break;
                case room.duration:
                    roundStart(room);
                    break;
            }

            room.currentSeconds--;
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
    let roomId = makeid(5);
    while (rooms[roomId]) {
        roomId = makeid(5);
    }
    return roomId;
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
        canGuess,
        lat: room.lat,
        lon: room.lon,
        zoom: room.zooms[room.currentRound]
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