FROM node:lts

WORKDIR /app

COPY server.js .
COPY package.json .
COPY package-lock.json .
COPY LICENSE .

RUN npm ci

CMD ["node", "server.js"]