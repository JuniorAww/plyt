FROM oven/bun:1

WORKDIR /app

COPY . .

RUN bun install

RUN apt-get update && apt-get install -y cron && rm -rf /var/lib/apt/lists/*

CMD ["sh", "-c", "cron && bun run start"]
