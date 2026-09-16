# clanker-cleanroom/cursor
FROM clanker-cleanroom/base

# Official Cursor CLI installer; install under a world-readable path so
# arbitrary host UIDs (docker --user) can run agent.
RUN curl -fsSL https://cursor.com/install | bash \
  && VERSION_DIR="$(find /root/.local/share/cursor-agent/versions -mindepth 1 -maxdepth 1 -type d | head -1)" \
  && test -n "$VERSION_DIR" \
  && mkdir -p /usr/local/lib /usr/local/bin \
  && cp -a "$VERSION_DIR" /usr/local/lib/cursor-agent \
  && ln -sf /usr/local/lib/cursor-agent/cursor-agent /usr/local/bin/cursor-agent \
  && ln -sf /usr/local/lib/cursor-agent/cursor-agent /usr/local/bin/agent \
  && chmod -R a+rX /usr/local/lib/cursor-agent \
  && command -v agent

# Empty home for arbitrary host UIDs; only auth.json is bind-mounted at runtime.
RUN mkdir -p /home/agent/.config/cursor \
  && chmod -R 0777 /home/agent

ENV HOME=/home/agent
ENV PATH="/usr/local/bin:${PATH}"

WORKDIR /workspace

# Runtime identity is set via --user <host-uid>:<host-gid>.
# No ENTRYPOINT — the library passes `agent ...` as the container command.
