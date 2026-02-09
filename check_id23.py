#!/usr/bin/env python3
import sqlite3

db_path = 'databasepnda.db'
conn = sqlite3.connect(db_path)
c = conn.cursor()

# Sample data from incoming_mails ID 23
print("=== INCOMING_MAILS ID 23 ===")
c.execute("SELECT id, file_path, subject, ref_code FROM incoming_mails WHERE id = 23")
row = c.fetchone()
if row:
    print(f"ID: {row[0]}")
    print(f"file_path: {row[1]}")
    print(f"subject: {row[2]}")
    print(f"ref_code: {row[3]}")
else:
    print("ID 23 not found")

# Check all file_path values
print("\n=== FIRST 3 RECORDS WITH FILE_PATH ===")
c.execute("SELECT id, file_path, subject FROM incoming_mails WHERE file_path IS NOT NULL LIMIT 3")
rows = c.fetchall()
for row in rows:
    print(f"ID {row[0]}: {row[1]} ({row[2]})")

conn.close()
