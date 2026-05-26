import os
from collections import defaultdict
from backend.rules.rules import get_category_for_extension, get_recommended_folder

def classify_files(scanned_files, root_dir):
    """
    Groups files by category and detects duplicate groups based on MD5 hashes.
    Calculates an overall organization score.
    """
    total_files = len(scanned_files)
    if total_files == 0:
        return {
            "categories": {},
            "duplicates": [],
            "organization_score": 100,
            "total_size_bytes": 0,
            "unorganized_count": 0,
            "duplicate_count": 0
        }

    categories = defaultdict(list)
    md5_groups = defaultdict(list)
    unorganized_count = 0
    total_size_bytes = 0
    
    # Track files to group them
    for file in scanned_files:
        total_size_bytes += file["size_bytes"]
        ext = file["extension"]
        category = get_category_for_extension(ext)
        recommended_dest = get_recommended_folder(ext, root_dir)
        
        # Add recommendation details to the file object
        file["category"] = category
        file["recommended_path"] = recommended_dest
        file["recommended_folder_name"] = os.path.basename(recommended_dest)
        
        # Determine if it's currently unorganized (i.e. sitting right in the root_dir)
        is_root = os.path.abspath(file["directory"]) == os.path.abspath(root_dir)
        file["is_unorganized"] = is_root
        if is_root:
            unorganized_count += 1
            
        categories[category].append(file)
        
    # Group by size to identify candidate duplicate files
    size_groups = defaultdict(list)
    for file in scanned_files:
        size_groups[file["size_bytes"]].append(file)
        
    # Calculate MD5 hashes on-demand ONLY for candidate files sharing the exact same size
    from backend.scanner.scanner import calculate_md5
    for size, grouped_files in size_groups.items():
        if len(grouped_files) > 1 and size > 0:
            for file in grouped_files:
                if not file.get("md5"):
                    file["md5"] = calculate_md5(file["filepath"])
                if file["md5"]:
                    md5_groups[file["md5"]].append(file)

            
    # Process duplicates (only groups with size > 1)
    duplicates_list = []
    duplicate_count = 0
    for md5, grouped_files in md5_groups.items():
        if len(grouped_files) > 1:
            duplicates_list.append({
                "md5": md5,
                "filename": grouped_files[0]["filename"],
                "size_str": grouped_files[0]["size_str"],
                "size_bytes": grouped_files[0]["size_bytes"],
                "paths": [f["filepath"] for f in grouped_files]
            })
            duplicate_count += len(grouped_files) - 1 # count redundant files

    # Calculate Organization Score (0-100)
    # Penalty of 40% based on unorganized files ratio
    # Penalty of 40% based on duplicate files ratio
    # Baseline 20% penalty if files are in "Others" at the root level
    unorganized_ratio = unorganized_count / total_files
    duplicate_ratio = duplicate_count / total_files
    
    penalty = (50 * unorganized_ratio) + (50 * duplicate_ratio)
    org_score = max(0, min(100, int(100 - penalty)))
    
    # Identify files recommended for deletion (Junk / Deletion candidates)
    from datetime import datetime, timedelta
    thirty_days_ago = datetime.now() - timedelta(days=30)
    
    # Identify redundant duplicate paths (copies 2, 3, etc.)
    duplicate_paths = set()
    for md5, grouped_files in md5_groups.items():
        if len(grouped_files) > 1:
            for f in grouped_files[1:]:
                duplicate_paths.add(f["filepath"])
                
    junk_files = []
    for file in scanned_files:
        is_junk = False
        reason = ""
        
        if file["filepath"] in duplicate_paths:
            is_junk = True
            reason = "Redundant Copy"
        elif file["category"] == "Installers":
            try:
                mod_date = datetime.strptime(file["last_modified"], "%Y-%m-%d %H:%M:%S")
                if mod_date < thirty_days_ago:
                    is_junk = True
                    reason = "Old Installer"
            except Exception:
                pass
        elif file["extension"] in [".tmp", ".log", ".bak", ".crdownload"]:
            is_junk = True
            reason = "Temp/Log File"
            
        if is_junk:
            junk_copy = file.copy()
            # Mark its virtual category name with its specific junk flag
            junk_copy["category"] = f"Trash ({reason})"
            junk_files.append(junk_copy)
            
    if junk_files:
        categories["Junk / Delete Recommended"] = junk_files

    
    return {
        "categories": dict(categories),
        "duplicates": duplicates_list,
        "organization_score": org_score,
        "total_size_bytes": total_size_bytes,
        "unorganized_count": unorganized_count,
        "duplicate_count": duplicate_count
    }
