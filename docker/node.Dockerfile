# bifrost/node
# Node.js script runtime derived from the cleanroom base (no harness).
FROM clanker-cleanroom/base

USER aur
RUN yay -S --noconfirm --needed nodejs npm \
  && yay -Scc --noconfirm

USER root
RUN mkdir -p /opt/bifrost /workspace
COPY docker/run-script.mjs /opt/bifrost/run-script.mjs

WORKDIR /workspace
ENTRYPOINT ["node", "/opt/bifrost/run-script.mjs"]
