
class MigrationReportResponse(BaseModel):
    before: Dict[str, Any]
    migration: Dict[str, Any]
    after: Dict[str, Any]
    validation: Dict[str, Any]
    decision: Dict[str, Any]
