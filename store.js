import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");
const TEMP_FILE = path.join(DATA_DIR, "store.json.tmp");

const defaultStore = {
  version: 1,
  stories: [],
  scripts: [],
  history: [],
  settings: {
    researchMode: true
  }
};

let store = structuredClone(defaultStore);
let writeQueue = Promise.resolve();

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    store = {
      ...structuredClone(defaultStore),
      ...parsed,
      settings: { ...defaultStore.settings, ...(parsed.settings || {}) }
    };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await persist();
  }
}

async function persist() {
  const payload = JSON.stringify(store, null, 2);
  await fs.writeFile(TEMP_FILE, payload, "utf8");
  await fs.rename(TEMP_FILE, STORE_FILE);
}

function queuePersist() {
  writeQueue = writeQueue.then(persist, persist);
  return writeQueue;
}

export async function initStore() {
  await ensureStore();
  return store;
}

export function getStore() {
  return store;
}

export async function save() {
  return queuePersist();
}

export function nextId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function listStories() {
  return [...store.stories].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function listScripts() {
  return [...store.scripts].sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt));
}

export function getStory(id) {
  return store.stories.find((story) => story.id === id);
}

export function getScript(id) {
  return store.scripts.find((script) => script.id === id);
}

export async function addStory(input) {
  const now = new Date().toISOString();
  const story = {
    id: nextId("story"),
    title: String(input.title || "").trim(),
    type: String(input.type || "Original").trim(),
    description: String(input.description || "").trim(),
    source: String(input.source || "Original").trim(),
    sourceUrl: String(input.sourceUrl || "").trim(),
    used: false,
    createdAt: now,
    usedAt: null
  };
  store.stories.push(story);
  await save();
  return story;
}

export async function updateStory(id, patch) {
  const story = getStory(id);
  if (!story) return null;

  const allowed = ["title", "type", "description", "source", "sourceUrl", "used"];
  for (const key of allowed) {
    if (patch[key] !== undefined) {
      story[key] = key === "used" ? Boolean(patch[key]) : String(patch[key] ?? "").trim();
    }
  }
  story.usedAt = story.used ? (story.usedAt || new Date().toISOString()) : null;
  await save();
  return story;
}

export async function deleteStory(id) {
  const before = store.stories.length;
  store.stories = store.stories.filter((story) => story.id !== id);
  if (store.stories.length === before) return false;
  await save();
  return true;
}

export async function resetStories() {
  for (const story of store.stories) {
    story.used = false;
    story.usedAt = null;
  }
  await save();
}

export async function addScript(script) {
  store.scripts.push(script);
  await save();
  return script;
}

export async function addHistory(entry) {
  store.history.push({
    id: nextId("run"),
    createdAt: new Date().toISOString(),
    ...entry
  });
  if (store.history.length > 100) {
    store.history = store.history.slice(-100);
  }
  await save();
}

export async function markStoryUsed(id) {
  const story = getStory(id);
  if (!story) return null;
  story.used = true;
  story.usedAt = new Date().toISOString();
  await save();
  return story;
}

export function getStats() {
  const stories = store.stories;
  const scripts = store.scripts;
  const successful = store.history.filter((h) => h.status === "success");
  const failed = store.history.filter((h) => h.status === "failed");

  return {
    totalStories: stories.length,
    unusedStories: stories.filter((s) => !s.used).length,
    usedStories: stories.filter((s) => s.used).length,
    generatedScripts: scripts.length,
    successfulGenerations: successful.length,
    failedGenerations: failed.length,
    lastGeneration: successful.at(-1)?.createdAt || null,
    lastGenerationStatus: store.history.at(-1)?.status || null,
    researchMode: store.settings.researchMode
  };
}
