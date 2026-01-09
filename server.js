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

/* ROOT ROUTE */
app.get("/", (req, res) => {
  res.send("SayHello Backend is running 🚀");
});

/* SOCKET LOGIC */
let onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  socket.on("join", (username) => {
    onlineUsers.set(socket.id, username);
    io.emit("online-users", Array.from(onlineUsers.values()));
  });

  socket.on("send-message", (data) => {
    io.emit("receive-message", data);
  });

  socket.on("disconnect", () => {
    onlineUsers.delete(socket.id);
    io.emit("online-users", Array.from(onlineUsers.values()));
    console.log("🔴 User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(✅ Server running on port ${PORT});
});
