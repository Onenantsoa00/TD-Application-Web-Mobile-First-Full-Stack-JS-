<script setup>
import { ref, onMounted } from "vue";

const cards = ref([]);

const fetchData = async () => {
  const res = await fetch("http://localhost:3000/api/data");
  const data = await res.json();
  cards.value = data;
};

onMounted(fetchData);
</script>

<template>
  <div class="container">
    <h1>Dashboard</h1>

    <button @click="fetchData">Refresh</button>

    <div class="layout">
      <div v-for="(card, index) in cards" :key="index" class="card">
        <h2>{{ card.title }}</h2>
        <p>{{ card.content }}</p>
      </div>
    </div>
  </div>
</template>

<style>
/* Palette de gris moderne */
:root {
  --primary: #444;
  --secondary: #888;
  --background: #f5f5f5;
  --card-bg: #e0e0e0;
  --hover: #d1d1d1;
  --text: #222;
  --accent: #bdbdbd;
}

body,
.container {
  background: var(--background);
  color: var(--text);
  font-family: "Segoe UI", "Roboto", Arial, sans-serif;
  min-height: 100vh;
}

h1 {
  color: var(--primary);
  font-size: 2.2rem;
  margin-bottom: 24px;
  letter-spacing: 1px;
}

h2 {
  color: var(--primary);
  font-size: 1.3rem;
  margin-bottom: 8px;
}

button {
  padding: 10px 22px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 7px;
  cursor: pointer;
  margin-bottom: 22px;
  font-size: 1rem;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(68, 68, 68, 0.08);
  transition: background 0.2s, box-shadow 0.2s, transform 0.1s;
}
button:hover {
  background: var(--hover);
  color: var(--primary);
  box-shadow: 0 4px 16px rgba(68, 68, 68, 0.12);
  transform: translateY(-2px) scale(1.03);
}

.container {
  padding: 32px 16px;
  max-width: 700px;
  margin: 0 auto;
  border-radius: 18px;
  background: var(--background);
  box-shadow: 0 2px 16px rgba(68, 68, 68, 0.07);
}

.layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 22px;
}

.card {
  padding: 22px 18px;
  background: var(--card-bg);
  border-radius: 14px;
  box-shadow: 0 2px 8px rgba(68, 68, 68, 0.06);
  transition: background 0.2s, box-shadow 0.2s, transform 0.1s;
  border: 1px solid var(--accent);
}
.card:hover {
  background: var(--hover);
  box-shadow: 0 6px 24px rgba(68, 68, 68, 0.13);
  transform: translateY(-3px) scale(1.01);
}

.card p {
  color: var(--secondary);
  font-size: 1.05rem;
  margin: 0;
}

/* Responsive */
@media (min-width: 768px) {
  .layout {
    grid-template-columns: 2fr 1fr;
  }
}
</style>
