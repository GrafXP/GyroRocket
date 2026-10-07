// Three stars from one finished run: finish, par, every crystal. Old progress
// records used `best` for the time; new ones keep the star-winning run separately.
export function starsOf(level, record) {
  const run = record?.run ?? record;
  return [!!run, !!run && (run.time ?? run.best) <= level.par, !!run?.crystals];
}

export const starCount = (level, record) => starsOf(level, record).filter(Boolean).length;

// Most stars wins; with the same number of stars, keep the faster run.
export function beatsStarRun(level, run, old) {
  if (!old) return true;
  const stars = starCount(level, run);
  const previous = starCount(level, old);
  return stars > previous || (stars === previous && run.time < old.time);
}
