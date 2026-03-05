FROM ubuntu:24.04

# Install common tooling
RUN apt-get update && apt-get install -y \
    git \
    nodejs \
    npm \
    curl \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Install cursor-cli
RUN curl -fsSL https://cursor.com/docs/cli/install.sh | sh

# Copy entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Set working directory
WORKDIR /workspace

# Set entrypoint
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
