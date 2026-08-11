# Horror Script Automation V2

Personal horror YouTube script automation powered by Groq.

## What it does

- Maintains a story queue.
- Generates one 10–15 minute long-form horror script.
- Generates one 20–35 second Hook Short.
- Generates one 25–40 second Climax Short.
- Uses Research Mode to create an original story when the queue is empty.
- Saves stories and scripts to a persistent JSON store on disk.
- Runs automatically every day at 9:00 AM Asia/Kolkata.
- Optionally emails generated scripts.
- Provides a simple public dashboard.
- Designed for GitHub + Oracle Cloud Always Free deployment.

## Groq model

The default is:

`openai/gpt-oss-120b`

This is configurable with `GROQ_MODEL`.

The application uses Groq Chat Completions and strict JSON Schema output for reliable structured results.

## Local setup

Requirements:

- Node.js 20+
- A Groq API key

```bash
git clone YOUR_REPOSITORY_URL
cd horror-script-automation
npm install
copy .env.example .env
```

On macOS/Linux use:

```bash
cp .env.example .env
```

Edit `.env`:

```env
GROQ_API_KEY=your_real_key
GROQ_MODEL=openai/gpt-oss-120b
GENERATION_HOUR=9
GENERATION_MINUTE=0
GENERATION_TIMEZONE=Asia/Kolkata
```

Start:

```bash
npm start
```

Open:

`http://localhost:3000`

Health:

`http://localhost:3000/health`

## Data persistence

The application intentionally uses a small file-backed JSON store rather than a database server.

Data is stored at:

`data/store.json`

This is appropriate for a single-user personal tool with a modest number of scripts and stories.

On Oracle Cloud, the VM's persistent boot volume keeps this file across reboots.

Do not commit `data/store.json` to GitHub.

Back it up periodically if the generated scripts are important.

## Optional email

Set:

```env
EMAIL_USER=yourgmail@gmail.com
EMAIL_PASSWORD=your_gmail_app_password
EMAIL_RECIPIENT=your@email.com
```

Use a Gmail App Password, not your normal Gmail password.

If email variables are empty, the application simply skips email.

## Daily scheduler

Default:

9:00 AM Asia/Kolkata.

Change with:

```env
GENERATION_HOUR=9
GENERATION_MINUTE=0
GENERATION_TIMEZONE=Asia/Kolkata
```

The scheduler runs inside the Node process. On Oracle Cloud, PM2/systemd keeps the process running and restarts it after a reboot.

## Public dashboard

The server listens on `0.0.0.0`, so after the Oracle firewall/network rule allows the port, the dashboard can be reached using the VM's public IP.

For a cleaner setup, the included Nginx configuration can proxy port 80 to Node on port 3000.

## Reset

The reset endpoint resets stories to unused while keeping generated scripts.

For extra protection, set:

```env
RESET_TOKEN=some-long-random-value
```

Then the dashboard asks for the token before resetting.

## No Railway

This project has no Railway dependency or Railway configuration.
