require("dotenv").config();
const express = require("express");
const app = express();
const http = require("http");
const cors = require("cors");

const { Server } = require("socket.io");

app.use(cors()); // Add cors middleware

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const CHAT_BOT = "ChatBot";

let chatRoom = "";
let allUSers = [];

const harperSaveMessage = require("./services/harper-save-message");
const harperGetMessages = require("./services/harper-get-message");
const leaveRoom = require("./utils/leave-room");

io.on("connection", (socket) => {
  console.log(`User connected ${socket.id}`);

  socket.on("join_room", (data) => {
    const { username, room } = data;
    socket.join(room);

    let __createdtime__ = Date.now();

    socket.to(room).emit("recive_message", {
      message: `${username} has joined the chat room`,
      username: CHAT_BOT,
      __createdtime__,
    });

    socket.emit("recive_message", {
      message: `Welcome ${username}`,
      username: CHAT_BOT,
      __createdtime__,
    });

    chatRoom = room;

    allUSers.push({
      id: socket.id,
      username,
      room,
    });

    chatRoomUsers = allUSers.filter((user) => user.room === room);

    socket.to(room).emit("chatroom_users", chatRoomUsers);

    socket.emit("chatroom_users", chatRoomUsers);

    socket.on('send_message', (data) => {
      const { message, username, room, __createdtime__ } = data;
      io.in(room).emit('receive_message', data); // Send to all users in room, including sender
      harperSaveMessage(message, username, room, __createdtime__) // Save message in db
        .then((response) => console.log(response))
        .catch((err) => console.log(err));
    });

    harperGetMessages(room)
    .then((last100Messages) => {
      // console.log('latest message', last100Messages);
      socket.emit('last_100_messages', last100Messages)
    })
    .catch((err) => console.log(err))
    
  });

  socket.on('leave_room', (data) => {
    const {username, room} = data;
    socket.leave(room);
    const __createdtime__ = Date.now();

    // remove user from memory
    allUSers = leaveRoom(socket.id, allUSers);
    socket.to(room).emit('chatroom_users', allUSers);
    socket.to(room).emit('recive_message', {
      username: CHAT_BOT,
      message: `${username} has left the chat`,
      __createdtime__,
    });
    console.log(`${username} has left the chat`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected from the chat');
    const user = allUSers.find((user) => user.id == socket.id);
    if (user?.username) {
      allUSers = leaveRoom(socket.id, allUSers);
      socket.to(chatRoom).emit('chatroom_users', allUSers);
      socket.to(chatRoom).emit('recive_message', {
        message: `${user.username} has disconnected from the chat`,
      })
    }
  })
});

server.listen(4000, () => "Server is running on port 3000");
