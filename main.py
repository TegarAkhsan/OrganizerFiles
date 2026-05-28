import os
import json
import socketserver
import sys
import threading
import webview
from http.server import SimpleHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

# Import custom backend modules
from backend.database.database import init_db, get_scan_history, get_organization_history, get_batches, log_scan
from backend.scanner.scanner import scan_directory
from backend.classifier.classifier import classify_files
from backend.recommendation.recommendation import generate_recommendations
from backend.mover.mover import execute_organization, rollback_batch

PORT = 8000

if getattr(sys, 'frozen', False):
    # PyInstaller extracts resources to sys._MEIPASS
    BASE_DIR = sys._MEIPASS
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

class ThreadingHTTPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    """Multi-threaded HTTP Server for responsive parallel operations (e.g. scanning while UI remains active)."""
    allow_reuse_address = True

class APIHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # We override directory to point to frontend folder
        super().__init__(*args, directory=FRONTEND_DIR, **kwargs)

    def end_headers(self):
        # Allow CORS just in case
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        
        # Route API Calls
        if path == "/api/scan-presets":
            self.handle_get_presets()
        elif path == "/api/history":
            self.handle_get_history()
        elif path == "/api/batches":
            self.handle_get_batches()
        elif path == "/api/preview":
            self.handle_get_preview(parsed_url)
        else:
            # Serve standard static files
            super().do_GET()

    def do_POST(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        
        # Read request body
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length) if content_length > 0 else b""
        
        try:
            payload = json.loads(post_data.decode('utf-8')) if post_data else {}
        except Exception:
            payload = {}

        if path == "/api/scan":
            self.handle_post_scan(payload)
        elif path == "/api/organize":
            self.handle_post_organize(payload)
        elif path == "/api/rollback":
            self.handle_post_rollback(payload)
        elif path == "/api/delete":
            self.handle_post_delete(payload)
        else:
            self.send_error(404, "Endpoint not found")


    # API HANDLERS

    def handle_get_presets(self):
        home = os.path.expanduser('~')
        presets = {
            "Downloads": os.path.join(home, "Downloads"),
            "Documents": os.path.join(home, "Documents"),
            "Desktop": os.path.join(home, "Desktop"),
        }
        # Clean up path formats to use standard slashes
        presets = {k: os.path.abspath(v).replace('\\', '/') for k, v in presets.items()}
        
        self.send_json_response(200, presets)

    def handle_get_history(self):
        history = {
            "scans": get_scan_history(),
            "moves": get_organization_history()
        }
        self.send_json_response(200, history)

    def handle_get_batches(self):
        batches = get_batches()
        self.send_json_response(200, batches)

    def handle_get_preview(self, parsed_url):
        params = parse_qs(parsed_url.query)
        file_path = params.get("path", [None])[0]
        
        if not file_path:
            self.send_error(400, "File path is required")
            return
            
        normalized_path = os.path.abspath(file_path)
        
        from backend.scanner.scanner import is_protected
        if is_protected(normalized_path):
            self.send_error(403, "Access to this file is restricted for safety reasons.")
            return
            
        if not os.path.exists(normalized_path) or not os.path.isfile(normalized_path):
            self.send_error(404, "File not found")
            return
            
        ext = os.path.splitext(normalized_path)[1].lower()
        
        # Comprehensive mapping of direct media streaming extensions
        media_extensions = {
            # Images
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".svg": "image/svg+xml",
            ".webp": "image/webp",
            ".ico": "image/x-icon",
            # PDF Document
            ".pdf": "application/pdf",
            # Video Files
            ".mp4": "video/mp4",
            ".webm": "video/webm",
            # Audio Files
            ".mp3": "audio/mpeg",
            ".wav": "audio/wav",
            ".ogg": "audio/ogg"
        }
        
        # Standard Plain Text & Code extensions whitelist
        text_extensions = {
            ".txt", ".log", ".ini", ".cfg", ".conf", ".json", ".xml", ".yaml", ".yml",
            ".csv", ".tsv", ".md", ".py", ".js", ".ts", ".html", ".css", ".sql", ".sh",
            ".bat", ".cmd", ".ps1", ".java", ".c", ".cpp", ".h", ".cs", ".go", ".rs",
            ".rb", ".php", ".aspx", ".jsx", ".tsx", ".toml", ".rst", ".tex"
        }
        
        try:
            if ext in media_extensions:
                content_type = media_extensions[ext]
                with open(normalized_path, "rb") as f:
                    data = f.read()
                self.send_response(200)
                self.send_header("Content-Type", content_type)
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
            elif ext in text_extensions:
                # Treat as text for preview, with a fallback
                # Limit to first 100KB to prevent freezes
                try:
                    with open(normalized_path, "r", encoding="utf-8", errors="replace") as f:
                        text_data = f.read(100 * 1024)
                    
                    response_data = {
                        "success": True,
                        "type": "text",
                        "content": text_data,
                        "filename": os.path.basename(normalized_path),
                        "file_size": os.path.getsize(normalized_path)
                    }
                except Exception:
                    response_data = {
                        "success": False,
                        "type": "binary",
                        "message": "Binary preview not supported.",
                        "filename": os.path.basename(normalized_path),
                        "file_size": os.path.getsize(normalized_path)
                    }
                self.send_json_response(200, response_data)
            else:
                # Direct fallback for unsupported binary formats (archives, executables, Word, Excel)
                response_data = {
                    "success": False,
                    "type": "binary",
                    "message": "Binary preview not supported.",
                    "filename": os.path.basename(normalized_path),
                    "file_size": os.path.getsize(normalized_path)
                }
                self.send_json_response(200, response_data)
        except Exception as e:
            self.send_error(500, f"Error reading file: {str(e)}")

    def handle_post_scan(self):
        # We need to make sure this handles payload or sends a bad request
        pass

    def handle_post_scan(self, payload):
        target_path = payload.get("path")
        if not target_path or not os.path.exists(target_path) or not os.path.isdir(target_path):
            self.send_json_response(400, {"success": False, "message": "Invalid directory path. Please check if the folder exists."})
            return
            
        try:
            # Recursively scan files
            scanned = scan_directory(target_path)
            
            # Classify files & get score
            classified = classify_files(scanned, target_path)
            
            # Generate smart recommendations
            recommendations = generate_recommendations(classified)
            
            # Log the scan to the database
            log_scan(os.path.abspath(target_path).replace('\\', '/'), len(scanned))
            
            # Format output for frontend
            # Convert categories of files to a frontend-friendly structure
            category_lists = {}
            for cat, files in classified["categories"].items():
                category_lists[cat] = [
                    {
                        "filename": f["filename"],
                        "filepath": f["filepath"],
                        "extension": f["extension"],
                        "size_bytes": f["size_bytes"],
                        "size_str": f["size_str"],
                        "last_modified": f["last_modified"],
                        "recommended_path": f["recommended_path"],
                        "recommended_folder_name": f["recommended_folder_name"],
                        "is_unorganized": f["is_unorganized"],
                        "md5": f["md5"]
                    } for f in files
                ]

            response_data = {
                "success": True,
                "scanned_path": os.path.abspath(target_path).replace('\\', '/'),
                "total_files": len(scanned),
                "total_size": classified["total_size_bytes"],
                "organization_score": classified["organization_score"],
                "unorganized_count": classified["unorganized_count"],
                "duplicate_count": classified["duplicate_count"],
                "categories": category_lists,
                "duplicates": classified["duplicates"],
                "recommendations": recommendations
            }
            
            self.send_json_response(200, response_data)
            
        except PermissionError as pe:
            self.send_json_response(403, {"success": False, "message": str(pe)})
        except Exception as e:
            self.send_json_response(500, {"success": False, "message": f"Error during scanning: {str(e)}"})

    def handle_post_organize(self, payload):
        files = payload.get("files")
        if not files:
            self.send_json_response(400, {"success": False, "message": "No files selected for organization."})
            return
            
        try:
            result = execute_organization(files)
            self.send_json_response(200, {
                "success": True,
                "batch_id": result["batch_id"],
                "success_count": result["success_count"],
                "moved_records": result["moved_records"],
                "errors": result["errors"]
            })
        except Exception as e:
            self.send_json_response(500, {"success": False, "message": f"Error executing organization: {str(e)}"})

    def handle_post_rollback(self, payload):
        batch_id = payload.get("batch_id")
        if not batch_id:
            self.send_json_response(400, {"success": False, "message": "Batch ID is required for rollback."})
            return
            
        try:
            result = rollback_batch(batch_id)
            self.send_json_response(200, result)
        except Exception as e:
            self.send_json_response(500, {"success": False, "message": f"Error performing rollback: {str(e)}"})

    def handle_post_delete(self, payload):
        files = payload.get("files", [])
        if not files:
            self.send_json_response(400, {"success": False, "message": "No files selected for deletion."})
            return
            
        from backend.scanner.scanner import is_protected
        
        deleted_count = 0
        errors = []
        
        for file_path in files:
            normalized_path = os.path.abspath(file_path)
            
            # Enforce safety blocklist filters
            if is_protected(normalized_path):
                errors.append(f"Security Block: Cannot delete protected path: {os.path.basename(file_path)}")
                continue
                
            if not os.path.exists(normalized_path):
                errors.append(f"Not found: {os.path.basename(file_path)}")
                continue
                
            try:
                os.remove(normalized_path)
                deleted_count += 1
            except Exception as e:
                errors.append(f"Failed to delete {os.path.basename(file_path)}: {str(e)}")
                
        self.send_json_response(200, {
            "success": True,
            "deleted_count": deleted_count,
            "errors": errors
        })


    # UTILS

    def send_json_response(self, status, data):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

def main():
    # 1. Initialize SQLite Database Tables
    print("[AI Organizer] Initializing database...")
    init_db()
    
    # 2. Boot Local Web Server in a daemon thread
    print(f"[AI Organizer] Starting server at http://localhost:{PORT}")
    server_address = ('', PORT)
    httpd = ThreadingHTTPServer(server_address, APIHandler)
    
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()
    
    # 3. Open PyWebView GUI window
    print("[AI Organizer] Starting Desktop GUI...")
    # Create webview window
    webview.create_window(
        "AI Organizer", 
        f"http://localhost:{PORT}", 
        width=1200, 
        height=800,
        min_size=(1000, 700)
    )
    webview.start()
    
    # After webview closes, shut down the HTTP server cleanly
    print("[AI Organizer] Closing server.")
    httpd.shutdown()

if __name__ == "__main__":
    main()
