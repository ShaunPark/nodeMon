FROM node:alpine

WORKDIR /nodeMon

COPY *.json ./

RUN npm install && npm install -g typescript && npm install -g ts-node
COPY . .
RUN tsc

CMD [ "ts-node", "NodeMonMain.ts", "-f", "/config/config.yaml"]