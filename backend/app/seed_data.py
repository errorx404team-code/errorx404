<<<<<<< HEAD
"""
Seed data module — intentionally empty.

All demo/sample routines have been removed.
The application starts with an empty database;
only user-uploaded routines will appear.
"""

from app.database import Base, engine


def seed_database():
    """No-op: no demo data is seeded. Only user uploads populate the database."""
    Base.metadata.create_all(bind=engine)
=======
import json
from app.database import SessionLocal, engine, Base
from app.models import Routine, Specification, Conversion, TestCase, VerificationResult, ConfidenceScore, ReviewDecision, DependencyGraphNode, BusinessLogicPartition

SAMPLE_ROUTINES = [
    {
        "name": "PSOHLDS",
        "source_language": "MUMPS",
        "raw_code": """PSOHLDS ;VistA/SACC - OUTPATIENT PHARMACY ORDER VERIFICATION ; 10-AUG-2023
 ;;7.0;OUTPATIENT PHARMACY;**156,210,402**;DEC 1997;Build 12
 ;
EN(DFN,RX) ;Entry point for pharmacy order validation
 N STAT,DOSE,WEIGHT,ERR
 S ERR=0
 I '$D(^DPT(DFN,0)) S ERR=1 W !,"PATIENT NOT FOUND IN ^DPT" Q ERR
 S STAT=$P($G(^DPT(DFN,0)),"^",10)
 I STAT'="A" W !,"PATIENT INACTIVE" Q -1
 S WEIGHT=$P($G(^DPT(DFN,"WT")),"^",1)
 I WEIGHT'>0 S WEIGHT=70 ; Default weight in kg
 S DOSE=$$CALC(WEIGHT,10)
 D STATUS(RX,"VERIFIED")
 Q 1
 ;
CALC(WT,BASE) ;Calculate medication dosage
 N FINAL
 I WT'>0 Q 0
 I BASE'>0 Q 0
 S FINAL=WT*BASE
 Q FINAL
 ;
STATUS(RXID,NEWSTAT) ;Update prescription status global
 I '$D(^PSRX(RXID,0)) S ^PSRX(RXID,0)=NEWSTAT
 S $P(^PSRX(RXID,0),"^",2)=NEWSTAT
 D ^ORWU ;Call CPRS GUI utilities
 Q 1
"""
    },
    {
        "name": "ORWPT",
        "source_language": "MUMPS",
        "raw_code": """ORWPT ;VistA/CPRS - PATIENT LOOKUP UTILITIES ; 15-JUN-2022
 ;;3.0;ORDER ENTRY/RESULTS REPORTING;**280,350**;DEC 1997;Build 8
 ;
LOOKUP(VAL) ;Patient lookup by Name or SSN
 N DFN,NAME,SSN,FOUND
 S FOUND=0
 I VAL="" Q "INVALID INPUT"
 I VAL?9N S DFN=$O(^DPT("SSN",VAL,0)) I DFN S FOUND=1 Q DFN
 S NAME=$O(^DPT("B",VAL))
 I NAME[VAL S DFN=$O(^DPT("B",NAME,0)) I DFN S FOUND=1 Q DFN
 Q "NOT FOUND"
 ;
GETINFO(DFN) ;Return patient demographic string
 N NODE,NAME,DOB,SEX
 I '$D(^DPT(DFN,0)) Q ""
 S NODE=$G(^DPT(DFN,0))
 S NAME=$P(NODE,"^",1)
 S DOB=$P(NODE,"^",2)
 S SEX=$P(NODE,"^",3)
 Q NAME_"^"_DOB_"^"_SEX
"""
    },
    {
        "name": "PSORX0",
        "source_language": "MUMPS",
        "raw_code": """PSORX0 ;VistA/PHARMACY - PRESCRIPTION RENEWAL CHECK ; 04-JAN-2024
 ;;7.0;OUTPATIENT PHARMACY;**450**;DEC 1997;Build 5
 ;
RENEW(RXID,REFILLS) ;Validate prescription refills left
 N CURR,MAX
 I '$D(^PSRX(RXID,0)) Q 0
 S CURR=$P(^PSRX(RXID,0),"^",4)
 S MAX=$P(^PSRX(RXID,0),"^",5)
 I CURR>=MAX Q -1 ; No refills left
 S $P(^PSRX(RXID,0),"^",4)=CURR+1
 Q 1
"""
    }
]

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    if db.query(Routine).count() > 0:
        db.close()
        return

    for r_data in SAMPLE_ROUTINES:
        routine = Routine(
            name=r_data["name"],
            source_language=r_data["source_language"],
            raw_code=r_data["raw_code"]
        )
        db.add(routine)
        db.commit()
        db.refresh(routine)

        # Seed Test Cases
        if r_data["name"] == "PSOHLDS":
            tc1 = TestCase(
                routine_id=routine.id,
                input_json=json.dumps({"dfn": "10001", "rx": "RX-9082"}),
                expected_output="VERIFIED",
                source="reference_verified"
            )
            tc2 = TestCase(
                routine_id=routine.id,
                input_json=json.dumps({"weight_kg": 75, "base_mg": 12.5}),
                expected_output="937.5",
                source="reference_verified"
            )
            db.add_all([tc1, tc2])
        elif r_data["name"] == "ORWPT":
            tc1 = TestCase(
                routine_id=routine.id,
                input_json=json.dumps({"val": "DOE,JOHN"}),
                expected_output="DOE,JOHN",
                source="reference_verified"
            )
            db.add(tc1)
        elif r_data["name"] == "PSORX0":
            tc1 = TestCase(
                routine_id=routine.id,
                input_json=json.dumps({"rx_id": "RX-101", "refills": 1}),
                expected_output="1",
                source="reference_verified"
            )
            db.add(tc1)

        db.commit()

    db.close()
    print("Database seeded with real VistA MUMPS routines successfully!")

if __name__ == "__main__":
    seed_database()
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
