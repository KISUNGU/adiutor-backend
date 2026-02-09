#!/usr/bin/env python3
import sqlite3
import os

db_path = 'adiutorai.db'
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
c = conn.cursor()

# List all tables
print("=== ALL TABLES ===")
c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = c.fetchall()
for table in tables:
    print(f"  {table[0]}")

# Check if courriers_sortants exists and has a file column
print("\n=== COURRIERS_SORTANTS STRUCTURE ===")
c.execute("PRAGMA table_info(courriers_sortants)")
cols = c.fetchall()
if cols:
    for col in cols:
        print(f"  {col[1]} ({col[2]})")
else:
    print("  (table not found)")

# Check archives structure
print("\n=== ARCHIVES STRUCTURE ===")
c.execute("PRAGMA table_info(archives)")
cols = c.fetchall()
if cols:
    for col in cols:
        print(f"  {col[1]} ({col[2]})")
else:
    print("  (table not found)")

conn.close()
print("\nDone.")
