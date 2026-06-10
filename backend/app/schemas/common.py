from pydantic import BaseModel
from typing import Optional, Any, List

class PaginatedResponse(BaseModel):
    data: List[Any]
    total: int
    page: int
    page_size: int
    total_pages: int

class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None

class SuccessResponse(BaseModel):
    success: bool = True
    message: Optional[str] = None
    data: Optional[Any] = None