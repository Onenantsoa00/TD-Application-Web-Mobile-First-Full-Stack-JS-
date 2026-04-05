<script setup>
import { ref, onMounted, nextTick } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { io } from "socket.io-client";

const cards = ref([]);
const newTitle = ref("");
const newContent = ref("");
const editingId = ref(null);
let db;

const isOnline = ref(navigator.onLine);
const isSyncing = ref(false);
const locationText = ref("Position inconnue");
const weatherText = ref("Météo inconnue");
let map = null;
const socket = io("http://localhost:3000");

const getLocation = () => {
  if (!navigator.geolocation) {
    locationText.value = "GPS non supporté";
    return;
  }

  navigator.geolocation.getCurrentPosition(async (position) => {
    const { latitude, longitude } = position.coords;

    locationText.value = `📍 ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

    await nextTick();
    initMap(latitude, longitude);
    fetchWeather(latitude, longitude);
  });
};

const initMap = (lat, lng) => {
  if (map) {
    map.remove();
  }

  map = L.map("map").setView([lat, lng], 13);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);

  L.marker([lat, lng])
    .addTo(map)
    .bindPopup("📍 Position du technicien")
    .openPopup();
};

const fetchWeather = async (lat, lng) => {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code`,
    );

    const data = await res.json();

    weatherText.value = `🌤️ ${data.current.temperature_2m}°C`;
  } catch {
    weatherText.value = "🌧️ météo indisponible";
  }
};

socket.on("card-added", (card) => {
  const exists = cards.value.some((c) => String(c.id) === String(card.id));
  if (!exists) cards.value.push(card);
});

socket.on("card-updated", (updated) => {
  const index = cards.value.findIndex(
    (c) => String(c.id) === String(updated.id),
  );
  if (index !== -1) cards.value[index] = updated;
});

socket.on("card-deleted", (id) => {
  cards.value = cards.value.filter((c) => String(c.id) !== String(id));
});

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("DashboardDB", 1);

    request.onupgradeneeded = (event) => {
      db = event.target.result;

      if (!db.objectStoreNames.contains("cards")) {
        if (!db.objectStoreNames.contains("cards")) {
          db.createObjectStore("cards", { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains("pending")) {
          db.createObjectStore("pending", {
            keyPath: "id",
            autoIncrement: true,
          });
        }
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve();
    };

    request.onerror = reject;
  });
};

const waitForRequest = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const waitForTransaction = (tx) =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error || new Error("IndexedDB transaction aborted"));
  });

const syncPendingChanges = async () => {
  isSyncing.value = true;

  try {
    const pendingActions = await new Promise((resolve, reject) => {
      const tx = db.transaction(["pending"], "readonly");
      const store = tx.objectStore("pending");
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    for (const action of pendingActions) {
      try {
        if (action.type === "add") {
          const res = await fetch("http://localhost:3000/api/cards", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(action.data),
          });

          const savedCard = await res.json();

          const tx2 = db.transaction("cards", "readwrite");
          const store2 = tx2.objectStore("cards");
          store2.delete(action.data.id);
          store2.put(savedCard);
          await waitForTransaction(tx2);

          cards.value = cards.value.filter((c) => c.id !== action.data.id);
          if (!cards.value.some((c) => c.id === savedCard.id)) {
            cards.value.push(savedCard);
          }
        }

        if (action.type === "update") {
          await fetch(`http://localhost:3000/api/cards/${action.data.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(action.data),
          });
        }

        if (action.type === "delete") {
          await fetch(`http://localhost:3000/api/cards/${action.data.id}`, {
            method: "DELETE",
          });
        }

        const tx3 = db.transaction(["pending"], "readwrite");
        const store3 = tx3.objectStore("pending");
        store3.delete(action.id);
        await waitForTransaction(tx3);
      } catch (error) {
        console.log("Toujours offline", error);
        break;
      }
    }

    await fetchData();
  } finally {
    isSyncing.value = false;
  }
};

const saveToDB = (data) => {
  const tx = db.transaction("cards", "readwrite");
  const store = tx.objectStore("cards");

  store.clear();
  data.forEach((item) => store.put(item));
};

const getFromDB = () => {
  return new Promise((resolve) => {
    const tx = db.transaction("cards", "readonly");
    const store = tx.objectStore("cards");
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
  });
};

const fetchData = async () => {
  try {
    const res = await fetch("http://localhost:3000/api/cards");
    const apiData = await res.json();

    const localData = await getFromDB();
    const tempCards = localData.filter(
      (card) => typeof card.id === "string" && card.id.startsWith("temp-"),
    );

    const merged = [...apiData];

    tempCards.forEach((tempCard) => {
      if (!merged.some((c) => String(c.id) === String(tempCard.id))) {
        merged.push(tempCard);
      }
    });

    cards.value = merged;
    saveToDB(merged);

    console.log("✅ API + fusion local");
  } catch {
    console.log("⚠️ Offline → IndexedDB");
    cards.value = await getFromDB();
  }
};

const addCard = async () => {
  const newCard = {
    id: "temp-" + Date.now(),
    title: newTitle.value,
    content: newContent.value,
  };

  try {
    await fetch("http://localhost:3000/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCard),
    });

    await fetchData();
  } catch {
    const tx = db.transaction(["cards", "pending"], "readwrite");

    tx.objectStore("cards").put(newCard);

    tx.objectStore("pending").add({
      type: "add",
      data: newCard,
    });

    cards.value.push(newCard);
  }

  newTitle.value = "";
  newContent.value = "";
};

const updateCard = async (id) => {
  const updatedCard = {
    id,
    title: newTitle.value,
    content: newContent.value,
  };

  try {
    await fetch(`http://localhost:3000/api/cards/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedCard),
    });

    await fetchData();
  } catch {
    const tx = db.transaction(["cards", "pending"], "readwrite");

    tx.objectStore("cards").put(updatedCard);
    tx.objectStore("pending").add({
      type: "update",
      data: updatedCard,
    });

    const index = cards.value.findIndex((c) => c.id === id);
    if (index !== -1) cards.value[index] = updatedCard;
  }

  cancelEdit();
};

const deleteCard = async (id) => {
  try {
    await fetch(`http://localhost:3000/api/cards/${id}`, {
      method: "DELETE",
    });

    await fetchData();
  } catch {
    const tx = db.transaction(["cards", "pending"], "readwrite");

    tx.objectStore("cards").delete(id);
    tx.objectStore("pending").add({
      type: "delete",
      data: { id },
    });

    cards.value = cards.value.filter((card) => card.id !== id);
  }
};

const startEdit = (card) => {
  editingId.value = card.id;
  newTitle.value = card.title;
  newContent.value = card.content;
};

const cancelEdit = () => {
  editingId.value = null;
  newTitle.value = "";
  newContent.value = "";
};

const updateNetworkStatus = () => {
  isOnline.value = navigator.onLine;
};
onMounted(async () => {
  await initDB();
  await fetchData();
  getLocation();

  window.addEventListener("online", async () => {
    isOnline.value = true;
    await syncPendingChanges();
  });

  window.addEventListener("offline", () => {
    isOnline.value = false;
  });

  if (isOnline.value) {
    await syncPendingChanges();
  }
});
</script>

<template>
  <div class="container">
    <h1>Dashboard</h1>

    <div class="status-bar">
      <span :class="isOnline ? 'badge online' : 'badge offline'">
        {{ isOnline ? "🟢 Online" : "🔴 Offline" }}
      </span>

      <span class="badge sync" v-if="isSyncing"> 🔄 Synchronisation... </span>

      <span class="badge location">
        {{ locationText }}
      </span>

      <span class="badge weather">
        {{ weatherText }}
      </span>
    </div>

    <div id="map" class="map-box"></div>

    <div class="header-actions">
      <button @click="fetchData">Refresh</button>
    </div>

    <!-- Formulaire d'ajout -->
    <div v-if="!editingId" class="form-section">
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
      <div v-for="card in cards" :key="card.id" class="card">
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
          Aucune carte pour le moment. Commencez par en ajouter une !
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

.status-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
}

.badge {
  padding: 8px 12px;
  border-radius: 999px;
  font-size: 0.9rem;
  font-weight: 600;
}

.online {
  background: #dcfce7;
}

.offline {
  background: #fee2e2;
}

.sync {
  background: #dbeafe;
}

.location {
  background: #f1f5f9;
}

.weather {
  background: #eef2ff;
}

.map-box {
  width: 100%;
  min-height: 320px;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid var(--border);
  margin-bottom: 24px;
}

#map {
  width: 100%;
  height: 100%;
  min-height: 320px;
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
