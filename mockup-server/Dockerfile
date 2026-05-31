FROM node:24-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund --loglevel=error

# Vite project files (configs + entry); MOCKUP.jsx is bind-mounted at runtime from repo root
COPY vite.config.js tailwind.config.js postcss.config.js index.html ./
COPY src ./src

ENV CHOKIDAR_USEPOLLING=true
ENV WATCHPACK_POLLING=true

EXPOSE 5173

CMD ["npm", "run", "dev"]
