'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Globe, Loader2, Check, AlertCircle, Search } from 'lucide-react';

const FALLBACK_ZONES = [
    'UTC',
    'America/Santiago',
    'America/Argentina/Buenos_Aires',
    'America/Mexico_City',
    'America/Bogota',
    'America/Lima',
    'Europe/Madrid',
    'Europe/London',
    'US/Eastern',
    'US/Central',
    'US/Pacific',
];

export default function ConfigPage() {
    const [zonaHoraria, setZonaHoraria] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // Estado del buscador de zona horaria
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);

    const zonas = useMemo<string[]>(() => {
        const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
        try {
            if (typeof fn === 'function') {
                const list = fn.call(Intl, 'timeZone');
                if (list && list.length > 0) return list;
            }
        } catch {
            // fallback
        }
        return FALLBACK_ZONES;
    }, []);

    const filteredZonas = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return zonas;
        return zonas.filter((z) => z.toLowerCase().includes(q));
    }, [zonas, query]);

    const selectZone = (z: string) => {
        setZonaHoraria(z);
        setQuery('');
        setOpen(false);
    };

    const loadConfig = async () => {
        try {
            setLoading(true);
            const res = await api.get('/config');
            setZonaHoraria(res.data.zonaHoraria || 'UTC');
        } catch (err: any) {
            setErrorMsg(err.response?.data?.message || 'No se pudo cargar la configuración');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadConfig();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!zonaHoraria.trim()) return;

        try {
            setSaving(true);
            setErrorMsg('');
            setSuccessMsg('');
            await api.patch('/config', { zonaHoraria: zonaHoraria.trim() });
            setSuccessMsg('Zona horaria actualizada correctamente');
        } catch (err: any) {
            setErrorMsg(err.response?.data?.message || 'Error al guardar la zona horaria');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-xl space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Globe className="text-blue-500 w-7 h-7" />
                    Configuración
                </h1>
                <p className="text-slate-400 text-sm">
                    Define la zona horaria del servidor. Los horarios de las alarmas recurrentes se
                    interpretan en esta zona, por lo que todos los dispositivos suenan a la misma hora real.
                </p>
            </div>

            {errorMsg && (
                <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{errorMsg}</span>
                </div>
            )}

            {successMsg && (
                <div className="flex items-center gap-2 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-lg">
                    <Check className="w-5 h-5 flex-shrink-0" />
                    <span>{successMsg}</span>
                </div>
            )}

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 shadow-xl">
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                            Zona horaria del servidor
                        </label>
                        {loading ? (
                            <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Cargando...
                            </div>
                        ) : (
                            <div className="relative">
                                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                    type="text"
                                    value={open ? query : zonaHoraria}
                                    placeholder="Buscar zona horaria..."
                                    onFocus={() => { setQuery(''); setOpen(true); }}
                                    onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                                    onBlur={() => setOpen(false)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && filteredZonas.length > 0) {
                                            e.preventDefault();
                                            selectZone(filteredZonas[0]);
                                        } else if (e.key === 'Escape') {
                                            setOpen(false);
                                        }
                                    }}
                                    className="w-full bg-slate-950 border border-slate-800 text-white pl-9 pr-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                />
                                {open && (
                                    <ul className="absolute z-20 mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                        {filteredZonas.length === 0 ? (
                                            <li className="px-3 py-2 text-sm text-slate-500">Sin resultados</li>
                                        ) : (
                                            filteredZonas.map((z) => (
                                                <li key={z}>
                                                    <button
                                                        type="button"
                                                        onMouseDown={(e) => { e.preventDefault(); selectZone(z); }}
                                                        className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-blue-600/20 hover:text-white"
                                                    >
                                                        {z}
                                                    </button>
                                                </li>
                                            ))
                                        )}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={saving || loading}
                            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 w-full sm:w-auto"
                        >
                            {saving ? 'Guardando...' : 'Guardar zona horaria'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
