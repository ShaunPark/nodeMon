FROM coolage/nodemon-base:latest

WORKDIR /nodeMon

COPY . .
#RUN mv /nodeMon/node.js /nodeMon/node_modules/aws-sdk/lib/http/node.js
# RUN cp /nodeMon/coreV1Api.js /nodeMon/node_modules/@kubernetes/client-node/dist/gen/api/coreV1Api.js
RUN apk add --no-cache tzdata
ENV TZ=Asia/Seoul
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
EXPOSE 8880
RUN tsc
CMD [ "ts-node", "NodeMonMain.ts", "-f", "/config/config.yaml"]