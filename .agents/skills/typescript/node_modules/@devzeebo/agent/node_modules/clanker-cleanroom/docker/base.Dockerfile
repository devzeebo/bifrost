# clanker-cleanroom/base
# Shared Arch/yay base for cursor, claude, and future agents.
# AUR installs (build-time only): USER aur && yay -S --noconfirm ... && USER root
FROM archlinux:latest

# pacman 7 sandboxes its downloader: drops to the `alpm` user, then applies a
# Landlock filesystem rule and a seccomp syscall denylist. Upstream already
# disables the Landlock half (no Landlock in container kernels). The seccomp
# half cannot load under Rosetta/QEMU user-mode emulation (every seccomp entry
# point returns EINVAL, regardless of --privileged or seccomp=unconfined), which
# breaks builds on Apple Silicon. Disabling only the syscall filter keeps the
# user drop + NO_NEW_PRIVS and is a no-op difference on native x86_64 hosts.
RUN sed -i 's/^#DisableSandboxSyscalls/DisableSandboxSyscalls/' /etc/pacman.conf \
  && grep -q '^DisableSandboxSyscalls' /etc/pacman.conf \
  && pacman -Sy --noconfirm --needed \
      base-devel git sudo curl ca-certificates \
  && useradd -m aur \
  && echo 'aur ALL=(ALL) NOPASSWD: ALL' > /etc/sudoers.d/aur \
  && chmod 0440 /etc/sudoers.d/aur \
  && pacman -Scc --noconfirm

USER aur
WORKDIR /home/aur
RUN git clone https://aur.archlinux.org/yay-bin.git /tmp/yay-bin \
  && cd /tmp/yay-bin \
  && makepkg -si --noconfirm \
  && rm -rf /tmp/yay-bin

USER root
WORKDIR /
