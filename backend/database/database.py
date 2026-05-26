import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "organizer.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Table for scan history
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS scan_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scan_date DATETIME NOT NULL,
            scanned_folder TEXT NOT NULL,
            total_files INTEGER NOT NULL
        )
    """)
    
    # Table for organized files history
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS organization_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            old_location TEXT NOT NULL,
            new_location TEXT NOT NULL,
            moved_at DATETIME NOT NULL,
            batch_id TEXT NOT NULL
        )
    """)
    
    conn.commit()
    conn.close()

def log_scan(scanned_folder, total_files):
    conn = get_db_connection()
    cursor = conn.cursor()
    scan_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute(
        "INSERT INTO scan_history (scan_date, scanned_folder, total_files) VALUES (?, ?, ?)",
        (scan_date, scanned_folder, total_files)
    )
    conn.commit()
    conn.close()

def log_move(filename, old_location, new_location, batch_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    moved_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute(
        "INSERT INTO organization_history (filename, old_location, new_location, moved_at, batch_id) VALUES (?, ?, ?, ?, ?)",
        (filename, old_location, new_location, moved_at, batch_id)
    )
    conn.commit()
    conn.close()

def get_scan_history():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, scan_date, scanned_folder, total_files FROM scan_history ORDER BY id DESC LIMIT 50")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_organization_history():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, filename, old_location, new_location, moved_at, batch_id FROM organization_history ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_batches():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT batch_id, MAX(moved_at) as moved_at, COUNT(*) as files_moved 
        FROM organization_history 
        GROUP BY batch_id 
        ORDER BY moved_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_batch_moves(batch_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT filename, old_location, new_location FROM organization_history WHERE batch_id = ?", (batch_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def delete_batch(batch_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM organization_history WHERE batch_id = ?", (batch_id,))
    conn.commit()
    conn.close()
