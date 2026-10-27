"""
Builds public/galaxy.json from GloVe vectors.

1. Download glove-wiki-gigaword-50.gz from
   https://github.com/RaRe-Technologies/gensim-data/releases/tag/glove-wiki-gigaword-50
2. pip install numpy scikit-learn umap-learn
3. python scripts/build_galaxy.py path/to/glove-wiki-gigaword-50.gz
"""
import base64, gzip, json, re, sys
import numpy as np
import umap
from sklearn.cluster import KMeans

N_WORDS = 6000
STOP = set("""the of and to a in for is on that by with as at from it was he his be are this an or which
has had not but were they have its their been also who will one after she new her more first other two all
would when can there up about out into than over only time some years we them most could i you so if do did
no any what then may""".split())

src = sys.argv[1]
words, vecs = [], []
with gzip.open(src, "rt", encoding="utf8") as f:
    next(f)  # header line
    for line in f:
        w, *v = line.rstrip().split(" ")
        if re.fullmatch(r"[a-z]{3,}", w) and w not in STOP:
            words.append(w)
            vecs.append(np.array(v, dtype=np.float32))
            if len(words) >= N_WORDS:
                break

X = np.stack(vecs)
Xn = X / np.linalg.norm(X, axis=1, keepdims=True)

# 3D layout: similar words end up close together
P = umap.UMAP(n_components=3, n_neighbors=12, min_dist=0.04, metric="cosine", random_state=7).fit_transform(Xn)
P = P - P.mean(0)
P = P / np.abs(P).max()

# colour regions
groups = KMeans(n_clusters=9, n_init=10, random_state=7).fit(P).labels_

# compress vectors to int8
scale = np.abs(Xn).max(0)
Q = np.clip(np.round(Xn / scale * 127), -127, 127).astype(np.int8)

json.dump(
    {
        "dims": int(X.shape[1]),
        "words": words,
        "pos": np.round(P, 3).flatten().tolist(),
        "group": groups.tolist(),
        "scale": np.round(scale, 5).tolist(),
        "vec": base64.b64encode(Q.tobytes()).decode(),
    },
    open("public/galaxy.json", "w"),
    separators=(",", ":"),
)
print(f"wrote {len(words)} words")
