-- Recalcule les compteurs films d'un utilisateur à partir de ses lignes.
-- Utilisé après un import en masse (plus simple et plus sûr que des deltas
-- sur des milliers de lignes). Coût borné par l'user (PK user_movies).
CREATE OR REPLACE FUNCTION recompute_movie_counters(p_user int)
RETURNS void
LANGUAGE sql AS $$
  UPDATE users u SET
    movies_watched = c.n,
    movie_minutes = c.m
  FROM (
    SELECT count(*)::int AS n, coalesce(sum(um.plays * coalesce(m.runtime, 0)), 0)::int AS m
    FROM user_movies um JOIN movies m ON m.id = um.movie_id
    WHERE um.user_id = p_user AND um.status = 1
  ) c
  WHERE u.id = p_user
$$;
