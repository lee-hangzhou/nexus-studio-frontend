FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . ./
ARG VITE_API_ORIGIN=
ENV VITE_API_ORIGIN=$VITE_API_ORIGIN
RUN npm run build

FROM nginx:1.27.5

RUN ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone
ENV BACKEND_UPSTREAM=backend:8000
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80
