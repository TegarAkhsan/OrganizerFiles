import os
import json
import socketserver
from http.server import SimpleHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

# Import custom backend modules
from backend.database.database import init_db, get_scan_history, get_organization_history, get_batches, log_scan
from backend.scanner.scanner import scan_directory
from backend.classifier.classifier import classify_files
from backend.recommendation.recommendation import generate_recommendations
from backend.mover.mover import execute_organization, rollback_batch

PORT = 8000
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend")

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
    
    # 2. Boot Local Web Server
    print(f"[AI Organizer] Starting server at http://localhost:{PORT}")
    server_address = ('', PORT)
    httpd = ThreadingHTTPServer(server_address, APIHandler)
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[AI Organizer] Shutting down server safely.")
        httpd.server_close()

if __name__ == "__main__":
    main()
