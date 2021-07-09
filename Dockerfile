FROM coolage/nodemon-base:latest

WORKDIR /nodeMon

COPY . .
#RUN mv /nodeMon/node.js /nodeMon/node_modules/aws-sdk/lib/http/node.js
# RUN cp /nodeMon/coreV1Api.js /nodeMon/node_modules/@kubernetes/client-node/dist/gen/api/coreV1Api.js
EXPOSE 8880

CMD [ "ts-node", "NodeMonMain.ts", "-f", "/config/config.yaml"]