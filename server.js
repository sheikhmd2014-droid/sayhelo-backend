const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("SayHello Backend is running");
});

// 🔹 users store
let users = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // register user
  socket.on("join", (username) => {
    users[socket.id] = username;

    io.emit("users", Object.values(users));
  });

  // receive message
  socket.on("message", (msg) => {
    io.emit("message", {
      user: users[socket.id],
      text: msg,
    });
  });

  socket.on("disconnect", () => {
    delete users[socket.id];
    io.emit("users", Object.values(users));
    console.log("User disconnected");
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
