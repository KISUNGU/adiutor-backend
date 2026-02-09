/**
 * jobs/schedulers.js
 * Tâches planifiées et automatisées
 * 
 * ✅ Tous les setInterval/setTimeout consolidés ici
 * ✅ Protection contre double exécution
 * ✅ Compatible Docker (un seul backend)
 * ✅ Aucune tâche dans server.js ou routes
 */

const moment = require('moment');

// Protection contre double démarrage
let schedulersStarted = false;

/**
 * Détecte les tentatives de brute-force sur login
 */
function detectBruteforce(db, createAlertIfNotExists) {
  db.all(
    `SELECT ip, COUNT(*) as fails
     FROM audit_logs
     WHERE action = 'LOGIN_FAILED'
       AND created_at >= datetime('now','-10 minutes')
     GROUP BY ip
     HAVING fails >= 5`,
    [],
    (err, rows) => {
      if (err) return console.error('❌ detectBruteforce error:', err.message);
      
      if (!rows || rows.length === 0) return;
      
      rows.forEach(r => {
        createAlertIfNotExists({
          type: 'BRUTE_FORCE_LOGIN',
          title: 'Tentatives de connexion suspectes',
          message: `Détection brute-force: ${r.fails} échecs de connexion en 10 min depuis IP ${r.ip}`,
          severity: 'high',
          meta: { ip: r.ip, fails: r.fails }
        });
      });
    }
  );
}

/**
 * Vérifie les courriers en retard et notifie
 */
function checkOverdueMails(db, createNotification) {
  const today = moment().format('YYYY-MM-DD');

  const queryWithStatutGlobal = `
    SELECT id, subject, sender, response_due, assigned_to, statut_global as sg 
    FROM incoming_mails 
    WHERE response_due IS NOT NULL 
      AND response_due < ? 
      AND statut_global NOT IN ('Archivé','Rejeté')
  `;
  
  const queryWithStatus = `
    SELECT id, subject, sender, response_due, assigned_to, status as sg 
    FROM incoming_mails 
    WHERE response_due IS NOT NULL 
      AND response_due < ? 
      AND status NOT IN ('Archivé','Rejeté')
  `;

  const processRows = (overdueMails) => {
    if (!overdueMails || overdueMails.length === 0) return;
    
    console.log(`⚠️ ${overdueMails.length} courrier(s) en retard détecté(s)`);
    
    overdueMails.forEach(mail => {
      const daysOverdue = moment().diff(moment(mail.response_due), 'days');
      
      // Notifier l'utilisateur assigné
      if (mail.assigned_to) {
        db.get('SELECT id FROM users WHERE username = ?', [mail.assigned_to], (userErr, user) => {
          if (!userErr && user) {
            createNotification(
              user.id,
              'alerte_retard',
              '⚠️ Courrier en retard',
              `Le courrier "${mail.subject}" de ${mail.sender} est en retard de ${daysOverdue} jour(s). Date limite: ${moment(mail.response_due).format('DD/MM/YYYY')}`,
              mail.id
            ).catch(err => console.error('❌ Erreur création alerte:', err));
          }
        });
      }
      
      // Notifier les admins (role_id = 1)
      db.all('SELECT id FROM users WHERE role_id = ?', [1], (adminErr, admins) => {
        if (!adminErr && admins) {
          admins.forEach(admin => {
            createNotification(
              admin.id,
              'alerte_retard',
              '⚠️ Courrier en retard',
              `Le courrier "${mail.subject}" assigné à ${mail.assigned_to || 'Non assigné'} est en retard de ${daysOverdue} jour(s).`,
              mail.id
            ).catch(err => console.error('❌ Erreur création alerte admin:', err));
          });
        }
      });
    });
  };

  db.all(queryWithStatutGlobal, [today], (err, rows) => {
    if (err) {
      if (/no such column: statut_global/i.test(err.message)) {
        // Fallback si colonne nommée 'status'
        db.all(queryWithStatus, [today], (err2, rows2) => {
          if (err2) {
            console.error('❌ Erreur vérification courriers en retard (fallback):', err2.message);
            return;
          }
          processRows(rows2);
        });
      } else {
        console.error('❌ Erreur vérification courriers en retard:', err.message);
      }
      return;
    }
    processRows(rows);
  });
}

/**
 * Détecte les délais de workflow anormaux
 */
async function detectWorkflowDelays(dbGet, dbAll, upsertAlertByType, resolveAlertsByType) {
  try {
    const cols = await dbAll(`PRAGMA table_info(incoming_mails)`, []).catch(() => []);
    const names = new Set((cols || []).map(c => c.name));
    
    const statusExpr = names.has('statut_global') ? 'statut_global'
      : names.has('status') ? 'status'
      : null;
    
    const dateField = names.has('date_reception') ? 'date_reception'
      : names.has('arrival_date') ? 'arrival_date'
      : names.has('mail_date') ? 'mail_date'
      : names.has('created_at') ? 'created_at'
      : null;

    if (!statusExpr || !dateField) return;

    const stuck = await dbGet(
      `SELECT COUNT(*) as c
       FROM incoming_mails
       WHERE lower(${statusExpr}) NOT IN ('archivé')
         AND datetime(${dateField}) < datetime('now', '-10 day')`,
      []
    ).catch(() => null);

    const count = Number(stuck?.c || 0);
    const type = 'WORKFLOW_DELAYS';

    if (count === 0) {
      await resolveAlertsByType(type);
      return;
    }

    await upsertAlertByType({
      type,
      title: 'Courriers bloqués > 10 jours',
      message: `${count} courrier(s) non archivé(s) depuis plus de 10 jours.`,
      severity: count >= 20 ? 'high' : 'medium',
      meta: { count_stuck: count, threshold_days: 10 },
    });
  } catch (e) {
    console.error('❌ detectWorkflowDelays error:', e?.message || e);
  }
}

/**
 * Détecte les pics de rejets
 */
async function detectRejectionSpike(dbGet, upsertAlertByType, resolveAlertsByType) {
  try {
    const cols = await dbGet(`PRAGMA table_info(incoming_mails)`, []).catch(() => []);
    const names = new Set((cols || []).map(c => c.name));
    
    const statusExpr = names.has('statut_global') ? 'statut_global'
      : names.has('status') ? 'status'
      : null;
    
    const dateField = names.has('date_reception') ? 'date_reception'
      : names.has('arrival_date') ? 'arrival_date'
      : names.has('mail_date') ? 'mail_date'
      : names.has('created_at') ? 'created_at'
      : null;

    if (!statusExpr || !dateField) return;

    const last24h = await dbGet(
      `SELECT COUNT(*) as c
       FROM incoming_mails
       WHERE lower(${statusExpr}) = lower('Rejeté')
         AND datetime(${dateField}) >= datetime('now', '-1 day')`,
      []
    ).catch(() => null);

    const count = Number(last24h?.c || 0);
    const type = 'REJECTION_SPIKE';

    if (count < 5) {
      await resolveAlertsByType(type);
      return;
    }

    await upsertAlertByType({
      type,
      title: 'Pic de rejets (24h)',
      message: `${count} courriers rejetés sur les dernières 24h.`,
      severity: count >= 10 ? 'high' : 'medium',
      meta: { count_rejected: count },
    });
  } catch (e) {
    console.error('❌ detectRejectionSpike error:', e?.message || e);
  }
}

/**
 * Détecte les courriers urgents en attente
 */
async function detectUrgentBacklog(dbGet, dbAll, upsertAlertByType, resolveAlertsByType) {
  try {
    const cols = await dbAll(`PRAGMA table_info(incoming_mails)`, []).catch(() => []);
    const names = new Set((cols || []).map(c => c.name));
    
    const statusExpr = names.has('statut_global') ? 'statut_global'
      : names.has('status') ? 'status'
      : null;
    
    const priorityExpr = names.has('ai_priority') ? 'ai_priority'
      : names.has('priority') ? 'priority'
      : null;

    if (!statusExpr || !priorityExpr) return;

    const urgent = await dbGet(
      `SELECT COUNT(*) as c
       FROM incoming_mails
       WHERE lower(${priorityExpr}) = 'high'
         AND lower(${statusExpr}) NOT IN ('archivé','rejeté')`,
      []
    ).catch(() => null);

    const count = Number(urgent?.c || 0);
    const type = 'URGENT_BACKLOG';

    if (count < 3) {
      await resolveAlertsByType(type);
      return;
    }

    await upsertAlertByType({
      type,
      title: 'Arriéré urgents',
      message: `${count} courrier(s) prioritaires non archivés.`,
      severity: count >= 10 ? 'high' : 'medium',
      meta: { count_urgent: count },
    });
  } catch (e) {
    console.error('❌ detectUrgentBacklog error:', e?.message || e);
  }
}

/**
 * Détecte les réponses en retard
 */
async function detectResponseDueOverdue(dbGet, dbAll, upsertAlertByType, resolveAlertsByType) {
  try {
    const cols = await dbAll(`PRAGMA table_info(incoming_mails)`, []).catch(() => []);
    const names = new Set((cols || []).map(c => c.name));
    
    const statusExpr = names.has('statut_global') ? 'statut_global'
      : names.has('status') ? 'status'
      : null;

    if (!statusExpr || !names.has('response_due')) return;

    const overdue = await dbGet(
      `SELECT COUNT(*) as c
       FROM incoming_mails
       WHERE response_due IS NOT NULL
         AND DATE(response_due) < DATE('now')
         AND lower(${statusExpr}) NOT IN ('archivé','rejeté')`,
      []
    ).catch(() => null);

    const count = Number(overdue?.c || 0);
    const type = 'RESPONSE_OVERDUE';

    if (count === 0) {
      await resolveAlertsByType(type);
      return;
    }

    await upsertAlertByType({
      type,
      title: 'Réponses en retard',
      message: `${count} courrier(s) avec date limite de réponse dépassée.`,
      severity: count >= 5 ? 'high' : 'medium',
      meta: { count_overdue: count },
    });
  } catch (e) {
    console.error('❌ detectResponseDueOverdue error:', e?.message || e);
  }
}

/**
 * Détecte les pics d'acquisitions
 */
async function detectAcquisitionSpike(dbGet, dbAll, upsertAlertByType, resolveAlertsByType) {
  try {
    const cols = await dbAll(`PRAGMA table_info(incoming_mails)`, []).catch(() => []);
    const names = new Set((cols || []).map(c => c.name));
    
    const statusExpr = names.has('statut_global') ? 'statut_global'
      : names.has('status') ? 'status'
      : null;
    
    const dateField = names.has('date_reception') ? 'date_reception'
      : names.has('arrival_date') ? 'arrival_date'
      : names.has('mail_date') ? 'mail_date'
      : names.has('created_at') ? 'created_at'
      : null;

    if (!statusExpr || !dateField) return;

    const last24h = await dbGet(
      `SELECT COUNT(*) as c
       FROM incoming_mails
       WHERE lower(${statusExpr}) = lower('acquis')
         AND datetime(${dateField}) >= datetime('now', '-1 day')`,
      []
    ).catch(() => null);

    const prev7d = await dbGet(
      `SELECT COUNT(*) as c
       FROM incoming_mails
       WHERE lower(${statusExpr}) = lower('acquis')
         AND datetime(${dateField}) >= datetime('now', '-8 day')
         AND datetime(${dateField}) < datetime('now', '-1 day')`,
      []
    ).catch(() => null);

    const c24 = Number(last24h?.c || 0);
    const c7 = Number(prev7d?.c || 0);
    const avg = c7 / 7;
    const type = 'ACQUISITION_SPIKE';
    
    // Garde-fou pour éviter bruit sur petits volumes
    const isSpike = c24 >= 20 && avg > 0 && (c24 / avg) >= 2;

    if (!isSpike) {
      await resolveAlertsByType(type);
      return;
    }

    await upsertAlertByType({
      type,
      title: 'Pic d\'acquisitions (24h)',
      message: `${c24} courriers "Acquis" sur 24h (≈ ${avg.toFixed(1)}/jour sur les 7 jours précédents).`,
      severity: (c24 / avg) >= 3 ? 'high' : 'medium',
      meta: { last_24h: c24, prev_7d_total: c7, prev_7d_avg_per_day: avg },
    });
  } catch (e) {
    console.error('❌ detectAcquisitionSpike error:', e?.message || e);
  }
}

/**
 * Démarre le scheduler des alertes intelligentes
 * Toutes les 5 minutes
 */
function startSmartAlertsScheduler(dbGet, dbAll, upsertAlertByType, resolveAlertsByType) {
  const run = async () => {
    await detectWorkflowDelays(dbGet, dbAll, upsertAlertByType, resolveAlertsByType);
    await detectRejectionSpike(dbGet, upsertAlertByType, resolveAlertsByType);
    await detectUrgentBacklog(dbGet, dbAll, upsertAlertByType, resolveAlertsByType);
    await detectResponseDueOverdue(dbGet, dbAll, upsertAlertByType, resolveAlertsByType);
    await detectAcquisitionSpike(dbGet, dbAll, upsertAlertByType, resolveAlertsByType);
  };
  
  run(); // Exécution immédiate
  setInterval(run, 5 * 60 * 1000); // Puis toutes les 5 minutes
  
  console.log('✅ Smart Alerts Scheduler démarré (toutes les 5 min)');
}

/**
 * Purge les refresh tokens expirés/révoqués
 * Toutes les 6 heures
 */
function startRefreshTokenCleanup(cleanupExpiredRefreshTokens, logger) {
  const run = () => {
    cleanupExpiredRefreshTokens().catch((err) => {
      logger.error('❌ Refresh token cleanup failed', { error: err.message });
    });
  };
  
  setInterval(run, 6 * 60 * 60 * 1000); // Toutes les 6 heures
  
  console.log('✅ Refresh Token Cleanup démarré (toutes les 6h)');
}

/**
 * Point d'entrée unique : démarre TOUS les schedulers
 * À appeler UNE SEULE FOIS au démarrage
 * 
 * @param {object} db - Instance SQLite
 * @param {object} helpers - Fonctions utilitaires (createNotification, createAlertIfNotExists, etc.)
 */
function startAllSchedulers(db, helpers) {
  // Protection contre double démarrage
  if (schedulersStarted) {
    console.warn('⚠️ Schedulers déjà démarrés, ignoring');
    return;
  }
  
  schedulersStarted = true;
  console.log('🚀 Démarrage des tâches planifiées...');

  try {
    const {
      createNotification,
      createAlertIfNotExists,
      dbGet,
      dbAll,
      upsertAlertByType,
      resolveAlertsByType,
      cleanupExpiredRefreshTokens,
      logger
    } = helpers;

    // 1. Détection brute-force (toutes les minutes)
    setInterval(() => detectBruteforce(db, createAlertIfNotExists), 60 * 1000);
    detectBruteforce(db, createAlertIfNotExists); // Immédiat
    console.log('✅ Brute Force Detector démarré (toutes les 1 min)');

    // 2. Vérification courriers en retard (toutes les heures)
    setInterval(() => checkOverdueMails(db, createNotification), 60 * 60 * 1000);
    setTimeout(() => checkOverdueMails(db, createNotification), 5000); // Après 5 secondes
    console.log('✅ Overdue Mails Checker démarré (toutes les 1h)');

    // 3. Alertes intelligentes (toutes les 5 minutes)
    startSmartAlertsScheduler(dbGet, dbAll, upsertAlertByType, resolveAlertsByType);

    // 4. Purge refresh tokens (toutes les 6 heures)
    startRefreshTokenCleanup(cleanupExpiredRefreshTokens, logger);

    console.log('✅ Tous les schedulers démarrés avec succès');
  } catch (e) {
    console.error('❌ Erreur démarrage schedulers:', e?.message || e);
  }
}

module.exports = {
  startAllSchedulers,
  detectBruteforce,
  checkOverdueMails,
  startSmartAlertsScheduler
};
