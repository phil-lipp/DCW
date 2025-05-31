const Docker = require('dockerode');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class ContainerService {
  constructor(pool, hostService) {
    this.docker = new Docker();
    this.pool = pool;
    this.hostService = hostService;
  }

  async checkContainerUpdates(container, hostname) {
    try {
      const docker = await this.hostService.getDockerClient(hostname);

      if (!docker) {
        throw new Error(`No Docker client available for host ${hostname}`);
      }

      // Get container info
      const containerInfo = await docker.getContainer(container.Id).inspect();
      const imageName = containerInfo.Config.Image;
      
      // Get current image info
      const currentImage = await docker.getImage(imageName).inspect();
      
      // For :latest tags, compare image IDs instead of digests
      if (imageName.endsWith(':latest')) {
        const currentImageId = currentImage.Id;
        
        // Pull the latest image without applying it
        await execAsync(`docker pull ${imageName} --quiet`);
        
        // Get the new image info
        const newImage = await docker.getImage(imageName).inspect();
        const newImageId = newImage.Id;
        
        if (newImageId !== currentImageId) {
          // Update available
          await this.pool.query(
            `UPDATE containers 
             SET latest = false, 
                 new = true, 
                 current_version = $1, 
                 latest_version = $2,
                 created_at = $3,
                 image_created = $4,
                 last_checked = CURRENT_TIMESTAMP
             WHERE name = $5 AND host = $6`,
            [
              currentImageId,
              newImageId,
              containerInfo.Created,
              currentImage.Created,
              container.Names[0].slice(1),
              hostname
            ]
          );
        } else {
          // Already on latest version
          await this.pool.query(
            `UPDATE containers 
             SET latest = true, 
                 new = false, 
                 error = false,
                 error_message = NULL,
                 current_version = $1,
                 latest_version = $1,
                 created_at = $2,
                 image_created = $3,
                 last_checked = CURRENT_TIMESTAMP
             WHERE name = $4 AND host = $5`,
            [
              currentImageId,
              containerInfo.Created,
              currentImage.Created,
              container.Names[0].slice(1),
              hostname
            ]
          );
        }
      } else {
        // For non-latest tags, use the original digest comparison
        const currentDigest = currentImage.RepoDigests?.[0]?.split('@')[1];
        const { stdout: newDigest } = await execAsync(`docker pull ${imageName} --quiet`);
        
        if (newDigest.trim() !== currentDigest) {
          // Update available
          await this.pool.query(
            `UPDATE containers 
             SET latest = false, 
                 new = true, 
                 current_version = $1, 
                 latest_version = $2,
                 created_at = $3,
                 image_created = $4,
                 last_checked = CURRENT_TIMESTAMP
             WHERE name = $5 AND host = $6`,
            [
              currentDigest,
              newDigest.trim(),
              containerInfo.Created,
              currentImage.Created,
              container.Names[0].slice(1),
              hostname
            ]
          );
        } else {
          // Already on latest version
          await this.pool.query(
            `UPDATE containers 
             SET latest = true, 
                 new = false, 
                 error = false,
                 error_message = NULL,
                 current_version = $1,
                 latest_version = $1,
                 created_at = $2,
                 image_created = $3,
                 last_checked = CURRENT_TIMESTAMP
             WHERE name = $4 AND host = $5`,
            [
              currentDigest,
              containerInfo.Created,
              currentImage.Created,
              container.Names[0].slice(1),
              hostname
            ]
          );
        }
      }
    } catch (error) {
      console.error(`Error checking updates for container ${container.Names[0]} on host ${hostname}:`, error);
      // Error occurred
      await this.pool.query(
        `UPDATE containers 
         SET error = true, 
             error_message = $1,
             last_checked = CURRENT_TIMESTAMP
         WHERE name = $2 AND host = $3`,
        [error.message, container.Names[0].slice(1), hostname]
      );
    }
  }

  async checkHostContainers(host) {
    try {
      if (host.status !== 'online') {
        console.log(`Skipping offline host: ${host.hostname}`);
        return {
          hostname: host.hostname,
          total_containers: 0,
          up_to_date: 0,
          updates_available: 0,
          errors: 0,
          status: 'offline'
        };
      }

      console.log(`Checking containers on host: ${host.hostname}`);
      const docker = await this.hostService.getDockerClient(host.hostname);

      if (!docker) {
        console.error(`No Docker client available for host ${host.hostname}`);
        return {
          hostname: host.hostname,
          total_containers: 0,
          up_to_date: 0,
          updates_available: 0,
          errors: 0,
          status: 'error',
          error_message: 'No Docker client available'
        };
      }

      const containers = await docker.listContainers();
      console.log(`Found ${containers.length} containers on host ${host.hostname}`);
      
      // Process containers in parallel
      await Promise.all(containers.map(async (container) => {
        try {
          // Check if container exists in database
          const { rows } = await this.pool.query(
            'SELECT id FROM containers WHERE name = $1 AND host = $2',
            [container.Names[0].slice(1), host.hostname]
          );

          if (rows.length === 0) {
            console.log(`Adding new container: ${container.Names[0]} on host ${host.hostname}`);
            // Insert new container
            await this.pool.query(
              `INSERT INTO containers (name, host, image)
               VALUES ($1, $2, $3)`,
              [container.Names[0].slice(1), host.hostname, container.Image]
            );
          }

          // Check for updates
          await this.checkContainerUpdates(container, host.hostname);
        } catch (error) {
          console.error(`Error processing container ${container.Names[0]} on host ${host.hostname}:`, error);
          // Update container status
          await this.pool.query(
            `UPDATE containers 
             SET error = true, 
                 error_message = $1,
                 last_checked = CURRENT_TIMESTAMP
             WHERE name = $2 AND host = $3`,
            [error.message, container.Names[0].slice(1), host.hostname]
          );
        }
      }));

      // Get stats for this host
      const { rows: hostContainers } = await this.pool.query(
        'SELECT * FROM containers WHERE host = $1',
        [host.hostname]
      );

      return {
        hostname: host.hostname,
        total_containers: hostContainers.length,
        up_to_date: hostContainers.filter(c => c.latest).length,
        updates_available: hostContainers.filter(c => c.new).length,
        errors: hostContainers.filter(c => c.error).length,
        status: 'success'
      };
    } catch (error) {
      console.error(`Error checking containers on host ${host.hostname}:`, error);
      // Update host status to offline
      await this.hostService.updateHostStatus(host.hostname, 'offline');
      return {
        hostname: host.hostname,
        total_containers: 0,
        up_to_date: 0,
        updates_available: 0,
        errors: 0,
        status: 'error',
        error_message: error.message
      };
    }
  }

  async checkAllContainers() {
    try {
      // Get all hosts
      const hosts = await this.hostService.getHosts();
      
      if (hosts.length === 0) {
        console.log('No hosts found in database, adding local host');
        const localHostname = process.env.HOSTNAME || 'localhost';
        await this.hostService.addHost(localHostname, 2375);
        hosts.push({ hostname: localHostname, status: 'online' });
      }

      // Process hosts in parallel
      const results = await Promise.all(hosts.map(async (host) => {
        try {
          const result = await this.checkHostContainers(host);
          
          // Record update check history for this host
          await this.pool.query(
            `INSERT INTO update_check_history 
             (hostname, total_containers, up_to_date, updates_available, errors, status, error_message)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              result.hostname,
              result.total_containers,
              result.up_to_date,
              result.updates_available,
              result.errors,
              result.status,
              result.error_message || null
            ]
          );

          return result;
        } catch (error) {
          console.error(`Error processing host ${host.hostname}:`, error);
          const errorResult = {
            hostname: host.hostname,
            total_containers: 0,
            up_to_date: 0,
            updates_available: 0,
            errors: 0,
            status: 'error',
            error_message: error.message
          };

          // Record error in history
          await this.pool.query(
            `INSERT INTO update_check_history 
             (hostname, total_containers, up_to_date, updates_available, errors, status, error_message)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              errorResult.hostname,
              errorResult.total_containers,
              errorResult.up_to_date,
              errorResult.updates_available,
              errorResult.errors,
              errorResult.status,
              errorResult.error_message
            ]
          );

          return errorResult;
        }
      }));

      return results;
    } catch (error) {
      console.error('Error checking containers:', error);
      throw error;
    }
  }
}

module.exports = ContainerService; 