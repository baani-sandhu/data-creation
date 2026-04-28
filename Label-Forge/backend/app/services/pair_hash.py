import hashlib
import json
from typing import Any


def _normalize_value(value: Any) -> Any:
    if isinstance(value, str):
        return value.strip().lower()
    if isinstance(value, dict):
        return {key: _normalize_value(value[key]) for key in sorted(value.keys())}
    if isinstance(value, list):
        return [_normalize_value(item) for item in value]
    return value


def compute_pair_hash(field_values: dict[str, Any]) -> str:
    normalized = _normalize_value(field_values)
    payload = json.dumps(normalized, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
