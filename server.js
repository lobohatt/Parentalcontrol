const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const { Server: SocketIOServer } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// IPV6 IPV4 

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], 
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "*"],
    }
  }
}));

//https & http   // cors access / multiple cross border certificate transfer // SSL certificate
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


const sessions = new Map();
const TTL_MS = 1000 * 60 * 60; 


setInterval(() => {
  const now = Date.now();
  for (const [id, data] of sessions.entries()) {
    if (!data?.timestamp || now - data.timestamp > TTL_MS) {
      sessions.delete(id);
    }
  }
}, 60000);


app.post('/store', (req, res) => {
  const { sessionId, lat, lon, accuracy_m } = req.body;
  if (!sessionId || typeof lat === 'undefined' || typeof lon === 'undefined') {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const payload = {
    lat: Number(lat),
    lon: Number(lon),
    accuracy_m: Number(accuracy_m) || null,
    timestamp: Date.now(),
    userAgent: req.headers['user-agent'] || ''
  };

  sessions.set(sessionId, payload);
  io.to(sessionId).emit('update', { sessionId, ...payload });

  res.json({ ok: true });
});


app.get('/get', (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });
  const payload = sessions.get(sessionId) || null;
  res.json(payload);
});


io.on('connection', socket => {
  socket.on('join', sessionId => {
    if (typeof sessionId === 'string') {
      socket.join(sessionId);
      const payload = sessions.get(sessionId);
      if (payload) socket.emit('update', { sessionId, ...payload });
    }
  });
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
