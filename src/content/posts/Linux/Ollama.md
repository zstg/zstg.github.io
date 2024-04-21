--- 
title: "How to run LLMs locally using Ollama" 
published: 2024-03-27T17:04:20+05:30 
author: ZeStig 
tags : ["Docker", "LLM","ML", "ChatGPT", "Ollama"] 
category : "Emacs"
description: "Running Large Language Models made simple using Ollama" 
---

PS: This post has **definitely** *not* been written using Ollama.

# What's Ollama?

Ollama provides an easy way to manage LLMs. It's a *command-line* app
that lets you run large language models right on your computer. It's
built on top of `llama.cpp`, a C++ library that makes it easy to run
models on CPUs or GPUs.

Whether you're using an older GPU or don't have one at all, Ollama's
got you covered. It's designed to be simple and focused, making it a
breeze to get started with LLMs.

# How do I run models locally?

Simple. Just run this in the terminal if you're on GNU+Linux or macOS.

``` bash
curl -fsSL https://ollama.com/install.sh | sh
```

If you're on Windows, download the executable from [the
website](https://ollama.com/download/OllamaSetup.exe) and run the setup
file. This will setup an [Ollama]{.underline} service (on all of the
above operating systems).

To pull your first model,

``` bash
ollama run neural-chat 
```

I've used [Neural-chat](https://huggingface.co/Intel/neural-chat-7b-v3)
for example purposes, but [other models](https://ollama.com/models) such
as `LLaMa2` are also available. Some models, such as
[LLaVA](https://ollama.com/library/llava), even have *visual
understanding* capabilities such as identifying details in images.

# Ugh, this is a pain to use. Is there a better way?

Of course! Running LLMs this way in a terminal is boring! One can use
[Open WebUI](https://github.com/open-webui/open-webui) for this. I'll
be running it via [Podman](https://podman.io/); Docker can also be used
to achieve this.

``` bash
podman run --rm -p 3000:8080  \
   -v open-webui:/app/backend/data  \
   --network slirp4netns:allow_host_loopback=true \
   --add-host=ollama.local:10.0.2.2 \
   --env OLLAMA_BASE_URL=http://ollama.local:11434 \
   --env ANONYMIZED_TELEMETRY=False \
   --name open-webui ghcr.io/open-webui/open-webui:main
```

If you are using Docker instead of Podman:

``` bash
docker run --rm -p 3000:8080 \
   -v open-webui:/app/backend/data \
   --network=host \
   --add-host=host.docker.internal:host-gateway \
   -e OLLAMA_BASE_URL=http://127.0.0.1:11434 \
   -e ANONYMIZED_TELEMETRY=False \
   --name open-webui ghcr.io/open-webui/open-webui:main
```

Now open a browser and start configuring Open-WebUI!
[Here](https://docs.openwebui.com/assets/images/demo-6793d95448aa180bca8dafbd21aa91b5.gif)'s
a demo on how to use Open-WebUI.

# Fin

Pick and choose the model of your choice. The more parameters a model
has been trained on (e.g 3B,7B,13B) etc, the more resource-intensive it
will be. On my *potato* laptop (which lacks have a dGPU) running these
models places a strain on my CPU and can consume a *ton* of memory. But
I guess that's fine. These models don't send telemetry data anywhere.
Thanks for reading!
