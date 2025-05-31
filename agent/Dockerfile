FROM node:18-alpine

# Install required packages
RUN apk add --no-cache docker-cli

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Expose Docker API port
EXPOSE 2375

# Start the agent
CMD ["node", "agent.js"] 