import subprocess
import os

repo = r"E:\VS-Code\Glanz\Glanz-Mobile"

def run(cmd):
    result = subprocess.run(cmd, cwd=repo, capture_output=True, text=True, shell=True)
    print(f"CMD: {cmd}")
    print(f"STDOUT: {result.stdout}")
    print(f"STDERR: {result.stderr}")
    print(f"RC: {result.returncode}")
    print("---")
    return result

# 1. Check status
run("git status")
run("git log --oneline -3")
