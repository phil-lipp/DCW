const Docker = require('dockerode');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class ContainerService {
  constructor(pool) {
    this.docker = new Docker();
    this.pool = pool;
  }

  async checkContainerUpdates(container) {
    try {
      // Get container info
      const containerInfo = await this.docker.getContainer(container.Id).inspect();
      const imageName = containerInfo.Config.Image;
      
      // Get current image digest
      const currentImage = await this.docker.getImage(imageName).inspect();
      const currentDigest = currentImage.RepoDigests?.[0]?.split('@')[1];

      // Check for new image
      const { stdout: newDigest } = await execAsync(`docker pull ${imageName} --quiet`);
      
      if (newDigest.trim() !== currentDigest) {
        // Update available
        await this.pool.query(
          `UPDATE containers 
           SET latest = false, 
               new = true, 
               current_version = $1, 
               latest_version = $2,
               last_checked = CURRENT_TIMESTAMP
           WHERE name = $3 AND host = $4`,
          [currentDigest, newDigest.trim(), container.Names[0].slice(1), process.env.HOSTNAME]
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
               last_checked = CURRENT_TIMESTAMP
           WHERE name = $2 AND host = $3`,
          [currentDigest, container.Names[0].slice(1), process.env.HOSTNAME]
        );
      }
    } catch (error) {
      // Error occurred
      await this.pool.query(
        `UPDATE containers 
         SET error = true, 
             error_message = $1,
             last_checked = CURRENT_TIMESTAMP
         WHERE name = $2 AND host = $3`,
        [error.message, container.Names[0].slice(1), process.env.HOSTNAME]
      );
    }
  }

  async checkAllContainers() {
    try {
      const containers = await this.docker.listContainers();
      
      for (const container of containers) {
        // Check if container exists in database
        const { rows } = await this.pool.query(
          'SELECT id FROM containers WHERE name = $1 AND host = $2',
          [container.Names[0].slice(1), process.env.HOSTNAME]
        );

        if (rows.length === 0) {
          // Insert new container
          await this.pool.query(
            `INSERT INTO containers (name, host, image)
             VALUES ($1, $2, $3)`,
            [container.Names[0].slice(1), process.env.HOSTNAME, container.Image]
          );
        }

        // Check for updates
        await this.checkContainerUpdates(container);
      }
    } catch (error) {
      console.error('Error checking containers:', error);
      throw error;
    }
  }
}

module.exports = ContainerService; 