import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SYSTEM_PROMPT = fs.readFileSync(
  path.join(__dirname, "systemPrompt.txt"),
  "utf8"
);

export function buildGenerationPrompt(story) {
  return `Create the complete production package for this horror story idea.

STORY TITLE:
${story.title}

STORY TYPE:
${story.type}

STORY DESCRIPTION:
${story.description}

SOURCE:
${story.source || "Original"}

SOURCE URL:
${story.sourceUrl || "None provided"}

IMPORTANT:
- Treat the supplied source information as authoritative.
- If source is Original or no source is supplied, do not call it a true case.
- Choose the narration tone that best fits the story.
- Write the long-form narration as one continuous narration suitable for voice recording, with natural paragraph breaks.
- Create the Hook Short and Climax Short from the SAME long-form story.
- The Shorts must not invent events.
- Create useful but non-spammy YouTube metadata.
- If factual claims are not supplied, do not invent citations, dates, evidence, or real-world claims.

TARGET LENGTHS:
- Long-form: approximately 1500–2300 words.
- Hook Short: approximately 50–90 words.
- Climax Short: approximately 65–110 words.`;
}

export function buildRepairPrompt(story, draft, errors) {
  return `Repair the following generated horror package.

STORY:
${story.title}
${story.description}

VALIDATION PROBLEMS:
${errors.map((e) => `- ${e}`).join("\n")}

DRAFT:
${JSON.stringify(draft)}

Return a complete corrected package matching the exact JSON schema.
Do not explain the changes.
Keep the story's strongest ideas and improve only what is necessary.
Do not invent factual sources.`;
}

export function buildResearchPrompt() {
  return `Create one ORIGINAL horror story concept for a faceless narrated horror YouTube channel.

Requirements:
- Strong hook potential.
- Clear protagonist and motivation.
- Specific believable setting.
- Escalating tension.
- A meaningful supernatural or psychological core.
- A satisfying climax.
- A memorable ending.
- Avoid generic haunted-house repetition.
- Vary the fear type and setting.
- The story is FICTIONAL unless explicitly based on supplied source material.
- Do not invent that it is a true case.

Return only JSON with:
{
  "title": "string",
  "type": "Original|Creepypasta|Psychological|Paranormal|Japanese",
  "description": "2-4 sentence premise",
  "source": "AI Original",
  "sourceUrl": ""
}`;
}
