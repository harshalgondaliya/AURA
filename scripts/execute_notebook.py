"""
scripts/execute_notebook.py
Executes a target Jupyter notebook top to bottom and updates it with outputs.
"""

import sys
import time
from pathlib import Path
import nbformat
from nbclient import NotebookClient

def execute_notebook(nb_path_str):
    nb_path = Path(nb_path_str)
    assert nb_path.exists(), f"Notebook not found: {nb_path}"
    
    print(f"=== EXECUTING NOTEBOOK: {nb_path.name} ===")
    t0 = time.time()
    
    with open(nb_path, "r", encoding="utf-8") as f:
        nb = nbformat.read(f, as_version=4)
        
    client = NotebookClient(nb, timeout=600, kernel_name="python3")
    client.execute()
    
    with open(nb_path, "w", encoding="utf-8") as f:
        nbformat.write(nb, f)
        
    duration = time.time() - t0
    print(f"[SUCCESS] {nb_path.name} executed completely in {duration:.2f}s with zero errors!")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/execute_notebook.py <path_to_notebook>")
        sys.exit(1)
    execute_notebook(sys.argv[1])
