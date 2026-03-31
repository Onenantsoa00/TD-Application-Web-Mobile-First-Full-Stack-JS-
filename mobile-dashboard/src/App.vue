<script setup>
import { ref, onMounted } from "vue";

const cards = ref([]);
const newTitle = ref("");
const newContent = ref("");
const editingId = ref(null);
let db;

// Initialiser IndexedDB
const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("DashboardDB", 1);

    request.onupgradeneeded = (event) => {
      db = event.target.result;
      db.createObjectStore("cards", { keyPath: "id", autoIncrement: true });
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };

    request.onerror = (event) => reject(event);
  });
};

// Sauvegarder données
const saveToDB = (data) => {
  const tx = db.transaction("cards", "readwrite");
  const store = tx.objectStore("cards");

  store.clear(); // éviter doublons
  data.forEach((item) => store.add(item));
};

// Lire données
const getFromDB = () => {
  return new Promise((resolve) => {
    const tx = db.transaction("cards", "readonly");
    const store = tx.objectStore("cards");
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
  });
};

// Fetch + fallback offline
const fetchData = async () => {
  try {
    const res = await fetch("http://localhost:3000/api/cards");
    const data = await res.json();

    cards.value = data;
    saveToDB(data);

    console.log(" Données depuis API");
  } catch (error) {
    console.log(" Offline → chargement depuis IndexedDB");

    const localData = await getFromDB();
    cards.value = localData;
  }
};

// Ajouter une carte
const addCard = async () => {
  if (!newTitle.value.trim() || !newContent.value.trim()) {
    alert("Veuillez remplir le titre et la description");
    return;
  }

  await fetch("http://localhost:3000/api/cards", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: newTitle.value,
      content: newContent.value,
    }),
  });

  newTitle.value = "";
  newContent.value = "";
  fetchData();
};

// Supprimer une carte
const deleteCard = async (id) => {
  await fetch(`http://localhost:3000/api/cards/${id}`, {
    method: "DELETE",
  });

  fetchData();
};

// Démarrer l'édition
const startEdit = (card) => {
  editingId.value = card.id;
  newTitle.value = card.title;
  newContent.value = card.content;
};

// Annuler l'édition
const cancelEdit = () => {
  editingId.value = null;
  newTitle.value = "";
  newContent.value = "";
};

// Modifier une carte
const updateCard = async (id) => {
  if (!newTitle.value.trim() || !newContent.value.trim()) {
    alert("Veuillez remplir le titre et la description");
    return;
  }

  await fetch(`http://localhost:3000/api/cards/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: newTitle.value,
      content: newContent.value,
    }),
  });

  editingId.value = null;
  newTitle.value = "";
  newContent.value = "";
  fetchData();
};

//  Au démarrage
onMounted(async () => {
  await initDB();
  fetchData();
});
</script>

<template>
  <div class="container">
    <h1>Dashboard</h1>

    <div class="header-actions">
      <button @click="fetchData">Refresh</button>
    </div>

    <!-- Formulaire d'ajout -->
    <div class="form-section">
      <h3>➕ Ajouter une nouvelle carte</h3>
      <input
        v-model="newTitle"
        type="text"
        placeholder="Titre de la carte"
        class="input-field"
      />
      <textarea
        v-model="newContent"
        placeholder="Description de la carte..."
        class="input-field"
      ></textarea>
      <button @click="addCard" class="add-btn">Ajouter une carte</button>
    </div>

    <div class="layout">
      <!-- Mode édition -->
      <div v-if="editingId" class="edit-form">
        <h3>✏️ Modifier la carte</h3>
        <input v-model="newTitle" type="text" class="input-field" />
        <textarea v-model="newContent" class="input-field"></textarea>
        <div class="button-group">
          <button @click="updateCard(editingId)" class="save-btn">
            💾 Enregistrer
          </button>
          <button @click="cancelEdit" class="cancel-btn">✕ Annuler</button>
        </div>
      </div>

      <!-- Affichage des cartes -->
      <div v-for="(card, index) in cards" :key="index" class="card">
        <div class="card-header">
          <div>
            <h2>{{ card.title }}</h2>
            <p>{{ card.content }}</p>
          </div>
          <div class="card-actions">
            <button class="edit-btn" @click="startEdit(card)" title="Modifier">
              ✎
            </button>
            <button
              class="delete-btn"
              @click="deleteCard(card.id)"
              title="Supprimer"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      <!-- Message vide -->
      <div
        v-if="cards.length === 0 && !editingId"
        style="grid-column: 1 / -1; text-align: center; padding: 40px 20px"
      >
        <p style="color: var(--secondary); font-size: 1.1rem">
          Aucune carte pour le moment. Commencez par en ajouter une ! 🚀
        </p>
      </div>
    </div>
  </div>
</template>

<style>
/* Palette moderne */
:root {
  --primary: #2563eb;
  --primary-dark: #1e40af;
  --secondary: #64748b;
  --background: #f8fafc;
  --card-bg: #ffffff;
  --border: #e2e8f0;
  --text: #1e293b;
  --text-light: #64748b;
  --success: #16a34a;
  --danger: #dc2626;
  --warning: #ea580c;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body,
html {
  background: var(--background);
  color: var(--text);
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu,
    Cantarell, sans-serif;
  min-height: 100vh;
}

.container {
  padding: 40px 20px;
  max-width: 900px;
  margin: 0 auto;
}

h1 {
  color: var(--primary);
  font-size: 2.5rem;
  margin-bottom: 32px;
  font-weight: 700;
  text-align: center;
  letter-spacing: -0.5px;
}

h2 {
  color: var(--text);
  font-size: 1.25rem;
  margin-bottom: 8px;
  font-weight: 600;
}

h3 {
  color: var(--primary);
  font-size: 1.125rem;
  margin-bottom: 16px;
  font-weight: 600;
}

/* Bouton principal */
button {
  padding: 12px 24px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.2);
  transition: all 0.3s ease;
}

button:hover {
  background: var(--primary-dark);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
  transform: translateY(-2px);
}

button:active {
  transform: translateY(0);
}

/* Inputs et Textarea */
.input-field {
  width: 100%;
  padding: 12px 16px;
  background: var(--card-bg);
  color: var(--text);
  border: 2px solid var(--border);
  border-radius: 8px;
  font-size: 0.95rem;
  font-family: inherit;
  transition: all 0.3s ease;
  margin-bottom: 16px;
}

.input-field:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  background: #ffffff;
}

.input-field::placeholder {
  color: var(--secondary);
}

textarea.input-field {
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
}

/* Formulaire d'ajout */
.form-section {
  background: var(--card-bg);
  padding: 28px;
  border-radius: 12px;
  border: 2px solid var(--border);
  margin-bottom: 32px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.form-section h3 {
  margin-bottom: 24px;
  color: var(--primary);
}

.add-btn {
  width: 100%;
  background: var(--primary);
  color: white;
  padding: 14px;
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}

.add-btn:hover {
  background: var(--primary-dark);
}

/* Formulaire d'édition */
.edit-form {
  background: var(--card-bg);
  padding: 28px;
  border-radius: 12px;
  border: 2px solid var(--primary);
  margin-bottom: 28px;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
}

.button-group {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.save-btn {
  background: var(--success);
  flex: 1;
  max-width: 200px;
}

.save-btn:hover {
  background: #15803d;
  box-shadow: 0 4px 12px rgba(22, 163, 74, 0.3);
}

.cancel-btn {
  background: var(--secondary);
  flex: 1;
  max-width: 200px;
}

.cancel-btn:hover {
  background: #475569;
  box-shadow: 0 4px 12px rgba(100, 116, 139, 0.3);
}

/* Header avec Refresh */
.header-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 32px;
}

.header-actions button {
  flex: 1;
  background: var(--secondary);
}

.header-actions button:hover {
  background: #475569;
  box-shadow: 0 4px 12px rgba(100, 116, 139, 0.3);
}

/* Layout des cartes */
.layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

.card {
  background: var(--card-bg);
  padding: 24px;
  border-radius: 12px;
  border: 1px solid var(--border);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.card:hover {
  border-color: var(--primary);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
  transform: translateY(-4px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.card-header > div {
  flex: 1;
}

.card p {
  color: var(--text-light);
  font-size: 0.95rem;
  line-height: 1.6;
  margin: 0;
}

.card-actions {
  display: flex;
  gap: 8px;
}

.edit-btn {
  padding: 8px 12px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.3s ease;
  margin: 0;
  box-shadow: 0 1px 3px rgba(37, 99, 235, 0.2);
}

.edit-btn:hover {
  background: var(--primary-dark);
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
  transform: scale(1.05);
}

.delete-btn {
  padding: 8px 12px;
  background: var(--danger);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.3s ease;
  margin: 0;
  box-shadow: 0 1px 3px rgba(220, 38, 38, 0.2);
}

.delete-btn:hover {
  background: #b91c1c;
  box-shadow: 0 2px 6px rgba(220, 38, 38, 0.3);
  transform: scale(1.05);
}

/* Responsive */
@media (max-width: 640px) {
  .container {
    padding: 20px 16px;
  }

  h1 {
    font-size: 2rem;
    margin-bottom: 24px;
  }

  .form-section {
    padding: 20px;
  }

  .button-group {
    flex-direction: column;
  }

  .save-btn,
  .cancel-btn {
    max-width: none;
  }

  .card {
    padding: 16px;
  }

  .input-field {
    font-size: 16px; /* Prevents zoom on iOS */
  }
}

@media (min-width: 768px) {
  .layout {
    grid-template-columns: repeat(2, 1fr);
    gap: 24px;
  }

  .form-section {
    grid-column: 1 / -1;
  }
}

@media (min-width: 1024px) {
  .layout {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
