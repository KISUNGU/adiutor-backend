async function getWorkflowKpi({ dbGet, dbAll }) {
  const byStatus = await dbAll(
    `SELECT statut_global as status, COUNT(*) as count FROM incoming_mails GROUP BY statut_global`,
  );

  const totalRow = await dbGet(`SELECT COUNT(*) as total FROM incoming_mails`);
  const total = totalRow ? totalRow.total : 0;

  const avgComplete = await dbGet(
    `
      SELECT AVG(julianday(treatment_completed_at) - julianday(treatment_started_at)) AS avg_days
      FROM incoming_mails
      WHERE treatment_started_at IS NOT NULL AND treatment_completed_at IS NOT NULL
    `,
  );

  const avgIndexToStart = await dbGet(
    `
      SELECT AVG(julianday(treatment_started_at) - julianday(date_indexation)) AS avg_days
      FROM incoming_mails
      WHERE treatment_started_at IS NOT NULL AND date_indexation IS NOT NULL
    `,
  );

  return {
    counts: {
      total: total || 0,
      byStatus: byStatus || [],
    },
    durations: {
      avg_index_to_start_days: avgIndexToStart && avgIndexToStart.avg_days ? parseFloat(parseFloat(avgIndexToStart.avg_days).toFixed(2)) : 0,
      avg_start_to_complete_days: avgComplete && avgComplete.avg_days ? parseFloat(parseFloat(avgComplete.avg_days).toFixed(2)) : 0,
    },
  };
}

async function getWorkflowPerformance({ dbGet, dbAll }) {
  const fullCycle = await dbGet(
    `
      SELECT AVG(julianday(date_archivage) - julianday(date_reception)) AS avg_days
      FROM incoming_mails
      WHERE date_reception IS NOT NULL AND date_archivage IS NOT NULL
    `,
  );

  const byStage = await dbAll(
    `
      SELECT statut_global as stage, COUNT(*) as count
      FROM incoming_mails
      GROUP BY statut_global
      ORDER BY count DESC
    `,
  );

  const returns = await dbGet(
    `
      SELECT 
        COUNT(*) as total_courriers,
        SUM(CASE WHEN return_comment IS NOT NULL THEN 1 ELSE 0 END) as returned_count
      FROM incoming_mails
    `,
  );

  const byService = await dbAll(
    `
      SELECT assigned_service as service, COUNT(*) as count
      FROM incoming_mails
      WHERE assigned_service IS NOT NULL
      GROUP BY assigned_service
      ORDER BY count DESC
    `,
  );

  const acqToIndex = await dbGet(
    `
      SELECT AVG(julianday(date_indexation) - julianday(date_reception)) AS avg_days
      FROM incoming_mails
      WHERE date_reception IS NOT NULL AND date_indexation IS NOT NULL
    `,
  );

  const treatment = await dbGet(
    `
      SELECT AVG(julianday(treatment_completed_at) - julianday(treatment_started_at)) AS avg_days
      FROM incoming_mails
      WHERE treatment_started_at IS NOT NULL AND treatment_completed_at IS NOT NULL
    `,
  );

  const archiving = await dbGet(
    `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN statut_global = 'Archivé' OR date_archivage IS NOT NULL THEN 1 ELSE 0 END) as archived
      FROM incoming_mails
    `,
  );

  const totalCourriers = returns ? returns.total_courriers : 0;
  const returnedCount = returns ? returns.returned_count : 0;
  const total = archiving ? archiving.total : 0;
  const archived = archiving ? archiving.archived : 0;

  return {
    durations: {
      avg_full_cycle_days: fullCycle && fullCycle.avg_days ? parseFloat(parseFloat(fullCycle.avg_days).toFixed(2)) : 0,
      avg_acquisition_to_indexation_days: acqToIndex && acqToIndex.avg_days ? parseFloat(parseFloat(acqToIndex.avg_days).toFixed(2)) : 0,
      avg_treatment_days: treatment && treatment.avg_days ? parseFloat(parseFloat(treatment.avg_days).toFixed(2)) : 0,
    },
    counts: {
      total_courriers: total || 0,
      archived_courriers: archived || 0,
      returned_count: returnedCount || 0,
      courriers_by_stage: byStage || [],
      courriers_by_service: byService || [],
    },
    rates: {
      archive_rate: total > 0 ? parseFloat(((archived / total) * 100).toFixed(2)) : 0,
      return_rate: totalCourriers > 0 ? parseFloat(((returnedCount / totalCourriers) * 100).toFixed(2)) : 0,
    },
  };
}

module.exports = {
  getWorkflowKpi,
  getWorkflowPerformance,
};
