from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from app.services.llm_service import refine_prompt
from app.limiter import limiter

router = APIRouter(prefix="/prompts", tags=["prompts"])

class PromptRefineRequest(BaseModel):
    prompt: str

class PromptRefineResponse(BaseModel):
    refined_prompt: str

@router.post("/refine", response_model=PromptRefineResponse)
@limiter.limit("10/minute")
async def refine_prompt_endpoint(request: Request, body: PromptRefineRequest):
    if not body.prompt.strip():
        raise HTTPException(400, "Prompt is required")

    try:
        refined = refine_prompt(body.prompt)
        if not refined:
            raise ValueError("No refined prompt returned")
        return {"refined_prompt": refined}
    except Exception as exc:
        raise HTTPException(500, str(exc)) from exc
