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

/* ✅ VERY IMPORTANT ROOT ROUTE */
app.get("/", (req, res) => {
  res.status(200).send("SayHello Backend is running 🚀");
});

/* Socket.io */
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("send_message", (data) => {
    socket.broadcast.emit("receive_message", data);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

/* ✅ Render PORT */
const PORT = process.env.PORT || 10000;
server.listen(PORT, "0.0.0.0", () => {
 console.log(Server running on port ${PORT}');
});
