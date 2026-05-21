const TEAM_AVATAR_COLORS = ['#0f4c81', '#1a73e8', '#0d9488', '#7c3aed', '#dc2626', '#d97706'];

export function getInitials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

export function getAvatarColor(seed = '') {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TEAM_AVATAR_COLORS[Math.abs(hash) % TEAM_AVATAR_COLORS.length];
}

export function buildDeterministicFallbackId(prefix = 'id', source = '') {
  const base = String(source || 'unknown').toLowerCase();
  const safe = base.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${prefix}-${safe || 'unknown'}`;
}

export { TEAM_AVATAR_COLORS };
