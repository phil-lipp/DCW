const HostService = require('./hostService');

class InitService {
  constructor(pool) {
    this.hostService = new HostService(pool);
  }

  async initializeHosts() {
    try {
      // Always add local host first
      const localHostname = process.env.HOSTNAME || 'localhost';
      console.log(`Adding local host: ${localHostname}`);
      const localSuccess = await this.hostService.addHost(localHostname, 2375);
      if (localSuccess) {
        console.log(`Successfully added local host: ${localHostname}`);
      } else {
        console.error(`Failed to add local host: ${localHostname}`);
      }

      // Check if auto-add is enabled for remote hosts
      if (process.env.AUTO_ADD_HOSTS !== 'true') {
        console.log('Automatic remote host addition is disabled');
        return;
      }

      // Get remote hosts from environment
      const remoteHosts = process.env.REMOTE_HOSTS;
      if (!remoteHosts) {
        console.log('No remote hosts configured');
        return;
      }

      // Parse remote hosts
      const hosts = remoteHosts.split(',').map(host => {
        const [hostname, port] = host.split(':');
        return {
          hostname: hostname.trim(),
          port: port ? parseInt(port.trim()) : 2375
        };
      });

      // Add each remote host
      for (const host of hosts) {
        if (host.hostname === localHostname) {
          console.log(`Skipping local host: ${host.hostname}`);
          continue;
        }

        console.log(`Adding remote host: ${host.hostname}:${host.port}`);
        const success = await this.hostService.addHost(host.hostname, host.port);
        if (success) {
          console.log(`Successfully added host: ${host.hostname}`);
        } else {
          console.error(`Failed to add host: ${host.hostname}`);
        }
      }
    } catch (error) {
      console.error('Error initializing hosts:', error);
      throw error;
    }
  }
}

module.exports = InitService; 