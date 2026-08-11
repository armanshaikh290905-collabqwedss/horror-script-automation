import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  initStore,
  getStory,
  getScript,
  listStories,
  listScripts,
  addStory,
  updateStory,
  deleteStory,
  resetStories,
  addScript,
  addHistory,
  markStoryUsed,
  getStats,
  getStore
} from "./store.js";
import { generateScript, generateOriginalConcept, getGroqModel } from "./groq.js";
import { sendScriptEmail } from "./email.js";
import { startScheduler, getScheduleInfo } from "./scheduler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

let initialized = false;
let generationRunning = false;
let lastGeneration = null;

const VALID_TYPES = [
  "Creepypasta",
  "Japanese",
  "Paranormal",
  "Psychological",
  "Original",
  "True Case"
];

function sanitizeStoryInput(body = {}) {
  return {
    title: String(body.title || "").trim().slice(0, 200),
    type: VALID_TYPES.includes(body.type) ? body.type : "Original",
    description: String(body.description || "").trim().slice(0, 5000),
    source: String(body.source || "Original").trim().slice(0, 500),
    sourceUrl: String(body.sourceUrl || "").trim().slice(0, 2000)
  };
}

function requireResetToken(req, res, next) {
  const configured = process.env.RESET_TOKEN;
  if (!configured) return next();
  const supplied = req.header("x-reset-token") || req.body?.token;
  if (supplied !== configured) {
    return res.status(403).json({ error: "Reset token required." });
  }
  next();
}

async function runGeneration({ trigger = "manual", storyId = null } = {}) {
  if (generationRunning) {
    const error = new Error("A generation is already running.");
    error.code = "GENERATION_BUSY";
    throw error;
  }

  generationRunning = true;
  const startedAt = Date.now();

  try {
    let story = storyId ? getStory(storyId) : listStories().find((item) => !item.used);

    if (!story) {
      const stats = getStats();
      if (!stats.researchMode) {
        throw new Error("No unused stories are available and Research Mode is disabled.");
      }

      const concept = await generateOriginalConcept();
      story = await addStory({
        title: concept.title,
        type: concept.type,
        description: concept.description,
        source: "AI Original",
        sourceUrl: ""
      });
    }

    if (story.used) {
      throw new Error("This story has already been used.");
    }

    console.log(`[generation] ${trigger}: ${story.title}`);

    const result = await generateScript(story);
    const script = {
      id: `script_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      storyId: story.id,
      storyTitle: result.data.storyTitle,
      storyType: result.data.storyType,
      narrationTone: result.data.narrationTone,
      source: result.data.source,
      sourceUrl: result.data.sourceUrl,
      contentWarnings: result.data.contentWarnings,
      longForm: result.data.longForm,
      hookShort: result.data.hookShort,
      climaxShort: result.data.climaxShort,
      youtubeMetadata: result.data.youtubeMetadata,
      productionNotes: result.data.productionNotes,
      generatedAt: new Date().toISOString(),
      metrics: result.metrics,
      trigger,
      model: getGroqModel()
    };

    await addScript(script);
    await markStoryUsed(story.id);

    let email = { sent: false, skipped: true };
    try {
      email = await sendScriptEmail(script);
    } catch (emailError) {
      console.error("[email] Failed:", emailError.message);
    }

    lastGeneration = {
      status: "success",
      storyId: story.id,
      scriptId: script.id,
      storyTitle: story.title,
      trigger,
      durationMs: Date.now() - startedAt,
      generatedAt: script.generatedAt,
      email
    };

    await addHistory(lastGeneration);
    return { story, script, lastGeneration };
  } catch (error) {
    lastGeneration = {
      status: "failed",
      trigger,
      durationMs: Date.now() - startedAt,
      generatedAt: new Date().toISOString(),
      error: error.message
    };
    await addHistory(lastGeneration);
    throw error;
  } finally {
    generationRunning = false;
  }
}

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "horror-script-automation",
    initialized,
    generationRunning,
    time: new Date().toISOString()
  });
});

app.get("/api/status", (req, res) => {
  res.json({
    ...getStats(),
    generationRunning,
    lastGeneration,
    schedule: getScheduleInfo(),
    groqModel: getGroqModel()
  });
});

app.get("/api/stories", (req, res) => {
  res.json({ stories: listStories() });
});

app.post("/api/stories", async (req, res) => {
  const input = sanitizeStoryInput(req.body);
  if (!input.title || !input.description) {
    return res.status(400).json({ error: "Title and description are required." });
  }

  try {
    const story = await addStory(input);
    res.status(201).json({ story });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not add story." });
  }
});

app.put("/api/stories/:id", async (req, res) => {
  try {
    const story = await updateStory(req.params.id, req.body);
    if (!story) return res.status(404).json({ error: "Story not found." });
    res.json({ story });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not update story." });
  }
});

app.delete("/api/stories/:id", async (req, res) => {
  try {
    const deleted = await deleteStory(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Story not found." });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not delete story." });
  }
});

app.get("/api/scripts", (req, res) => {
  res.json({ scripts: listScripts() });
});

app.get("/api/scripts/:id", (req, res) => {
  const script = getScript(req.params.id);
  if (!script) return res.status(404).json({ error: "Script not found." });
  res.json({ script });
});

app.post("/api/generate", async (req, res) => {
  try {
    const result = await runGeneration({
      trigger: "manual",
      storyId: req.body?.storyId || null
    });
    res.json(result);
  } catch (error) {
    const status = error.code === "GENERATION_BUSY" ? 409 : 500;
    res.status(status).json({
      error: error.message,
      code: error.code || "GENERATION_FAILED"
    });
  }
});

app.post("/api/reset", requireResetToken, async (req, res) => {
  try {
    await resetStories();
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not reset stories." });
  }
});

app.get("/api/config", (req, res) => {
  res.json({
    storyTypes: VALID_TYPES,
    schedule: getScheduleInfo(),
    groqModel: getGroqModel(),
    emailConfigured: Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD)
  });
});

await initStore();
initialized = true;
startScheduler(() => runGeneration({ trigger: "scheduled" }));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Horror Script Automation running on port ${PORT}`);
  console.log(`Public dashboard: http://0.0.0.0:${PORT}`);
});
