# Embedding Explorer

Explore 6,000 English words as stars in 3D space. Words with similar meanings sit close together.

- **Explore:** type a word and its closest words light up around it as a constellation

Everything runs in the browser. No server, no API keys.

## Demo

https://github.com/user-attachments/assets/d55bd9bd-d549-4883-836f-324d37a911bc

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Deploy

```bash
npm run build
```

## How it works

1. **Word vectors:** each word comes with a list of 50 numbers from [GloVe](https://nlp.stanford.edu/projects/glove/), learned from Wikipedia text. Words used in similar ways get similar numbers.
2. **3D layout:** 50 numbers can't be drawn, so [UMAP](https://umap-learn.readthedocs.io/) squeezes them into 3D while keeping neighbours close.
3. **Similarity:** closeness is measured with cosine similarity on the full 50 numbers, not the 3D positions.



