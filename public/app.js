const $ = (id) => document.getElementById(id);

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove("show"), 3500);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[char]));
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

async function refreshStatus() {
  const status = await api("/api/status");
  $("totalStories").textContent = status.totalStories;
  $("unusedStories").textContent = status.unusedStories;
  $("usedStories").textContent = status.usedStories;
  $("generatedScripts").textContent = status.generatedScripts;
  $("lastRun").textContent = status.lastGeneration ? formatDate(status.lastGeneration.generatedAt) : "—";
  $("modelBadge").textContent = `Model: ${status.groqModel}`;
  $("researchBadge").textContent = `Research Mode: ${status.researchMode ? "ON" : "OFF"}`;
  $("scheduleBadge").textContent = `Daily: ${String(status.schedule.hour).padStart(2,"0")}:${String(status.schedule.minute).padStart(2,"0")} ${status.schedule.timezone}`;
  $("generationStatus").textContent = status.generationRunning
    ? "Generation is running…"
    : status.lastGenerationStatus === "failed"
      ? `Last generation failed: ${status.lastGeneration?.error || "unknown error"}`
      : "Ready.";
}

async function refreshHealth() {
  try {
    await api("/health");
    $("healthDot").classList.add("good");
    $("healthText").textContent = "Online";
  } catch {
    $("healthDot").classList.remove("good");
    $("healthText").textContent = "Offline";
  }
}

async function refreshStories() {
  const { stories } = await api("/api/stories");
  const list = $("storyList");

  if (!stories.length) {
    list.innerHTML = `<div class="card"><div class="card-title">No stories yet</div><p>Add a few ideas, or use Research Mode to create originals automatically.</p></div>`;
    return;
  }

  list.innerHTML = stories.map((story) => `
    <article class="card">
      <div class="card-head">
        <div>
          <div class="card-title">${escapeHtml(story.title)}</div>
          <div class="meta-row">
            <span class="badge">${escapeHtml(story.type)}</span>
            <span class="badge ${story.used ? "used" : "unused"}">${story.used ? "Used" : "Unused"}</span>
          </div>
        </div>
      </div>
      <p>${escapeHtml(story.description)}</p>
      <p>Source: ${escapeHtml(story.source || "Original")}${story.sourceUrl ? ` · ${escapeHtml(story.sourceUrl)}` : ""}</p>
      <div class="card-actions">
        ${!story.used ? `<button class="primary small" onclick="generateStory('${story.id}')">Generate</button>` : ""}
        <button class="secondary small" onclick="deleteStory('${story.id}')">Delete</button>
      </div>
    </article>
  `).join("");
}

async function refreshScripts() {
  const { scripts } = await api("/api/scripts");
  const list = $("scriptList");

  if (!scripts.length) {
    list.innerHTML = `<div class="card"><div class="card-title">No scripts yet</div><p>Your first generated story will appear here.</p></div>`;
    return;
  }

  list.innerHTML = scripts.map((script) => `
    <article class="card script-card">
      <div class="card-head">
        <div>
          <div class="card-title">${escapeHtml(script.storyTitle)}</div>
          <div class="meta-row">
            <span class="badge">${escapeHtml(script.storyType)}</span>
            <span class="badge">${escapeHtml(script.narrationTone)}</span>
            <span class="badge">${escapeHtml(script.metrics?.longWords || "?")} words</span>
          </div>
        </div>
        <span class="badge">${formatDate(script.generatedAt)}</span>
      </div>

      <details open>
        <summary>Long-form · ${escapeHtml(script.longForm.title)}</summary>
        <div class="card-actions"><button class="secondary small" onclick="copyText(${JSON.stringify(script.longForm.narration)})">Copy</button></div>
        <pre class="script-text">${escapeHtml(script.longForm.narration)}</pre>
      </details>

      <details>
        <summary>Hook Short · ${escapeHtml(script.hookShort.title)}</summary>
        <div class="card-actions"><button class="secondary small" onclick="copyText(${JSON.stringify(script.hookShort.narration)})">Copy</button></div>
        <pre class="script-text">${escapeHtml(script.hookShort.narration)}</pre>
      </details>

      <details>
        <summary>Climax Short · ${escapeHtml(script.climaxShort.title)}</summary>
        <div class="card-actions"><button class="secondary small" onclick="copyText(${JSON.stringify(script.climaxShort.narration)})">Copy</button></div>
        <pre class="script-text">${escapeHtml(script.climaxShort.narration)}</pre>
      </details>

      <details>
        <summary>YouTube Metadata</summary>
        <pre class="script-text">${escapeHtml(JSON.stringify(script.youtubeMetadata, null, 2))}</pre>
      </details>
    </article>
  `).join("");
}

async function refreshAll() {
  await Promise.all([refreshStatus(), refreshHealth(), refreshStories(), refreshScripts()]);
}

async function generateStory(storyId = null) {
  const button = $("generateBtn");
  button.disabled = true;
  button.textContent = "Generating…";
  $("generationStatus").textContent = "Groq is generating the long-form story and two Shorts. This can take a little while.";

  try {
    const result = await api("/api/generate", {
      method: "POST",
      body: JSON.stringify(storyId ? { storyId } : {})
    });
    toast(`Generated: ${result.script.storyTitle}`);
    await refreshAll();
  } catch (error) {
    toast(error.message);
    await refreshStatus();
  } finally {
    button.disabled = false;
    button.textContent = "Generate Next Story";
  }
}

window.generateStory = generateStory;

window.deleteStory = async (id) => {
  if (!confirm("Delete this story from the queue?")) return;
  try {
    await api(`/api/stories/${id}`, { method: "DELETE" });
    toast("Story deleted.");
    await refreshAll();
  } catch (error) {
    toast(error.message);
  }
};

window.copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied.");
  } catch {
    toast("Could not copy automatically.");
  }
};

$("showAddStory").addEventListener("click", () => $("storyForm").classList.toggle("hidden"));
$("cancelStory").addEventListener("click", () => $("storyForm").classList.add("hidden"));
$("refreshBtn").addEventListener("click", refreshAll);
$("generateBtn").addEventListener("click", () => generateStory());

$("storyForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await api("/api/stories", {
      method: "POST",
      body: JSON.stringify({
        title: $("storyTitle").value,
        type: $("storyType").value,
        description: $("storyDescription").value,
        source: $("storySource").value,
        sourceUrl: $("storySourceUrl").value
      })
    });
    event.target.reset();
    $("storySource").value = "Original";
    $("storyForm").classList.add("hidden");
    toast("Story added.");
    await refreshAll();
  } catch (error) {
    toast(error.message);
  }
});

$("resetBtn").addEventListener("click", async () => {
  if (!confirm("Reset every story to UNUSED? Generated scripts will remain saved.")) return;
  const token = prompt("If you configured RESET_TOKEN, enter it. Otherwise press Cancel.");
  const headers = token ? { "x-reset-token": token } : {};
  try {
    await api("/api/reset", { method: "POST", headers });
    toast("Story queue reset.");
    await refreshAll();
  } catch (error) {
    toast(error.message);
  }
});

refreshAll();
setInterval(refreshStatus, 30000);
setInterval(refreshHealth, 30000);
