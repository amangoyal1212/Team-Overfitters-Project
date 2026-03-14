"""
phenotype_mapper.py
Maps (gene, diplotype) → metaboliser phenotype.
Uses CPIC API with local fallback.
"""

from cpic_client import get_cpic_phenotype, get_local_phenotype


async def map_phenotype_async(gene: str, allele: str) -> dict:
    """Async version — queries CPIC API first, falls back to local tables."""
    result = await get_cpic_phenotype(gene, allele)
    return result


def map_phenotype(gene: str, allele: str) -> str:
    """Sync fallback for compatibility — uses local CPIC tables only."""
    result = get_local_phenotype(gene, allele)
    return result["phenotype"]
