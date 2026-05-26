import os
import shutil
import uuid
from backend.database.database import log_move, log_scan, get_batch_moves, delete_batch
from backend.scanner.scanner import calculate_md5

def get_unique_path(target_path):
    """
    If a file exists at target_path, appends a incremental '-copyX' suffix
    to avoid overwriting existing data.
    """
    if not os.path.exists(target_path):
        return target_path
        
    base, ext = os.path.splitext(target_path)
    counter = 1
    new_path = f"{base}-copy{counter}{ext}"
    while os.path.exists(new_path):
        counter += 1
        new_path = f"{base}-copy{counter}{ext}"
        
    return new_path

def execute_organization(files_to_move, batch_id=None):
    """
    Moves selected files to their recommended paths.
    Creates necessary folders automatically.
    Resolves filename conflicts without losing data.
    Logs every action to the SQLite database.
    """
    if not batch_id:
        batch_id = str(uuid.uuid4())
        
    success_count = 0
    errors = []
    moved_records = []
    
    for file in files_to_move:
        src = file["filepath"]
        dest_folder = file["recommended_path"]
        filename = file["filename"]
        
        if not os.path.exists(src):
            errors.append(f"Source file not found: {filename}")
            continue
            
        try:
            # Ensure target folder exists
            os.makedirs(dest_folder, exist_ok=True)
            
            dest_file_path = os.path.join(dest_folder, filename)
            
            # Collision check
            if os.path.exists(dest_file_path):
                # Calculate hashes to check if they are identical
                src_md5 = file.get("md5") or calculate_md5(src)
                dest_md5 = calculate_md5(dest_file_path)
                
                if src_md5 and src_md5 == dest_md5:
                    # They are identical, safe to overwrite or merge.
                    # To be perfectly safe, we can just delete the source and say it merged,
                    # but let's just log and move it normally or remove the duplicate source.
                    os.remove(src)
                    log_move(filename, src, dest_file_path, batch_id)
                    success_count += 1
                    moved_records.append({
                        "filename": filename,
                        "from": src,
                        "to": dest_file_path,
                        "status": "merged"
                    })
                    continue
                else:
                    # Files are different, get a unique name
                    dest_file_path = get_unique_path(dest_file_path)
                    filename = os.path.basename(dest_file_path)
            
            # Move the file
            shutil.move(src, dest_file_path)
            
            # Log in database
            log_move(filename, src, dest_file_path, batch_id)
            success_count += 1
            moved_records.append({
                "filename": filename,
                "from": src,
                "to": dest_file_path,
                "status": "moved"
            })
            
        except Exception as e:
            errors.append(f"Failed to move {filename}: {str(e)}")
            continue
            
    return {
        "batch_id": batch_id,
        "success_count": success_count,
        "moved_records": moved_records,
        "errors": errors
    }

def rollback_batch(batch_id):
    """
    Rolls back an entire organization session using its batch_id.
    Moves files back to their exact original paths and clears database entries.
    """
    moves = get_batch_moves(batch_id)
    if not moves:
        return {"success": False, "message": "Batch ID not found or already rolled back."}
        
    rolled_back_count = 0
    skipped_count = 0
    errors = []
    
    for move in moves:
        filename = move["filename"]
        current_loc = move["new_location"]
        original_loc = move["old_location"]
        
        # If the file doesn't exist at its organized path, we must skip it
        if not os.path.exists(current_loc):
            skipped_count += 1
            errors.append(f"Could not restore {filename}: File no longer exists in organized directory.")
            continue
            
        try:
            # Recreate original parent folder if it was deleted
            original_parent = os.path.dirname(original_loc)
            os.makedirs(original_parent, exist_ok=True)
            
            # If a file has since been put in the original location, avoid overwriting
            target_path = get_unique_path(original_loc)
            
            shutil.move(current_loc, target_path)
            rolled_back_count += 1
            
        except Exception as e:
            errors.append(f"Error rolling back {filename}: {str(e)}")
            continue
            
    # Remove from database history
    delete_batch(batch_id)
    
    return {
        "success": True,
        "rolled_back_count": rolled_back_count,
        "skipped_count": skipped_count,
        "errors": errors
    }
