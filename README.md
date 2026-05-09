# Orbitron

Orbitron is a simple, polished web app for people who want to use top AI models in one place.

Instead of juggling separate tools from different AI companies, Orbitron gives you a single dashboard where you can:

- Chat with multiple leading AI models
- Generate images
- Compare model options and pricing
- Track your activity and spending
- Manage your account and API keys

In short: **one account, one experience, many models**.

---

## Why Orbitron exists

Most people run into the same problems when using AI:

- You have to sign up in multiple places
- Pricing is hard to understand
- It is difficult to compare models
- Usage tracking is scattered

Orbitron is designed to make this easier. It focuses on clarity and everyday usability over complexity.

---

## What you can do in Orbitron

### 1) Chat with different AI models

Orbitron supports popular models from major providers, including OpenAI, Anthropic, and Google.

You can pick a model based on your goal (speed, quality, or cost), send messages, and get streaming responses in real time.

### 2) Generate images

You can create images from prompts directly in the app. Generated images appear in a gallery-style view so you can quickly browse, preview, and download them.

### 3) Explore model options

Orbitron includes a models catalog that helps you understand what is available. It is meant to be straightforward, so you can make decisions without digging through multiple vendor docs.

### 4) Monitor usage and costs

There are built-in pages for usage and credits so you can keep an eye on requests and spending. This makes it easier to stay in control, especially when usage grows.

### 5) Manage keys and account settings

Orbitron includes account pages for login/session management and API key management.

---

## Who Orbitron is for

Orbitron is useful for:

- Individuals who want one place to use multiple AI models
- Teams prototyping quickly
- Builders who want a cleaner AI workflow
- Anyone who values clear pricing and less setup friction

---

## Product experience

Orbitron has two main areas:

- **Public pages** for exploring the product (home, models, pricing, docs, status)
- **Dashboard pages** for signed-in users (chat, usage, credits, keys, settings)

The interface is designed to feel focused and fast on both desktop and mobile.

---

## Core ideas behind Orbitron

- **Simple over complicated**: common tasks should be obvious
- **Transparent over confusing**: usage and cost should be understandable
- **Practical over flashy**: useful features should come first
- **One place over many tabs**: reduce context switching across providers

---

## Project structure (high level)

If you are browsing this repository, the important folders are:

- `src/` — frontend pages and UI components
- `server/` — backend API and integrations
- `dist-server/` — built server output

You do not need deep infrastructure knowledge to understand the product goals: this project is about making multi-model AI access easier for end users.

---

## Current status

Orbitron already includes working chat, image generation, model browsing, status checks, usage tracking, and account/key management.

Some advanced billing and benchmarking areas are intentionally lightweight for now and presented clearly in the UI rather than hidden behind fake data.

---

## Local development

Install dependencies and run the app:

```bash
npm install
npm run dev
```

Then open the local URL shown in your terminal.

---

## Final note

Orbitron is built to reduce the friction of using modern AI tools. If your goal is to move faster with less setup and fewer moving parts, this project is designed for you.
