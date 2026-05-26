import os

# Extension mappings for different categories
CATEGORY_MAP = {
    "Documents": [".pdf", ".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt", ".txt", ".csv", ".rtf", ".odt"],
    "Pictures": [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg", ".webp", ".tiff", ".ico"],
    "Videos": [".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".mpeg"],
    "Music": [".mp3", ".wav", ".aac", ".flac", ".ogg", ".m4a", ".wma"],
    "Archives": [".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz"],
    "Installers": [".exe", ".msi", ".apk", ".dmg", ".iso"],
    "Projects": [".py", ".js", ".html", ".css", ".json", ".sql", ".ts", ".tsx", ".jsx", ".java", ".cpp", ".h", ".cs", ".sh", ".bat", ".rb", ".go", ".rs"]
}

def get_category_for_extension(extension):
    """
    Returns the category name based on the file extension.
    If not found in the map, returns 'Others'.
    """
    ext = extension.lower().strip()
    if not ext.startswith('.'):
        ext = '.' + ext
        
    for category, extensions in CATEGORY_MAP.items():
        if ext in extensions:
            return category
            
    return "Others"

def get_recommended_folder(extension, scanned_dir):
    """
    Returns the recommended full path for a file category relative to the scanned directory.
    E.g. scanned_dir = "C:/Users/User/Downloads", extension = ".pdf"
    Returns "C:/Users/User/Downloads/Documents"
    """
    category = get_category_for_extension(extension)
    
    # Nested custom subfolders for specific categories to keep things even cleaner
    ext = extension.lower().strip()
    sub_category = ""
    if category == "Documents":
        if ext == ".pdf":
            sub_category = "PDFs"
        elif ext in [".xlsx", ".xls", ".csv"]:
            sub_category = "Spreadsheets"
        elif ext in [".docx", ".doc", ".rtf"]:
            sub_category = "Word_Documents"
        else:
            sub_category = "Text_Files"
    elif category == "Projects":
        if ext in [".py", ".js", ".ts", ".tsx", ".jsx", ".html", ".css"]:
            sub_category = "Web_and_Scripts"
        elif ext == ".sql":
            sub_category = "Database_Scripts"
        else:
            sub_category = "Source_Code"

    # Combine scanned directory with recommended folder structure
    if sub_category:
        recommended_path = os.path.join(scanned_dir, category, sub_category)
    else:
        recommended_path = os.path.join(scanned_dir, category)
        
    return os.path.abspath(recommended_path)
