import os
import re
import urllib.request
import urllib.parse
import urllib.error

# This script runs directly in the project directory (works on both local PC and remote server)
workspace_dir = os.path.dirname(os.path.abspath(__file__))
old_server_ip = "93.186.118.110"

print(f"Starting missing image scanner in: {workspace_dir}")
print("Scanning HTML files...")

image_urls = set()

# Scan all HTML files in the project directory
for root, dirs, files in os.walk(workspace_dir):
    if ".git" in root or ".gemini" in root:
        continue
    for file in files:
        if file.endswith(".html"):
            filepath = os.path.join(root, file)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
                # Find all src="...uploads/..." or href="...uploads/..."
                matches = re.findall(r'src=["\']([^"\']*/uploads/[^"\']+)["\']', content)
                for m in matches:
                    image_urls.add(m)
                matches_href = re.findall(r'href=["\']([^"\']*/uploads/[^"\']+)["\']', content)
                for m in matches_href:
                    image_urls.add(m)
            except Exception as e:
                pass

print(f"Found {len(image_urls)} unique upload paths in HTML files.")

missing_count = 0
downloaded_count = 0
failed_count = 0

for url in sorted(image_urls):
    # Only process local/internal upload URLs
    if url.startswith("http") and "unityverseacademy.com" not in url and "localhost" not in url and "35.234.93.8" not in url:
        continue
        
    clean_path = url
    if "unityverseacademy.com" in clean_path:
        clean_path = clean_path.split("unityverseacademy.com")[-1]
    elif "localhost" in clean_path:
        clean_path = clean_path.split("localhost:8000")[-1]
    elif "35.234.93.8" in clean_path:
        clean_path = clean_path.split("35.234.93.8")[-1]
        
    # Remove relative prefixes like ../..
    clean_path = re.sub(r'^[\./]+uploads', 'uploads', clean_path)
    if clean_path.startswith('/uploads'):
        clean_path = clean_path[1:]
    
    if not clean_path.startswith("uploads/"):
        continue
        
    # Remove query parameters if any
    clean_path_no_query = clean_path.split('?')[0]
    
    # URL decode to handle unicode characters in the filesystem path
    decoded_path = urllib.parse.unquote(clean_path_no_query)
    
    local_path = os.path.join(workspace_dir, decoded_path.replace('/', os.sep))
    
    if not os.path.exists(local_path):
        missing_count += 1
        
        # Build url-safe encoded path for the HTTP request
        path_parts = decoded_path.split('/')
        quoted_path = '/'.join(urllib.parse.quote(part) for part in path_parts)
        
        old_url = f"http://{old_server_ip}/{quoted_path}"
        
        req = urllib.request.Request(old_url)
        req.add_header('Host', 'unityverseacademy.com')
        
        # Ensure target directory exists
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        
        try:
            print(f"Downloading missing: {decoded_path} ... ", end="")
        except UnicodeEncodeError:
            try:
                print(f"Downloading missing: {decoded_path.encode('ascii', errors='replace').decode('ascii')} ... ", end="")
            except Exception:
                print("Downloading missing file ... ", end="")
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                with open(local_path, 'wb') as out_file:
                    out_file.write(response.read())
            print("SUCCESS")
            downloaded_count += 1
        except urllib.error.HTTPError as e:
            print(f"HTTP ERROR {e.code}")
            failed_count += 1
        except Exception as e:
            print(f"FAILED: {e}")
            failed_count += 1

print(f"\nTask Complete!")
print(f"Total Missing Detected: {missing_count}")
print(f"Successfully Downloaded: {downloaded_count}")
print(f"Failed to Download: {failed_count}")
