# Oracle Cloud Always Free Deployment

This guide deploys the Horror Script Automation app to an Oracle Cloud Always Free VM.

## 1. Create the Oracle Cloud account

Use Oracle Cloud Free Tier.

Choose your home region carefully because Always Free compute resources are provisioned in the home region.

Oracle currently documents Always Free Ampere A1 compute as up to 2 OCPUs and 12 GB RAM for an Always Free tenancy. Availability can vary by region/host capacity.

## 2. Create an Always Free VM

In Oracle Cloud Console:

Compute → Instances → Create Instance

Recommended simple setup:

- Image: Ubuntu 24.04 LTS if available
- Shape: VM.Standard.A1.Flex
- OCPU: 2
- Memory: 12 GB
- Boot volume: default Always Free-eligible size
- Public IPv4: assign one

If A1 capacity is unavailable, Oracle may show an out-of-host-capacity message. Try another availability domain or wait and retry.

## 3. Network security

You need inbound access to HTTP.

Preferred final setup:

Internet → port 80 → Nginx → Node port 3000

Open TCP port 80 in the VCN security list / network security group.

For initial testing you can temporarily open TCP 3000 instead, but Nginx/port 80 is the cleaner setup.

Also make sure Ubuntu's firewall allows port 80:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw enable
```

Do not expose unnecessary ports.

## 4. Connect over SSH

From Windows PowerShell:

```powershell
ssh -i "C:\path\to\your\private_key" ubuntu@YOUR_PUBLIC_IP
```

## 5. Install Node.js and Git

Update packages:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y git curl nginx
```

Install Node.js 22 LTS using NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify:

```bash
node -v
npm -v
git --version
```

The Groq Node SDK requires Node 20 LTS or newer.

## 6. Clone the GitHub repository

```bash
cd ~
git clone YOUR_GITHUB_REPOSITORY_URL horror-script-automation
cd horror-script-automation
npm install
```

## 7. Create the environment file

```bash
cp .env.example .env
nano .env
```

Set at least:

```env
PORT=3000
GROQ_API_KEY=YOUR_REAL_GROQ_KEY
GROQ_MODEL=openai/gpt-oss-120b

GENERATION_HOUR=9
GENERATION_MINUTE=0
GENERATION_TIMEZONE=Asia/Kolkata
```

Optional email:

```env
EMAIL_USER=
EMAIL_PASSWORD=
EMAIL_RECIPIENT=
```

Optional reset protection:

```env
RESET_TOKEN=
```

Save and exit.

## 8. Test locally on the VM

Start:

```bash
npm start
```

In another SSH session:

```bash
curl http://127.0.0.1:3000/health
```

You should receive JSON containing:

```json
{
  "status": "ok"
}
```

Open the dashboard from the VM itself with:

```bash
curl -I http://127.0.0.1:3000
```

Stop Node with Ctrl+C after testing.

## 9. Run Node permanently with systemd

Create:

```bash
sudo nano /etc/systemd/system/horror-script-automation.service
```

Use:

```ini
[Unit]
Description=Horror Script Automation
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/horror-script-automation
ExecStart=/usr/bin/node /home/ubuntu/horror-script-automation/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable horror-script-automation
sudo systemctl start horror-script-automation
```

Check:

```bash
sudo systemctl status horror-script-automation
```

Logs:

```bash
sudo journalctl -u horror-script-automation -f
```

## 10. Configure Nginx

Create:

```bash
sudo nano /etc/nginx/sites-available/horror-script-automation
```

Use:

```nginx
server {
    listen 80;
    server_name _;

    client_max_body_size 2m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 180s;
        proxy_send_timeout 180s;
    }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/horror-script-automation /etc/nginx/sites-enabled/horror-script-automation
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

## 11. Open the dashboard

Go to:

`http://YOUR_ORACLE_PUBLIC_IP`

You should see the Horror Script Automation dashboard.

Health:

`http://YOUR_ORACLE_PUBLIC_IP/health`

## 12. Test Groq generation

Add a story in the dashboard.

Example:

Title:
`The Apartment Above Mine`

Type:
`Creepypasta`

Description:
`A tenant begins hearing deliberate footsteps above his apartment even though he lives on the top floor. The sounds slowly begin responding to things he says aloud.`

Source:
`Original`

Then click Generate.

The application should:

1. Send the story to Groq.
2. Generate structured JSON.
3. Validate the script.
4. Save the script to `data/store.json`.
5. Mark the story used only after success.
6. Optionally send email.

## 13. Verify persistence

After generating a script:

```bash
cat data/store.json
```

Restart the server:

```bash
sudo systemctl restart horror-script-automation
```

Refresh the dashboard.

The story and script should still exist.

## 14. Updating the application

On your PC:

```bash
git add .
git commit -m "Update horror automation"
git push
```

On Oracle:

```bash
cd ~/horror-script-automation
git pull
npm install
sudo systemctl restart horror-script-automation
```

Then check:

```bash
sudo systemctl status horror-script-automation
```

## 15. Back up generated scripts

The generated content is stored in:

`data/store.json`

Create a backup:

```bash
cp data/store.json data/store-backup-$(date +%Y-%m-%d).json
```

For a more complete backup:

```bash
tar -czf horror-backup-$(date +%Y-%m-%d).tar.gz data/
```

Download the backup to your PC periodically.

## 16. Scheduler verification

Default schedule:

9:00 AM Asia/Kolkata.

The Node scheduler uses the explicit timezone from:

```env
GENERATION_TIMEZONE=Asia/Kolkata
```

You can see the scheduler configuration in:

`GET /api/status`

The response includes the configured schedule.

## 17. Important Oracle note

Always Free resources are intended to remain free within Oracle's Always Free limits. Oracle currently lists Ampere A1 as an Always Free resource, with the Always Free tenancy limit equivalent to 2 OCPUs and 12 GB RAM.

If Oracle reports that A1 is out of host capacity, that is a capacity problem rather than a problem with this application. Try another availability domain or wait and retry.

## 18. No Railway

This deployment does not use Railway.

There is:

- no Railway project
- no Railway volume
- no Railway environment
- no Railway cron

The Oracle VM itself is the always-on server and its disk stores `data/store.json`.
