// IndexedDB persistence: settings, favorites, ratings, logged meals (incl. photo
// blobs) and the nutrition knowledge graph (nodes + edges).

const DB_NAME = "kitchen-recipes";
const DB_VERSION = 1;
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      if (!db.objectStoreNames.contains("meals")) db.createObjectStore("meals", { keyPath: "id" });
      if (!db.objectStoreNames.contains("nodes")) db.createObjectStore("nodes", { keyPath: "id" });
      if (!db.objectStoreNames.contains("edges")) db.createObjectStore("edges", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(db, store, mode, run) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const result = run(t.objectStore(store));
    t.oncomplete = () => resolve(result && "result" in result ? result.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

function getAll(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---------- key/value (settings, favorites, ratings) ----------

export async function kvGet(key, fallback = null) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction("kv").objectStore("kv").get(key);
    req.onsuccess = () => resolve(req.result === undefined ? fallback : req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function kvSet(key, value) {
  const db = await openDB();
  await tx(db, "kv", "readwrite", (s) => s.put(value, key));
}

export async function getFavorites() {
  return new Set(await kvGet("favorites", []));
}

export async function toggleFavorite(recipeId) {
  const favs = await getFavorites();
  const on = !favs.has(recipeId);
  if (on) favs.add(recipeId); else favs.delete(recipeId);
  await kvSet("favorites", [...favs]);
  return on;
}

export async function getRatings() {
  return kvGet("ratings", {});
}

export async function setRating(recipeId, stars) {
  const ratings = await getRatings();
  if (stars > 0) ratings[recipeId] = stars; else delete ratings[recipeId];
  await kvSet("ratings", ratings);
}

// ---------- meals ----------

export async function addMeal(meal) {
  const db = await openDB();
  await tx(db, "meals", "readwrite", (s) => s.put(meal));
  return meal.id;
}

export async function getMeals() {
  const db = await openDB();
  const meals = await new Promise((resolve, reject) => {
    const t = db.transaction("meals");
    getAll(t.objectStore("meals")).then(resolve, reject);
  });
  return meals.sort((a, b) => b.ts - a.ts);
}

export async function deleteMeal(id) {
  const db = await openDB();
  await tx(db, "meals", "readwrite", (s) => s.delete(id));
}

// ---------- graph ----------

export async function putGraph(nodes, edges) {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const t = db.transaction(["nodes", "edges"], "readwrite");
    const ns = t.objectStore("nodes");
    const es = t.objectStore("edges");
    nodes.forEach((n) => ns.put(n));
    edges.forEach((e) => es.put(e));
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });
}

export async function getGraph() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(["nodes", "edges"]);
    Promise.all([getAll(t.objectStore("nodes")), getAll(t.objectStore("edges"))])
      .then(([nodes, edges]) => resolve({ nodes, edges }), reject);
  });
}

export async function deleteGraphItems(nodeIds, edgeIds) {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const t = db.transaction(["nodes", "edges"], "readwrite");
    nodeIds.forEach((id) => t.objectStore("nodes").delete(id));
    edgeIds.forEach((id) => t.objectStore("edges").delete(id));
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });
}

// ---------- export / import / wipe ----------

async function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function dataURLToBlob(url) {
  const res = await fetch(url);
  return res.blob();
}

export async function exportData() {
  const [favorites, ratings, settings, meals, graph] = await Promise.all([
    kvGet("favorites", []), kvGet("ratings", {}), kvGet("settings", {}), getMeals(), getGraph(),
  ]);
  const serializable = [];
  for (const meal of meals) {
    const copy = { ...meal };
    if (copy.photo instanceof Blob) copy.photo = await blobToDataURL(copy.photo);
    serializable.push(copy);
  }
  return JSON.stringify({ version: 1, favorites, ratings, settings, meals: serializable, graph }, null, 2);
}

export async function importData(json) {
  const data = JSON.parse(json);
  if (data.version !== 1) throw new Error("Unsupported backup version");
  await kvSet("favorites", data.favorites || []);
  await kvSet("ratings", data.ratings || {});
  await kvSet("settings", data.settings || {});
  for (const meal of data.meals || []) {
    if (typeof meal.photo === "string" && meal.photo.startsWith("data:")) {
      meal.photo = await dataURLToBlob(meal.photo);
    }
    await addMeal(meal);
  }
  if (data.graph) await putGraph(data.graph.nodes || [], data.graph.edges || []);
}

export async function wipeAll() {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const t = db.transaction(["kv", "meals", "nodes", "edges"], "readwrite");
    ["kv", "meals", "nodes", "edges"].forEach((name) => t.objectStore(name).clear());
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });
}
