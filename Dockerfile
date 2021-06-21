FROM node:12

WORKDIR /nodeMon

COPY package*.json ./
RUN npm install && npm install -g typescript
COPY . .
RUN tsc

CMD [ "ts-node", "App.ts", "-f", "/config/config.yaml"]
