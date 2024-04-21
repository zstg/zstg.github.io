--- 
title: "Setup a simple blog using GitHub Pages and Astro" 
author: ZeStig
published: 2024-04-21T12:39:39+05:30 
tags : ["Git", "Astro"] 
category : "Blog"
keywords : ["Blog", "GitHub Pages"] 
description : "A quick tutorial on how to set up a blog post using Astro, hosted on GitHub pages" 
---

Blogs are a great way to share your thoughts, ideas, and experiences
with the world. They can be used for personal or professional purposes,
and there are blogs on just about every topic imaginable.

Astro is a popular static site generator that can be used to create
blogs, websites, and other types of online content. It is known for its
speed, flexibility, and ease of use.

In this blog post, I will walk you through the steps of creating a blog
with Astro. I will assume that you have some basic knowledge of Git and
the command line.

# Install pnpm and git

I use Arch **BTW**, and so i can install `Git` from the Arch
repositories. Instructions vary depending on OS and GNU/Linux
distribution.
`pnpm` is a faster drop-in replacement for `npm`.

``` bash
sudo pacman -S git pnpm
```

# Repo creation

The next step involves creating a public repo on GitHub (to host your website). I'll be
creating a repo for [GitHub Pages
deployment](https://github.com/zstg/zstg.github.io). I recommend beginners create these repos from the web interface rather than (pushing to a remote from
the command-line), but feel free to do it in any way you please.

After the repos are created, clone them to your local machine. In my case, I'm cloning my existing repo.

``` bash
cd ~/Git/ # an arbitrary directory where all my Git repos live
git clone https://github.com/zstg/zstg.github.io.git
cd zstg.github.io
```
Install all the npm dependencies required for the blog:

``` bash
pnpm i
```

Cool. Now we can start creating and uploading posts as we please! Run
this (in the same working directory) to create a
[MarkDown](https://markdownguide.org), `HTML` ~~or
[Org](https://orgmode.org)~~ file, where your blog will be stored.

To preview the posts that you write, run `pnpm build && pnpm astro preview` from the project root directory.

``` bash
$EDITOR src/content/posts/nameOfFile.md
```
---
**&#9432; NOTE**

> The `PAGE_SIZE` variable defined in `src/constants/constants.ts` defines the _number_ of articles allowed per page.

> The file structure instead of `src/content/posts` does NOT matter, categories and tags are defined at the top of each file.

---

Edit `src/content/posts/nameOfFile.md` and add a *brief* intro to your post.

``` bash
git add .
git commit -am "Add new content"
git push
```

Next up, we need to add a _GitHub Action_ (provided by Astro) that deploys from our existing repo.

Create `.github/workflows/deploy.yml` with the following content. **Ensure** that Actions are enabled and that the `Allow all actions and reusable workflows`  option is checked.
```yaml
name: Deploy to GitHub Pages

on:
  # Trigger the workflow every time you push to the `main` branch
  # Using a different branch name? Replace `main` with your branch’s name
  push:
    branches: [main]
  # Allows you to run this workflow manually from the Actions tab on GitHub.
  workflow_dispatch:

# Allow this job to clone the repo and create a page deployment
permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout your repository using git
        uses: actions/checkout@v4
      - name: Install, build, and upload your site output
        uses: withastro/action@v2
        with:
            path: . # The root location of your Astro project inside the repository. (optional)
            node-version: 20 # The specific version of Node that should be used to build your site. Defaults to 18. (optional)
            package-manager: pnpm@latest # The Node package manager that should be used to install dependencies and build your site. Automatically detected based on your lockfile. (optional)

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```
After you push these changes to GitHub, the page should be generated after a while.

## Fin
Thanks for taking the time to read this blog!
