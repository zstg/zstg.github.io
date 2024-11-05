---
title: "Configuring BTRFS on Arch"
author: "ZeStig"
date: 2024-11-04
authorTwitter: "" #do not include @
cover: ""
keywords: ["Arch", "Linux"]
description: "How to configure BTRFS on a fresh Archlinux install."
showFullContent: false
readingTime: false
hideComments: false
category: "Linux"
---

This guide is for anyone who's just installed Arch Linux with GRUB and BTRFS. I’m going to keep things straightforward, using the defaults set up by `archinstall`. If you’re ready, let’s dive in!

## Install Required Packages

First things first, we need some essential tools to manage BTRFS effectively. Open up your terminal and run:

```bash
sudo pacman -S snapper snap-pac grub-btrfs
```

### What Are These Packages?

- **Snapper**: This handy tool helps you create and manage BTRFS snapshots. Think of snapshots as save points in a video game—they let you revert your system to a previous state if something goes wrong.
  
- **Snap-pac**: This adds a hook to `pacman`, Arch’s package manager. Basically, it automatically takes a snapshot before or after you install, remove, or upgrade packages. This is super useful because if an update breaks something, you can roll back without a hassle.

- **Grub-btrfs**: This package helps integrate BTRFS with your bootloader, GRUB. It makes it easier to manage boot entries and snapshots from the boot menu.

## Procedure

### Clean Up Existing Snapshots

If this is a fresh install, you likely don’t have any snapshots yet, but just to be sure, let’s remove any existing ones:

```bash
sudo umount /.snapshots
sudo rm -r /.snapshots
```

### Create a New Root Config

Now, let’s create a configuration for the root filesystem. This will set up a place for your snapshots to live:

```bash
sudo snapper -c root create-config /
```

This command creates a subvolume `/.snapshots` where all your snapshots will be stored. It’s like giving your snapshots a nice home!

### Reinitialize Snapshots

Next, we need to make sure the `.snapshots` directory is accessible:

```bash
sudo mkdir /.snapshots
sudo mount -a
```

This mounts the `.snapshots` subvolume so Snapper can actually use it.

### Fix Some Permissions

Let’s set the right permissions to ensure everything works smoothly:

```bash
sudo chmod 750 /.snapshots
sudo chown :wheel /.snapshots
```

These commands set the permissions so that only the root and users in the `wheel` group can access the snapshots, keeping your system secure.

### Enable Automatic Snapshotting

To make your life easier, we want to enable automatic snapshotting. This way, you won’t have to remember to take snapshots manually:

```bash
sudo systemctl enable --now snapper-timeline.timer snapper-cleanup.timer
```

This enables two timers: one for creating snapshots automatically at set intervals, and another for cleaning up old snapshots to save space.

### Add Snapshots to GRUB

To make sure you can boot into your snapshots, you need to configure GRUB. Open the GRUB configuration file and ensure this line is present:

```bash
GRUB_BTRFS_GRUB_DIRNAME="/boot/efi"
```

This tells `grub-btrfs` where to find the GRUB directory.

### Enable grub-btrfsd

Next, we want to set up `grub-btrfsd` to automatically generate the `grub-btrfs.cfg` file whenever you make changes. You can enable it with:

```bash
sudo systemctl enable --now grub-btrfsd
```

This service will keep your GRUB menu up to date with the latest snapshots, so you can easily boot into a previous state if needed.

## Chrooting into a BTRFS System

If you ever need to troubleshoot or repair your system, you might need to `chroot` into your BTRFS environment. Here’s how:

1. Boot from an Arch Linux live USB.
2. Open a terminal.
3. First, you need to mount your BTRFS subvolumes correctly. Here's how you can do that with the default setup from `archinstall`:

   ```bash
   mount -o subvol=@ /dev/sdXY /mnt
   mount -o subvol=@home /dev/sdXY /mnt/home
   mount -o subvol=@pkg /dev/sdXY /mnt/var/cache/pacman/pkg
   mount -o subvol=@log /dev/sdXY /mnt/var/log
   mount -o subvol=@snapshots /dev/sdXY /mnt/.snapshots
   mount /dev/sdXZ /mnt/boot
   ```

   Replace `/dev/sdXY` and `/dev/sdXZ` with your actual device identifiers (you can find these using `lsblk`).

4. Once everything is mounted, enter the chroot environment:

   ```bash
   arch-chroot /mnt
   ```

You’re now inside your system’s environment and can make changes as needed.

## System Rollback the Arch Way

One of the coolest features of BTRFS is its snapshot capability, which allows you to roll back your system if something goes wrong. Here’s how to do it, based on points from the Arch Wiki:

1. **List Existing Snapshots**: First, check your existing snapshots to see what you have:

   ```bash
   sudo snapper list
   ```

   This will show you a list of snapshots, along with their IDs.

2. **Roll Back to a Previous Snapshot**: If you find a snapshot that you want to revert to, you can use the following command:

   ```bash
   sudo snapper rollback <snapshot_id>
   ```

   Replace `<snapshot_id>` with the ID of the snapshot you want to roll back to.

3. **Reboot Your System**: After rolling back, reboot your system to apply the changes:

   ```bash
   sudo reboot
   ```

When your system starts back up, it will be in the state it was at the time of that snapshot.

### Important Note

Rolling back will restore the files in the root subvolume to their state at the time of the snapshot. However, be careful—any changes made after the snapshot will be lost. Always ensure you have backups of important data before rolling back.

## Conclusion

And there you have it! You’ve successfully configured BTRFS on your Arch Linux installation, set up automatic snapshots, and learned how to roll back your system when needed. This setup not only enhances your system’s stability but also gives you peace of mind, knowing you can revert to a previous state if something breaks.

Feel free to play around with the snapshots and see how they work—it's a powerful feature that can save you a lot of headaches in the long run. Happy tinkering!
