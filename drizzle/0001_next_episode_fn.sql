-- Prochain épisode à voir = premier épisode (saison > 0) situé APRÈS le
-- dernier épisode vu dans l'ordre saison/numéro. Si l'utilisateur a sauté des
-- épisodes, on ne le renvoie pas en arrière (comportement attendu par les users).
-- NULL = à jour.
-- Coût : 2 lectures d'index (PK watched_episodes + episodes_show_order_idx).
CREATE OR REPLACE FUNCTION next_episode_id(p_user int, p_show int)
RETURNS int
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT e.id
  FROM episodes e
  WHERE e.show_id = p_show
    AND e.season > 0
    AND (e.season, e.number) > COALESCE(
      (SELECT ROW(le.season, le.number)
         FROM watched_episodes w
         JOIN episodes le ON le.id = w.episode_id
        WHERE w.user_id = p_user AND w.show_id = p_show AND le.season > 0
        ORDER BY le.season DESC, le.number DESC
        LIMIT 1),
      ROW(0::smallint, 0::smallint))
  ORDER BY e.season, e.number
  LIMIT 1
$$;
--> statement-breakpoint
-- Nombre d'épisodes diffusés (saisons > 0) : alimente shows.aired_episodes.
CREATE OR REPLACE FUNCTION aired_episode_count(p_show int)
RETURNS smallint
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT count(*)::smallint FROM episodes
  WHERE show_id = p_show AND season > 0 AND air_date <= current_date
$$;
