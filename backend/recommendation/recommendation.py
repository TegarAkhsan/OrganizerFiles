import os
from backend.scanner.scanner import format_size

def generate_recommendations(classified_data):
    """
    Analyzes classified data and generates clean, user-friendly recommendations.
    Returns a list of recommendations, each having a type, title, message, and category code.
    """
    recommendations = []
    
    org_score = classified_data["organization_score"]
    duplicate_count = classified_data["duplicate_count"]
    unorganized_count = classified_data["unorganized_count"]
    categories = classified_data["categories"]
    
    # 1. Overall Score Recommendation
    if org_score < 50:
        recommendations.append({
            "type": "warning",
            "title": "Low Organization Score",
            "message": f"Your folder score is only {org_score}%. Decluttering your files and organizing them into subfolders will dramatically clean up your workspace.",
            "category": "score"
        })
    elif org_score < 85:
        recommendations.append({
            "type": "info",
            "title": "Room for Improvement",
            "message": f"Your folder score is {org_score}%. You have {unorganized_count} files sitting at the root level that could be neatly organized.",
            "category": "score"
        })
    else:
        recommendations.append({
            "type": "success",
            "title": "Excellent Setup!",
            "message": f"Amazing! Your workspace is very neat with an organization score of {org_score}%.",
            "category": "score"
        })
        
    # 2. Duplicate Detection Recommendation
    if duplicate_count > 0:
        total_dup_bytes = sum(dup["size_bytes"] * (len(dup["paths"]) - 1) for dup in classified_data["duplicates"])
        dup_size_str = format_size(total_dup_bytes)
        recommendations.append({
            "type": "danger",
            "title": "Redundant Files Found",
            "message": f"Found {duplicate_count} duplicate files wasting approximately {dup_size_str} of disk space. Consider cleaning up these redundant files.",
            "category": "duplicates"
        })
        
    # 3. Category Specific Recommendations
    for category_name, files in categories.items():
        # Count how many files in this category are unorganized (in the root directory)
        unorg_cat_files = [f for f in files if f["is_unorganized"]]
        if not unorg_cat_files:
            continue
            
        count = len(unorg_cat_files)
        total_bytes = sum(f["size_bytes"] for f in unorg_cat_files)
        size_str = format_size(total_bytes)
        
        if category_name == "Documents":
            recommendations.append({
                "type": "primary",
                "title": "Organize Documents",
                "message": f"Found {count} document file(s) ({size_str}) at the root. We recommend moving them to 'Documents' (divided by PDF, Excel, and Word files).",
                "category": "Documents"
            })
        elif category_name == "Pictures":
            recommendations.append({
                "type": "primary",
                "title": "Consolidate Pictures",
                "message": f"Found {count} image file(s) ({size_str}) scattered in the root. We recommend moving them into a dedicated 'Pictures' folder.",
                "category": "Pictures"
            })
        elif category_name == "Videos":
            recommendations.append({
                "type": "primary",
                "title": "Sort Video Library",
                "message": f"Found {count} video file(s) ({size_str}) occupying space in the root. We suggest sorting them into a nested 'Videos' directory.",
                "category": "Videos"
            })
        elif category_name == "Music":
            recommendations.append({
                "type": "primary",
                "title": "Organize Audio Tracks",
                "message": f"Found {count} audio track(s) ({size_str}) in the root folder. We suggest placing them into a 'Music' folder.",
                "category": "Music"
            })
        elif category_name == "Archives":
            recommendations.append({
                "type": "primary",
                "title": "Archive Management",
                "message": f"Found {count} zip/rar compressed archive(s) ({size_str}). Consolidating them into 'Archives' will make them easier to retrieve.",
                "category": "Archives"
            })
        elif category_name == "Installers":
            recommendations.append({
                "type": "warning",
                "title": "Installer Files Clean Up",
                "message": f"Found {count} setup/installer file(s) ({size_str}) like .exe or .msi in the root. Moving them to 'Installers' prevents messy download pools.",
                "category": "Installers"
            })
        elif category_name == "Projects":
            recommendations.append({
                "type": "primary",
                "title": "Declutter Project files",
                "message": f"Found {count} developer code/script file(s) ({size_str}) sitting in the root folder. We recommend grouping them into 'Projects'.",
                "category": "Projects"
            })
            
    return recommendations
