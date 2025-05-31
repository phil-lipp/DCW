const express = require('express');
const { WebSocketServer } = require('ws');
const Docker = require('dockerode');
const cors = require('cors');
const { Pool } = require('pg');
const winston = require('winston');
const ContainerService = require('./services/containerService');
require('dotenv').config();

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Docker
const docker = new Docker();

// Initialize PostgreSQL connection
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  port: process.env.POSTGRES_PORT || 5432,
});

// Initialize container service
const containerService = new ContainerService(pool);

// WebSocket server
const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
  logger.info('New WebSocket connection');

  ws.on('message', (message) => {
    logger.info('Received:', message);
  });

  ws.on('close', () => {
    logger.info('Client disconnected');
  });
});

// Function to broadcast updates to all connected clients
function broadcastUpdate(type, data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type, data }));
    }
  });
}

// API Routes
app.get('/api/containers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM containers ORDER BY host, name');
    res.json(result.rows);
  } catch (err) {
    logger.error('Error fetching containers:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/check-updates', async (req, res) => {
  try {
    // Broadcast update check started
    broadcastUpdate('update-check-started');
    
    // Check for updates
    await containerService.checkAllContainers();
    
    // Get current container stats
    const { rows: containers } = await pool.query('SELECT * FROM containers');
    const stats = {
      total_containers: containers.length,
      up_to_date: containers.filter(c => c.latest).length,
      updates_available: containers.filter(c => c.new).length,
      errors: containers.filter(c => c.error).length
    };

    // Record update check history
    await pool.query(
      `INSERT INTO update_check_history 
       (total_containers, up_to_date, updates_available, errors)
       VALUES ($1, $2, $3, $4)`,
      [stats.total_containers, stats.up_to_date, stats.updates_available, stats.errors]
    );
    
    // Broadcast update check completed
    broadcastUpdate('update-check-completed');
    
    res.json({ message: 'Update check completed' });
  } catch (err) {
    logger.error('Error checking updates:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get update check history
app.get('/api/update-history', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM update_check_history ORDER BY timestamp DESC LIMIT 10'
    );
    res.json(rows);
  } catch (err) {
    logger.error('Error fetching update history:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Schedule daily update check
const scheduleUpdateCheck = () => {
  const now = new Date();
  const scheduledTime = new Date();
  scheduledTime.setHours(parseInt(process.env.CRON_HOUR || '0'), parseInt(process.env.CRON_MINUTE || '0'), 0);
  
  if (scheduledTime < now) {
    scheduledTime.setDate(scheduledTime.getDate() + 1);
  }
  
  const timeUntilCheck = scheduledTime - now;
  
  setTimeout(async () => {
    try {
      logger.info('Running scheduled update check');
      await containerService.checkAllContainers();
      broadcastUpdate('update-check-completed');
    } catch (error) {
      logger.error('Error in scheduled update check:', error);
    }
    
    // Schedule next check
    scheduleUpdateCheck();
  }, timeUntilCheck);
};

// Start scheduled checks
scheduleUpdateCheck();

// Initial container check on startup
containerService.checkAllContainers()
  .then(() => {
    logger.info('Initial container check completed');
  })
  .catch((error) => {
    logger.error('Error in initial container check:', error);
  });

// Start server
app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
}); 