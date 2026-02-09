import sqlite3

# ATTENTION : Ce script supprime la table courriers_sortants !
# Sauvegardez vos données si besoin avant d'exécuter.

db = sqlite3.connect('databasepnda.db')
c = db.cursor()
c.execute('DROP TABLE IF EXISTS courriers_sortants')
db.commit()
db.close()
print('Table courriers_sortants supprimée. Relancez le backend pour la recréer proprement.')
