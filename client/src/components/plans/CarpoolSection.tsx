import { useCallback, useEffect, useState } from 'react';
import { Car, Hand, Loader2, Pencil, Trash2, X } from 'lucide-react';
import { Ride, RideRequest } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { getSocket } from '../../lib/socket';
import { useSocketEvent } from '../../hooks/useSocketEvent';
import api from '../../services/api';
import { DateTimeField } from '../ui/DateTimeField';

interface Props {
  planId: string;
  userId: string;
  isAbsent: boolean;
}

function localToISO(str: string): string {
  const [datePart, timePart] = str.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [h, min] = timePart.split(':').map(Number);
  return new Date(y, m - 1, d, h, min).toISOString();
}

function isoToLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDeparture(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    .format(new Date(iso));
}

type RideForm = { departure: string; departureAt: string; seats: string; note: string };
const emptyForm: RideForm = { departure: '', departureAt: '', seats: '3', note: '' };

export function CarpoolSection({ planId, userId, isAbsent }: Props) {
  const { token } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [requests, setRequests] = useState<RideRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rideForm, setRideForm] = useState<RideForm | null>(null);
  const [editingRideId, setEditingRideId] = useState<string | null>(null);
  const [requestFrom, setRequestFrom] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/rides/plan/${planId}`);
      setRides(data.rides);
      setRequests(data.requests);
    } catch {
      // section non bloquante : on garde l'état précédent
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    function onRidesUpdated(payload: { planId: string }) {
      if (payload.planId === planId) load();
    }
    socket.on('rides-updated', onRidesUpdated);
    return () => { socket.off('rides-updated', onRidesUpdated); };
  }, [token, planId, load]);
  // Trajets modifiés pendant une coupure de connexion
  useSocketEvent('connect', () => { load(); });

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await action();
      await load();
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur');
      return false;
    } finally {
      setBusy(false);
    }
  }

  const myRide = rides.find(r => r.driver.id === userId);
  const mySeatRideId = rides.find(r => r.passengers.some(p => p.userId === userId))?.id;
  const myRequest = requests.find(r => r.user.id === userId);

  async function submitRide() {
    if (!rideForm) return;
    const body = {
      departure: rideForm.departure,
      departureAt: rideForm.departureAt ? localToISO(rideForm.departureAt) : null,
      seats: Number(rideForm.seats),
      note: rideForm.note,
    };
    const ok = await run(() => editingRideId
      ? api.put(`/rides/${editingRideId}`, body)
      : api.post(`/rides/plan/${planId}`, body));
    if (ok) { setRideForm(null); setEditingRideId(null); }
  }

  async function submitRequest() {
    if (requestFrom === null) return;
    const ok = await run(() => api.post(`/rides/plan/${planId}/request`, { fromLocation: requestFrom }));
    if (ok) setRequestFrom(null);
  }

  return (
    <div>
      <h3 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-1.5">
        <Car size={15} className="text-indigo-500" />
        Covoiturage
      </h3>

      {loading ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : (
        <div className="space-y-2">
          {rides.length === 0 && requests.length === 0 && !rideForm && requestFrom === null && (
            <p className="text-sm text-slate-400 italic">Aucun trajet proposé pour l'instant.</p>
          )}

          {rides.map(ride => {
            const isDriver = ride.driver.id === userId;
            const isPassenger = ride.passengers.some(p => p.userId === userId);
            const full = ride.passengers.length >= ride.seats;
            return (
              <div key={ride.id} className={`p-3 rounded-xl border shadow-sm ${isDriver || isPassenger ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200'}`}>
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <Car size={15} className="text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800">
                      <span className="font-semibold">@{ride.driver.pseudo}</span>
                      <span className="text-slate-500"> · depuis </span>
                      <span className="font-medium">{ride.departure}</span>
                    </p>
                    {ride.departureAt && (
                      <p className="text-xs text-slate-500 mt-0.5">Départ {formatDeparture(ride.departureAt)}</p>
                    )}
                    {ride.note && <p className="text-xs text-slate-500 italic mt-0.5">{ride.note}</p>}
                    {ride.passengers.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {ride.passengers.map(p => (
                          <span key={p.userId} className="text-xs px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
                            @{p.user.pseudo}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-lg flex-shrink-0 ${full ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'}`}>
                    {full ? 'Complet' : `${ride.seats - ride.passengers.length} place${ride.seats - ride.passengers.length > 1 ? 's libres' : ' libre'}`}
                  </span>
                </div>

                {!isAbsent && (
                  <div className="flex justify-end gap-2 mt-2">
                    {isDriver ? (
                      <>
                        <button
                          onClick={() => {
                            setEditingRideId(ride.id);
                            setRideForm({ departure: ride.departure, departureAt: isoToLocal(ride.departureAt), seats: String(ride.seats), note: ride.note ?? '' });
                            setRequestFrom(null);
                          }}
                          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium text-slate-600 hover:bg-white transition-colors"
                        >
                          <Pencil size={12} /> Modifier
                        </button>
                        <button
                          onClick={() => run(() => api.delete(`/rides/${ride.id}`))}
                          disabled={busy}
                          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          <Trash2 size={12} /> Annuler le trajet
                        </button>
                      </>
                    ) : isPassenger ? (
                      <button
                        onClick={() => run(() => api.delete(`/rides/${ride.id}/join`))}
                        disabled={busy}
                        className="text-xs px-2.5 py-1 rounded-lg font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                      >
                        Je descends
                      </button>
                    ) : !myRide && !full ? (
                      <button
                        onClick={() => run(() => api.post(`/rides/${ride.id}/join`))}
                        disabled={busy}
                        className="text-xs px-2.5 py-1 rounded-lg font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                      >
                        {mySeatRideId ? 'Changer pour ce trajet' : 'Je monte'}
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}

          {requests.map(req => (
            <div key={req.id} className="flex items-center gap-2.5 p-3 rounded-xl border border-dashed border-amber-300 bg-amber-50">
              <Hand size={15} className="text-amber-600 flex-shrink-0" />
              <p className="flex-1 text-sm text-slate-700">
                <span className="font-semibold">@{req.user.pseudo}</span> cherche une place depuis{' '}
                <span className="font-medium">{req.fromLocation}</span>
              </p>
              {req.user.id === userId && (
                <button
                  onClick={() => run(() => api.delete(`/rides/plan/${planId}/request`))}
                  disabled={busy}
                  title="Retirer ma demande"
                  className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-white transition-colors disabled:opacity-50"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}

          {rideForm && (
            <div className="p-3 rounded-xl border border-indigo-200 bg-white shadow-sm space-y-2">
              <p className="text-sm font-semibold text-slate-800">{editingRideId ? 'Modifier mon trajet' : 'Je propose un trajet'}</p>
              <input
                autoFocus
                value={rideForm.departure}
                onChange={e => setRideForm({ ...rideForm, departure: e.target.value })}
                placeholder="Lieu de départ (ex. Lausanne gare)"
                maxLength={100}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex gap-2 items-start">
                <div className="flex-1 min-w-0 text-xs text-slate-500">
                  Heure de départ (optionnel)
                  <DateTimeField
                    value={rideForm.departureAt}
                    onChange={v => setRideForm({ ...rideForm, departureAt: v })}
                    placeholder="Choisir"
                    clearable
                    className="mt-0.5"
                  />
                </div>
                <label className="w-24 text-xs text-slate-500">
                  Places
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={rideForm.seats}
                    onChange={e => setRideForm({ ...rideForm, seats: e.target.value })}
                    className="mt-0.5 w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </label>
              </div>
              <input
                value={rideForm.note}
                onChange={e => setRideForm({ ...rideForm, note: e.target.value })}
                placeholder="Note (optionnel), ex. retour vers 23h"
                maxLength={200}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setRideForm(null); setEditingRideId(null); setError(''); }}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200"
                >
                  Annuler
                </button>
                <button
                  onClick={submitRide}
                  disabled={busy || !rideForm.departure.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {busy && <Loader2 size={13} className="animate-spin" />}
                  {editingRideId ? 'Enregistrer' : 'Proposer'}
                </button>
              </div>
            </div>
          )}

          {requestFrom !== null && (
            <div className="flex gap-2">
              <input
                autoFocus
                value={requestFrom}
                onChange={e => setRequestFrom(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitRequest()}
                placeholder="D'où pars-tu ? (ex. Morges)"
                maxLength={100}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
              <button
                onClick={submitRequest}
                disabled={busy || !requestFrom.trim()}
                className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                OK
              </button>
              <button
                onClick={() => { setRequestFrom(null); setError(''); }}
                className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-300"
              >
                Annuler
              </button>
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          {isAbsent ? (
            <p className="text-xs text-slate-400 italic">Tu es indiqué(e) absent(e) : le covoiturage n'est pas disponible.</p>
          ) : !rideForm && requestFrom === null && (
            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
              {!myRide && (
                <button
                  onClick={() => { setRideForm(emptyForm); setEditingRideId(null); setError(''); }}
                  className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  <Car size={14} />
                  Je propose un trajet
                </button>
              )}
              {!myRide && !mySeatRideId && (
                <button
                  onClick={() => { setRequestFrom(myRequest?.fromLocation ?? ''); setError(''); }}
                  className="flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-800 font-medium"
                >
                  <Hand size={14} />
                  {myRequest ? 'Modifier ma demande' : 'Je cherche une place'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
