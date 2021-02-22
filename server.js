const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
var async = require('async');
const port = process.env.PORT || 3000;
let users = {};
let rooms = {};

app.get('*', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

function gameLoop(room, duration, round){
    io.to(room).emit("round", round);
    counter = duration;
    async.whilst(
        function (callbackFunction) {
            // start loop
            loopStartTime = Date.now();
            callbackFunction(null, counter >= 0);
        },
        function (callback) {
            //logic
            io.to(room).emit("countdown", counter);
            // end loop
            counter--;
            loopEndTime = Date.now();
            waitTime = 1000 - (loopEndTime - loopStartTime);
            if(counter === 0){
                if(round < rooms.room.rounds){
                    counter = duration
                } else {
                    io.to(room).emit("finished", "finished");
                    return
                }
                round++;
                io.to(room).emit("round", round);
            }
            setTimeout(callback, waitTime);
        }
    )
 }

io.on('connection', (socket) => {

    users[socket.id] = {};
    socket.on('create room', room => {
        room = makeid(5);
        while (rooms.room){
            room = makeid(5);
        }
        const secret = makeid(24);
        const rounds = 2;
        rooms.room = {
            room,
            status: 0,
            admin: socket.id,
            secret,
            rounds
        };

        socket.emit("room created", rooms.room);

        socket.join(room);
    });

    socket.on('start game', room => {
        if(socket.id !== rooms.room.admin){
            socket.emit("error", "You are not the admin of this room")
            console.log("You are not the admin of this room")
            return
        }

        console.log(gameLoop(room, 10, 1));
    });

    socket.on('join room', room => {
        users[socket.id].room = room;
        socket.join(room);
        console.log("user joined " + room);
        console.log(rooms.room)
    });

    socket.on('chat message', msg => {
        io.to(users[socket.id].room).emit('chat message', msg);
    });

    // socket.on("disconnect", (reason) => {
    //     delete users[socket.id];
    // });

});

http.listen(port, () => {
    console.log(`Socket.IO server running at http://localhost:${port}/`);
});

function makeid(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
       result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
 }