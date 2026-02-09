# backend/flask_app.py

import os
import sqlite3
from pathlib import Path
from datetime import date

from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# -------------------------------------------------------------------
# 0. Optionnel : OpenAI (sera désactivé si pas de SDK ou pas de clé)
# -------------------------------------------------------------------
try:
    from openai import OpenAI
    OPENAI_SDK_AVAILABLE = True
except Exception as e:
    OPENAI_SDK_AVAILABLE = False
    print(f"⚠️ OpenAI import failed: {e}")

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "databasepnda.db"

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if OPENAI_SDK_AVAILABLE and OPENAI_API_KEY:
    openai_client = OpenAI(api_key=OPENAI_API_KEY)
    print("✅ OpenAI initialisé pour l'agent IA.")
else:
    openai_client = None
    print("⚠️ OpenAI non configuré (pas de SDK ou pas d'OPENAI_API_KEY) – fallback rule-based uniquement.")

# -------------------------------------------------------------------
# 1. Initialisation Flask
# -------------------------------------------------------------------
app = Flask(__name__)
CORS(app)  # Vue -> Node -> Flask, CORS ok

# -------------------------------------------------------------------
# 2. Helpers SQLite
# -------------------------------------------------------------------
def get_connection():
    """Ouvre une connexion SQLite vers backend/databasepnda.db."""
    readonly = os.getenv("FLASK_SQLITE_READONLY", "true").lower() in ("1", "true", "yes")
    if readonly:
        conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True, check_same_thread=False)
    else:
        conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def get_table_columns(conn, table_name: str):
    """Retourne la liste des colonnes pour une table."""
    try:
        cur = conn.cursor()
        cur.execute(f"PRAGMA table_info({table_name})")
        return [row["name"] if isinstance(row, sqlite3.Row) else row[1] for row in cur.fetchall()]
    except Exception:
        return []


def safe_count(conn, table_name: str) -> int:
    """COUNT(*) sur une table, avec gestion d'erreur."""
    try:
        cur = conn.cursor()
        cur.execute(f"SELECT COUNT(*) AS c FROM {table_name}")
        row = cur.fetchone()
        return row["c"] if row else 0
    except Exception as e:
        print(f"⚠️  Erreur COUNT sur {table_name}: {e}")
        return 0


def get_basic_counters(conn):
    """Totaux globaux (entrants, sortants, archives, notifications)."""
    return {
        "incoming_total": safe_count(conn, "incoming_mails"),
        "outgoing_total": safe_count(conn, "courriers_sortants"),
        "archives_total": safe_count(conn, "archives"),
        "notifications_total": safe_count(conn, "notifications"),
    }


def detect_column(columns, candidates):
    """Retrouve la première colonne existante parmi une liste de candidats."""
    for c in candidates:
        if c in columns:
            return c
    return None


def compute_incoming_kpis(conn):
    """
    Calcule des KPIs sur incoming_mails :
      - par statut
      - non traités
      - en retard (si date d'échéance dispo)
      - par service
    """
    cur = conn.cursor()
    cols = get_table_columns(conn, "incoming_mails")

    result = {
        "by_status": [],
        "unprocessed": 0,
        "late": 0,
        "by_service": [],
    }

    status_col = detect_column(cols, ["status", "statut", "etat"])
    service_col = detect_column(cols, ["service", "service_id", "id_service", "idService"])
    due_col = detect_column(cols, ["due_date", "date_limite", "date_echeance", "deadline"])

    # --- Répartition par statut ---
    if status_col:
        try:
            cur.execute(
                f"SELECT {status_col} AS status, COUNT(*) AS c "
                f"FROM incoming_mails GROUP BY {status_col}"
            )
            result["by_status"] = [
                {"status": row["status"], "count": row["c"]}
                for row in cur.fetchall()
            ]
        except Exception as e:
            print("⚠️  Erreur by_status incoming_mails:", e)

        # --- Courriers non traités ---
        unprocessed_values = [
            "NON_TRAITE", "NON TRAITE", "NON_TRAITÉ", "NON TRAITÉ",
            "EN_ATTENTE", "EN ATTENTE", "A_TRAITER", "A TRAITER",
            "PENDING", "TO_DO", "TODO", "TO_PROCESS",
        ]
        placeholders = ",".join("?" for _ in unprocessed_values)
        try:
            cur.execute(
                f"""
                SELECT COUNT(*) AS c
                FROM incoming_mails
                WHERE {status_col} IS NULL
                   OR UPPER({status_col}) IN ({placeholders})
                """,
                [v.upper() for v in unprocessed_values],
            )
            row = cur.fetchone()
            result["unprocessed"] = row["c"] if row else 0
        except Exception as e:
            print("⚠️  Erreur unprocessed incoming_mails:", e)

    # --- Courriers en retard (besoin d'une date d'échéance) ---
    if due_col:
        try:
            today_str = date.today().isoformat()
            if status_col:
                done_values = [
                    "TRAITE", "TRAITÉ", "TERMINE", "TERMINÉ",
                    "CLOS", "CLOSE", "DONE", "PROCESSED",
                ]
                placeholders = ",".join("?" for _ in done_values)
                cur.execute(
                    f"""
                    SELECT COUNT(*) AS c
                    FROM incoming_mails
                    WHERE {due_col} < ?
                      AND (
                        {status_col} IS NULL
                        OR UPPER({status_col}) NOT IN ({placeholders})
                      )
                    """,
                    [today_str, *[v.upper() for v in done_values]],
                )
            else:
                cur.execute(
                    f"SELECT COUNT(*) AS c FROM incoming_mails WHERE {due_col} < ?",
                    [today_str],
                )
            row = cur.fetchone()
            result["late"] = row["c"] if row else 0
        except Exception as e:
            print("⚠️  Erreur late incoming_mails:", e)

    # --- Répartition par service ---
    if service_col:
        try:
            cur.execute(
                f"""
                SELECT {service_col} AS service, COUNT(*) AS c
                FROM incoming_mails
                GROUP BY {service_col}
                """
            )
            result["by_service"] = [
                {"service": row["service"], "count": row["c"]}
                for row in cur.fetchall()
            ]
        except Exception as e:
            print("⚠️  Erreur by_service incoming_mails:", e)

    return result

# -------------------------------------------------------------------
# 3. Classification des requêtes (intention de l'agent)
# -------------------------------------------------------------------
def classify_query(query: str) -> str:
    q = (query or "").lower()

    # Urgences
    if any(k in q for k in ["urgent", "urgence", "prioritaire", "haute priorité", "haute priorite"]):
        return "urgent_focus"

    # Courriers en retard
    if any(k in q for k in ["retard", "en retard", "deadline dépassée", "deadline depassee", "échéance dépassée", "echeance depassee"]):
        return "late_mails"

    # Courriers non traités
    if any(k in q for k in ["non traité", "non traites", "non traités", "pas traité", "pas traites", "non traite"]):
        return "unprocessed_mails"

    # Répartition par service / département
    if any(k in q for k in ["par service", "par département", "par departement", "par unité", "par unite", "par direction", "services", "départements", "departements"]):
        return "per_service"

    # Performance workflow / KPIs
    if any(k in q for k in ["kpi", "performance", "workflow", "indicateur", "indicateurs"]):
        return "workflow_kpis"

    # Archives
    if any(k in q for k in ["archive", "archives", "archivage"]):
        return "archives_focus"

    # Par défaut
    return "default"

# -------------------------------------------------------------------
# 4. Commentaire IA (rule-based + éventuellement OpenAI)
# -------------------------------------------------------------------
def build_rule_based_comment(mode: str, snapshot: dict, query: str) -> str:
    totals = snapshot.get("totals", {})
    incoming_kpis = snapshot.get("incoming_kpis", {})

    if mode == "urgent_focus":
        unprocessed = incoming_kpis.get("unprocessed", 0)
        late = incoming_kpis.get("late", 0)
        return (
            f"Analyse des urgences : {late} courrier(s) en retard et {unprocessed} courrier(s) possiblement non traités. "
            "Priorisez ces dossiers pour réduire les risques opérationnels."
        )

    if mode == "late_mails":
        late = incoming_kpis.get("late", 0)
        return (
            f"On détecte {late} courrier(s) en retard. "
            "Un plan de rattrapage (réaffectation, rappels, relances) peut être nécessaire."
        )

    if mode == "unprocessed_mails":
        unprocessed = incoming_kpis.get("unprocessed", 0)
        return (
            f"Il y a {unprocessed} courrier(s) potentiellement non traités. "
            "Vérifiez les files d'attente et les responsabilités pour éviter les blocages."
        )

    if mode == "per_service":
        by_service = incoming_kpis.get("by_service", [])
        if not by_service:
            return "Impossible de détailler par service : aucune colonne de service détectée dans la table incoming_mails."
        top = max(by_service, key=lambda x: x["count"])
        return (
            f"La répartition par service montre que « {top.get('service') or 'N/A'} » "
            f"est le plus sollicité avec {top.get('count', 0)} courrier(s)."
        )

    if mode == "workflow_kpis":
        inc = totals.get("incoming_total", 0)
        out = totals.get("outgoing_total", 0)
        archives = totals.get("archives_total", 0)
        return (
            f"Vue globale du workflow : {inc} courriers entrants, {out} sortants, "
            f"{archives} archivés. Utilisez ces indicateurs pour piloter la charge et les délais."
        )

    if mode == "archives_focus":
        archives = totals.get("archives_total", 0)
        return (
            f"La base contient {archives} élément(s) d'archives. "
            "Pensez à vérifier la répartition par type et les délais légaux de conservation."
        )

    inc = totals.get("incoming_total", 0)
    out = totals.get("outgoing_total", 0)
    return (
        f"Dashboard standard généré pour la requête « {query} » : "
        f"{inc} courriers entrants et {out} sortants. "
        "Affinez votre requête pour cibler les urgences, les retards ou un service précis."
    )


def build_ai_comment_with_openai(mode: str, snapshot: dict, query: str) -> str:
    """Si OpenAI est dispo, produit un commentaire plus riche, sinon fallback rule-based."""
    if openai_client is None:
        return build_rule_based_comment(mode, snapshot, query)

    try:
        totals = snapshot.get("totals", {})
        incoming_kpis = snapshot.get("incoming_kpis", {})

        prompt = (
            "Tu es un assistant spécialisé en gouvernance des courriers et archivage.\n"
            "On te fournit des indicateurs chiffrés et une requête utilisateur. "
            "Produis un court commentaire analytique (3 à 4 phrases max), en français, "
            "qui aide un responsable à piloter son activité.\n\n"
            f"Requête: {query}\n"
            f"Mode détecté: {mode}\n"
            f"Totaux: {totals}\n"
            f"KPIs courriers entrants: {incoming_kpis}\n"
        )

        resp = openai_client.responses.create(
            model="gpt-4.1-mini",
            input=prompt,
            max_output_tokens=200,
        )
        txt = resp.output[0].content[0].text
        return txt
    except Exception as e:
        print("⚠️ Erreur appel OpenAI, fallback commentaire simple:", e)
        return build_rule_based_comment(mode, snapshot, query)

# -------------------------------------------------------------------
# 5. Construction de la config de dashboard selon le mode
# -------------------------------------------------------------------
def build_config_for_mode(mode: str, snapshot: dict, query: str, ai_comment: str) -> dict:
    totals = snapshot.get("totals", {})
    incoming_kpis = snapshot.get("incoming_kpis", {})

    # Widgets de base (vue d'ensemble)
    widgets = [
        {
            "id": "incoming-total",
            "type": "stats",
            "title": f"Courriers Entrants ({totals.get('incoming_total', 0)})",
            "currentValue": totals.get("incoming_total", 0),
            "color": "info",
            "size": {"sm": 6, "md": 4, "lg": 3, "xl": 3, "xxl": 3},
            # 🔗 Cible de navigation : Acquisition
            "navigationTarget": {
                "routeName": "Acquisition",           # à adapter si ton routeur a un autre nom
                "query": {"fromDashboard": "incoming_total"},
            },
        },
        {
            "id": "outgoing-total",
            "type": "stats",
            "title": f"Courriers Sortants ({totals.get('outgoing_total', 0)})",
            "currentValue": totals.get("outgoing_total", 0),
            "color": "warning",
            "size": {"sm": 6, "md": 4, "lg": 3, "xl": 3, "xxl": 3},
            # 🔗 Cible : module des courriers sortants (si tu en as un)
            "navigationTarget": {
                "routeName": "Traitement",            # ou "CourriersSortants", "Sortants"… à adapter
                "query": {"fromDashboard": "outgoing_total"},
            },
        },
        {
            "id": "archives-total",
            "type": "stats",
            "title": f"Archives ({totals.get('archives_total', 0)})",
            "currentValue": totals.get("archives_total", 0),
            "color": "success",
            "size": {"sm": 6, "md": 4, "lg": 3, "xl": 3, "xxl": 3},
            # 🔗 Cible : Archivage
            "navigationTarget": {
                "routeName": "Archivage",
                "query": {"fromDashboard": "archives_total"},
            },
        },
    ]

    title = "Dashboard Courrier IA"

    # --- Modes spécifiques ---
    if mode == "urgent_focus":
        title = "Focus Courriers Urgents"
        widgets.append({
            "id": "urgent-unprocessed",
            "type": "stats",
            "title": "Courriers urgents / non traités",
            "icon": "cil-warning",
            "color": "danger",
            "currentValue": incoming_kpis.get("unprocessed", 0),
            "size": {"sm": 6, "md": 4, "lg": 3, "xl": 3, "xxl": 3},
            "navigationTarget": {
                "routeName": "Indexation",           # module qui liste les courriers à traiter
                "query": {"fromDashboard": "urgent_unprocessed"},
            },
        })
        widgets.append({
            "id": "urgent-late",
            "type": "stats",
            "title": "Courriers en retard",
            "icon": "cil-clock",
            "color": "danger",
            "currentValue": incoming_kpis.get("late", 0),
            "size": {"sm": 6, "md": 4, "lg": 3, "xl": 3, "xxl": 3},
            "navigationTarget": {
                "routeName": "Indexation",
                "query": {"fromDashboard": "urgent_late"},
            },
        })

    elif mode == "late_mails":
        title = "Courriers en Retard"
        widgets.append({
            "id": "late-mails",
            "type": "stats",
            "title": "Courriers en retard",
            "icon": "cil-clock",
            "color": "danger",
            "currentValue": incoming_kpis.get("late", 0),
            "size": {"sm": 6, "md": 4, "lg": 3, "xl": 3, "xxl": 3},
            "navigationTarget": {
                "routeName": "Indexation",
                "query": {"fromDashboard": "late_mails"},
            },
        })

    elif mode == "unprocessed_mails":
        title = "Courriers Non Traités"
        widgets.append({
            "id": "unprocessed-mails",
            "type": "stats",
            "title": "Courriers non traités",
            "icon": "cil-task",
            "color": "warning",
            "currentValue": incoming_kpis.get("unprocessed", 0),
            "size": {"sm": 6, "md": 4, "lg": 3, "xl": 3, "xxl": 3},
            "navigationTarget": {
                "routeName": "Indexation",
                "query": {"fromDashboard": "unprocessed"},
            },
        })

    elif mode == "per_service":
        title = "Charge par Service"
        widgets.append({
            "id": "incoming-by-service",
            "type": "table",
            "title": "Répartition des courriers entrants par service",
            "columns": ["Service", "Nombre"],
            "rows": [
                [row.get("service") or "Non renseigné", row.get("count", 0)]
                for row in incoming_kpis.get("by_service", [])
            ],
            "size": {"sm": 12, "md": 8, "lg": 8, "xl": 8, "xxl": 8},
            # 🔗 Cible : on ouvre Indexation filtrable par service
            "navigationTarget": {
                "routeName": "Indexation",
                "query": {"fromDashboard": "per_service"},
            },
        })

    elif mode == "workflow_kpis":
        title = "Performance & KPIs du Workflow"
        widgets.append({
            "id": "incoming-by-status-chart",
            "type": "chart",
            "title": "Répartition des courriers entrants par statut",
            "dataSource": "incoming_by_status",
            "chartType": "bar",  # 👈 important : on évite "area" pour ne pas casser Chart.js
            "size": {"sm": 12, "md": 8, "lg": 8, "xl": 8, "xxl": 8},
            "navigationTarget": {
                "routeName": "Indexation",
                "query": {"fromDashboard": "workflow_kpis"},
            },
        })

    elif mode == "archives_focus":
        title = "Vue Archives"
        # les stats archives sont déjà dans les widgets de base

    # mode "default" : on garde uniquement la vue d'ensemble

    return {
        "title": title,
        "description": f"Configuration générée par l'agent IA pour la requête : « {query} »",
        "ai_comment": ai_comment,
        "widgets": widgets,
    }

# -------------------------------------------------------------------
# 6. Endpoint principal : /dashboard-ai
# -------------------------------------------------------------------
@app.route("/dashboard-ai", methods=["POST"])
def dashboard_ai():
    data = request.get_json(force=True) or {}
    query = data.get("query", "")

    print(f"[Flask] Reçu query depuis Node : {query}")

    # 1) Récupérer un snapshot de la base
    with get_connection() as conn:
        snapshot = {
            "totals": get_basic_counters(conn),
            "incoming_kpis": compute_incoming_kpis(conn),
        }

    # 2) Déterminer l'intention (mode)
    mode = classify_query(query)

    # 3) Générer le commentaire IA
    if openai_client is not None:
        ai_comment = build_ai_comment_with_openai(mode, snapshot, query)
    else:
        ai_comment = build_rule_based_comment(mode, snapshot, query)

    # 4) Construire la config du dashboard
    config = build_config_for_mode(mode, snapshot, query, ai_comment)

    # 5) Retourner au backend Node
    return jsonify({
        "config": config,
        "mode": mode,
        "snapshot": snapshot,  # utile si un jour tu veux afficher les détails dans Vue
        "source": "flask-agent",
        "query": query,
    })


if __name__ == "__main__":
    print("🚀 Flask IA Agent démarré sur http://127.0.0.1:5000")
    print("   DB_PATH =", DB_PATH)
    if openai_client is None:
        print("   ⚠️ OpenAI désactivé (pas de clé ou pas de SDK)")
    app.run(host="127.0.0.1", port=5000, debug=True)
