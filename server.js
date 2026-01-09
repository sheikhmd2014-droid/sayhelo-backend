const express = require("express");

const app = express();

// Root route (IMPORTANT for Render)
app.get("/", (req, res) => {
  res.send("SayHello Backend is running");
});

// Port (Render automatically provides PORT)
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
