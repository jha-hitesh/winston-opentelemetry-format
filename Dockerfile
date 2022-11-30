FROM node:14.16-alpine as builder

COPY package.json /data/package.json
WORKDIR /data/
RUN npm install
ENV PATH /data/node_modules/.bin:$PATH

WORKDIR /srv/
COPY . /srv/

ENTRYPOINT ["node"]