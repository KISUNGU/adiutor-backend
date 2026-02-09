#!/usr/bin/env python3
import sqlite3
import os

db_path = 'databasepnda.db'
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

# Check incoming_mails structure
print("\n=== INCOMING_MAILS STRUCTURE ===")
c.execute("PRAGMA table_info(incoming_mails)")
cols = c.fetchall()
if cols:
    for col in cols:
        print(f"  {col[1]} ({col[2]})")
else:
    print("  (table not found)")

# Sample data from incoming_mails
print("\n=== SAMPLE INCOMING_MAILS DATA ===")
c.execute("SELECT id, original_filename FROM incoming_mails LIMIT 3")
rows = c.fetchall()
for row in rows:
    print(f"  ID {row[0]}: {row[1]}")

conn.close()
print("\nDone.")
