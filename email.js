import nodemailer from "nodemailer";

let transporter = null;

function getTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) return null;

  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }

  return transporter;
}

export async function sendScriptEmail(script) {
  const transport = getTransporter();
  const recipient = process.env.EMAIL_RECIPIENT || process.env.EMAIL_USER;

  if (!transport || !recipient) {
    return { sent: false, skipped: true };
  }

  const text = [
    `HORROR SCRIPT: ${script.storyTitle}`,
    "",
    `Type: ${script.storyType}`,
    `Narration tone: ${script.narrationTone}`,
    "",
    "LONG-FORM",
    script.longForm.narration,
    "",
    "HOOK SHORT",
    script.hookShort.narration,
    "",
    "CLIMAX SHORT",
    script.climaxShort.narration,
    "",
    "YOUTUBE METADATA",
    `Title: ${script.youtubeMetadata.title}`,
    `Description: ${script.youtubeMetadata.description}`,
    `Keywords: ${script.youtubeMetadata.keywords.join(", ")}`,
    `Hashtags: ${script.youtubeMetadata.hashtags.join(" ")}`
  ].join("\n");

  await transport.sendMail({
    from: process.env.EMAIL_USER,
    to: recipient,
    subject: `Horror Script: ${script.storyTitle}`,
    text
  });

  return { sent: true, skipped: false };
}
