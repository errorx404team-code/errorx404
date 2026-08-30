from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Routine(Base):
    __tablename__ = "routines"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    source_language = Column(String(50), default="MUMPS")
    raw_code = Column(Text, nullable=False)
    relative_path = Column(String(500), nullable=True)
    workspace_id = Column(String(100), nullable=True, index=True)
    # File classification: CONVERT | PRESERVE | ADAPT | GENERATE | REVIEW_REQUIRED
    file_action = Column(String(50), nullable=True, default="CONVERT")
    created_at = Column(DateTime, default=datetime.utcnow)

    specifications = relationship("Specification", back_populates="routine", cascade="all, delete-orphan")
    conversions = relationship("Conversion", back_populates="routine", cascade="all, delete-orphan")
    test_cases = relationship("TestCase", back_populates="routine", cascade="all, delete-orphan")
    dependencies = relationship("DependencyGraphNode", back_populates="routine", cascade="all, delete-orphan")
    partitions = relationship("BusinessLogicPartition", back_populates="routine", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessage", back_populates="routine")


class Specification(Base):
    __tablename__ = "specifications"

    id = Column(Integer, primary_key=True, index=True)
    routine_id = Column(Integer, ForeignKey("routines.id"), nullable=False)
    spec_json = Column(Text, nullable=False)  # JSON string
    spec_readable_text = Column(Text, nullable=False)
    business_rules_json = Column(Text, nullable=False)  # JSON string of explicit business rules
    created_at = Column(DateTime, default=datetime.utcnow)

    routine = relationship("Routine", back_populates="specifications")


class Conversion(Base):
    __tablename__ = "conversions"

    id = Column(Integer, primary_key=True, index=True)
    routine_id = Column(Integer, ForeignKey("routines.id"), nullable=False)
    target_language = Column(String(50), default="Python")
    generated_code = Column(Text, nullable=False)
    model_used = Column(String(100), default="gemini-2.0-flash")
    # Traceability comment injected in generated code header
    traceability_header = Column(Text, nullable=True)
    # Conversion source: REAL_GEMINI | DEMO_FALLBACK | FAILED
    # NEVER display DEMO_FALLBACK or FAILED output as a successful real AI conversion.
    conversion_source = Column(String(50), nullable=True, default="UNKNOWN")
    created_at = Column(DateTime, default=datetime.utcnow)

    routine = relationship("Routine", back_populates="conversions")
    verification_results = relationship("VerificationResult", back_populates="conversion", cascade="all, delete-orphan")
    confidence_score = relationship("ConfidenceScore", back_populates="conversion", uselist=False, cascade="all, delete-orphan")
    review_decision = relationship("ReviewDecision", back_populates="conversion", uselist=False, cascade="all, delete-orphan")
    human_explanation = relationship("HumanExplanation", back_populates="conversion", uselist=False, cascade="all, delete-orphan")


class HumanExplanation(Base):
    __tablename__ = "human_explanations"

    id = Column(Integer, primary_key=True, index=True)
    conversion_id = Column(Integer, ForeignKey("conversions.id"), nullable=False, index=True)
    explanation_json = Column(Text, nullable=False)
    simple_summary = Column(Text, nullable=True)
    business_summary = Column(Text, nullable=True)
    technical_summary = Column(Text, nullable=True)
    generated_by_model = Column(String(100), default="gemini-2.0-flash")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    conversion = relationship("Conversion", back_populates="human_explanation")


class TestCase(Base):
    __tablename__ = "test_cases"

    id = Column(Integer, primary_key=True, index=True)
    routine_id = Column(Integer, ForeignKey("routines.id"), nullable=False)
    input_json = Column(Text, nullable=False)
    expected_output = Column(Text, nullable=False)
    source = Column(String(50), default="reference_verified")  # live_interpreter or reference_verified
    test_type = Column(String(50), default="unit")  # unit | integration | dependency | interface

    routine = relationship("Routine", back_populates="test_cases")
    verification_results = relationship("VerificationResult", back_populates="test_case", cascade="all, delete-orphan")


class VerificationResult(Base):
    __tablename__ = "verification_results"

    id = Column(Integer, primary_key=True, index=True)
    conversion_id = Column(Integer, ForeignKey("conversions.id"), nullable=False)
    test_case_id = Column(Integer, ForeignKey("test_cases.id"), nullable=False)
    actual_output = Column(Text, nullable=True)
    passed = Column(Boolean, default=False)
    mismatch_details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    conversion = relationship("Conversion", back_populates="verification_results")
    test_case = relationship("TestCase", back_populates="verification_results")


class ConfidenceScore(Base):
    __tablename__ = "confidence_scores"

    id = Column(Integer, primary_key=True, index=True)
    conversion_id = Column(Integer, ForeignKey("conversions.id"), nullable=False)
    score = Column(Float, nullable=False)  # 0-100
    category = Column(String(50), nullable=False)  # safe / needs_review / failed
    reasoning_text = Column(Text, nullable=False)
    # Dependency-aware score breakdown
    dependency_preservation_pct = Column(Float, nullable=True, default=100.0)
    interface_compatibility_pct = Column(Float, nullable=True, default=100.0)

    conversion = relationship("Conversion", back_populates="confidence_score")


class ReviewDecision(Base):
    __tablename__ = "review_decisions"

    id = Column(Integer, primary_key=True, index=True)
    conversion_id = Column(Integer, ForeignKey("conversions.id"), nullable=False)
    decision = Column(String(50), nullable=False)  # approved / rejected / changes_requested / reverted
    reviewer_notes = Column(Text, nullable=True)
    decided_at = Column(DateTime, default=datetime.utcnow)

    conversion = relationship("Conversion", back_populates="review_decision")


class DependencyGraphNode(Base):
    __tablename__ = "dependency_graph"

    id = Column(Integer, primary_key=True, index=True)
    routine_id = Column(Integer, ForeignKey("routines.id"), nullable=False)
    node_id = Column(String(200), nullable=False)
    node_type = Column(String(50), nullable=False)  # function, global_variable, external_routine, table, api, config
    related_node_id = Column(String(200), nullable=True)
    dependency_type = Column(String(50), nullable=False)  # member, CALLS, READS, WRITES, USES_GLOBAL, USES_TABLE, etc.
    # Cross-file dependency fields
    source_file = Column(String(500), nullable=True)
    target_file = Column(String(500), nullable=True)
    source_symbol = Column(String(200), nullable=True)
    target_symbol = Column(String(200), nullable=True)
    confidence = Column(Float, nullable=True, default=1.0)

    routine = relationship("Routine", back_populates="dependencies")


class BusinessLogicPartition(Base):
    __tablename__ = "business_logic_partitions"

    id = Column(Integer, primary_key=True, index=True)
    routine_id = Column(Integer, ForeignKey("routines.id"), nullable=False)
    partition_name = Column(String(100), nullable=False)  # e.g., "Patient Identification", "Prescription Validation"
    member_functions_json = Column(Text, nullable=False)  # list of tag names in JSON
    cohesion_percentage = Column(Float, nullable=False)  # 0-100
    coupling_percentage = Column(Float, nullable=False)  # 0-100

    routine = relationship("Routine", back_populates="partitions")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), nullable=False, default="default")
    role = Column(String(20), nullable=False)  # user / assistant
    message_text = Column(Text, nullable=False)
    related_routine_id = Column(Integer, ForeignKey("routines.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    routine = relationship("Routine", back_populates="chat_messages")


# ─── Workspace-level cross-file dependency edges ─────────────────────────

class WorkspaceDependencyEdge(Base):
    """Stores cross-file dependency edges discovered at workspace level."""
    __tablename__ = "workspace_dependency_edges"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(String(100), nullable=False, index=True)
    source_routine_id = Column(Integer, ForeignKey("routines.id"), nullable=True)
    target_routine_id = Column(Integer, ForeignKey("routines.id"), nullable=True)
    source_file = Column(String(500), nullable=False)
    target_file = Column(String(500), nullable=False)
    source_symbol = Column(String(200), nullable=True)
    target_symbol = Column(String(200), nullable=True)
    dependency_type = Column(String(100), nullable=False)  # CALLS, IMPORTS, USES_GLOBAL, USES_TABLE, USES_API, etc.
    confidence = Column(Float, nullable=True, default=1.0)
    created_at = Column(DateTime, default=datetime.utcnow)


class WorkspaceConversionPlan(Base):
    """Stores the dependency-aware conversion plan for a workspace."""
    __tablename__ = "workspace_conversion_plans"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(String(100), nullable=False, index=True)
    plan_json = Column(Text, nullable=False)  # JSON: list of {routine_id, path, action, depends_on, priority}
    cycles_json = Column(Text, nullable=True)  # JSON: detected circular dependency chains
    created_at = Column(DateTime, default=datetime.utcnow)


class InterfaceContract(Base):
    """Stores per-module interface contracts for cross-file dependency preservation."""
    __tablename__ = "interface_contracts"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(String(100), nullable=False, index=True)
    routine_id = Column(Integer, ForeignKey("routines.id"), nullable=False)
    contract_json = Column(Text, nullable=False)  # JSON: exports, dependencies, consumers
    created_at = Column(DateTime, default=datetime.utcnow)


class ProjectVerificationResult(Base):
    """Stores project-level integration verification results."""
    __tablename__ = "project_verification_results"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(String(100), nullable=False, index=True)
    total_files = Column(Integer, nullable=False, default=0)
    files_verified = Column(Integer, nullable=False, default=0)
    syntax_passed = Column(Integer, nullable=False, default=0)
    import_passed = Column(Integer, nullable=False, default=0)
    integration_tests_total = Column(Integer, nullable=False, default=0)
    integration_tests_passed = Column(Integer, nullable=False, default=0)
    dependency_issues = Column(Integer, nullable=False, default=0)
    broken_imports_json = Column(Text, nullable=True)   # JSON list
    missing_deps_json = Column(Text, nullable=True)     # JSON list
    blocked_files_json = Column(Text, nullable=True)    # JSON: {file: "BLOCKED BY X"}
    cycles_json = Column(Text, nullable=True)           # JSON list of cycles
    overall_status = Column(String(50), nullable=False, default="NOT_VERIFIED")
    report_text = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ProjectVerification(Base):
    """Stores workspace-level project verification summary."""
    __tablename__ = "project_verifications"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(String(100), nullable=False, index=True)
    project_status = Column(String(50), nullable=False, default="NOT_VERIFIED")  # VERIFIED, NEEDS_REVIEW, FAILED
    total_files = Column(Integer, nullable=False, default=0)
    successfully_converted = Column(Integer, nullable=False, default=0)
    failed_conversions = Column(Integer, nullable=False, default=0)
    verified_files = Column(Integer, nullable=False, default=0)
    failed_files = Column(Integer, nullable=False, default=0)
    average_confidence = Column(Float, nullable=False, default=0.0)
    pass_rate = Column(Float, nullable=False, default=0.0)
    dependency_health = Column(Float, nullable=False, default=100.0)
    file_summaries_json = Column(Text, nullable=True)
    verified_at = Column(DateTime, default=datetime.utcnow)

