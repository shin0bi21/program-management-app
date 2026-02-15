FROM node:20-alpine

# Install PostgreSQL client for psql migrations
RUN apk add --no-cache postgresql-client

WORKDIR /app

# Note: Dependencies and code are mounted via volumes in docker-compose.yml
# This keeps the image lightweight for development

# Expose port for API
EXPOSE 5001

# Keep container running for exec commands (migrations, npm scripts)
CMD ["tail", "-f", "/dev/null"]
