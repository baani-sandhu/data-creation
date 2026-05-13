from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

_model = None


def get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


REDUNDANCY_THRESHOLD = 0.95
DRIFT_THRESHOLD = 0.55
NOISE_WARNING_THRESHOLD = 0.20
NOISE_ROLLBACK_THRESHOLD = 0.30


def pair_to_text(pair: dict) -> str:
    return " ".join(str(v) for v in pair.values())


def calculate_noise_score(
    augmented_pairs: list[dict],
    original_pairs: list[dict],
) -> dict:
    if not augmented_pairs or not original_pairs:
        return {
            "noise_score": 0.0,
            "noise_percentage": 0.0,
            "redundancy_rate": 0.0,
            "drift_rate": 0.0,
            "redundant_count": 0,
            "drifted_count": 0,
            "total_checked": 0,
            "status": "clean",
            "message": "No pairs to evaluate.",
        }

    model = get_model()
    aug_texts = [pair_to_text(p) for p in augmented_pairs]
    orig_texts = [pair_to_text(p) for p in original_pairs]

    aug_embeddings = model.encode(aug_texts, batch_size=64, show_progress_bar=False)
    orig_embeddings = model.encode(orig_texts, batch_size=64, show_progress_bar=False)

    similarities = []
    for aug_emb, orig_emb in zip(aug_embeddings, orig_embeddings):
        sim = cosine_similarity([aug_emb], [orig_emb])[0][0]
        similarities.append(float(sim))

    similarities = np.array(similarities)
    redundant_count = int(np.sum(similarities > REDUNDANCY_THRESHOLD))
    drifted_count = int(np.sum(similarities < DRIFT_THRESHOLD))
    total = len(similarities)

    redundancy_rate = redundant_count / total
    drift_rate = drifted_count / total
    noise_score = (0.50 * redundancy_rate) + (0.50 * drift_rate)
    noise_percentage = round(noise_score * 100, 2)

    if noise_score >= NOISE_ROLLBACK_THRESHOLD:
        status = "rollback_recommended"
        message = (
            f"Noise level is high ({noise_percentage}%). "
            f"{redundant_count} near-duplicate pairs and "
            f"{drifted_count} semantically drifted pairs detected. "
            f"Consider rolling back this augmentation cycle."
        )
    elif noise_score >= NOISE_WARNING_THRESHOLD:
        status = "warning"
        message = (
            f"Noise level is moderate ({noise_percentage}%). "
            f"{redundant_count} near-duplicate pairs and "
            f"{drifted_count} semantically drifted pairs detected. "
            f"Review augmented pairs carefully before proceeding."
        )
    else:
        status = "clean"
        message = f"Noise level is acceptable ({noise_percentage}%). Augmented data looks good."

    return {
        "noise_score": round(float(noise_score), 4),
        "noise_percentage": noise_percentage,
        "redundancy_rate": round(float(redundancy_rate), 4),
        "drift_rate": round(float(drift_rate), 4),
        "redundant_count": redundant_count,
        "drifted_count": drifted_count,
        "total_checked": total,
        "status": status,
        "message": message,
    }
