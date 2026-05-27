// Heart voice assistant — local proxy server
// Reads Claude auth token from macOS keychain (same one Claude Code uses)
// Run: node voice-assistant/server.js

const http = require('http');
const { execSync } = require('child_process');

const PORT = 3131;

function getToken() {
  const raw = execSync('security find-generic-password -s "Claude Code-credentials" -w', { encoding: 'utf8' });
  const creds = JSON.parse(raw.trim());
  return creds?.claudeAiOauth?.accessToken;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  if (req.method === 'POST' && req.url === '/chat') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { messages, system } = JSON.parse(body);
        const token = getToken();

        const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': token,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1000, system, messages })
        });

        const data = await apiRes.json();
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(apiRes.status);
        res.end(JSON.stringify(data));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: { message: err.message } }));
      }
    });
    return;
  }

  res.writeHead(404); res.end();
});

server.listen(PORT, () => {
  console.log(`\n💜 Heart server running → http://localhost:${PORT}`);
  console.log('   Open voice-assistant/index.html in Chrome to start talking.\n');
});
