// initialize the map on the "map" div with a given center and zoom
var map = L.map('map', {
    center: [51.505, -0.09],
    zoom: 1,
    zoomControl: false
});

L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
    attribution: '<a href="https://twitter.com/nestyOW">@nestyOW</a> | <a href="https://twitter.com/tman_art">@tman_art</a>',
    maxZoom: 18,
    id: 'mapbox/streets-v11',
    tileSize: 512,
    zoomOffset: -1,
    accessToken: 'pk.eyJ1IjoiaGVyZ2VuZCIsImEiOiJja2xodmV2MnMxcHMyMndwN3N2cDhkdDNtIn0.DiRshwkuxc5PrOdQTz3Xpw'
}).addTo(map);

map.touchZoom.disable();
map.doubleClickZoom.disable();
map.scrollWheelZoom.disable();
map.boxZoom.disable();
map.keyboard.disable();
map.dragging.disable();
let theMarker = {};
let lat;
let lon;
let round;
let seconds;

var mapDiv = document.getElementById('map');
var submitGuess = document.getElementById('submitGuess');
var allowGuess = false;

map.on('click', function (e) {
    if (allowGuess) {
        lat = e.latlng.lat;
        lon = e.latlng.lng;
        submitGuess.disabled = false;
        //Clear existing marker, 

        if (theMarker != undefined) {
            map.removeLayer(theMarker);
        };

        //Add a marker to show where you clicked.
        theMarker = L.marker([lat, lon]).addTo(map);
    }
});

String.prototype.noSlash = function () {
    return this.replace(/\//g, '')
}

const cookie = document.cookie.split('; ').reduce((prev, current) => {
    const [name, value] = current.split('=');
    prev[name] = value;
    return prev
}, {});

var socket = io();
socket.emit('user connect', cookie.userId ?? "create");

socket.on('user connected', function (userId) {
    document.cookie = `userId = ${userId}`;
});

var create = document.getElementById('create');
var start = document.getElementById('startGame');
var input = document.getElementById('input');
var roomField = document.getElementById('roomfield');
var secretField = document.getElementById('secretfield');
var roomName = document.getElementById('roomName');
var gameInfo = document.getElementById('gameInfo');
let rounds;

const path = window.location.pathname;
const joinRoom = path.noSlash();

if (joinRoom) {
    socket.emit('join room', joinRoom);
}

start.addEventListener('click', function (e) {
    console.log(room);
    e.preventDefault();
    if (room) {
        socket.emit('start game', room);
    }
});

submitGuess.addEventListener('click', function (e) {
    e.preventDefault();
    if (room) {
        socket.emit('submit guess', { room: room, lat, lon });
    }
    allowGuess = false;
    submitGuess.disabled = true;
    mapDiv.style.border = "20px solid black";
});

// All listners
socket.on('countdown', function (msg) {
    updateGameInfo(null, msg);
});

socket.on('stats', function (msg) {
    document.getElementById("playerCount").innerHTML = msg.players;
    console.log(msg);
});

socket.on('room joined', function (msg) {
    console.log(msg)
    if (msg.admin && msg.status == 0) {
        start.style.display = "inline-block";
        gameInfo.style.display = "inline-block";
    }
    rounds = msg.rounds;
    if (msg.status) {
        updateGameInfo(msg.currentRound, msg.currentSeconds);
        map.flyTo([msg.lat, msg.lon], msg.zoom)
    }
    if (msg.canGuess) {
        allowGuess = true;
    }

    room = msg.room;
    roomName.innerHTML = "<span class='dot connected'></span>" + msg.roomName;
});

socket.on('redirect', function (msg) {
    location.href = msg;
});

socket.on('round', function (msg) {
    updateGameInfo(msg.round, null);

    map.flyTo([msg.lat, msg.lon], msg.zoom)

    if (theMarker != undefined) {
        map.removeLayer(theMarker);
    };
    allowGuess = true;
    mapDiv.style.border = "20px solid #83F52C";
});

socket.on('finished', function (msg) {
    console.log(msg);
    if (theMarker != undefined) {
        map.removeLayer(theMarker);
    };

    theMarker = L.marker([msg.lat, msg.lon]).addTo(map);
    map.flyTo([msg.lat, msg.lon], 8);
    map.touchZoom.enable();
    map.doubleClickZoom.enable();
    map.scrollWheelZoom.enable();
    map.boxZoom.enable();
    map.keyboard.enable();
    map.dragging.enable();
    start.style.display = "inline-block";
});

socket.on('game started', function (msg) {
    map.flyTo([51.505, -0.09], 1);
    map.touchZoom.disable();
    map.doubleClickZoom.disable();
    map.scrollWheelZoom.disable();
    map.boxZoom.disable();
    map.keyboard.disable();
    map.dragging.disable();
    start.style.display = "none";
    gameInfo.style.display = "block";
    if (theMarker != undefined) {
        map.removeLayer(theMarker);
    };
});


function updateGameInfo(r, s) {
    round = r ?? round;
    seconds = s ?? seconds;
    let string = `Remaining: ${seconds} - Round ${round}/${rounds}`
    gameInfo.innerHTML = string;
}
