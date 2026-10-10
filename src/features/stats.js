const DAY_MS = 86400000;

export function dayIndex(ts) {
  const d = new Date(ts);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
}

export function computeStreaks(timestamps, now = Date.now()) {
  const days = [...new Set(timestamps.map(dayIndex))].sort((a, b) => a - b);
  if (!days.length) return { current: 0, longest: 0 };
  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = days[i] === days[i - 1] + 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }
  const today = dayIndex(now);
  const last = days[days.length - 1];
  let current = 0;
  if (last === today || last === today - 1) {
    current = 1;
    for (let i = days.length - 1; i > 0 && days[i - 1] === days[i] - 1; i--) current++;
  }
  return { current, longest };
}

export function diaryStats(timestamps, now = Date.now()) {
  const { current, longest } = computeStreaks(timestamps, now);
  const today = dayIndex(now);
  const n = new Date(now);
  const month = timestamps.filter((t) => {
    const d = new Date(t);
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
  }).length;
  const last7Days = timestamps.filter((t) => {
    const di = dayIndex(t);
    return di <= today && di > today - 7;
  }).length;
  return { total: timestamps.length, currentStreak: current, longestStreak: longest, last7Days, thisMonth: month };
}
