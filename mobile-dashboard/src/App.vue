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
h2 {
  color: black;
}

button {
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  margin-bottom: 16px;
}
button:hover {
  background: #0056b3;
}
.container {
  padding: 16px;
}

.layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.card {
  padding: 16px;
  background: #f3f3f3;
  border-radius: 10px;
}

/* Responsive */
@media (min-width: 768px) {
  .layout {
    grid-template-columns: 2fr 1fr;
  }
}
</style>
