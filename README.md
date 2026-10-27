# Embedding Explorer

Explore 6,000 English words as stars in 3D space. Words with similar meanings sit close together.

- **Explore:** type a word and its closest words light up around it as a constellation
- **Analogy:** try word maths like `king − man + woman = queen` and watch the same "jump" happen twice

Everything runs in the browser. No server, no API keys.

## Demo

<!--
  To add the video: edit this README on github.com, drag your .mp4/.mov file
  into the editor right below this comment, and GitHub will upload it and
  insert a link like https://github.com/user-attachments/assets/... on its own
  line. That link plays inline. Then delete the placeholder line below.
-->

> 🎬 _Demo video coming soon._

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Deploy for free

```bash
npm run build
```

This creates a static `out/` folder. Host it on Vercel, Netlify, Cloudflare Pages or a Render static site. It stays online all the time because there is no server to sleep.

## How it works

1. **Word vectors:** each word comes with a list of 50 numbers from [GloVe](https://nlp.stanford.edu/projects/glove/), learned from Wikipedia text. Words used in similar ways get similar numbers.
2. **3D layout:** 50 numbers can't be drawn, so [UMAP](https://umap-learn.readthedocs.io/) squeezes them into 3D while keeping neighbours close.
3. **Similarity:** closeness is measured with cosine similarity on the full 50 numbers, not the 3D positions.
4. **Analogy:** `king − man + woman` is plain vector maths. The app finds the word closest to the result.

## Structure

```
app/                 Next.js page and layout
components/
  SkyApp.tsx         UI: search, modes, neighbour panel, analogy bar
  Sky.tsx            canvas renderer: stars, nebulae, camera, links, labels
lib/galaxy.ts        loads the data, nearest words, analogies
public/galaxy.json   6,000 words, 3D positions, compressed vectors (~0.8 MB)
scripts/build_galaxy.py   rebuilds galaxy.json from GloVe
```

## Stack

Next.js 15, React 19, TypeScript, Tailwind CSS, Framer Motion. The 3D view is a plain 2D canvas with a small hand-written projection, so no 3D library is needed.
