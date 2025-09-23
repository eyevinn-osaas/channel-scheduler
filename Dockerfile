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

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Set environment variables
ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/data/prod.db"
ENV PORT=3000

# Expose port
EXPOSE 3000

# Create startup script that handles OSC_HOSTNAME
RUN echo '#!/bin/bash\n\
# Set PUBLIC_URL from OSC_HOSTNAME if defined\n\
if [ ! -z "$OSC_HOSTNAME" ]; then\n\
  export PUBLIC_URL="https://$OSC_HOSTNAME"\n\
  echo "Setting PUBLIC_URL to: $PUBLIC_URL"\n\
fi\n\
\n\
# Initialize database if it doesn'\''t exist\n\
if [ ! -f /app/data/prod.db ]; then\n\
  echo "Initializing database..."\n\
  npx prisma db push\n\
fi\n\
\n\
# Start the application\n\
exec npm start' > /app/start.sh

RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]