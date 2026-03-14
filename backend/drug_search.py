# backend/drug_search.py
from thefuzz import process, fuzz
from pharmgkb_lookup import get_drug_database_info, DRUG_ALIASES

def search_drugs(query: str, limit: int = 10) -> list:
    """
    Fuzzy search for drugs using both exact matches and aliases.
    Uses thefuzz for approximate string matching.
    """
    if not query:
        return []

    query = query.lower().strip()
    db_info = get_drug_database_info()
    all_generic_drugs = [d["drug_name"] for d in db_info]
    
    # 1. Check if it's an exact alias (e.g., "zoloft" -> "sertraline")
    if query in DRUG_ALIASES:
        matched_generic = DRUG_ALIASES[query]
        # Return that generic drug first
        return [d for d in db_info if d["drug_name"] == matched_generic]
        
    # 2. Fuzzy match against all known aliases and generic names
    search_corpus = all_generic_drugs + list(DRUG_ALIASES.keys())
    
    # Extract top matches
    matches = process.extract(
        query, 
        search_corpus, 
        limit=limit, 
        scorer=fuzz.partial_ratio
    )
    
    results = []
    seen = set()
    
    for match_str, score in matches:
        # If the match was an alias, resolve to generic
        generic_name = DRUG_ALIASES.get(match_str, match_str)
        
        if generic_name not in seen:
            seen.add(generic_name)
            
            # Find the full drug info from our db
            drug_data = next((d for d in db_info if d["drug_name"] == generic_name), None)
            if drug_data:
                # Add match score for sorting if desired
                result = dict(drug_data)
                result["match_score"] = score
                result["matched_term"] = match_str  # Helps UI show what matched
                results.append(result)
                
    # Sort strictly by match_score descending
    results.sort(key=lambda x: x["match_score"], reverse=True)
                
    return results[:limit]
