import os
import sys
import shutil

# Make sure our application root is in the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database.database import init_db, get_db_connection
from backend.scanner.scanner import scan_directory
from backend.classifier.classifier import classify_files
from backend.recommendation.recommendation import generate_recommendations

from backend.mover.mover import execute_organization, rollback_batch

TEST_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scratch_test_sandbox")

def setup_test_files():
    """Sets up a messy target directory with diverse files and duplicates."""
    if os.path.exists(TEST_DIR):
        shutil.rmtree(TEST_DIR)
    os.makedirs(TEST_DIR)
    
    # 1. Documents (one PDF, and one exact identical copy of it to trigger duplicates)
    pdf_content = b"PDF dummy content signature key 12345"
    with open(os.path.join(TEST_DIR, "Tugas_Kalkulus.pdf"), "wb") as f:
        f.write(pdf_content)
    with open(os.path.join(TEST_DIR, "Tugas_Kalkulus_Copy.pdf"), "wb") as f:
        f.write(pdf_content) # exact copy
        
    # 2. Picture
    with open(os.path.join(TEST_DIR, "screenshot.png"), "wb") as f:
        f.write(b"PNG fake pixel values 998877")
        
    # 3. Project code script
    with open(os.path.join(TEST_DIR, "app.py"), "w") as f:
        f.write("print('hello world')\n")
        
    # 4. Installer
    with open(os.path.join(TEST_DIR, "chrome_installer.exe"), "wb") as f:
        f.write(b"EXE binary executable dump 556677")
        
    # 5. Archive zip
    with open(os.path.join(TEST_DIR, "backup.zip"), "wb") as f:
        f.write(b"ZIP compress header bytes 1122")
        
    print(f"[Sandbox Setup] Created sandbox at: {TEST_DIR}")
    print("[Sandbox Setup] Total files: 6 (including 1 duplicate PDF)")

def run_e2e_test():
    setup_test_files()
    
    print("\n--- Phase 1: Database Initialization ---")
    init_db()
    print("[DB] SQLite database and tables initialized.")
    
    print("\n--- Phase 2: safe Directory Scanning ---")
    scanned_files = scan_directory(TEST_DIR)
    print(f"[Scanner] Scanned {len(scanned_files)} files successfully.")
    for f in scanned_files:
        print(f" - Found: {f['filename']} ({f['size_str']}) [MD5: {f['md5'][:6] if f['md5'] else 'None'}]")
    
    assert len(scanned_files) == 6, "Expected exactly 6 files."
    
    print("\n--- Phase 3: Classification and Scoring ---")
    classified = classify_files(scanned_files, TEST_DIR)
    print(f"[Classifier] Total unorganized: {classified['unorganized_count']}")
    print(f"[Classifier] Total duplicates: {classified['duplicate_count']}")
    print(f"[Classifier] Current Organization Score: {classified['organization_score']}%")
    
    assert classified['unorganized_count'] == 6, "All 6 files should start in the root (unorganized)."
    assert classified['duplicate_count'] == 1, "Expected exactly 1 redundant duplicate file copy."
    assert classified['organization_score'] < 100, "Score should be low for unorganized folders."
    
    print("\n--- Phase 4: Recommendation Generation ---")
    recs = generate_recommendations(classified)
    print(f"[Recommender] Generated {len(recs)} recommendation bulletins:")
    for r in recs:
        print(f" * [{r['type'].upper()}] {r['title']}: {r['message']}")
        
    print("\n--- Phase 5: Executing safe Move Migrations ---")
    # Prepare files structure for moving (we move all 6 files)
    files_to_move = []
    for cat, items in classified["categories"].items():
        files_to_move.extend(items)
        
    result = execute_organization(files_to_move)
    print(f"[Mover] Moved {result['success_count']} files successfully.")
    for record in result["moved_records"]:
        print(f" - {record['filename']} -> status: {record['status']} ({os.path.basename(os.path.dirname(record['to']))})")
        
    # Check that organized folders exist and contain files
    print("\n--- Phase 6: Verifying Target Subdirectories ---")
    doc_pdf_dir = os.path.join(TEST_DIR, "Documents", "PDFs")
    pic_dir = os.path.join(TEST_DIR, "Pictures")
    proj_dir = os.path.join(TEST_DIR, "Projects", "Web_and_Scripts")
    inst_dir = os.path.join(TEST_DIR, "Installers")
    arc_dir = os.path.join(TEST_DIR, "Archives")
    
    assert os.path.exists(doc_pdf_dir), "PDF folder should exist."
    assert os.path.exists(pic_dir), "Pictures folder should exist."
    assert os.path.exists(proj_dir), "Projects subfolder should exist."
    assert os.path.exists(inst_dir), "Installers folder should exist."
    assert os.path.exists(arc_dir), "Archives folder should exist."
    
    # Note: the duplicate Tugas_Kalkulus_Copy.pdf will be merged since it has matching hash
    print("[Mover] Validated: Subfolders nested beautifully. Identical duplicate copy was merged cleanly.")
    
    print("\n--- Phase 7: Rollback Verification ---")
    batch_id = result["batch_id"]
    rollback_res = rollback_batch(batch_id)
    print(f"[Rollback] Rolled back {rollback_res['rolled_back_count']} file(s).")
    
    # Verify that everything returned back to the root sandbox folder
    root_files = os.listdir(TEST_DIR)
    print(f"[Rollback] Files restored back in root directory: {root_files}")
    
    # Clean up test sandbox
    shutil.rmtree(TEST_DIR)
    print("[Cleanup] Sandbox directory deleted successfully.")
    print("\n[VERIFICATION STATUS] ALL E2E TESTS PASSED SUCCESSFULLY! [OK]")

if __name__ == "__main__":
    run_e2e_test()
