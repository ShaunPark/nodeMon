FROM node:12

WORKDIR /nodeMon

COPY package*.json .
RUN npm install && npm install -g typescript $$ npm install -g ts-node
COPY . .
RUN tsc

CMD [ "ts-node", "App.ts", "-f", "/config/config.yaml"]