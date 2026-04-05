const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

app.use(cors());
app.use(express.json());

let cards = [];

app.get("/api/cards", (req, res) => {
  res.json(cards);
});

app.post("/api/cards", (req, res) => {
  const newCard = { ...req.body, id: Date.now() };
  cards.push(newCard);

  io.emit("card-added", newCard);
  res.status(201).json(newCard);
});

app.put("/api/cards/:id", (req, res) => {
  const id = Number(req.params.id);
  const index = cards.findIndex((c) => c.id === id);

  if (index === -1) {
    return res.status(404).json({ message: "Carte introuvable" });
  }

  cards[index] = { ...cards[index], ...req.body };
  io.emit("card-updated", cards[index]);

  res.json(cards[index]);
});

app.delete("/api/cards/:id", (req, res) => {
  const id = Number(req.params.id);
  cards = cards.filter((c) => c.id !== id);

  io.emit("card-deleted", id);
  res.json({ message: "Supprimé" });
});

server.listen(3000, () => {
  console.log("🚀 API + WebSocket sur 3000");
});
