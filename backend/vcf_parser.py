# Pure Python VCF parser
# No external dependencies
# Windows compatible

# rsID to gene + allele mapping
RSID_MAP = {
    # CYP2D6 variants
    "rs3892097":  {
        "gene": "CYP2D6",
        "allele": "*4",
        "variant_name": "CYP2D6*4 (loss of function)"
    },
    "rs35742686": {
        "gene": "CYP2D6",
        "allele": "*3",
        "variant_name": "CYP2D6*3 (frameshift)"
    },
    "rs1065852":  {
        "gene": "CYP2D6",
        "allele": "*10",
        "variant_name": "CYP2D6*10 (reduced function)"
    },
    # CYP2C19 variants
    "rs4244285":  {
        "gene": "CYP2C19",
        "allele": "*2",
        "variant_name": "CYP2C19*2 (loss of function)"
    },
    "rs4986893":  {
        "gene": "CYP2C19",
        "allele": "*3",
        "variant_name": "CYP2C19*3 (loss of function)"
    },
    "rs12248560": {
        "gene": "CYP2C19",
        "allele": "*17",
        "variant_name": "CYP2C19*17 (gain of function)"
    },
    # CYP2C9 variants
    "rs1799853": {
        "gene": "CYP2C9",
        "allele": "*2",
        "variant_name": "CYP2C9*2 (reduced function)"
    },
    "rs1057910": {
        "gene": "CYP2C9",
        "allele": "*3",
        "variant_name": "CYP2C9*3 (no function)"
    },
    # DPYD variants
    "rs3918290": {
        "gene": "DPYD",
        "allele": "*2A",
        "variant_name": "DPYD*2A (no function)"
    },
    "rs55886062": {
        "gene": "DPYD",
        "allele": "*13",
        "variant_name": "DPYD*13 (no function)"
    },
    # SLCO1B1 variants
    "rs4149056": {
        "gene": "SLCO1B1",
        "allele": "*5",
        "variant_name": "SLCO1B1*5 (decreased function)"
    },
    # TPMT variants
    "rs1800462": {
        "gene": "TPMT",
        "allele": "*2",
        "variant_name": "TPMT*2 (no function)"
    },
    "rs1800460": {
        "gene": "TPMT",
        "allele": "*3B",
        "variant_name": "TPMT*3B (no function)"
    },
    "rs1142345": {
        "gene": "TPMT",
        "allele": "*3C",
        "variant_name": "TPMT*3C (no function)"
    },
}

# Genotype to diplotype mapping
# per gene
GENOTYPE_TO_DIPLOTYPE = {
    "CYP2D6": {
        # Normal - no variants
        "no_variant": "*1/*1",
        # One copy of loss-of-function
        "one_lof": "*1/*4",
        # Two copies of loss-of-function
        "two_lof": "*4/*4",
        # One copy of reduced function
        "one_reduced": "*1/*10",
        # Gain of function not applicable
    },
    "CYP2C19": {
        "no_variant": "*1/*1",
        "one_lof": "*1/*2",
        "two_lof": "*2/*2",
        "one_gain": "*1/*17",
        "two_gain": "*17/*17",
    },
    "CYP2C9": {
        "no_variant": "*1/*1",
        "one_lof": "*1/*3",
        "two_lof": "*3/*3",
        "one_reduced": "*1/*2"
    },
    "DPYD": {
        "no_variant": "*1/*1",
        "one_lof": "*1/*2A",
        "two_lof": "*2A/*2A"
    },
    "SLCO1B1": {
        "no_variant": "*1a/*1a",
        "one_reduced": "*1a/*5",
        "two_reduced": "*5/*5"
    },
    "TPMT": {
        "no_variant": "*1/*1",
        "one_lof": "*1/*3C",
        "two_lof": "*3C/*3C"
    }
}

def parse_genotype(gt_string):
    """
    Parse GT field from VCF.
    Returns (allele1, allele2) as integers.
    0 = reference, 1 = alternate
    Examples:
      "0/0" -> (0, 0)
      "0/1" -> (0, 1)
      "1/1" -> (1, 1)
      "0|1" -> (0, 1)  (phased)
    """
    gt = gt_string.replace("|", "/")
    parts = gt.split("/")
    if len(parts) != 2:
        return (0, 0)
    try:
        a1 = int(parts[0]) if parts[0] != "." else 0
        a2 = int(parts[1]) if parts[1] != "." else 0
        return (a1, a2)
    except ValueError:
        return (0, 0)

def determine_diplotype(gene, variants_found):
    """
    Given a gene and list of variants found,
    determine the diplotype string.
    
    variants_found is list of dicts:
    [{"rsid": "rs3892097", "gt": (0,1), 
      "allele": "*4", "type": "lof"}, ...]
    """
    if not variants_found:
        return GENOTYPE_TO_DIPLOTYPE[gene].get(
            "no_variant", "*1/*1"
        )
    
    # Separate by type
    lof_variants = []
    gain_variants = []
    reduced_variants = []
    
    for v in variants_found:
        gt = v["gt_tuple"]
        allele = v["allele"]
        
        # Determine variant type
        is_gain = allele in ["*17"]
        is_reduced = allele in ["*10"]
        
        if is_gain:
            if gt == (1, 1):
                gain_variants.append("two_gain")
            elif gt in [(0, 1), (1, 0)]:
                gain_variants.append("one_gain")
        elif is_reduced:
            if gt == (1, 1):
                reduced_variants.append("two_reduced")
            elif gt in [(0, 1), (1, 0)]:
                reduced_variants.append("one_reduced")
        else:
            # Loss of function
            if gt == (1, 1):
                lof_variants.append("two_lof")
            elif gt in [(0, 1), (1, 0)]:
                lof_variants.append("one_lof")
    
    # Determine final diplotype
    lookup = GENOTYPE_TO_DIPLOTYPE.get(gene, {})
    
    if "two_lof" in lof_variants:
        return lookup.get("two_lof", "*4/*4")
    elif "one_lof" in lof_variants:
        return lookup.get("one_lof", "*1/*4")
    elif "two_gain" in gain_variants:
        return lookup.get("two_gain", "*17/*17")
    elif "one_gain" in gain_variants:
        return lookup.get("one_gain", "*1/*17")
    elif "one_reduced" in reduced_variants:
        return lookup.get("one_reduced", "*1/*10")
    else:
        return lookup.get("no_variant", "*1/*1")

def parse_vcf_content(content: str) -> dict:
    """
    Parse VCF file content (as string).
    Returns dict with extracted gene data.
    
    Returns:
    {
      "success": True,
      "genes": {
        "CYP2D6": {
          "diplotype": "*4/*4",
          "variants": [
            {
              "rsid": "rs3892097",
              "genotype": "1/1",
              "allele": "*4",
              "variant_name": "CYP2D6*4",
              "gt_tuple": (1, 1)
            }
          ]
        },
        "CYP2C19": { ... }
      },
      "sample_id": "SAMPLE",
      "vcf_version": "VCFv4.2",
      "total_variants_found": 2,
      "rsids_detected": ["rs3892097", "rs4244285"]
    }
    """
    result = {
        "success": False,
        "genes": {},
        "sample_id": "VCF_SAMPLE",
        "vcf_version": "VCFv4.2",
        "total_variants_found": 0,
        "rsids_detected": [],
        "error": None
    }
    
    # Initialize gene tracking
    gene_variants = {
        "CYP2D6": [],
        "CYP2C19": [],
        "CYP2C9": [],
        "DPYD": [],
        "SLCO1B1": [],
        "TPMT": []
    }
    
    lines = content.strip().split("\n")
    header_cols = []
    format_col_idx = -1
    sample_col_idx = -1
    id_col_idx = 2
    
    for line in lines:
        line = line.strip()
        
        # Skip empty lines
        if not line:
            continue
        
        # Extract VCF version
        if line.startswith("##fileformat="):
            result["vcf_version"] = line.split("=")[1]
            continue
        
        # Skip other meta lines
        if line.startswith("##"):
            continue
        
        # Parse header line
        if line.startswith("#CHROM"):
            header_cols = line.lstrip("#").split("\t")
            # Find column indices
            for i, col in enumerate(header_cols):
                if col.upper() == "FORMAT":
                    format_col_idx = i
                if col.upper() not in [
                    "CHROM","POS","ID","REF",
                    "ALT","QUAL","FILTER",
                    "INFO","FORMAT"
                ]:
                    sample_col_idx = i
                    result["sample_id"] = col
            continue
        
        # Parse data lines
        if not header_cols:
            continue
        
        cols = line.split("\t")
        if len(cols) < 8:
            continue
        
        # Get rsID
        rsid = cols[id_col_idx] if len(cols) > id_col_idx else "."
        
        # Check if this rsID is in our map
        if rsid not in RSID_MAP:
            continue
        
        # Get variant info
        variant_info = RSID_MAP[rsid]
        gene = variant_info["gene"]
        allele = variant_info["allele"]
        variant_name = variant_info["variant_name"]
        
        # Extract genotype
        gt_string = "0/0"
        if (format_col_idx >= 0 and 
            sample_col_idx >= 0 and 
            len(cols) > sample_col_idx):
            
            format_fields = cols[format_col_idx].split(":")
            sample_fields = cols[sample_col_idx].split(":")
            
            if "GT" in format_fields:
                gt_idx = format_fields.index("GT")
                if gt_idx < len(sample_fields):
                    gt_string = sample_fields[gt_idx]
        
        gt_tuple = parse_genotype(gt_string)
        
        # Only record if variant is present
        # (at least one alternate allele)
        variant_data = {
            "rsid": rsid,
            "genotype": gt_string,
            "allele": allele,
            "variant_name": variant_name,
            "gt_tuple": gt_tuple
        }
        
        gene_variants[gene].append(variant_data)
        result["rsids_detected"].append(rsid)
        
        if gt_tuple != (0, 0):
            result["total_variants_found"] += 1
    
    # Determine diplotype for each gene
    for gene, variants in gene_variants.items():
        # Only include variants that are non-reference
        active_variants = [
            v for v in variants 
            if v["gt_tuple"] != (0, 0)
        ]
        
        diplotype = determine_diplotype(
            gene, active_variants
        )
        
        result["genes"][gene] = {
            "diplotype": diplotype,
            "variants": variants,
            "active_variants": active_variants
        }
    
    result["success"] = True
    return result
