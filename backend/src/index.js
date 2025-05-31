const express = require('express');
const { WebSocketServer } = require('ws');
const Docker = require('dockerode');
const cors = require('cors');
const { Pool } = require('pg');
const winston = require('winston');
const ContainerService = require('./services/containerService');
const HostService = require('./services/hostService');
const InitService = require('./services/initService');
const runMigrations = require('./db/migrate');
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
  host: process.env.POSTGRES_HOST || 'postgres',
  database: process.env.POSTGRES_DB || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  port: process.env.POSTGRES_PORT || 5432,
});

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
    const results = await req.app.locals.containerService.checkAllContainers();
    
    // Calculate overall stats
    const stats = results.reduce((acc, result) => ({
      total_containers: acc.total_containers + result.total_containers,
      up_to_date: acc.up_to_date + result.up_to_date,
      updates_available: acc.updates_available + result.updates_available,
      errors: acc.errors + result.errors
    }), {
      total_containers: 0,
      up_to_date: 0,
      updates_available: 0,
      errors: 0
    });
    
    // Broadcast update check completed
    broadcastUpdate('update-check-completed');
    
    res.json({ 
      message: 'Update check completed',
      results,
      stats
    });
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

// Get check interval settings
app.get('/api/settings/check-interval', (req, res) => {
  const intervalMinutes = parseInt(process.env.CHECK_INTERVAL_MINUTES || '0');
  res.json({ intervalMinutes });
});

// Update check interval settings
app.post('/api/settings/check-interval', (req, res) => {
  const { intervalMinutes } = req.body;
  if (typeof intervalMinutes !== 'number' || intervalMinutes < 0) {
    return res.status(400).json({ error: 'Invalid interval value' });
  }
  
  // Update environment variable
  process.env.CHECK_INTERVAL_MINUTES = intervalMinutes.toString();
  
  // Restart the interval check
  scheduleChecks();
  
  res.json({ message: 'Check interval updated successfully' });
});

// Schedule container checks
const scheduleChecks = () => {
  // Schedule daily check
  const scheduleDailyCheck = () => {
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(parseInt(process.env.CRON_HOUR || '0'), parseInt(process.env.CRON_MINUTE || '0'), 0);
    
    if (scheduledTime < now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }
    
    const timeUntilCheck = scheduledTime - now;
    
    setTimeout(async () => {
      try {
        logger.info('Running scheduled daily update check');
        await req.app.locals.containerService.checkAllContainers();
        broadcastUpdate('update-check-completed');
      } catch (error) {
        logger.error('Error in scheduled daily update check:', error);
      }
      
      // Schedule next daily check
      scheduleDailyCheck();
    }, timeUntilCheck);
  };

  // Schedule interval check
  const scheduleIntervalCheck = () => {
    const intervalMinutes = parseInt(process.env.CHECK_INTERVAL_MINUTES || '0');
    if (intervalMinutes > 0) {
      setInterval(async () => {
        try {
          logger.info('Running scheduled interval update check');
          await req.app.locals.containerService.checkAllContainers();
          broadcastUpdate('update-check-completed');
        } catch (error) {
          logger.error('Error in scheduled interval update check:', error);
        }
      }, intervalMinutes * 60 * 1000);
    }
  };

  // Start both schedulers
  scheduleDailyCheck();
  scheduleIntervalCheck();
};

// Start scheduling
scheduleChecks();

// Run migrations and start the server
async function startServer() {
  try {
    // Run database migrations first
    await runMigrations();
    logger.info('Database migrations completed');

    // Initialize services after migrations
    const hostService = new HostService(pool);
    const containerService = new ContainerService(pool, hostService);
    const initService = new InitService(pool);

    // Initialize remote hosts
    await initService.initializeHosts();
    logger.info('Remote hosts initialization completed');

    // Start the server
    app.listen(port, () => {
      logger.info(`Server running on port ${port}`);
    });

    // Initial container check after everything is set up
    try {
      await containerService.checkAllContainers();
      logger.info('Initial container check completed');
    } catch (error) {
      logger.error('Error in initial container check:', error);
    }

    // Make containerService available to route handlers
    app.locals.containerService = containerService;
  } catch (error) {
    logger.error('Error starting server:', error);
    process.exit(1);
  }
}

// Start the server
startServer(); 