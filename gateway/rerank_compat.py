"""硅基流动 rerank 兼容补丁。

litellm 1.91.1 的 JinaAIRerankConfig.transform_rerank_response 会把上游返回的
"document": null 原样透传，而 RerankResponse 的 TypedDict 要求 document 为
{"text": str}（缺失可、null 不可），导致网关 /v1/rerank 一律 400。
硅基流动 /v1/rerank（Jina 兼容格式）即使 return_documents=false 也恒返回
document: null，故在网关侧打补丁：document 缺失/为 null 时按 index 从请求
documents 回填原文。

litellm 升级修复上游 document 判空后可移除本模块（callbacks.py 中随导入生效）。
"""

from __future__ import annotations

from typing import Any, Dict, List

from httpx import Response

from litellm._uuid import uuid
from litellm.llms.jina_ai.rerank.transformation import JinaAIRerankConfig
from litellm.types.rerank import (
    RerankBilledUnits,
    RerankResponse,
    RerankResponseMeta,
    RerankTokens,
)


def _patched_transform_rerank_response(
    self,
    model: str,
    raw_response: Response,
    model_response: RerankResponse,
    logging_obj: Any,
    api_key: str | None = None,
    request_data: Dict = {},
    optional_params: Dict = {},
    litellm_params: Dict = {},
) -> RerankResponse:
    if raw_response.status_code != 200:
        raise Exception(raw_response.text)

    logging_obj.post_call(original_response=raw_response.text)

    _json_response = raw_response.json()

    _billed_units = RerankBilledUnits(**(_json_response.get("usage") or {}))
    _tokens = RerankTokens(**(_json_response.get("usage") or {}))
    rerank_meta = RerankResponseMeta(billed_units=_billed_units, tokens=_tokens)

    _results: List[dict] | None = _json_response.get("results")
    if _results is None:
        raise ValueError(f"No results found in the response={_json_response}")

    request_docs = request_data.get("documents") or []
    transformed_results = []
    for result in _results:
        entry: Dict[str, Any] = {
            "index": result["index"],
            "relevance_score": result["relevance_score"],
        }
        doc = result.get("document")
        if isinstance(doc, str):
            entry["document"] = {"text": doc}
        elif isinstance(doc, dict) and isinstance(doc.get("text"), str):
            entry["document"] = doc
        else:
            # 硅基流动恒返 document: null —— 按 index 回填请求原文
            idx = result.get("index")
            src: Any = ""
            if isinstance(idx, int) and 0 <= idx < len(request_docs):
                src = request_docs[idx]
            entry["document"] = {"text": src if isinstance(src, str) else str(src)}
        transformed_results.append(entry)

    return RerankResponse(
        id=_json_response.get("id") or str(uuid.uuid4()),
        results=transformed_results,  # type: ignore
        meta=rerank_meta,
    )


# side effect: 应用补丁
JinaAIRerankConfig.transform_rerank_response = _patched_transform_rerank_response  # type: ignore
