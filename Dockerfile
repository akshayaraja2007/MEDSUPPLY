FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci

COPY ai/requirements.txt ./ai/requirements.txt

RUN pip3 install \
    --no-cache-dir \
    --break-system-packages \
    -r ./ai/requirements.txt

COPY . .

EXPOSE 5000

CMD ["node", "server.js"]