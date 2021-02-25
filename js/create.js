 // Global
 let room;
 const socket = io();
 const cookie = getCookie();

 // DOM 
 const create = document.getElementById('create');
 const roundsInput = document.getElementById('roundsInput');
 const durationInput = document.getElementById('durationInput');
 const roomField = document.getElementById('roomfield');
 const roomName = document.getElementById('roomName');

 // Emits
 socket.emit('user connect', cookie.userId ?? "create");

 create.addEventListener('click', function (e) {
     e.preventDefault();
     const rounds = roundsInput.value;
     const duration = durationInput.value;
     const zooms = { 1: 1, 2: 3, 3: 5, 4: 7, 5: 9 };
     socket.emit('create room', { rounds, duration, zooms, roomName: roomName.value });
 });

 // Absorbs
 socket.on('room created', function (msg) {
     room = msg;
     roomField.value = room.room;
 });

 socket.on('user connected', function (userId) {
     document.cookie = `userId = ${userId}`;
 });

 //Functions
 function goToRoom() {
     if (room && room.room) {
         location.href = "/" + room.room;
     }
 }

 function getCookie() {
     return document.cookie.split('; ').reduce((prev, current) => {
         const [name, value] = current.split('=');
         prev[name] = value;
         return prev
     }, {});
 }