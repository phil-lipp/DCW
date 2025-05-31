# DCW (Docker Container Watcher)

A modern web application for monitoring and managing Docker containers across multiple hosts. This project is a fork of [Palleri/DCW](https://github.com/Palleri/DCW) with significant improvements and modernizations.

## Features

- 🐳 Real-time container monitoring
- 🔄 Automatic update checking
- 📊 Beautiful modern UI built with Tailwind CSS
- 🔔 Notification system for container updates
- 🌐 Multi-host support
- 🔒 Secure Docker socket access
- 📈 Container statistics and health monitoring

## Architecture

The application consists of three main components:

- **Frontend**: A modern web interface built with Tailwind CSS
- **Backend**: Node.js API server handling Docker operations
- **Database**: PostgreSQL for persistent storage

## Prerequisites

- Docker and Docker Compose
- Node.js (for local development)
- PostgreSQL (handled by Docker Compose)

## Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/DCW.git
   cd DCW
   ```

2. Copy the example environment file:
   ```bash
   cp .env-example .env
   ```

3. Configure your environment variables in `.env`

4. Start the application:
   ```bash
   docker-compose up -d
   ```

5. Access the web interface at `http://localhost:80`

## Configuration

### Environment Variables

- `NODE_ENV`: Node environment (production/development)
- `DOCKER_HOST`: Docker socket path
- `POSTGRES_*`: PostgreSQL configuration
- `VITE_API_URL`: Frontend API URL
- `PORT`: Backend port
- `CHECK_INTERVAL_MINUTES`: Container check interval
- `CRON_HOUR` & `CRON_MINUTE`: Scheduled check time
- `WS_PORT`: WebSocket port

## Roadmap

1. ✅ Container update via GUI
2. ✅ Multiple hosts one GUI
3. 🔄 Test notifications
4. 🔄 Improve web UI settings
5. 🔄 Add authentication

## Security Considerations

- Docker socket is mounted as read-only (`:ro`)
- Environment variables for sensitive data
- Secure WebSocket connections
- Authentication system (planned)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Credits
- [Palleri](https://github.com/Palleri/)
- [Mag37](https://github.com/Mag37) 👑
- [t0rnis](https://github.com/t0rnis) 🪖🐛

## License

This project is licensed under the GPL-3.0 License - see the [LICENSE](LICENSE) file for details.

For information about third-party licenses used in this project, please see [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md). 