"""Seed script to populate mock Florida statutes with embeddings."""

import asyncio
import json
from pathlib import Path

from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import Statute, Base
from backend.db.session import AsyncSessionLocal, sync_engine, init_db
from backend.lib.embeddings import get_embedding


# Mock Florida statutes data
MOCK_STATUTES = [
    {
        "citation": "Fla. Stat. § 83.51",
        "title": "Landlord's obligation to maintain premises",
        "text": "The landlord at all times during the tenancy shall: (1) Comply with the requirements of applicable building, housing, and health codes; (2) Make all repairs and do whatever is necessary to put and keep the premises in a good and safe condition; (3) Keep common areas of the premises in a clean and safe condition; (4) Provide locks and keys; (5) Provide functioning facilities for heat during winter, running water, and hot water.",
        "chapter": 83,
        "jurisdiction": "FL",
        "category": "commercial_lease",
    },
    {
        "citation": "Fla. Stat. § 83.52",
        "title": "Tenant's obligation to maintain dwelling unit",
        "text": "The tenant shall at all times during the tenancy: (1) Comply with all obligations imposed upon tenants by applicable provisions of building, housing, and health codes; (2) Keep that part of the premises which he or she occupies and uses clean and sanitary; (3) Remove from the tenant's dwelling unit all garbage in a clean and sanitary manner; (4) Keep all plumbing fixtures in the dwelling unit or used by the tenant clean and sanitary and in repair; (5) Use and operate in a reasonable manner all electrical, plumbing, sanitary, heating, ventilating, air-conditioning and other facilities and appliances, including elevators.",
        "chapter": 83,
        "jurisdiction": "FL",
        "category": "commercial_lease",
    },
    {
        "citation": "Fla. Stat. § 83.56",
        "title": "Termination of rental agreement",
        "text": "If the landlord materially fails to comply with s. 83.51(1) or material provisions of the rental agreement within 7 days after delivery of written notice by the tenant specifying the noncompliance, the tenant may, unless the landlord's failure is due to causes beyond the landlord's control, terminate the rental agreement.",
        "chapter": 83,
        "jurisdiction": "FL",
        "category": "commercial_lease",
    },
    {
        "citation": "Fla. Stat. § 448.110",
        "title": "Employment discrimination prohibited",
        "text": "It is an unlawful employment practice for an employer: (1) To fail or refuse to hire or to discharge any individual, or otherwise to discriminate against any individual with respect to compensation, terms, conditions, or privileges of employment, because of such individual's race, color, religion, sex, or national origin; (2) To limit, segregate, or classify his employees or applicants for employment in any way which would deprive or tend to deprive any individual of employment opportunities or otherwise adversely affect his status as an employee, because of such individual's race, color, religion, sex, or national origin.",
        "chapter": 448,
        "jurisdiction": "FL",
        "category": "employment",
    },
    {
        "citation": "Fla. Stat. § 501.171",
        "title": "Security of confidential personal information",
        "text": "A business entity must take reasonable measures to protect and secure data containing personal information in electronic form containing personal information. A business entity that maintains computerized data that includes personal information shall give notice to any resident of this state whose unencrypted personal information was, or is reasonably believed to have been, acquired by an unauthorized person.",
        "chapter": 501,
        "jurisdiction": "FL",
        "category": "data_privacy",
    },
    {
        "citation": "Fla. Stat. § 83.47",
        "title": "Prohibited provisions in rental agreements",
        "text": "A rental agreement may not provide that the tenant: (1) Agrees to waive or forego rights or remedies under this part; (2) Authorizes any person to confess judgment on a claim arising out of the rental agreement; (3) Agrees to pay the landlord's attorney's fees except as provided in this part; (4) Agrees to exculpate or limit the landlord's liability or the landlord's agents for the landlord's failure to perform a duty imposed by law or to indemnify the landlord or the landlord's agents for liability or damages arising from the landlord's or agent's negligent or wrongful acts.",
        "chapter": 83,
        "jurisdiction": "FL",
        "category": "commercial_lease",
    },
    {
        "citation": "Fla. Stat. § 83.48",
        "title": "Rental agreement; duration",
        "text": "A rental agreement may provide for a term of any duration, and the term may be extended or renewed by agreement of the parties. If the rental agreement contains no provision as to its duration, the duration is determined by the periods for which rent is payable. If the rent is payable weekly, then the tenancy is from week to week; if payable monthly, from month to month; if payable quarterly, from quarter to quarter; if payable yearly, from year to year.",
        "chapter": 83,
        "jurisdiction": "FL",
        "category": "commercial_lease",
    },
    {
        "citation": "Fla. Stat. § 448.09",
        "title": "Minimum wage",
        "text": "Every employer shall pay to each employee wages at a rate not less than the federal minimum wage rate. The minimum wage rate shall be adjusted annually on September 30 of each year, beginning September 30, 2021, to reflect the annual percentage change in the federal Consumer Price Index for Urban Wage Earners and Clerical Workers.",
        "chapter": 448,
        "jurisdiction": "FL",
        "category": "employment",
    },
    {
        "citation": "Fla. Stat. § 501.011",
        "title": "Consumer protection",
        "text": "Unfair methods of competition, unconscionable acts or practices, and unfair or deceptive acts or practices in the conduct of any trade or commerce are hereby declared unlawful. It is the intent of the Legislature that, in construing this section, due consideration and great weight shall be given to the interpretations of the Federal Trade Commission and the federal courts relating to s. 5(a)(1) of the Federal Trade Commission Act.",
        "chapter": 501,
        "jurisdiction": "FL",
        "category": "data_privacy",
    },
    {
        "citation": "Fla. Stat. § 83.49",
        "title": "Deposits or advance rents",
        "text": "Whenever money is deposited or advanced by a tenant on a rental agreement as security for performance of the rental agreement or as advance rent for other than the next immediate rental period, the landlord or the landlord's agent shall either: (1) Hold the total amount of such money in a separate non-interest-bearing account in a Florida banking institution for the benefit of the tenant or tenants; (2) Hold the total amount of such money in a separate interest-bearing account in a Florida banking institution for the benefit of the tenant or tenants, in which case the tenant shall receive and collect interest in an amount of at least 75 percent of the annualized average interest rate payable on such account or interest at the rate of 5 percent per year, simple interest, whichever the landlord elects.",
        "chapter": 83,
        "jurisdiction": "FL",
        "category": "commercial_lease",
    },
]


async def seed_statutes() -> None:
    """Seed database with mock Florida statutes and embeddings."""
    # Initialize database
    init_db()
    
    # Enable pgvector extension if not already enabled
    with sync_engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()
    
    async with AsyncSessionLocal() as session:
        for statute_data in MOCK_STATUTES:
            # Check if statute already exists
            stmt = select(Statute).where(Statute.citation == statute_data["citation"])
            result = await session.execute(stmt)
            existing = result.scalar_one_or_none()
            
            if existing:
                print(f"Statute {statute_data['citation']} already exists, skipping...")
                continue
            
            # Get embedding for statute text
            embedding = await get_embedding(statute_data["text"])
            
            # Create tsvector for full-text search
            tsvector_query = text(
                "SELECT to_tsvector('english', :text) as tsvector"
            )
            tsvector_result = await session.execute(
                tsvector_query,
                {"text": statute_data["text"]},
            )
            tsvector = tsvector_result.scalar()
            
            # Create statute record
            statute = Statute(
                citation=statute_data["citation"],
                title=statute_data["title"],
                text=statute_data["text"],
                vector=embedding,
                tsvector=tsvector,
                chapter=statute_data["chapter"],
                jurisdiction=statute_data["jurisdiction"],
                category=statute_data["category"],
            )
            
            session.add(statute)
            print(f"Added statute: {statute_data['citation']}")
        
        await session.commit()
        print("Database seeded successfully!")


if __name__ == "__main__":
    asyncio.run(seed_statutes())

