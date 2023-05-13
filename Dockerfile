FROM node:lts

COPY server.js .
COPY package.json .
COPY package-lock.json .
COPY LICENSE .

RUN npm ci

CMD ["node", "server.js"]