FROM node:18-slim

# Install dependencies required for Prisma
RUN apt-get update && apt-get install -y \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Create default data directory
RUN mkdir -p /data

# Set environment variables
ENV NODE_ENV=production
ENV DATA_DIR="/data"
ENV DATABASE_URL="file:/data/prod.db"
ENV PORT=3000

# Create volume for data persistence
VOLUME ["/data"]

# Expose port
EXPOSE 3000

# Create startup script that handles OSC_HOSTNAME and DATA_DIR
RUN echo '#!/bin/bash\n\
# Set PUBLIC_URL from OSC_HOSTNAME if defined\n\
if [ ! -z "$OSC_HOSTNAME" ]; then\n\
  export PUBLIC_URL="https://$OSC_HOSTNAME"\n\
  echo "Setting PUBLIC_URL to: $PUBLIC_URL"\n\
fi\n\
\n\
# Set DATA_DIR (defaults to /data if not set)\n\
DATA_DIR=${DATA_DIR:-/data}\n\
export DATABASE_URL="file:${DATA_DIR}/prod.db"\n\
echo "Using data directory: $DATA_DIR"\n\
echo "Database URL: $DATABASE_URL"\n\
\n\
# Create data directory if it doesn'\''t exist\n\
mkdir -p "$DATA_DIR"\n\
\n\
# Initialize database if it doesn'\''t exist\n\
if [ ! -f "${DATA_DIR}/prod.db" ]; then\n\
  echo "Initializing database..."\n\
  npx prisma db push\n\
fi\n\
\n\
# Start the application\n\
exec npm start' > /app/start.sh

RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]