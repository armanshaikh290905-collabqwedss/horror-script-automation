import Groq from "groq-sdk";
import { buildGenerationPrompt, buildRepairPrompt, buildResearchPrompt } from "./prompts.js";
import { validateScript } from "./validator.js";

const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

if (!process.env.GROQ_API_KEY) {
  console.warn("GROQ_API_KEY is not configured. The dashboard will load, but generation will fail until it is set.");
}

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
  maxRetries: 2,
  timeout: 120000
});

const scriptSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    storyTitle: { type: "string" },
    storyType: { type: "string" },
    narrationTone: { type: "string" },
    source: { type: "string" },
    sourceUrl: { type: "string" },
    contentWarnings: { type: "string" },
    longForm: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        durationEstimate: { type: "string" },
        narration: { type: "string" }
      },
      required: ["title", "durationEstimate", "narration"]
    },
    hookShort: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        durationEstimate: { type: "string" },
        narration: { type: "string" },
        cta: { type: "string" }
      },
      required: ["title", "durationEstimate", "narration", "cta"]
    },
    climaxShort: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        durationEstimate: { type: "string" },
        narration: { type: "string" },
        cta: { type: "string" }
      },
      required: ["title", "durationEstimate", "narration", "cta"]
    },
    youtubeMetadata: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        keywords: { type: "array", items: { type: "string" } },
        hashtags: { type: "array", items: { type: "string" } },
        thumbnailConcept: { type: "string" }
      },
      required: ["title", "description", "keywords", "hashtags", "thumbnailConcept"]
    },
    productionNotes: { type: "string" }
  },
  required: [
    "storyTitle",
    "storyType",
    "narrationTone",
    "source",
    "sourceUrl",
    "contentWarnings",
    "longForm",
    "hookShort",
    "climaxShort",
    "youtubeMetadata",
    "productionNotes"
  ]
};

const conceptSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    type: { type: "string" },
    description: { type: "string" },
    source: { type: "string" },
    sourceUrl: { type: "string" }
  },
  required: ["title", "type", "description", "source", "sourceUrl"]
};

function parseJson(content) {
  if (typeof content !== "string") throw new Error("Groq returned no text content.");
  return JSON.parse(content);
}

async function completion({ system, user, schema, maxTokens = 12000 }) {
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    temperature: 0.8,
    max_completion_tokens: maxTokens,
    reasoning_effort: "low",
    response_format: {
      type: "json_schema",
      json_schema: {
        name: schema === conceptSchema ? "horror_story_concept" : "horror_script_package",
        strict: true,
        schema
      }
    }
  });

  return parseJson(response.choices?.[0]?.message?.content);
}

export async function generateScript(story) {
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const draft = await completion({
        system: (await import("./prompts.js")).SYSTEM_PROMPT,
        user: attempt === 1
          ? buildGenerationPrompt(story)
          : buildRepairPrompt(story, lastError?.draft || {}, lastError?.validation?.errors || [lastError.message]),
        schema: scriptSchema
      });

      const validation = validateScript(draft);
      if (validation.valid) {
        return { data: draft, metrics: validation.metrics, attempts: attempt };
      }

      lastError = {
        message: "Script failed quality validation.",
        validation,
        draft
      };
    } catch (error) {
      lastError = error;
      if (attempt === 2) throw error;
    }
  }

  const error = new Error(
    `Generated script failed validation after two attempts: ${lastError?.validation?.errors?.join("; ") || lastError?.message || "unknown error"}`
  );
  error.validation = lastError?.validation;
  throw error;
}

export async function generateOriginalConcept() {
  const concept = await completion({
    system: "You create original fictional horror concepts. Return only the requested JSON. Never claim an invented concept is a true case.",
    user: buildResearchPrompt(),
    schema: conceptSchema,
    maxTokens: 2500
  });

  return concept;
}

export function getGroqModel() {
  return MODEL;
}
