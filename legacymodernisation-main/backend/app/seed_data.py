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
