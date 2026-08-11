const forbiddenPhrases = [
  "little did i know",
  "to this day",
  "i couldn't believe my eyes",
  "i could hardly believe",
  "it was all just a dream"
];

function wordCount(text = "") {
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

function containsForbiddenPhrase(text = "") {
  const lower = text.toLowerCase();
  return forbiddenPhrases.find((phrase) => lower.includes(phrase)) || null;
}

export function validateScript(data) {
  const errors = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["AI response was not an object."] };
  }

  const required = [
    "storyTitle",
    "storyType",
    "narrationTone",
    "source",
    "contentWarnings",
    "longForm",
    "hookShort",
    "climaxShort",
    "youtubeMetadata"
  ];

  for (const field of required) {
    if (!data[field]) errors.push(`Missing field: ${field}`);
  }

  if (typeof data.longForm?.narration !== "string") {
    errors.push("Missing long-form narration.");
  }
  if (typeof data.hookShort?.narration !== "string") {
    errors.push("Missing Hook Short narration.");
  }
  if (typeof data.climaxShort?.narration !== "string") {
    errors.push("Missing Climax Short narration.");
  }

  const longWords = wordCount(data.longForm?.narration);
  const hookWords = wordCount(data.hookShort?.narration);
  const climaxWords = wordCount(data.climaxShort?.narration);

  if (longWords < 1200 || longWords > 2600) {
    errors.push(`Long-form word count is ${longWords}; target is approximately 1500–2300 words.`);
  }

  if (hookWords < 45 || hookWords > 105) {
    errors.push(`Hook Short word count is ${hookWords}; target is approximately 50–90 words.`);
  }

  if (climaxWords < 55 || climaxWords > 125) {
    errors.push(`Climax Short word count is ${climaxWords}; target is approximately 65–110 words.`);
  }

  const combined = [
    data.longForm?.narration,
    data.hookShort?.narration,
    data.climaxShort?.narration
  ].filter(Boolean).join("\n");

  const bad = containsForbiddenPhrase(combined);
  if (bad) errors.push(`Avoid overused phrase: "${bad}".`);

  if (data.youtubeMetadata?.keywords && !Array.isArray(data.youtubeMetadata.keywords)) {
    errors.push("youtubeMetadata.keywords must be an array.");
  }

  if (data.youtubeMetadata?.hashtags && !Array.isArray(data.youtubeMetadata.hashtags)) {
    errors.push("youtubeMetadata.hashtags must be an array.");
  }

  return {
    valid: errors.length === 0,
    errors,
    metrics: { longWords, hookWords, climaxWords }
  };
}
