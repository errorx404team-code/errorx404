from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import datetime

class RoutineUploadRequest(BaseModel):
    name: str
    raw_code: str
    source_language: str = "MUMPS"
    relative_path: Optional[str] = None
    workspace_id: Optional[str] = None

class RoutineResponse(BaseModel):
    id: int
    name: str
    source_language: str
    raw_code: str
    relative_path: Optional[str] = None
    workspace_id: Optional[str] = None
    file_action: Optional[str] = "CONVERT"
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
    dependency_preservation_pct: Optional[float] = 100.0
    interface_compatibility_pct: Optional[float] = 100.0

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


# ─── NEW: Workspace / Project-level schemas ───────────────────────────────────

class CrossFileEdge(BaseModel):
    source_file: str
    target_file: str
    source_symbol: Optional[str] = None
    target_symbol: Optional[str] = None
    dependency_type: str
    confidence: Optional[float] = 1.0
    source_routine_name: Optional[str] = None
    target_routine_name: Optional[str] = None

class ConversionPlanFile(BaseModel):
    routine_id: Optional[int] = None
    name: str
    path: str
    source_language: str = "MUMPS"
    action: str = "CONVERT"
    depends_on: List[str] = []
    priority: int = 1
    blocked_by: Optional[str] = None

class WorkspaceAnalysisResponse(BaseModel):
    workspace_id: str
    total_files: int
    cross_edges: List[CrossFileEdge]
    conversion_plan: Dict[str, Any]
    cycles: List[List[str]]
    has_cycles: bool
    interface_contracts: Dict[str, Any]
    workspace_graph: Dict[str, Any]

class WorkspaceGraphResponse(BaseModel):
    workspace_id: str
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    cross_edges: List[CrossFileEdge]
    cycles: List[List[str]]
    has_cycles: bool

class ConversionPlanResponse(BaseModel):
    workspace_id: str
    files: List[ConversionPlanFile]
    cycles: List[List[str]]
    has_cycles: bool
    order_description: str = ""

class InterfaceContractResponse(BaseModel):
    workspace_id: str
    contracts: Dict[str, Any]

class ProjectVerificationResponse(BaseModel):
    workspace_id: str
    total_files: int
    files_verified: int
    syntax_passed: int
    import_passed: int
    integration_tests_total: int
    integration_tests_passed: int
    dependency_issues: int
    broken_imports: List[Dict[str, Any]]
    missing_deps: List[Dict[str, Any]]
    blocked_files: Dict[str, str]
    file_results: Dict[str, Any]
    overall_status: str
    report_text: str
    # Acceptance gate summary
    confidence_score: Optional[float] = None
    confidence_category: Optional[str] = None

class ProjectAcceptRequest(BaseModel):
    workspace_id: str
    routine_ids: List[int]
    decision: str = "approved"
    reviewer_notes: Optional[str] = None

class ProjectAcceptResponse(BaseModel):
    workspace_id: str
    total_accepted: int
    decisions: List[Dict[str, Any]]
    download_ready: bool

class ProjectExportRequest(BaseModel):
    routine_ids: List[int]
    include_sources: bool = True
    workspace_id: Optional[str] = None
    only_accepted: bool = False  # When True, only export approved conversions

class ProjectManifest(BaseModel):
    project: str
    workspace_id: str
    source_files: List[str]
    converted_files: List[str]
    preserved_files: List[str]
    dependencies: List[Dict[str, Any]]
    cycles: List[List[str]]
    verification: Dict[str, Any]
    accepted: bool


# ─── NEW: Human Understanding & NLP Layer Schemas ────────────────────────────

class InputDetail(BaseModel):
    name: str
    meaning: str
    example: str = ""

class OutputDetail(BaseModel):
    name: str
    meaning: str
    example: str = ""

class WorkflowStep(BaseModel):
    step: int
    action: str
    reason: str
    business_meaning: str

class BusinessRuleExplanation(BaseModel):
    rule_id: str
    technical_rule: str
    human_explanation: str
    why_it_matters: str

class DataUsageDetail(BaseModel):
    data_source: str
    technical_operation: str  # READ | WRITE | DELETE
    human_meaning: str

class DecisionDetail(BaseModel):
    condition: str
    if_true: str
    if_false: str
    human_explanation: str

class ErrorHandlingDetail(BaseModel):
    scenario: str
    system_behavior: str
    human_explanation: str

class ConversionSummaryDetail(BaseModel):
    old_technology: str = "MUMPS"
    new_technology: str = "Python"
    what_changed: str
    what_was_preserved: str

class VerificationSummaryDetail(BaseModel):
    tests_run: int = 0
    tests_passed: int = 0
    tests_failed: int = 0
    human_explanation: str

class ConfidenceExplanationDetail(BaseModel):
    score: float = 100.0
    category: str = "safe"
    human_explanation: str
    risk_level: str = "low"
    recommended_action: str

class WarningDetail(BaseModel):
    severity: str = "low"  # low | medium | high | critical
    message: str
    human_explanation: str

class TechnicalTermDetail(BaseModel):
    term: str
    simple_meaning: str
    technical_meaning: str

class LegacyModernComparison(BaseModel):
    legacy_mumps: str
    human_meaning: str
    modern_python: str

class HumanUnderstandingResponse(BaseModel):
    title: str
    one_line_summary: str
    business_purpose: str
    who_is_this_for: str = "Healthcare & Business Users"
    inputs: List[InputDetail] = []
    outputs: List[OutputDetail] = []
    workflow: List[WorkflowStep] = []
    business_rules: List[BusinessRuleExplanation] = []
    data_usage: List[DataUsageDetail] = []
    decisions: List[DecisionDetail] = []
    error_handling: List[ErrorHandlingDetail] = []
    conversion_summary: ConversionSummaryDetail
    verification_summary: VerificationSummaryDetail
    confidence_explanation: ConfidenceExplanationDetail
    warnings: List[WarningDetail] = []
    technical_terms: List[TechnicalTermDetail] = []
    before_after_comparison: List[LegacyModernComparison] = []
    human_summary: str
    executive_summary: str

class HumanExplanationDBResponse(BaseModel):
    id: int
    conversion_id: int
    structured_explanation: HumanUnderstandingResponse
    simple_summary: Optional[str] = None
    business_summary: Optional[str] = None
    technical_summary: Optional[str] = None
    generated_by_model: str = "gemini-2.0-flash"
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ChatUnderstandRequest(BaseModel):
    conversion_id: int
    question: str
    explanation_level: Optional[str] = "business"  # simple | business | technical

class EvidenceItem(BaseModel):
    type: str  # mumps_code | python_code | business_rule | test_case | confidence_score
    reference: str
    detail: str

class ChatUnderstandResponse(BaseModel):
    answer: str
    evidence: List[EvidenceItem] = []
    explanation_level: str = "business"
