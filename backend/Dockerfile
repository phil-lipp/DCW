FROM node:18-alpine

WORKDIR /app

# Install PostgreSQL client and Docker CLI
RUN apk add --no-cache postgresql-client docker-cli

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Add entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["npm", "start"] 