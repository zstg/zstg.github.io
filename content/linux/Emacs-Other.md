---
title: "Miscellaneous Emacs configuration"
date: 2024-12-11
author: ZeStig 
category: "Emacs"
description: "Interesting Emacs configuration ideas" 
---

I've been spending a bit of time getting my Emacs configuration up-to-date, cutting down on bloat, and reducing package usage. Here's how it went:

## Setting up presentations

One of the things I wanted to streamline was setting up presentations directly from Emacs. I've tried a couple of methods, and here's a quick rundown of what worked best for me.

### Setting up a LaTeX environment

Org-mode continues to be one of Emacs' most powerful tools. One thing I discovered recently is the *Org-beamer* export feature, which lets you create presentations directly from Org files. It's pretty neat since you can structure your slides just like an outline. It's like writing your slides in markdown but with the full power of Org-mode's features. All you need to do is use a couple of `#+` directives, and the export to LaTeX will handle the rest.

Note that this needs the following set up:
- `pandoc` - I obtained it from the [AUR](https://aur.archlinux.org) since I use Arch (BTW). Installation steps vary depending on the GNU+Linux distribution and OS.
- `TeXLive` - it's possible to use the system package on Archlinux, but I've setup a local installation. Here's how I did it:

```bash
mkdir -p ~/.Texlive
cd ~/.Texlive
wget https://mirror.ctan.org/systems/texlive/tlnet/install-tl-unx.tar.gz
# this typically needs gunzip installed
unzip ~/.dotfiles/scripts/ex install-tl-unx.tar.gz
./install-tl --texdir ~/.Texlive
```
I added the Texlive installation to the Emacs `path` because I do not like these scripts *"polluting"* my `fish` suggestions 🙄. Anyways, a simple
```lisp
(setenv "PATH" (concat (getenv "HOME") "/.Texlive/bin/x86_64-linux:" (getenv "PATH")))
```
did the job for me.

I ended up using this setup for a few talks, and honestly, it's super handy. The presentation is completely text-based, so you can tweak content as easily as changing a heading. I also love that you can embed code blocks with results in your slides if you're doing a technical talk, which looks great.

#### Org-beamer

The LaTeX backend for Org-beamer is solid and works wonders with the LaTeX environment mentioned above. YMMV.

Here’s a minimal setup for using Org-beamer:

```
#+LATEX_CLASS: beamer
#+LATEX_CLASS_OPTIONS: [presentation]
#+BEAMER_THEME: Madrid
```

You can specify themes, colors, and the layout you want. A couple of tweaks like this can go a long way to make your presentation look clean without needing to dive into too many customization details.

Here's what my setup looks like. Note that I've set this in my Emacs configuration because I'll _mostly_ follow similar settings across presentations.
```lisp
(setq org-latex-default-class "beamer"
	org-latex-class-options "[smaller]"
	org-beamer-theme "Malmoe"
	org-latex-with-hyperref nil)
```

To get Org-Beamer to work, all you need to do is add a `#+STARTUP: beamer` to the (top of) the file you want to export.

You can then export your slides to `Beamer PDF` and open it in any PDF viewer (or even your browser). Sweet. Who needs ~~PowerPoint~~ office suites?!

### Via Org-reveal and RevealJS

On the other hand, if you’re more into web-based presentations, Org-reveal comes to the rescue. It exports your Org-mode files to HTML and integrates seamlessly with Reveal.js, giving you smooth transitions and interactive slides.

The process is pretty straightforward: just make sure you’ve got the necessary tools installed (like the `ox-reveal` package). Once you've set up Org-reveal, your Org files can become fully interactive web presentations. 

The best part? You can embed JavaScript, custom themes, and even interactive elements like quizzes and polls. I prefer this setup for non-technical presentations, where I want some snazzy effects and a more polished, web-based result.

Call me biased, but I prefer this over the previously mentioned Beamer solution. Who doesn't like some pizzazz??

Add something like this to the Org file that you want to export:
```
#+REVEAL_JS: t
#+REVEAL_THEME: solarized
#+REVEAL_TRANSITIONS: zoom
```
And here are my settings:
```lisp
(setq
	;; org-reveal-root "https://cdn.jsdelivr.net/npm/reveal.js"
	org-reveal-root "/home/stig/Git/reveal.js"
	org-reveal-theme "league"
	org-reveal-width 1920 ;; 1200 too small
	org-reveal-height 1080 ;;800 too broad
	org-reveal-margin 0.001
	org-reveal-min-scale 0.01
	org-reveal-max-scale 1.0
	org-reveal-transition "cube" ;; Wayfire vibes
	;; org-reveal-head-preamble "<meta name=\"description\" content=\"Org-Reveal Introduction.\">"
	;; org-reveal-postamble "<p> Created by ZeStig. </p>"
	org-reveal-hlevel 1)
```

There are lots of themes and transitions available out of the box, and you can always tweak them as needed.

## Switching to Elpaca from Straight

I’ve also been taking a closer look at package management in Emacs. After spending a long time using Straight.el, I decided to give Elpaca a try, mostly due to its simplicity and speed. Straight.el has been great, but it can sometimes feel like overkill, especially if you’re just looking for a lightweight, fast way to manage packages.

Elpaca is built to be much leaner, and it doesn’t try to do too much. It’s focused on performance, which, for me, is a huge deal. I noticed a slight performance boost after switching, and the configuration is super simple compared to what I had with Straight.el.

Here's how you set it up:

(I've plagiarised this from the [elpaca README](https://github.com/progfolio/elpaca?tab=readme-ov-file#installer)).
```lisp
(defvar elpaca-installer-version 0.8)
(defvar elpaca-directory (expand-file-name "elpaca/" user-emacs-directory))
(defvar elpaca-builds-directory (expand-file-name "builds/" elpaca-directory))
(defvar elpaca-repos-directory (expand-file-name "repos/" elpaca-directory))
(defvar elpaca-order '(elpaca :repo "https://github.com/progfolio/elpaca.git"
                              :ref nil :depth 1
                              :files (:defaults "elpaca-test.el" (:exclude "extensions"))
                              :build (:not elpaca--activate-package)))
(let* ((repo  (expand-file-name "elpaca/" elpaca-repos-directory))
       (build (expand-file-name "elpaca/" elpaca-builds-directory))
       (order (cdr elpaca-order))
       (default-directory repo))
  (add-to-list 'load-path (if (file-exists-p build) build repo))
  (unless (file-exists-p repo)
    (make-directory repo t)
    (when (< emacs-major-version 28) (require 'subr-x))
    (condition-case-unless-debug err
        (if-let* ((buffer (pop-to-buffer-same-window "*elpaca-bootstrap*"))
                  ((zerop (apply #'call-process `("git" nil ,buffer t "clone"
                                                  ,@(when-let* ((depth (plist-get order :depth)))
                                                      (list (format "--depth=%d" depth) "--no-single-branch"))
                                                  ,(plist-get order :repo) ,repo))))
                  ((zerop (call-process "git" nil buffer t "checkout"
                                        (or (plist-get order :ref) "--"))))
                  (emacs (concat invocation-directory invocation-name))
                  ((zerop (call-process emacs nil buffer nil "-Q" "-L" "." "--batch"
                                        "--eval" "(byte-recompile-directory \".\" 0 'force)")))
                  ((require 'elpaca))
                  ((elpaca-generate-autoloads "elpaca" repo)))
            (progn (message "%s" (buffer-string)) (kill-buffer buffer))
          (error "%s" (with-current-buffer buffer (buffer-string))))
      ((error) (warn "%s" err) (delete-directory repo 'recursive))))
  (unless (require 'elpaca-autoloads nil t)
    (require 'elpaca)
    (elpaca-generate-autoloads "elpaca" repo)
    (load "./elpaca-autoloads")))
(add-hook 'after-init-hook #'elpaca-process-queues)
(elpaca `(,@elpaca-order))

  ;; Install use-package support
(elpaca elpaca-use-package
  ;; Enable :elpaca use-package keyword.
  (elpaca-use-package-mode)
  ;; Assume :elpaca t unless otherwise specified.
  ;; (setq elpaca-use-package-by-default t)) -> replace https://github.com/progfolio/elpaca/issues/255
  (setq use-package-always-ensure t))
(elpaca-wait)
```

Then, I just migrated my existing packages over to Elpaca. The process was smooth and didn’t require a complete rework of my setup. So far, everything's been fast, and the management overhead is much lower. 

For migrating packages available on GitHub from Straight to Elpaca:

```diff
- (use-package emacs-everywhere
-      :straight (:type git :host github :repo "tecosaur/emacs-everywhere")
+ (use-package emacs-everywhere
+  :ensure '(emacs-everywhere :host github :repo "tecosaur/emacs-everywhere")
```

If you're looking to simplify your package management and reduce some of the complexity that comes with more feature-rich solutions like Straight, Elpaca is definitely worth checking out.

## Org Roam
[Roam](https://roamresearch.com/) is a note-taking application designed around the concept of **bidirectional linking**.  This means that when you create a link to another note, that link is also automatically added to the linked note, creating a web of interconnected ideas.  This is in contrast to traditional note-taking apps which treat notes as isolated files.

Let's say you're writing a note about "Artificial Intelligence."  You might link to related notes like "Machine Learning", "Deep Learning" and "Neural Networks".  Then, when you look at the "Machine Learning" note, you'll see a backlink to your "Artificial Intelligence" note. Org-Roam also provides a graph UI of the links thus generated.

### Setting up Syncthing
Install Syncthing. Instructions vary across operating systems. Here's how I do it:
```bash
sudo pacman -S syncthing
```
I've also enabled the Syncthing daemon - `systemctl --user enable --now syncthing`.

We can proceed to configuring Syncthing. I've used one mobile phone for demonstration purposes, but this procedure is identical for any number of devices - phones and computers alike.

![Setting up Syncthing to work - part 1](/linux/Syncthing1.png)

![Part 2](/linux/Syncthing2.png)

Note that `HyperOS` is the name that I've assigned to my phone on Syncthing.

Simply download the Syncthing app on your other device - it would automatically detect all devices on your network (that have Syncthing running). Choose the right device and you're done. I use [Org-note](https://org-note.com/) to view/edit notes on my phone.

### Org-Roam-UI
This package - installed along with Org-Roam -  provides the ability to visually display your notes as a graph, showing the connections between them. This provides a powerful way to understand the structure of your knowledge base and identify relationships between different concepts.

Here's my Org and Org-Roam configuration:

```lisp
(use-package org-roam
  :config
  (setq org-roam-directory (file-truename "~/Documents/Notes")))

(use-package org-roam-ui
  :ensure '(org-roam-ui :host github :repo "org-roam/org-roam-ui")
  :after org-roam
  ;;  :hook (after-init . org-roam-ui-mode)
  :config
  (setq org-roam-ui-sync-theme t
        org-roam-ui-follow t
	org-roam-completion-everywhere t
        org-roam-ui-update-on-save t
        org-roam-ui-open-on-start t)
  (org-roam-db-autosync-enable))
```

Feel free to change the location where you store notes via the `org-roam-directory` variable. `org-roam-db-autosync-enable` will automaically sync the graph UI and redraw the graph as nodes get added/removed/modified.

Create your first node using `org-roam-node-find`. This brings up a *capture buffer* where you can type stuff. After you're done, simply save the file.

Note that **nodes will be created automatically if they do not exist**.

To link notes, use the `org-roam-node-insert` function. This function is what creates a link in the graph web UI. 

Open the web UI in a browser using `org-roam-ui-open`. 

Here's what the web UI looks like in my Notes folder:
![Org Roam in 2D](/linux/ORUI1.png)
![Some customization](/linux/ORUI2.png)
I like the Gruvbox theme, so I'd probably apply it from the web UI. Prefs will be saved in cache.
## Mail
>This is where the fun begins.

> Anakin, Ep 3, Revenge of the Sith (2005)

You need a mail indexer such as `mu` installed. You also need a mailbox synchroniser such as `mbsync`:

```bash
yay -S mu
sudo pacman -S isync gnutls
```
`gnutls` is likely installed by default on your GNU+Linux distribution.
Then you need an <u>_Application Password_</u> for authenticating to GMail. You can obtain one from the [Google Accounts](https://myaccount.google.com) page. Simply search for "App Password" in the search field and create an app password. Store the App password securely for we'll need it later.

We now need to configure Emacs and `mbsync`. 

### Emacs
Add this to your configuration:
```lisp
(add-to-list 'load-path "/usr/share/emacs/site-lisp/mu4e")(require 'mu4e)(use-package mu4e  :ensure nil  :config
  (setq mail-user-agent 'mu4e-user-agent)

  (setq mu4e-drafts-folder "/[Gmail].Drafts")
  (setq mu4e-sent-folder   "/[Gmail].Sent Mail")
  (setq mu4e-trash-folder  "/[Gmail].Trash")

  ;; don't save message to Sent Messages, Gmail/IMAP takes care of this
  (setq mu4e-sent-messages-behavior 'delete)

    ;; setup some handy shortcuts
  ;; you can quickly switch to your Inbox -- press ``ji''
  ;; then, when you want archive some messages, move them to
  ;; the 'All Mail' folder by pressing ``ma''.
  
   (setq mu4e-maildir-shortcuts
    '( (:maildir "/INBOX"              :key ?i)
       (:maildir "/[Gmail].Sent Mail"  :key ?s)
       (:maildir "/[Gmail].Trash"      :key ?t)
       (:maildir "/[Gmail].All Mail"   :key ?a)))

  (add-to-list 'mu4e-bookmarks
           ;; ':favorite t' i.e, use this one for the modeline
           '(:query "maildir:/inbox" :name "Inbox" :key ?i :favorite t))

  ;; allow for updating mail using 'U' in the main view:
  (setq mu4e-get-mail-command "mbsync -a")

  ;; something about ourselves
  (setq user-mail-address "<USERNAME>@gmail.com"
    user-full-name  "<NAME>")
  ;; ( setq message-signature (concat "\n" "\n"))

  (setq mu4e-compose-signature (concat "Sent with <U+E7CF>\n" "https://zstg.is-a.dev\n"))
   (require 'smtpmail)
  (setq message-send-mail-function 'smtpmail-send-it
    send-mail-function 'smtpmail-send-it
    smtpmail-default-smtp-server "smtp.gmail.com"
    smtpmail-smtp-server "smtp.gmail.com"
    smtpmail-smtp-service 587
    smtpmail-stream-type 'starttls
    smtpmail-smtp-user "<USERNAME>@gmail.com"
    starttls-use-gnutls t
    starttls-gnutls-program "gnutls-cli"
    starttls-extra-arguments nil)
  ;; this is not the right place to configure auth details...
  (setq auth-source-debug t
    auth-sources '((:source "~/.authinfo.gpg"))
        ;; don't keep message buffers around
        message-kill-buffer-on-exit t))
```
Replace `USERNAME` and `NAME` appropriately.

But wait? Where are the actual Gmail credentials? Surely they must be stored somewhere?

To answer that question, add this to the `~/.authinfo` file: Create the file if it doesn't exist.


```bash
machine "smtp.gmail.com" login "username@gmail.com" password "abcd bcde cdef defg"
```
Obviously replace `abcd bcde cdef defg` with the _Application Password_ that you set previously.

Now encrypt this file:

```bash
gpg -c ~/.authinfo
```
This will create a `~/.authinfo.gpg` file that stores the App Password.

Do the same thing for your Gmail password.

```
echo <password> > .passwd
gpg -c .passwd
rm .passwd
```
*NOTE*: `<password>` is your <u>application password</u>, not the Google Account password. 
I'm not sure if this changed recently (as of time of this update) or if it has always been that way.

Create the directory where you want to store your mail. I've stored mine in `~/.mail`.
We're almost there. Now all that's left is to configure `mbsync` (aka `isync`) and fetch the mail...

Create `~/.mbsyncrc` with the following content:

```bash
IMAPStore gmail-remote
Host imap.gmail.com
SSLType IMAPS
AuthMechs LOGIN
User <USERNAME>@gmail.com
PassCmd "gpg -dq --for-your-eyes-only ~/.passwd.gpg"

MaildirStore gmail-local
Path ~/.mail/
Inbox ~/.mail/INBOX
Subfolders Verbatim

Channel gmail
Master :gmail-remote:
Slave :gmail-local:
Create Both
Expunge Both
Patterns * !"[Gmail]/All Mail" !"[Gmail]/Important" !"[Gmail]/Starred" !"[Gmail]/Bin"
SyncState *
```
Obviously replace `<USERNAME>@gmail.com` with your email address.

Finally, let's create initialise the mail index and fetch the mail:

```bash
mu init --maildir=$HOME/.mail --my-address='<USERNAME>@gmail.com'
mu index
```

When you open Emacs the next time, a simple `mu4e-update-index` will display all the email you have received.
## RSS

I'm not quite sure how often (or even if) I'll use this functionality, but I've set up an RSS reader inside Emacs. This was simple to do, and I've just plagarised [DT](https://distro.tube)'s [configuration](https://gitlab.com/dwt1/dotfiles/-/blob/master/.config/emacs/config.org).

```lisp
(use-package elfeed
  :config
  (setq elfeed-search-feed-face ":foreground #ffffff :weight bold"
        elfeed-feeds (quote
	(("https://www.reddit.com/r/linux.rss" reddit linux)
	("https://www.reddit.com/r/archlinux.rss" reddit archlinux)
	("https://www.reddit.com/r/linuxfornoobs.rss" reddit linuxfornoobs)
	("https://www.reddit.com/r/linuxquestions.rss" reddit linuxquestions)
	("https://www.reddit.com/r/commandline.rss" reddit commandline)
	("https://www.reddit.com/r/distrotube.rss" reddit distrotube)
	("https://www.reddit.com/r/emacs.rss" reddit emacs)
	("https://www.gamingonlinux.com/article_rss.php" gaming linux)
	("https://hackaday.com/blog/feed/" hackaday linux)
	("https://opensource.com/feed" opensource linux)
	("https://linux.softpedia.com/backend.xml" softpedia linux)
	("https://itsfoss.com/feed/" itsfoss linux)
	("https://www.zdnet.com/topic/linux/rss.xml" zdnet linux)
	("https://www.phoronix.com/rss.php" phoronix linux)
	("http://feeds.feedburner.com/d0od" omgubuntu linux)
	("https://www.computerworld.com/index.rss" computerworld linux)
	("https://www.networkworld.com/category/linux/index.rss" networkworld linux)
	("https://www.techrepublic.com/rssfeeds/topic/open-source/" techrepublic linux)
	("https://betanews.com/feed" betanews linux)
	("http://lxer.com/module/newswire/headlines.rss" lxer linux)
	("https://distrowatch.com/news/dwd.xml" distrowatch linux)))))
```
## Fin

All in all, this update to my Emacs setup has been pretty satisfying. I’ve cut down on unnecessary packages, streamlined my workflow for creating presentations, and improved performance. The best part is that it’s still flexible enough for me to jump into new tools or adjust things as I need them.

If you’re looking to clean up your own configuration or try out some of the things I mentioned, I’d say go for it. Emacs is an ongoing adventure, and it’s always fun to explore new ways of improving the experience. Happy hacking!
