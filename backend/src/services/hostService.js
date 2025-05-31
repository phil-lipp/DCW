const Docker = require('dockerode');
const { Pool } = require('pg');
const net = require('net');

class HostService {
  constructor(pool) {
    this.pool = pool;
    this.dockerClients = new Map();
  }

  async addHost(hostname, port) {
    try {
      // Check if host already exists
      const { rows } = await this.pool.query(
        'SELECT * FROM hosts WHERE hostname = $1',
        [hostname]
      );

      if (rows.length > 0) {
        console.log(`Host ${hostname} already exists`);
        return true;
      }

      // Test connection
      const isLocal = hostname === process.env.HOSTNAME || hostname === 'localhost';
      let status = 'offline';
      
      if (isLocal) {
        // For local host, test Docker socket
        try {
          const docker = new Docker();
          await docker.ping();
          status = 'online';
        } catch (error) {
          console.error(`Error testing local Docker socket:`, error);
          throw new Error('Failed to connect to local Docker socket');
        }
      } else {
        // For remote hosts, test TCP connection
        const isConnected = await this.testConnection(hostname, port);
        if (!isConnected) {
          throw new Error(`Failed to connect to ${hostname}:${port}`);
        }
        status = 'online';
      }

      // Add host to database
      await this.pool.query(
        `INSERT INTO hosts (hostname, port, status)
         VALUES ($1, $2, $3)`,
        [hostname, port, status]
      );

      // Create Docker client
      this.getDockerClient(hostname);

      return true;
    } catch (error) {
      console.error(`Error adding host ${hostname}:`, error);
      return false;
    }
  }

  async testConnection(hostname, port) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = 5000; // 5 seconds timeout

      socket.setTimeout(timeout);

      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });

      socket.connect(port, hostname);
    });
  }

  getDockerClient(hostname) {
    if (this.dockerClients.has(hostname)) {
      return this.dockerClients.get(hostname);
    }

    const isLocal = hostname === process.env.HOSTNAME || hostname === 'localhost';
    let docker;

    if (isLocal) {
      // Use Docker socket for local host
      docker = new Docker();
    } else {
      // Get host info from database
      const { rows } = this.pool.query(
        'SELECT * FROM hosts WHERE hostname = $1',
        [hostname]
      );

      if (rows.length === 0) {
        throw new Error(`Host ${hostname} not found`);
      }

      const host = rows[0];
      docker = new Docker({
        host: host.hostname,
        port: host.port
      });
    }

    this.dockerClients.set(hostname, docker);
    return docker;
  }

  async getDockerClient(hostname) {
    if (this.dockerClients.has(hostname)) {
      return this.dockerClients.get(hostname);
    }

    const isLocal = hostname === process.env.HOSTNAME || hostname === 'localhost';
    let docker;

    if (isLocal) {
      // Use Docker socket for local host
      docker = new Docker();
    } else {
      // Get host info from database
      const { rows } = await this.pool.query(
        'SELECT * FROM hosts WHERE hostname = $1',
        [hostname]
      );

      if (rows.length === 0) {
        throw new Error(`Host ${hostname} not found`);
      }

      const host = rows[0];
      docker = new Docker({
        host: host.hostname,
        port: host.port
      });
    }

    this.dockerClients.set(hostname, docker);
    return docker;
  }

  async getHosts() {
    const { rows } = await this.pool.query('SELECT * FROM hosts');
    return rows;
  }

  async updateHostStatus(hostname, status) {
    await this.pool.query(
      'UPDATE hosts SET status = $1 WHERE hostname = $2',
      [status, hostname]
    );
  }
}

module.exports = HostService; 