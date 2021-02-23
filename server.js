const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
var async = require('async');
const port = process.env.PORT || 3000;
let users = {};
let rooms = {};

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/create.html');
});
app.get('/*', (req, res) => {
    res.sendFile(__dirname + '/play.html');
});

function stats(room){
    async.whilst(
        function (callbackFunction) {
            let counter = 0;
            // start loop
            // loopStartTime = Date.now();
            callbackFunction(null, counter >= 0);
        },
        function (callback) {
            io.to(room).emit("stats", {
                players: Object.keys(rooms[room].players).length
            })
            setTimeout(callback, 1000);
        }
    )
}

function gameLoop(room, duration, round) {
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

            // end loop
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
                    io.to(room).emit("finished", {
                        round,
                        lat: rooms[room].lat,
                        lon: rooms[room].lon,
                        zoom: rooms[room].zooms[round]
                    });
                    return
                }

                let totalLat = 0;
                let totalLon = 0;
                if(rooms[room].guesses[round].length){
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
            console.log(rooms[room].currentSeconds, round)
            setTimeout(callback, waitTime);
        }
    )
}

io.on('connection', (socket) => {
    console.log("socket " + socket.id + " connected");
    users[socket.id] = {};

    socket.on('user connect', id => {
        if (id === "create") {
            id = makeid(24);
        }
        users[socket.id].userId = id;
        socket.emit("user connected", users[socket.id].userId);
        console.log("user " + users[socket.id].userId + " connected");
    });

    socket.on('create room', options => {
        console.log('create room ' + JSON.stringify(options));
        let room = makeid(5);
        while (rooms[room]) {
            room = makeid(5);
        }
        console.log(rooms)
        const secret = makeid(24);
        const rounds = parseInt(options.rounds);
        const duration = parseInt(options.duration);
        rooms[room] = {
            room,
            status: 0,
            admin: users[socket.id].userId,
            secret,
            rounds,
            currentRound: 0,
            currentSeconds: duration,
            guesses: {},
            zooms: options.zooms,
            duration,
            players: {},
            lat: 51.505,
            lon: -0.09
        };

        socket.emit("room created", rooms[room]);
        stats(room);
    });

    socket.on('start game', room => {
        if (users[socket.id].userId !== rooms[room].admin || rooms[room].status) {
            return
        }
        rooms[room].status = 1;
        console.log("game started");
        socket.emit("game started", true)
        gameLoop(room, rooms[room].duration, 1);
    });

    socket.on('join room', room => {
        if (rooms[room] == undefined) {
            socket.emit("redirect", "/")
            return
        }
        console.log(rooms[room]);
        if(rooms[room].players[users[socket.id].userId] == undefined){
            rooms[room].players[users[socket.id].userId] = {}
        }

        rooms[room]
        users[socket.id].room = room;
        socket.join(room);
        let canGuess = false;
        if(rooms[room].status && !rooms[room].players[users[socket.id].userId][rooms[room].currentRound]){
            canGuess = true;
        }
        socket.emit("room joined", { 
            room, 
            rounds: rooms[room].rounds, 
            duration: rooms[room].duration, 
            roomName: rooms[room].roomName ?? "WHOMEGALUL", 
            admin: (users[socket.id].userId === rooms[room].admin),
            status: rooms[room].status,
            currentRound: rooms[room].currentRound,
            currentSeconds: rooms[room].currentSeconds,
            canGuess
         })
        console.log("user joined " + room);
    });

    socket.on('submit guess', guess => {
        console.log("guessed");
        console.log(rooms[guess.room]);

        if(!rooms[guess.room].status || rooms[guess.room].players[users[socket.id].userId][rooms[guess.room].currentRound]){
            console.log("could not guess");
            return;
        }

        rooms[guess.room].guesses[rooms[guess.room].currentRound].push({ lat: guess.lat, lon: guess.lon })
        rooms[guess.room].players[users[socket.id].userId][rooms[guess.room].currentRound] = true;
    });

    socket.on("disconnect", (reason) => {
        console.log(socket.id + " disconnected");
        console.log(users[socket.id].room);
        if(users[socket.id] && users[socket.id].room){
            // delete rooms[users[socket.id].room].players[socket.id]
        }
        delete users[socket.id];
    });

});

http.listen(port, () => {
    console.log(`Socket.IO server running at http://localhost:${port}/`);
});

function makeid(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}