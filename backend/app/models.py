from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Routine(Base):
    __tablename__ = "routines"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    source_language = Column(String(50), default="MUMPS")
    raw_code = Column(Text, nullable=False)
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
    created_at = Column(DateTime, default=datetime.utcnow)

    routine = relationship("Routine", back_populates="conversions")
    verification_results = relationship("VerificationResult", back_populates="conversion", cascade="all, delete-orphan")
    confidence_score = relationship("ConfidenceScore", back_populates="conversion", uselist=False, cascade="all, delete-orphan")
    review_decision = relationship("ReviewDecision", back_populates="conversion", uselist=False, cascade="all, delete-orphan")


class TestCase(Base):
    __tablename__ = "test_cases"

    id = Column(Integer, primary_key=True, index=True)
    routine_id = Column(Integer, ForeignKey("routines.id"), nullable=False)
    input_json = Column(Text, nullable=False)
    expected_output = Column(Text, nullable=False)
    source = Column(String(50), default="reference_verified")  # live_interpreter or reference_verified

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
    node_id = Column(String(100), nullable=False)
    node_type = Column(String(50), nullable=False)  # function, global_variable, external_routine
    related_node_id = Column(String(100), nullable=True)
    dependency_type = Column(String(50), nullable=False)  # calls, reads, writes, includes

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
