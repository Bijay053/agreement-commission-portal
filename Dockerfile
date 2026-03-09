FROM node:20-alpine AS base

WORKDIR /app

FROM base AS deps
COPY package.json ./
RUN npm install

FROM deps AS build
COPY . .
RUN mkdir -p uploads && npm run build

FROM base AS production
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
RUN mkdir -p uploads
EXPOSE 5000
CMD ["node", "dist/index.cjs"]
