const express = require('express');
const Docker = require('dockerode');
const cors = require('cors');

const app = express();
const docker = new Docker();

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Docker API proxy running' });
});

// Docker API endpoints
app.get('/_ping', async (req, res) => {
  try {
    await docker.ping();
    res.send('OK');
  } catch (error) {
    console.error('Error in /_ping:', error);
    res.status(500).send(error.message);
  }
});

// Version endpoint
app.get('/version', async (req, res) => {
  try {
    const version = await docker.version();
    res.json(version);
  } catch (error) {
    console.error('Error in /version:', error);
    res.status(500).json({ error: error.message });
  }
});

// List containers
app.get('/containers/json', async (req, res) => {
  try {
    const containers = await docker.listContainers();
    res.json(containers);
  } catch (error) {
    console.error('Error in /containers/json:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get container info
app.get('/containers/:id/json', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    const info = await container.inspect();
    res.json(info);
  } catch (error) {
    console.error('Error in /containers/:id/json:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get image info
app.get('/images/:name/json', async (req, res) => {
  try {
    const image = docker.getImage(req.params.name);
    const info = await image.inspect();
    res.json(info);
  } catch (error) {
    console.error('Error in /images/:name/json:', error);
    res.status(500).json({ error: error.message });
  }
});

// Pull image
app.post('/images/create', async (req, res) => {
  try {
    const { fromImage, tag } = req.query;
    if (!fromImage) {
      return res.status(400).json({ error: 'Image name is required' });
    }

    const imageName = tag ? `${fromImage}:${tag}` : fromImage;
    await docker.pull(imageName);
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Error in /images/create:', error);
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message });
});

// Start the server
const PORT = process.env.PORT || 2375;
app.listen(PORT, () => {
  console.log(`Docker agent listening on port ${PORT}`);
}); 