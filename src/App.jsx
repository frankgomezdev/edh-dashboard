import { useState, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from 'recharts'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const winRate = (wins, games) =>
  games === 0 ? 0 : Math.round((wins / games) * 100)

// Convert an Excel date serial number to a JS Date.
// Excel's epoch is Jan 1 1900; Unix epoch is Jan 1 1970 (25569 days later).
const excelDateToJS = (serial) =>
  serial ? new Date(Math.round((serial - 25569) * 86400 * 1000)) : null

const parseXLSX = (buffer) => {
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' })

  const sheet = (name) => XLSX.utils.sheet_to_json(wb.Sheets[name] ?? {})

  // ── Players sheet → ordered player list ──────────────────────────────────
  const players = sheet('Players')
    .map(r => r.PlayerName?.trim())
    .filter(Boolean)

  // ── Game Players sheet → per-deck aggregates (source of truth) ───────────
  // Each row is one player's result in one game session.
  const deckStats = {}
  sheet('Game Players').forEach(({ DeckID, WinFlag }) => {
    if (!DeckID) return
    if (!deckStats[DeckID]) deckStats[DeckID] = { games: 0, wins: 0, losses: 0 }
    deckStats[DeckID].games++
    deckStats[DeckID].wins   += WinFlag === 1 ? 1 : 0
    deckStats[DeckID].losses += WinFlag === 0 ? 1 : 0
  })

  // ── Decks sheet → metadata joined with computed stats ────────────────────
  const decks = sheet('Decks').map(row => ({
    id:          String(row.DeckID ?? '').trim(),
    commander:   row.Commander?.trim()  ?? '—',
    player:      row.PlayerName?.trim() ?? '—',
    themes:      row.Theme
                   ? row.Theme.split(',').map(t => t.trim()).filter(Boolean)
                   : [],
    power:       row.EstPower           ?? null,
    // Add an ArchidektID column to the Decks sheet to enable deck links.
    archidektId: row.ArchidektID != null ? String(row.ArchidektID).trim() : null,
    ...(deckStats[row.DeckID] ?? { games: 0, wins: 0, losses: 0 }),
  }))

  // ── Games sheet → session metadata ───────────────────────────────────────
  // Each row is one pod session (multiple players/decks per session).
  const sessions = sheet('Games').map(row => ({
    id:       row.GameID,
    date:     excelDateToJS(row.Date),
    location: row.Location?.trim() || null,
    players:  row.TotalPlayers ?? 0,
    notes:    row.Notes?.trim() || null,
  }))

  return { decks, players, sessions }
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

// Animates a number from 0 → target with eased motion, starting after `delay` ms.
// Returns the target unchanged if it is not a number.
function useCountUp(target, delay = 0) {
  const isNum = typeof target === 'number'
  const [value, setValue] = useState(isNum ? 0 : target)

  useEffect(() => {
    setValue(isNum ? 0 : (target ?? '—'))

    if (!isNum) return

    const timeout = setTimeout(() => {
      const duration = 900
      const start = performance.now()

      const tick = (now) => {
        const progress = Math.min((now - start) / duration, 1)
        const eased    = 1 - Math.pow(1 - progress, 4) // ease-out quart
        setValue(Math.round(eased * target))
        if (progress < 1) requestAnimationFrame(tick)
      }

      requestAnimationFrame(tick)
    }, delay)

    return () => clearTimeout(timeout)
  }, [target, delay, isNum])

  return value
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, suffix = '', delay = 0 }) {
  // Animate numeric values; strings (player names) just display immediately.
  const animated = useCountUp(value, delay + 80)

  return (
    <div className="stat-card fade-up" style={{ animationDelay: `${delay}ms` }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{animated}{suffix}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

function PlayerPill({ player, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`player-pill${active ? ' active' : ''}`}
    >
      {player}
    </button>
  )
}

function SortButton({ label, active, onClick }) {
  return (
    <button onClick={onClick} className={`sort-btn${active ? ' active' : ''}`}>
      {label}
    </button>
  )
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="toggle-wrap">
      <button
        role="switch"
        aria-checked={checked}
        className={`toggle-track${checked ? ' on' : ''}`}
        onClick={onChange}
      >
        <span className="toggle-thumb" />
      </button>
      <span className="toggle-label">{label}</span>
    </label>
  )
}

function WinBar({ wins, games }) {
  const wr = winRate(wins, games)
  if (games === 0) return <span className="win-dash">—</span>
  return (
    <div className="winbar">
      <div className="winbar-track">
        <div className="winbar-fill" style={{ width: `${wr}%` }} />
      </div>
      <span className="winbar-pct">{wr}%</span>
    </div>
  )
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <div className="tooltip-player">{label}</div>
      {payload.map(p => (
        <div key={p.name} className="tooltip-row">
          <span>{p.name === 'games' ? 'Games' : 'Wins'}</span>
          <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [decks, setDecks]           = useState([])
  const [players, setPlayers]       = useState([])
  const [sessions, setSessions]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [activePlayer, setActive]   = useState('All')
  const [deckSort, setSort]         = useState('games')
  const [showUnplayed, setUnplayed] = useState(false)
  const [cardImages, setCardImages] = useState({}) // { commanderName → art_crop URL }
  const [cardColors, setCardColors] = useState({}) // { commanderName → color_identity [] }

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'Game Tracking.xlsx')
      .then(r => r.arrayBuffer())
      .then(buf => {
        const { decks, players, sessions } = parseXLSX(buf)
        setDecks(decks)
        setPlayers(players)
        setSessions(sessions)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Fetch card art from Scryfall for every unique commander.
  // Batches of 5 concurrent requests with a 100ms pause between batches
  // to stay within Scryfall's rate-limit guidance.
  useEffect(() => {
    if (!decks.length) return

    const unique = [...new Set(decks.map(d => d.commander).filter(Boolean))]
    const BATCH = 5

    const fetchOne = async (name) => {
      // For partner pairs ("A / B") search only the first card name
      const query = name.split('/')[0].split(' // ')[0].trim()
      try {
        const res = await fetch(
          `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(query)}`
        )
        if (!res.ok) return null
        const card = await res.json()
        if (card.object === 'error') return null
        const img =
          card.image_uris?.art_crop ??
          card.card_faces?.[0]?.image_uris?.art_crop ?? null
        const colors = card.color_identity ?? []
        return { name, img: img ?? null, colors }
      } catch {
        return null
      }
    }

    const run = async () => {
      for (let i = 0; i < unique.length; i += BATCH) {
        const batch = unique.slice(i, i + BATCH)
        const results = await Promise.allSettled(batch.map(fetchOne))
        const valid = results
          .filter(r => r.status === 'fulfilled' && r.value)
          .map(r => r.value)
        const newImages = Object.fromEntries(valid.filter(v => v.img).map(v => [v.name, v.img]))
        const newColors = Object.fromEntries(valid.map(v => [v.name, v.colors]))
        if (Object.keys(newImages).length) setCardImages(prev => ({ ...prev, ...newImages }))
        if (Object.keys(newColors).length) setCardColors(prev => ({ ...prev, ...newColors }))
        if (i + BATCH < unique.length) {
          await new Promise(r => setTimeout(r, 100))
        }
      }
    }

    run()
  }, [decks])

  const playerStats = useMemo(() =>
    players.map(player => {
      const pd    = decks.filter(d => d.player === player)
      const games = pd.reduce((s, d) => s + d.games, 0)
      const wins  = pd.reduce((s, d) => s + d.wins, 0)
      return { player, decks: pd.length, games, wins }
    }), [decks, players])

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

  const topWinner   = [...playerStats].sort((a, b) => b.wins  - a.wins)[0]
  const mostActive  = [...playerStats].sort((a, b) => b.games - a.games)[0]

  // Row 2 stats — Magic-flavored
  // Most played color: tally each color across all commanders, weighted by games played
  const mostPlayedColor = useMemo(() => {
    const COLOR_NAME = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' }
    const tally = {}
    decks.forEach(d => {
      const colors = cardColors[d.commander] ?? []
      colors.forEach(c => { tally[c] = (tally[c] ?? 0) + Math.max(d.games, 1) })
    })
    const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]
    return top ? { color: COLOR_NAME[top[0]] ?? top[0], count: top[1] } : null
  }, [decks, cardColors])

  // Most popular theme: tally each individual theme tag across all decks
  const mostPopularTheme = useMemo(() => {
    const tally = {}
    decks.forEach(d => d.themes.forEach(t => { tally[t] = (tally[t] ?? 0) + 1 }))
    const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]
    return top ? { theme: top[0], count: top[1] } : null
  }, [decks])

  // Most dominant commander: best win rate among decks with 2+ games
  const mostDominant = useMemo(() =>
    [...decks]
      .filter(d => d.games >= 2)
      .sort((a, b) => winRate(b.wins, b.games) - winRate(a.wins, a.games))[0] ?? null
  , [decks])

  // Graveyard of Dreams: decks never played
  const graveyardCount = decks.filter(d => d.games === 0).length

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-bar-track">
          <div className="loading-bar-fill" />
        </div>
        <span className="loading-text">Loading</span>
      </div>
    )
  }

  return (
    <div className="app">

      {/* ── Header ─────────────────────────────────────── */}
      <header className="header fade-up">
        <div className="header-left">
          <p className="header-eyebrow">Casual EDH Dashboard</p>
          <h1 className="app-title">Enough</h1>
          {/* <p className="app-subtitle">
            {players.length} players · {decks.length} decks · {sessions.length} sessions
          </p> */}
        </div>
        {/* Ghost watermark — shows year */}
        <div className="header-watermark" aria-hidden="true">
          {new Date().getFullYear()}
        </div>
      </header>

      {/* ── Stat Cards — Row 1 ─────────────────────────── */}
      <div className="stat-grid">
        <StatCard
          label="Nights Lost to Magic"
          value={sessions.length}
          sub="pods convened"
          delay={0}
        />
        <StatCard
          label="Cardboard Therapy"
          value={decks.length}
          sub="decks in the arsenal"
          delay={80}
        />
        <StatCard
          label="Threat Assessment #1"
          value={topWinner?.player}
          sub={`${topWinner?.wins} total wins`}
          delay={160}
        />
        <StatCard
          label="Heeds the Call"
          value={mostActive?.player}
          sub={`${mostActive?.games} games played`}
          delay={240}
        />
      </div>

      {/* ── Stat Cards — Row 2 ─────────────────────────── */}
      <div className="stat-grid">
        <StatCard
          label="Most Played Color"
          value={mostPlayedColor?.color ?? '—'}
          sub={mostPlayedColor ? `across ${mostPlayedColor.count} deck-games` : 'no data'}
          delay={60}
        />
        <StatCard
          label="Most Popular Theme"
          value={mostPopularTheme?.theme ?? '—'}
          sub={mostPopularTheme ? `${mostPopularTheme.count} decks` : 'no data'}
          delay={140}
        />
        <StatCard
          label="Most Dominant"
          value={mostDominant?.commander ?? '—'}
          sub={mostDominant
            ? `${winRate(mostDominant.wins, mostDominant.games)}% in ${mostDominant.games} games`
            : 'need 2+ games'}
          delay={220}
        />
        <StatCard
          label="Graveyard of Dreams"
          value={graveyardCount}
          sub="decks never played"
          delay={300}
        />
      </div>

      {/* ── Chart ──────────────────────────────────────── */}
      <div className="card fade-up" style={{ animationDelay: '280ms' }}>
        <div className="card-header">
          <h2 className="card-title">Player Breakdown</h2>
          <div className="chart-legend">
            <span className="legend-item">
              <span className="legend-swatch" style={{ background: '#e4e4e7', border: '1px solid #d4d4d8' }} />
              Total Games
            </span>
            <span className="legend-item">
              <span className="legend-swatch" style={{ background: '#09090b' }} />
              Wins
            </span>
          </div>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={playerStats}
              barGap={4}
              barSize={18}
              margin={{ top: 4, right: 4, left: -22, bottom: 0 }}
            >
              <XAxis
                dataKey="player"
                tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'Roboto, sans-serif', fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#d4d4d8', fontSize: 10, fontFamily: 'Roboto, sans-serif' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(0,0,0,0.03)' }}
              />
              <Bar dataKey="games" name="games" fill="#e4e4e7" radius={[3, 3, 0, 0]} />
              <Bar dataKey="wins"  name="wins"  fill="#09090b" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────── */}
      <div className="filters-bar fade-up" style={{ animationDelay: '360ms' }}>
        <div className="pill-group">
          {['All', ...players].map(p => (
            <PlayerPill
              key={p}
              player={p}
              active={activePlayer === p}
              onClick={() => setActive(p)}
            />
          ))}
        </div>
        <div className="sort-group">
          <span className="sort-label">Sort by</span>
          <SortButton label="Games"    active={deckSort === 'games'}   onClick={() => setSort('games')}   />
          <SortButton label="Wins"     active={deckSort === 'wins'}    onClick={() => setSort('wins')}    />
          <SortButton label="Win Rate" active={deckSort === 'winrate'} onClick={() => setSort('winrate')} />
          <div className="sort-divider" aria-hidden="true" />
          <Toggle
            label="Unplayed"
            checked={showUnplayed}
            onChange={() => setUnplayed(v => !v)}
          />
        </div>
      </div>

      {/* ── Deck Table ─────────────────────────────────── */}
      <div className="card fade-up" style={{ animationDelay: '420ms' }}>
        <div className="table-scroll">
          <table className="deck-table">
            <thead>
              <tr>
                <th className="col-left">Commander</th>
                <th className="col-left">Player</th>
                <th className="col-right">Games</th>
                <th className="col-right">Wins</th>
                <th className="col-right">Losses</th>
                <th className="col-right">Win Rate</th>
              </tr>
            </thead>
            <tbody>
              {filteredDecks.map((deck, i) => (
                <tr
                  key={deck.id}
                  style={{ animationDelay: `${Math.min(i * 22, 440)}ms` }}
                >
                  <td className="td-commander">
                    <div className="commander-cell">
                      <div className="commander-thumb-wrap">
                        {cardImages[deck.commander] && (
                          <img
                            src={cardImages[deck.commander]}
                            alt=""
                            className="commander-thumb"
                          />
                        )}
                      </div>
                      <div>
                        {deck.archidektId ? (
                          <a
                            href={`https://archidekt.com/decks/${deck.archidektId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="commander-link"
                          >
                            {deck.commander}
                          </a>
                        ) : (
                          deck.commander
                        )}
                        {deck.themes.length > 0 && (
                          <div className="deck-themes">
                            {deck.themes.map(t => (
                              <span key={t} className="deck-theme">{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td><span className="player-badge">{deck.player}</span></td>
                  <td className="td-num">
                    {deck.games === 0
                      ? <span className="num-zero">—</span>
                      : deck.games}
                  </td>
                  <td className="td-num">
                    {deck.wins === 0
                      ? <span className="num-zero">—</span>
                      : deck.wins}
                  </td>
                  <td className="td-num">
                    {deck.losses === 0
                      ? <span className="num-zero">—</span>
                      : deck.losses}
                  </td>
                  <td className="td-num">
                    <WinBar wins={deck.wins} games={deck.games} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredDecks.length === 0 && (
          <div className="empty-state">No decks match the current filters.</div>
        )}
      </div>

      <div className="table-footer">
        {filteredDecks.length} of {decks.length} decks
      </div>

    </div>
  )
}
