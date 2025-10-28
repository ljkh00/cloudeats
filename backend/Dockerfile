# Use Node.js official image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY server.js ./

# Expose API port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]