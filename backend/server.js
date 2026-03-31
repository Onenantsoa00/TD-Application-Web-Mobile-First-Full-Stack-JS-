const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json()); // important pour POST

// "base de données" temporaire
let cards = [
  { id: 1, title: "Carte 1", content: "Contenu mobile-first" },
  { id: 2, title: "Carte 2", content: "Données depuis Node.js" },
  { id: 3, title: "Carte 3", content: "Stockage IndexedDB" },
];

// GET → récupérer toutes les cartes
app.get("/api/cards", (req, res) => {
  res.json(cards);
});

// POST → ajouter une carte
app.post("/api/cards", (req, res) => {
  const newCard = {
    id: Date.now(),
    title: req.body.title,
    content: req.body.content,
  };

  cards.push(newCard);
  res.status(201).json(newCard);
});

// DELETE → supprimer une carte
app.delete("/api/cards/:id", (req, res) => {
  const id = parseInt(req.params.id);
  cards = cards.filter((card) => card.id !== id);

  res.json({ message: "Carte supprimée" });
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
