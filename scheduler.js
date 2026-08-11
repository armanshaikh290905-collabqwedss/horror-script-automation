import cron from "node-cron";

const hour = Number(process.env.GENERATION_HOUR ?? 9);
const minute = Number(process.env.GENERATION_MINUTE ?? 0);
const timezone = process.env.GENERATION_TIMEZONE || "Asia/Kolkata";

let task = null;
let runner = null;

export function startScheduler(runGeneration) {
  runner = runGeneration;

  const expression = `${minute} ${hour} * * *`;

  if (!cron.validate(expression)) {
    throw new Error(`Invalid scheduler expression: ${expression}`);
  }

  task = cron.schedule(expression, async () => {
    console.log(`[scheduler] Starting daily generation at ${new Date().toISOString()} (${timezone})`);
    try {
      await runner({ trigger: "scheduled" });
    } catch (error) {
      console.error("[scheduler] Generation failed:", error.message);
    }
  }, {
    timezone
  });

  console.log(`[scheduler] Daily generation scheduled for ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${timezone}`);
  return task;
}

export function getScheduleInfo() {
  return {
    hour,
    minute,
    timezone,
    expression: `${minute} ${hour} * * *`
  };
}
