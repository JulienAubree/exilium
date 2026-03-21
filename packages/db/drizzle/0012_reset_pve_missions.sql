-- Reset all PvE missions for the discovery rework
DELETE FROM pve_missions WHERE status IN ('available', 'in_progress');
