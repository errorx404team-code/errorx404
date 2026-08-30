"""
project_verifier.py — Project-level Modernization Verification Module.

Aggregates conversion statuses, individual file verification results, confidence scores,
and dependency relationships across an entire workspace to determine overall project readiness.

Status Rules:
- If Pass Rate >= 90% and Average Confidence >= 85% and No Critical Dependency Errors:
    PROJECT_STATUS = "VERIFIED"
- If Pass Rate between 60% and 89%:
    PROJECT_STATUS = "NEEDS_REVIEW"
- If Pass Rate < 60%:
    PROJECT_STATUS = "FAILED"
"""

import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app import models


class ProjectVerifier:
    """
    Module: Project Verification Layer.
    Evaluates whole-workspace readiness across all converted routines.
    """

    def verify_project(self, workspace_id: str, db: Session) -> Dict[str, Any]:
        """
        Collects all converted files, verification results, confidence scores,
        and dependency relationships in a workspace to calculate overall project readiness.
        """
        # 1. Fetch routines in workspace
        query = db.query(models.Routine)
        if workspace_id and workspace_id != "__default__":
            routines = query.filter(models.Routine.workspace_id == workspace_id).all()
        else:
            routines = query.all()

        total_files = len(routines)
        if total_files == 0:
            return {
                "workspace_id": workspace_id or "default",
                "total_files": 0,
                "successfully_converted": 0,
                "failed_conversions": 0,
                "verified_files": 0,
                "failed_files": 0,
                "average_confidence": 0.0,
                "pass_rate": 0.0,
                "dependency_health": 100.0,
                "project_status": "NOT_VERIFIED",
                "file_summaries": [],
                "verified_at": datetime.utcnow().isoformat(),
            }

        successfully_converted = 0
        verified_files = 0
        failed_files = 0
        confidence_scores: List[float] = []
        file_summaries: List[Dict[str, Any]] = []

        # 2. Inspect each routine
        for routine in routines:
            conversion = (
                db.query(models.Conversion)
                .filter(models.Conversion.routine_id == routine.id)
                .order_by(models.Conversion.id.desc())
                .first()
            )

            is_converted = False
            is_verified = False
            conf_score = 0.0
            ver_status = "NOT_VERIFIED"
            passed_tests = 0
            total_tests = 0

            if conversion:
                is_converted = bool(
                    conversion.generated_code
                    and not conversion.generated_code.strip().startswith("# REJECTED")
                    and not conversion.generated_code.strip().startswith("# Waiting")
                    and conversion.conversion_source != "FAILED"
                )
                if is_converted:
                    successfully_converted += 1

                # Verification Results
                ver_results = (
                    db.query(models.VerificationResult)
                    .filter(models.VerificationResult.conversion_id == conversion.id)
                    .all()
                )
                total_tests = len(ver_results)
                passed_tests = sum(1 for v in ver_results if v.passed)

                if total_tests > 0 and passed_tests == total_tests:
                    is_verified = True
                    ver_status = "VERIFIED"
                elif total_tests > 0:
                    ver_status = "FAILED"
                else:
                    ver_status = "NOT_VERIFIED"

                # Confidence Score
                score_record = (
                    db.query(models.ConfidenceScore)
                    .filter(models.ConfidenceScore.conversion_id == conversion.id)
                    .first()
                )
                if score_record:
                    conf_score = float(score_record.score)
                    confidence_scores.append(conf_score)
                elif is_verified:
                    conf_score = 90.0
                    confidence_scores.append(conf_score)
            else:
                ver_status = "PENDING"

            if is_verified:
                verified_files += 1
            else:
                failed_files += 1

            file_summaries.append({
                "routine_id": routine.id,
                "name": routine.name,
                "relative_path": routine.relative_path or f"{routine.name}.m",
                "is_converted": is_converted,
                "is_verified": is_verified,
                "verification_status": ver_status,
                "passed_tests": passed_tests,
                "total_tests": total_tests,
                "confidence_score": conf_score,
            })

        failed_conversions = total_files - successfully_converted

        # 3. Calculate Pass Rate & Average Confidence
        pass_rate = round((verified_files / total_files) * 100.0, 1) if total_files > 0 else 0.0
        avg_confidence = round(sum(confidence_scores) / len(confidence_scores), 1) if confidence_scores else 0.0

        # 4. Calculate Dependency Health
        # Check dependency graph nodes for this workspace/routines
        routine_ids = [r.id for r in routines]
        deps = (
            db.query(models.DependencyGraphNode)
            .filter(models.DependencyGraphNode.routine_id.in_(routine_ids))
            .all()
        )
        external_calls = [d for d in deps if d.node_type == "external_routine"]
        broken_refs = 0
        for ext in external_calls:
            target_name = ext.label.replace("^", "").upper()
            found = any(r.name.upper() == target_name for r in routines)
            if not found:
                broken_refs += 1

        dep_penalty = min(30.0, broken_refs * 5.0)
        dependency_health = max(70.0, 100.0 - dep_penalty)

        # 5. Determine Overall Project Status based on strict rules (Requirement 4)
        if pass_rate >= 90.0 and avg_confidence >= 85.0 and dependency_health >= 85.0:
            project_status = "VERIFIED"
        elif pass_rate >= 60.0:
            project_status = "NEEDS_REVIEW"
        else:
            project_status = "FAILED"

        # 6. Persist in database (project_verifications table)
        # Delete prior record for this workspace to maintain latest state
        db.query(models.ProjectVerification).filter(
            models.ProjectVerification.workspace_id == workspace_id
        ).delete()

        proj_ver = models.ProjectVerification(
            workspace_id=workspace_id or "__default__",
            project_status=project_status,
            total_files=total_files,
            successfully_converted=successfully_converted,
            failed_conversions=failed_conversions,
            verified_files=verified_files,
            failed_files=failed_files,
            average_confidence=avg_confidence,
            pass_rate=pass_rate,
            dependency_health=dependency_health,
            file_summaries_json=json.dumps(file_summaries),
            verified_at=datetime.utcnow(),
        )
        db.add(proj_ver)
        db.commit()
        db.refresh(proj_ver)

        return {
            "id": proj_ver.id,
            "workspace_id": workspace_id or "default",
            "total_files": total_files,
            "successfully_converted": successfully_converted,
            "failed_conversions": failed_conversions,
            "verified_files": verified_files,
            "failed_files": failed_files,
            "average_confidence": avg_confidence,
            "pass_rate": pass_rate,
            "dependency_health": dependency_health,
            "project_status": project_status,
            "file_summaries": file_summaries,
            "verified_at": proj_ver.verified_at,
        }

    def get_verification(self, workspace_id: str, db: Session) -> Dict[str, Any]:
        """
        Retrieves the latest project verification for a given workspace.
        """
        proj_ver = (
            db.query(models.ProjectVerification)
            .filter(models.ProjectVerification.workspace_id == workspace_id)
            .order_by(models.ProjectVerification.id.desc())
            .first()
        )
        if not proj_ver:
            # If not yet verified, run on-demand or return default status
            return self.verify_project(workspace_id, db)

        file_summaries = []
        if proj_ver.file_summaries_json:
            try:
                file_summaries = json.loads(proj_ver.file_summaries_json)
            except Exception:
                file_summaries = []

        return {
            "id": proj_ver.id,
            "workspace_id": proj_ver.workspace_id,
            "total_files": proj_ver.total_files,
            "successfully_converted": proj_ver.successfully_converted,
            "failed_conversions": proj_ver.failed_conversions,
            "verified_files": proj_ver.verified_files,
            "failed_files": proj_ver.failed_files,
            "average_confidence": proj_ver.average_confidence,
            "pass_rate": proj_ver.pass_rate,
            "dependency_health": proj_ver.dependency_health,
            "project_status": proj_ver.project_status,
            "file_summaries": file_summaries,
            "verified_at": proj_ver.verified_at,
        }


project_verifier = ProjectVerifier()
