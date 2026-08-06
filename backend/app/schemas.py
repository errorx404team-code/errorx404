from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import datetime

class RoutineUploadRequest(BaseModel):
    name: str
    raw_code: str
    source_language: str = "MUMPS"

class RoutineResponse(BaseModel):
    id: int
    name: str
    source_language: str
    raw_code: str
    created_at: datetime

    class Config:
        from_attributes = True

class SpecificationResponse(BaseModel):
    id: int
    routine_id: int
    spec_json: str
    spec_readable_text: str
    business_rules_json: str
    created_at: datetime

    class Config:
        from_attributes = True

class DependencyNode(BaseModel):
    id: str
    label: str
    type: str

class DependencyEdge(BaseModel):
    source: str
    target: str
    relationship: str

class DependencyGraphResponse(BaseModel):
    routine_id: int
    nodes: List[DependencyNode]
    edges: List[DependencyEdge]

class BusinessLogicPartitionSchema(BaseModel):
    partition_name: str
    member_functions: List[str]
    cohesion_percentage: float
    coupling_percentage: float

class BusinessLogicMapResponse(BaseModel):
    routine_id: int
    partitions: List[BusinessLogicPartitionSchema]
    overall_cohesion: float

class ConversionRequest(BaseModel):
    target_language: str = "Python"

class ConversionResponse(BaseModel):
    id: int
    routine_id: int
    target_language: str
    generated_code: str
    model_used: str
    created_at: datetime

    class Config:
        from_attributes = True

class TestCaseResponse(BaseModel):
    id: int
    routine_id: int
    input_json: str
    expected_output: str
    source: str

    class Config:
        from_attributes = True

class VerificationResultSchema(BaseModel):
    id: int
    test_case_id: int
    actual_output: Optional[str]
    passed: bool
    mismatch_details: Optional[str]

class VerificationResponse(BaseModel):
    conversion_id: int
    total_tests: int
    passed_tests: int
    failed_tests: int
    pass_rate: float
    results: List[VerificationResultSchema]

class ConfidenceScoreResponse(BaseModel):
    id: int
    conversion_id: int
    score: float
    category: str
    reasoning_text: str

    class Config:
        from_attributes = True

class ReviewRequest(BaseModel):
    decision: str  # approved / rejected / changes_requested
    reviewer_notes: Optional[str] = None

class ReviewDecisionResponse(BaseModel):
    id: int
    conversion_id: int
    decision: str
    reviewer_notes: Optional[str]
    decided_at: datetime

    class Config:
        from_attributes = True

class DocumentationResponse(BaseModel):
    routine_id: int
    conversion_id: int
    title: str
    markdown_docs: str

class ExplainabilityResponse(BaseModel):
    conversion_id: int
    reasoning_trace: List[Dict[str, Any]]

class DashboardSummaryResponse(BaseModel):
    total_routines: int
    total_conversions: int
    avg_confidence_score: float
    status_breakdown: Dict[str, int]
    avg_partition_cohesion: float
    business_logic_coverage_pct: float

class ChatAskRequest(BaseModel):
    question: str
    session_id: Optional[str] = "default"
    routine_id: Optional[int] = None

class ChatMessageResponse(BaseModel):
    id: int
    session_id: str
    role: str
    message_text: str
    related_routine_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True
