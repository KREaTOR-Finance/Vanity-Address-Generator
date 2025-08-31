FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
# Miner binaries should be mounted at /miner (see docker-compose)
CMD ["node", "worker.js"] 