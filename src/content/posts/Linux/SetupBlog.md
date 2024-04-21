--- 
title: "Setup a simple blog using GitHub Pages and Hugo" 
author: ZeStig
published: 2024-03-26T14:39:39+05:30  
tags : ["Git", "Hugo"] 
category : "Blog"
keywords : ["Blog", "GitHub Pages"] 
description : "A quick tutorial on how to set up a blog post using Hugo, hosted on GitHub pages" 
---

Blogs are a great way to share your thoughts, ideas, and experiences
with the world. They can be used for personal or professional purposes,
and there are blogs on just about every topic imaginable.

Hugo is a popular static site generator that can be used to create
blogs, websites, and other types of online content. It is known for its
speed, flexibility, and ease of use.

In this blog post, I will walk you through the steps of creating a blog
with Hugo. I will assume that you have some basic knowledge of Git and
the command line.

# Install hugo and git

I use Arch **BTW**, and so i can install `Hugo` and `Git` from the Arch
repositories. Instructions vary depending on OS and GNU/Linux
distribution.

``` bash
sudo pacman -S hugo git
```

# Repo creation

The next step involves creating public repos on GitHub. I'll be
creating 2 repos, a **non-empty** repo for [GitHub Pages
deployment](https://github.com/zstg/zstg.github.io) and the other for
storing [the blog itself](https://github.com/zstg/blog). For beginners,
I recommend creating these repos from the web interface rather than the
commandline, but feel free to do it in any way you please.

After the repos are created, clone them to your local machine:

``` bash
cd ~/Git/ # an arbitrary directory where all my Git repos live
git clone https://github.com/zstg/blog.git
cd blog
```

Now it's time to fire up the website template!

``` bash
hugo new site zstgblog # choose any name, doesn't have to be zstgblog ;)
cd zstgblog/
```

I like [this](https://github.com/panr/hugo-theme-terminal) particular
Hugo theme, so I'm fetching it too...

``` bash
# Note that I'm still inside the zstgblog directory.
git submodule add https://github.com/panr/hugo-theme-terminal themes/terminal
```

Next, add/modify `zstgblog/hugo.toml`{.verbatim} like so: (obviously,
replace with the name you'd provided earlier, and modify the details
below to your liking)

``` toml
baseURL = 'https://zstg.github.io/'
languageCode = 'en-us'
paginatePath = "page"
showMenuItems = 0
theme = "terminal"
[params]
  themeColor = "blue"
  # fullWidthTheme = true
  centerTheme = true

[params.logo]
   logoText = "Stig's blog"
   logoHomeLink = "/"
```

Cool. Now we can start creating and uploading posts as we please! Run
this (in the same working directory) to create a
[MarkDown](https://markdownguide.org), `HTML` or
[Org](https://orgmode.org) file, where your blog will be stored.

``` bash
hugo new posts/nameOfFile.md
```

Edit `content/posts/nameOfFile.md` and add a *brief* intro to your post.

Next, make the GitHub Page repo
(<https://github.com/username/username.github.io>) a `Git submodule` of
the current repo. This is done to ensure that this repo can be used for
GitHub Pages.

``` bash
# Ensure that you're in the zstgblog directory
git submodule add https://github.com/zstg/zstg.github.io.git public
```

We can now deploy this repo to GitHub and it will automatically be
converted to a proper GitHub page powered by Hugo.

``` bash
# in zstgblog
# git rm -r --cached public
hugo 
cd public
git add .
git commit -am "Add new content"
git push
cd ..
git add .
git commit -am "Rebuilt website"
git push
```

References
