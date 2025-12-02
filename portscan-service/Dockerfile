FROM node:18-alpine
RUN apk add --no-cache nmap
WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
COPY index.js .
EXPOSE 8080
