---
title: "Configuring Arch post-install"
author: "ZeStig"
published: 2023-09-01
authorTwitter: "" #do not include @
cover: ""
tags: ["Linux", "Arch"]
keywords: ["Arch", "Linux"]
description: "This blog serves as a how-to on setting up Arch post-install. This involves configuring things that are usually installed on 'normie' distros."
showFullContent: false
readingTime: false
hideComments: false
category: "Linux"
---

I'm using Arch with Hyprland, and so here's a quick reference for getting things up-to-speed.
## Initial configuration
```bash
sudo pacman -S waybar mako libnotify starship wl-clipboard hyprland pipewire \
               pipewire-pulse xdg-desktop-portal-hyprland git ripgrep fd bat blueman \
			   brave-bin librewolf-bin \
		       eza fuse2 git-delta gpm grim slurp swappy hugo keepassxc \
			   kitty ly nano-syntax-highlighting zsh-syntax-highlighting neofetch  \
               networkmanager-applet noto-fonts oh-my-zsh-git pacman-contrib  \ 
	           openssh pinentry playerctl qt5-wayland qt6-wayland tree wireplumber \
	           man-pages # provides man pages for some C functions/headers
	 
usermod -aG input,video,dialout stig # in case this returns an error, modify accordingly

# Switch to Zsh as the user shell
chsh -s /usr/bin/zsh 

paru -S hyprpaper eww-tray-wayland-git

# Autostart required services
systemctl --user enable --now xdg-desktop-portal-hyprland wireplumber pipewire-pulse pipewire 
```
<!--
git clone https://gitlab.com/zstg/dotfiles ~/.dotfiles
syncer # linker not reqd, stuff is in PATH
~/.dotfiles/misc/setup-yay
~/dotfiles/misc/setup-rofi
~/.dotfiles/misc/setup-doom-emacs
~/.dotfiles/misc/setup-nvchad
-->

## Configuring GTK settings
```bash
paru -S arc-gtk-theme papirus-icon-theme bibata-cursor-theme-bin 
```
To make Arc-dark the default system theme, 
add this to `~/.config/gtk-3.0/settings.ini` - note that the required packages have been installed above. If you want a different set, modify accordingly.
```ini
  [Settings]
  gtk-theme-name = Arc-Dark
  gtk-icon-theme-name = ePapirus-Dark
  gtk-cursor-theme-name = Bibata-Modern-Ice
  
```

And add this to `~/.icons/default/index.theme`:
```ini
[Icon Theme]
Name=Default
Comment=Default Cursor Theme
Inherits=Bibata-Modern-Ice
```
## Fonts
For my setup, JetBrains Mono Nerd Font and Symbols Mono Nerd are required for font rendering. I've also installed `noto-fonts` for fallback rendering of non-English characters.
```bash
# paru -S ttf-ms-fonts # proprietary font required for LibreOffice Flatpak
paru -S ttf-jetbrains-mono-nerd ttf-nerd-fonts-symbols-common ttf-nerd-fonts-symbols-mono noto-fonts
sudo fc-cache -fv
fc-cache -fv
```
## Flatpak
This section involves installing and configuring Flatpak. Note that all my Flatpak packages will be 
```bash
paru -S flatpak
# DON'T ADD flathub for root!
flatpak --user remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
```
## Polkit
```bash
sudo pacman -S polkit-gnome gnome-keyring libgnome-keyring
# /lib/polkit-gnome/polkit-gnome-authentication-agent-1 is part of Hyprland config
systemctl --user enable --now gnome-keyring-daemon
```
## Swap 
```bash 
sudo fallocate -l 8G /swapfile # allocate 8 gigs to an empty file
sudo chmod 600 /swapfile # fix permissions
sudo mkswap /swapfile  # create the swap file
echo '/swapfile    none    swap    sw    0    0' | sudo tee -a /etc/fstab # make changes permanent
# sudo reboot to use the swapfile 
```
## Hibernate settings
Edit `/etc/systemd/logind.conf:`

```ini
# InhibitDelayMaxSec=5
HandlePowerKey=ignore
HandlePowerKeyLongPress=poweroff
HandleLidSwitch=hibernate
HandleLidSwitchExternalPower=hibernate
# DefaultTimeoutStopSec=5s
```
Edit `/etc/systemd/sleep.conf`:

```ini
AllowHibernation=yes
HibernateDelaySec=3600
```
