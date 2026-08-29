import React, { useState, useEffect } from 'react';

const CONVEX_URL = 'https://canny-hummingbird-920.convex.site';

interface Guest {
  _id: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  attendance?: string;
  max_party?: number;
  song?: string;
  message?: string;
  plus_names?: string;
}

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('cl_admin_token'));
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<'guests' | 'messages' | 'songs'>('guests');
  const [guests, setGuests] = useState<Guest[]>([]);
  const [search, setSearch] = useState('');

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${CONVEX_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem('cl_admin_token', data.token);
        setToken(data.token);
        fetchData(data.token);
      } else {
        setError(data.error || 'Invalid password');
      }
    } catch {
      setError('Failed to connect to authentication server');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (token) {
      fetch(`${CONVEX_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    }
    localStorage.removeItem('cl_admin_token');
    setToken(null);
  };

  const fetchData = async (authToken: string) => {
    try {
      const res = await fetch(`${CONVEX_URL}/api/guests`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGuests(data.guests || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (token) fetchData(token);
  }, [token]);

  function downloadGuestTemplate() {
    const headers = ['first_name','last_name','spouse_name','guest_type','max_party','phone','email','deadline','attendance','easy_mode','plus_names','song','message'];
    const example = ['Charles','Smith','','single','1','555-123-4567','charles@example.com','2026-10-31','invited','false','','',''];
    const csv = [headers.join(','), example.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'guest-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleGuestCsv(e: React.ChangeEvent<HTMLInputElement> | Event) {
    const input = e instanceof Event ? (e.target as HTMLInputElement) : e.target;
    const file = input && input.files && input.files[0];
    if (!file || !token) return;
    const text = await file.text();
    const rows = text.split(/\r?\n/).map(r => r.trim()).filter(Boolean);
    if (rows.length < 2) { alert('CSV contains no data rows.'); return; }
    const headers = rows[0].split(',').map(h => h.trim());
    const data: any[] = [];
    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i].split(',');
      const obj: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = cols[j] !== undefined ? cols[j].trim() : '';
      }
      data.push(obj);
    }

    const confirmed = window.confirm(`Import ${data.length} guests? This will add them to Convex.`);
    if (!confirmed) return;

    try {
      const res = await fetch(`${CONVEX_URL}/api/guests/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ guests: data })
      });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      alert(`Import complete. Inserted: ${result.inserted || 0}. Errors: ${result.errors ? result.errors.length : 0}`);
      fetchData(token);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Import failed: ${msg}`);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-[#090a0f] text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-amber-500/20 rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-serif font-bold tracking-tight text-amber-400">Charles & Leticia</h1>
            <p className="text-xs uppercase tracking-widest text-slate-400">Wedding Admin Portal</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-300 mb-1">Passcode</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full px-4 py-3 bg-slate-950/80 border border-amber-500/30 rounded-xl focus:outline-none focus:border-amber-400 text-white placeholder-slate-600"
                required
              />
            </div>
            {error && <p className="text-sm text-red-400 bg-red-950/40 p-2 rounded border border-red-800/40">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold uppercase text-xs tracking-widest rounded-xl transition shadow-lg shadow-amber-500/10 active:scale-98"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const filteredGuests = guests.filter((g) => {
    const name = `${g.first_name || ''} ${g.last_name || ''}`.toLowerCase();
    return name.includes(search.toLowerCase()) || (g.phone && g.phone.includes(search));
  });

  const messages = guests.filter((g) => g.message && g.message.trim() !== '');
  const songs = guests.filter((g) => g.song && g.song.trim() !== '');

  const attendingCount = guests.filter((g) => g.attendance === 'attending').length;
  const declinedCount = guests.filter((g) => g.attendance === 'declined').length;
  const pendingCount = guests.filter((g) => !g.attendance || g.attendance === 'invited' || g.attendance === 'later').length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-slate-100 flex flex-col">
      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 bg-slate-900/70 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-300 font-serif font-bold text-base">
              C&L
            </div>
            <div>
              <div className="font-serif font-bold text-amber-300 text-lg">Charles & Leticia</div>
              <div className="text-[12px] text-slate-400">Wedding Admin</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadGuestTemplate()}
              aria-label="Download guest CSV template"
              className="hidden sm:inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-900 bg-amber-400 rounded-lg shadow-sm hover:brightness-105"
            >
              📥 Template
            </button>
            <input id="guest-csv-input" type="file" accept=".csv" style={{ display: 'none' }} onChange={(e) => handleGuestCsv(e)} aria-hidden />
            <button
              onClick={() => (document.getElementById('guest-csv-input') as HTMLInputElement)?.click()}
              aria-label="Upload guest CSV"
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-100 bg-amber-500 rounded-lg shadow-sm hover:opacity-95"
            >
              ⬆️ Upload
            </button>
            <button
              onClick={handleLogout}
              aria-label="Sign out"
              className="ml-2 px-3 py-2 text-sm font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Admin Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 border border-amber-500/20 rounded-xl p-4 space-y-1">
            <span className="text-xs uppercase tracking-wider text-slate-400">Total Invited</span>
            <div className="text-2xl font-bold text-white">{guests.length}</div>
          </div>
          <div className="bg-slate-900/60 border border-emerald-500/20 rounded-xl p-4 space-y-1">
            <span className="text-xs uppercase tracking-wider text-emerald-400">Attending</span>
            <div className="text-2xl font-bold text-emerald-400">{attendingCount}</div>
          </div>
          <div className="bg-slate-900/60 border border-rose-500/20 rounded-xl p-4 space-y-1">
            <span className="text-xs uppercase tracking-wider text-rose-400">Declined</span>
            <div className="text-2xl font-bold text-rose-400">{declinedCount}</div>
          </div>
          <div className="bg-slate-900/60 border border-amber-500/20 rounded-xl p-4 space-y-1">
            <span className="text-xs uppercase tracking-wider text-amber-400">Pending</span>
            <div className="text-2xl font-bold text-amber-400">{pendingCount}</div>
          </div>
        </div>

        {/* Tab Controls (shadcn style) */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex space-x-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('guests')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition ${
                activeTab === 'guests'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Guest List ({guests.length})
            </button>
            <button
              onClick={() => setActiveTab('messages')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition ${
                activeTab === 'messages'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Messages Inbox ({messages.length})
            </button>
            <button
              onClick={() => setActiveTab('songs')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition ${
                activeTab === 'songs'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Song Requests ({songs.length})
            </button>
          </div>

          {activeTab === 'guests' && (
            <input
              type="text"
              placeholder="Filter guests by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs focus:outline-none focus:border-amber-500 text-white w-64"
            />
          )}
        </div>

        {/* Tab Content */}
        {activeTab === 'guests' && (
          <div className="space-y-4">
            {/* Desktop table */}
            <div className="hidden md:block bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="p-4">Name</th>
                    <th className="p-4">Phone</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Party Size</th>
                    <th className="p-4">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredGuests.map((g) => (
                    <tr key={g._id} className="hover:bg-slate-800/30 transition">
                      <td className="p-4 font-semibold text-white">{g.first_name} {g.last_name}</td>
                      <td className="p-4 text-slate-400">{g.phone || '—'}</td>
                      <td className="p-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          g.attendance === 'attending'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : g.attendance === 'declined'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}>{g.attendance || 'Invited'}</span>
                      </td>
                      <td className="p-4">{g.max_party || 1}</td>
                      <td className="p-4 max-w-xs truncate text-slate-400">{g.message || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {filteredGuests.map((g) => (
                <div key={g._id} className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white">{g.first_name} {g.last_name}</div>
                      <div className="text-xs text-slate-400">{g.phone || '—'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs mb-1">Party: <span className="font-semibold">{g.max_party || 1}</span></div>
                      <div>
                        <span className={`inline-block px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          g.attendance === 'attending'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : g.attendance === 'declined'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}>{g.attendance || 'Invited'}</span>
                      </div>
                    </div>
                  </div>
                  {g.message && <div className="mt-3 text-sm text-slate-300 italic">"{g.message}"</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'messages' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {messages.length === 0 ? (
              <p className="text-slate-500 text-sm">No guest messages recorded yet.</p>
            ) : (
              messages.map((g) => (
                <div key={g._id} className="bg-slate-900/60 border border-amber-500/20 rounded-xl p-5 space-y-3 shadow-lg">
                  <div className="flex justify-between items-start">
                    <h4 className="font-semibold text-amber-400 text-sm">{g.first_name} {g.last_name}</h4>
                    <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      {g.attendance || 'invited'}
                    </span>
                  </div>
                  <p className="text-slate-200 text-sm italic">"{g.message}"</p>
                  {g.song && (
                    <div className="text-xs text-amber-300/80 pt-2 border-t border-slate-800 flex items-center gap-1">
                      <span>🎵 Song Requested:</span> <span className="font-semibold text-white">{g.song}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'songs' && (
          <div className="space-y-4">
            <h3 className="text-sm uppercase tracking-wider text-amber-400 font-semibold">Guest Song Submissions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {songs.length === 0 ? (
                <p className="text-slate-500 text-sm">No song requests received yet.</p>
              ) : (
                songs.map((g) => (
                  <div key={g._id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white text-sm">{g.song}</div>
                      <div className="text-xs text-slate-400">Requested by: {g.first_name} {g.last_name}</div>
                    </div>
                    <span className="text-xl">🎵</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
