import os
import hashlib
from pathlib import Path
from datetime import datetime

# Blocklist of system directories or folders that should NEVER be scanned or touched
PROTECTED_KEYWORDS = [
    "windows",
    "system32",
    "program files",
    "program files (x86)",
    "system volume information",
    "$recycle.bin",
    "appdata",
    ".git",
    "node_modules",
    "__pycache__",
    ".idea",
    ".vscode"
]

def calculate_md5(file_path):
    """Calculates MD5 hash of a file using buffered reading for performance and low memory footprint."""
    hasher = hashlib.md5()
    try:
        with open(file_path, 'rb') as f:
            # Read in 64kb chunks
            for chunk in iter(lambda: f.read(65536), b''):
                hasher.update(chunk)
        return hasher.hexdigest()
    except Exception:
        # Return none if file cannot be read (e.g. locked files)
        return None

def is_protected(path_str):
    """Checks if a given path contains any system-protected keywords."""
    normalized = path_str.lower().replace('\\', '/')
    for keyword in PROTECTED_KEYWORDS:
        if f"/{keyword}/" in f"/{normalized}/" or normalized.startswith(keyword):
            return True
    return False

def format_size(bytes_size):
    """Formats file size into human-readable strings (KB, MB, GB)."""
    if bytes_size < 1024:
        return f"{bytes_size} B"
    elif bytes_size < 1024 * 1024:
        return f"{bytes_size / 1024:.2f} KB"
    elif bytes_size < 1024 * 1024 * 1024:
        return f"{bytes_size / (1024 * 1024):.2f} MB"
    else:
        return f"{bytes_size / (1024 * 1024 * 1024):.2f} GB"

def scan_directory(directory_path, progress_callback=None):
    """
    Recursively scans directory_path.
    Returns a list of dictionaries containing file metadata.
    """
    target_dir = Path(directory_path).resolve()
    if not target_dir.exists() or not target_dir.is_dir():
        raise ValueError("Invalid target directory path")
        
    if is_protected(str(target_dir)):
        raise PermissionError("Accessing this directory is restricted for safety reasons.")
        
    scanned_files = []
    
    # We index the top-level directory only (non-recursive) for safety and instant response
    for root, dirs, files in os.walk(str(target_dir)):
        for file in files:
            file_path = os.path.join(root, file)
            
            # Skip hidden files starting with . or protected paths
            if file.startswith('.') or is_protected(file_path):
                continue
                
            try:
                stat = os.stat(file_path)
                size_bytes = stat.st_size
                mod_time = datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S")
                ext = os.path.splitext(file)[1].lower()
                
                # Check for progress_callback call
                if progress_callback:
                    progress_callback(file)
                
                # MD5 is computed dynamically during the classification phase to avoid recursive disk bottlenecks
                md5 = None
                
                scanned_files.append({
                    "filepath": os.path.abspath(file_path),
                    "filename": file,
                    "extension": ext if ext else "no_ext",
                    "size_bytes": size_bytes,
                    "size_str": format_size(size_bytes),
                    "last_modified": mod_time,
                    "directory": os.path.abspath(root),
                    "md5": md5
                })
            except (PermissionError, FileNotFoundError):
                # Skip locked files or files deleted during scan
                continue
            except Exception as e:
                # Catch-all to make sure scanning doesn't halt
                print(f"Error scanning file {file_path}: {e}")
                continue
        break # DO NOT descend recursively into nested project folders or code packages

                
    return scanned_files
