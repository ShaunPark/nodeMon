FROM node:alpine

WORKDIR /nodeMon

COPY *.json ./
RUN apk add --no-cache bash
RUN npm install && npm install -g typescript && npm install -g ts-node
COPY . .
RUN tsc
#RUN mv /nodeMon/node.js /nodeMon/node_modules/aws-sdk/lib/http/node.js
# RUN cp /nodeMon/coreV1Api.js /nodeMon/node_modules/@kubernetes/client-node/dist/gen/api/coreV1Api.js
EXPOSE 8880

CMD [ "node", "build/NodeMonMain.js", "-f", "/config/config.yaml"]