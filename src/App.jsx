import { useState, useEffect, useMemo } from 'react'
import Papa from 'papaparse'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, Legend
} from 'recharts'

// ─── Constants ───────────────────────────────────────────────────────────────

const PLAYER_COLORS = {
  Shane:    'var(--shane)',
  Nick:     'var(--nick)',
  Chavez:   'var(--chavez)',
  Isaac:    'var(--isaac)',
  Mark:     'var(--mark)',
  Franklin: 'var(--franklin)',
  'Jon Paul': 'var(--jonpaul)',
}

const PLAYER_HEX = {
  Shane:    '#f59e0b',
  Nick:     '#06b6d4',
  Chavez:   '#10b981',
  Isaac:    '#8b5cf6',
  Mark:     '#ef4444',
  Franklin: '#ec4899',
  'Jon Paul': '#f97316',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const winRate = (wins, games) =>
  games === 0 ? 0 : Math.round((wins / games) * 100)

const parseCSV = (raw) => {
  const { data } = Papa.parse(raw, { header: true, skipEmptyLines: true })
  // Deduplicate by DeckID, keep last occurrence
  const seen = new Map()
  data.forEach(row => seen.set(row.DeckID, row))
  return [...seen.values()].map(row => ({
    id:        row.DeckID?.trim(),
    commander: row.Commander?.trim(),
    player:    row.PlayerName?.trim(),
    games:     parseInt(row['Total Games']) || 0,
    wins:      parseInt(row.Wins) || 0,
    losses:    parseInt(row.Losses) || 0,
  }))
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, delay = 0 }) {
  return (
    <div className="fade-up" style={{
      animationDelay: `${delay}ms`,
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      padding: '1.2rem 1.4rem',
    }}>
      <div style={{ fontSize: '0.65rem', letterSpacing: '0.14em', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.5rem', fontFamily: 'Cinzel, serif' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.7rem', fontWeight: '700', color: color || 'var(--gold)', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginTop: '0.35rem' }}>{sub}</div>}
    </div>
  )
}

function PlayerPill({ player, active, onClick }) {
  const color = PLAYER_HEX[player] || '#c9a84c'
  return (
    <button onClick={onClick} style={{
      padding: '0.35rem 1rem',
      borderRadius: '20px',
      border: `1px solid ${active ? color : 'var(--border2)'}`,
      background: active ? color + '22' : 'transparent',
      color: active ? color : 'var(--text-dim)',
      fontSize: '0.82rem',
      transition: 'all 0.15s',
      fontFamily: 'Cinzel, serif',
      letterSpacing: '0.04em',
    }}>
      {player}
    </button>
  )
}

function SortButton({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '0.3rem 0.75rem',
      borderRadius: '4px',
      border: `1px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
      background: active ? 'var(--gold-dim)' : 'transparent',
      color: active ? 'var(--gold)' : 'var(--text-dim)',
      fontSize: '0.75rem',
      transition: 'all 0.15s',
    }}>
      {label}
    </button>
  )
}

function WinBar({ wins, games }) {
  const wr = winRate(wins, games)
  if (games === 0) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  const color = wr > 50 ? '#10b981' : wr > 0 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', justifyContent: 'center' }}>
      <div style={{ width: '56px', height: '4px', background: 'var(--border2)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${wr}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 0.3s ease' }} />
      </div>
      <span style={{ fontSize: '0.85rem', color, minWidth: '32px' }}>{wr}%</span>
    </div>
  )
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--surface2)',
      border: '1px solid var(--border2)',
      borderRadius: '6px',
      padding: '0.75rem 1rem',
      fontSize: '0.85rem',
      color: 'var(--text)',
    }}>
      <div style={{ fontFamily: 'Cinzel, serif', marginBottom: '0.4rem', color: 'var(--gold)' }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color, marginTop: '0.2rem' }}>
          {p.name === 'games' ? 'Games' : 'Wins'}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [decks, setDecks]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [activePlayer, setActive]   = useState('All')
  const [deckSort, setSort]         = useState('games')
  const [showUnplayed, setUnplayed] = useState(false)

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'games.csv')
      .then(r => r.text())
      .then(raw => { setDecks(parseCSV(raw)); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const players = useMemo(() => ['All', ...Object.keys(PLAYER_HEX)], [])

  const playerStats = useMemo(() =>
    Object.keys(PLAYER_HEX).map(player => {
      const pd = decks.filter(d => d.player === player)
      const games = pd.reduce((s, d) => s + d.games, 0)
      const wins  = pd.reduce((s, d) => s + d.wins, 0)
      return { player, decks: pd.length, games, wins, winRate: winRate(wins, games) }
    }), [decks])

  const filteredDecks = useMemo(() => {
    let d = activePlayer === 'All' ? decks : decks.filter(d => d.player === activePlayer)
    if (!showUnplayed) d = d.filter(d => d.games > 0)
    return [...d].sort((a, b) => {
      if (deckSort === 'games')   return b.games - a.games
      if (deckSort === 'wins')    return b.wins  - a.wins
      if (deckSort === 'winrate') return winRate(b.wins, b.games) - winRate(a.wins, a.games)
      return 0
    })
  }, [decks, activePlayer, showUnplayed, deckSort])

  const totalGames   = decks.reduce((s, d) => s + d.games, 0)
  const dustCount    = decks.filter(d => d.games === 0).length
  const topWinner    = [...playerStats].sort((a, b) => b.wins  - a.wins)[0]
  const mostActive   = [...playerStats].sort((a, b) => b.games - a.games)[0]

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-dim)', fontFamily: 'Cinzel, serif', letterSpacing: '0.1em' }}>
      Loading the chronicle...
    </div>
  )

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2.5rem 1.5rem' }}>

      {/* Header */}
      <div className="fade-up" style={{ marginBottom: '2.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem' }}>
        <h1 style={{
          fontFamily: 'Cinzel, serif',
          fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
          fontWeight: '700',
          background: 'linear-gradient(135deg, #c9a84c, #e8d5a3 60%, #a07830)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '0.04em',
          lineHeight: 1.1,
          marginBottom: '0.4rem',
        }}>
          EDH War Table
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '1rem', fontStyle: 'italic' }}>
          {totalGames} games logged across {decks.length} decks
        </p>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard label="Total Decks"   value={decks.length}       sub="in the arsenal"           delay={0}   />
        <StatCard label="Dust Collectors" value={dustCount}         sub="never played"             delay={60}  />
        <StatCard label="Top Winner"    value={topWinner?.player}   sub={`${topWinner?.wins} wins`}  delay={120} color={PLAYER_HEX[topWinner?.player]} />
        <StatCard label="Most Active"   value={mostActive?.player}  sub={`${mostActive?.games} games`} delay={180} color={PLAYER_HEX[mostActive?.player]} />
      </div>

      {/* Chart */}
      <div className="fade-up" style={{
        animationDelay: '200ms',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '1.4rem',
        marginBottom: '2rem',
      }}>
        <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '1.2rem' }}>
          Player Breakdown
        </h2>
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={playerStats} barGap={3} barSize={18}>
            <XAxis dataKey="player" tick={{ fill: 'var(--text-dim)', fontSize: 12, fontFamily: 'Cinzel, serif' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#444', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
            <Bar dataKey="games" name="games" radius={[3, 3, 0, 0]}>
              {playerStats.map(p => <Cell key={p.player} fill={PLAYER_HEX[p.player] + '35'} stroke={PLAYER_HEX[p.player]} strokeWidth={1} />)}
            </Bar>
            <Bar dataKey="wins" name="wins" radius={[3, 3, 0, 0]}>
              {playerStats.map(p => <Cell key={p.player} fill={PLAYER_HEX[p.player]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {players.map(p => (
          <PlayerPill key={p} player={p} active={activePlayer === p} onClick={() => setActive(p)} />
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>SORT</span>
          <SortButton label="Games"   active={deckSort === 'games'}   onClick={() => setSort('games')}   />
          <SortButton label="Wins"    active={deckSort === 'wins'}    onClick={() => setSort('wins')}    />
          <SortButton label="Win %"   active={deckSort === 'winrate'} onClick={() => setSort('winrate')} />
          <SortButton
            label={showUnplayed ? 'Hide Unplayed' : '+ Unplayed'}
            active={showUnplayed}
            onClick={() => setUnplayed(v => !v)}
          />
        </div>
      </div>

      {/* Deck Table */}
      <div className="fade-up" style={{
        animationDelay: '300ms',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border2)' }}>
              {['Commander', 'Player', 'Games', 'Wins', 'Losses', 'Win %'].map(h => (
                <th key={h} style={{
                  padding: '0.85rem 1.2rem',
                  textAlign: h === 'Commander' || h === 'Player' ? 'left' : 'center',
                  fontSize: '0.65rem',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  fontFamily: 'Cinzel, serif',
                  fontWeight: '600',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredDecks.map((deck, i) => {
              const color = PLAYER_HEX[deck.player] || '#888'
              return (
                <tr key={deck.id} style={{
                  borderBottom: '1px solid var(--border)',
                  background: i % 2 === 0 ? 'transparent' : 'var(--surface2)',
                }}>
                  <td style={{ padding: '0.9rem 1.2rem', fontSize: '0.95rem', color: 'var(--text)' }}>
                    {deck.commander}
                  </td>
                  <td style={{ padding: '0.9rem 1.2rem' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      padding: '0.2rem 0.65rem',
                      borderRadius: '12px',
                      background: color + '22',
                      color,
                      border: `1px solid ${color}44`,
                      fontFamily: 'Cinzel, serif',
                      letterSpacing: '0.04em',
                      whiteSpace: 'nowrap',
                    }}>{deck.player}</span>
                  </td>
                  {[deck.games, deck.wins, deck.losses].map((v, j) => (
                    <td key={j} style={{ padding: '0.9rem 1.2rem', textAlign: 'center', fontSize: '0.95rem', color: v === 0 ? 'var(--text-muted)' : 'var(--text-dim)' }}>
                      {v}
                    </td>
                  ))}
                  <td style={{ padding: '0.9rem 1.2rem', textAlign: 'center' }}>
                    <WinBar wins={deck.wins} games={deck.games} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {filteredDecks.length === 0 && (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No decks match the current filters
          </div>
        )}
      </div>

      <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
        Showing {filteredDecks.length} of {decks.length} decks
      </div>
    </div>
  )
}
