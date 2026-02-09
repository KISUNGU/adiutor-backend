#!/usr/bin/env python3
import sqlite3
import os

db_path = 'adiutorai.db'
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
c = conn.cursor()

# Check columns
print("=== INCOMING_MAILS TABLE COLUMNS ===")
c.execute("PRAGMA table_info(incoming_mails)")
cols = c.fetchall()
for col in cols:
    print(f"  {col[1]} ({col[2]})")

# Check sample data
print("\n=== SAMPLE DATA ===")
c.execute("SELECT id, subject, file_path FROM incoming_mails LIMIT 2")
rows = c.fetchall()
for row in rows:
    print(f"  ID {row[0]}: file_path = {row[2]}")

conn.close()
print("\nDone.")
