import type {
  LicenseConfig,
  NavBarConfig,
  ProfileConfig,
  SiteConfig,
} from './types/config'
import { LinkPreset } from './types/config'

export const siteConfig: SiteConfig = {
  title: 'ZeStig\'s blog',
  subtitle: 'Home',
  lang: 'en',
  themeHue: 250,
  banner: {
    enable: false,
    src: 'assets/images/hashtags-black.png',
  },
}

export const navBarConfig: NavBarConfig = {
  links: [
    LinkPreset.Home,
    LinkPreset.Archive,
    LinkPreset.About,
    {
      name: 'GitHub',
      url: 'https://github.com/zstg',
      external: true,
    },
  ],
}

export const profileConfig: ProfileConfig = {
  avatar: 'assets/images/demo-avatar.png',
  name: 'ZeStig',
  bio: 'Diehard Archlinux fanboy. Loves free software.',
  links: [
    {
      name: 'Mastodon',
      icon: 'fa6-brands:mastodon',
      url: 'https://fedia.social/@zstg',
    },
    {
      name: 'GitLab',
      icon: 'fa6-brands:gitlab',
      url: 'https://gitlab.com/zstg',
    },
    {
      name: 'GitHub',
      icon: 'fa6-brands:github',
      url: 'https://github.com/zstg',
    },
  ],
}

export const licenseConfig: LicenseConfig = {
  enable: false,
  name: 'CC BY-NC-SA 4.0',
  url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
}
