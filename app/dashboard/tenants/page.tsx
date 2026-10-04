'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Recurrence, RecurrenceTipo, DIAS_SEMANA, formatRecurrence, nextExecutionMs } from '@/lib/recurrence';
import {
    Building2, Plus, Trash2, Search,
    ChevronDown, ChevronRight, Bell, Clock, Power, Eye, EyeOff, X, Music, Edit2, Repeat
} from 'lucide-react';

interface Tenant {
    id: string;
    nombre: string;
    apiKey?: string;
    logoUrl?: string;
}

interface Alarm {
    id: string;
    tenantId: string;
    titulo: string;
    horaProgramada: string | null;
    recurrencia?: Recurrence | null;
    urlAudio: string;
    activa: boolean;
}

interface AudioItem {
    nombre?: string;
    nombreArchivo?: string;
    urlAudio: string;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function TenantsPage() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Control de filas desplegadas
    const [expandedTenants, setExpandedTenants] = useState<Record<string, boolean>>({});
    const [tenantAlarms, setTenantAlarms] = useState<Record<string, Alarm[]>>({});
    const [loadingAlarms, setLoadingAlarms] = useState<Record<string, boolean>>({});

    // Lista de audios
    const [audios, setAudios] = useState<AudioItem[]>([]);
    const [loadingAudios, setLoadingAudios] = useState(false);

    // Zona horaria del servidor (para calcular la próxima ejecución)
    const [zonaHoraria, setZonaHoraria] = useState('UTC');

    // Modal de Tenant (Crear / Editar)
    const [isTenantModalOpen, setIsTenantModalOpen] = useState(false);
    const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
    const [nombreTenant, setNombreTenant] = useState('');
    const [passwordTenant, setPasswordTenant] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Modal de Alarma (Crear / Editar)
    const [isAlarmModalOpen, setIsAlarmModalOpen] = useState(false);
    const [selectedTenantForAlarm, setSelectedTenantForAlarm] = useState<Tenant | null>(null);
    const [editingAlarm, setEditingAlarm] = useState<Alarm | null>(null);
    const [tituloAlarm, setTituloAlarm] = useState('');
    const [horaAlarm, setHoraAlarm] = useState('');
    const [urlAudioAlarm, setUrlAudioAlarm] = useState('');

    // Estado de recurrencia
    const [recurrenceTipo, setRecurrenceTipo] = useState<RecurrenceTipo | 'una_vez'>('una_vez');
    const [recurHora, setRecurHora] = useState('');
    const [recurDiasSemana, setRecurDiasSemana] = useState<number[]>([]);
    const [recurDiasMes, setRecurDiasMes] = useState<number[]>([]);
    const [recurAnioMes, setRecurAnioMes] = useState(1);
    const [recurAnioDia, setRecurAnioDia] = useState(1);
    const [recurHoraInicio, setRecurHoraInicio] = useState('');
    const [recurHoraFin, setRecurHoraFin] = useState('');
    const [recurIntervaloMinutos, setRecurIntervaloMinutos] = useState(10);
    const [recurFechaFin, setRecurFechaFin] = useState('');

    const [createLoading, setCreateLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const fetchTenants = async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true);
            const res = await api.get('/tenants');
            setTenants(res.data);
        } catch (err: any) {
            console.error('Error al obtener tenants:', err);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    const fetchAudios = async () => {
        try {
            setLoadingAudios(true);
            const res = await api.get('/media/audios');
            setAudios(res.data);
        } catch (err: any) {
            console.error('Error al obtener audios:', err);
        } finally {
            setLoadingAudios(false);
        }
    };

    const fetchConfig = async () => {
        try {
            const res = await api.get('/config');
            setZonaHoraria(res.data.zonaHoraria || 'UTC');
        } catch (err: any) {
            console.error('Error al obtener la zona horaria:', err);
        }
    };

    const fetchTenantAlarms = async (tenantId: string, showLoading = true) => {
        try {
            if (showLoading) {
                setLoadingAlarms((prev) => ({ ...prev, [tenantId]: true }));
            }
            const res = await api.get(`/alarms/tenant/${tenantId}`);
            setTenantAlarms((prev) => ({ ...prev, [tenantId]: res.data }));
        } catch (err) {
            console.error('Error al obtener alarmas del tenant:', err);
        } finally {
            if (showLoading) {
                setLoadingAlarms((prev) => ({ ...prev, [tenantId]: false }));
            }
        }
    };

    useEffect(() => {
        fetchTenants();
        fetchAudios();
        fetchConfig();
    }, []);

    const toggleTenantExpand = async (tenantId: string) => {
        const isExpanding = !expandedTenants[tenantId];
        setExpandedTenants((prev) => ({ ...prev, [tenantId]: isExpanding }));

        if (isExpanding && !tenantAlarms[tenantId]) {
            fetchTenantAlarms(tenantId, true);
        }
    };

    // Tenant Handlers
    const handleOpenCreateTenantModal = () => {
        setEditingTenant(null);
        setNombreTenant('');
        setPasswordTenant('');
        setErrorMsg('');
        setIsTenantModalOpen(true);
    };

    const handleOpenEditTenantModal = (tenant: Tenant) => {
        setEditingTenant(tenant);
        setNombreTenant(tenant.nombre);
        setPasswordTenant('');
        setErrorMsg('');
        setIsTenantModalOpen(true);
    };

    const handleSaveTenant = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nombreTenant.trim()) return;

        try {
            setCreateLoading(true);
            setErrorMsg('');

            const payload: { nombre: string; password?: string; } = { nombre: nombreTenant.trim() };
            if (passwordTenant.trim()) {
                payload.password = passwordTenant.trim();
            }

            if (editingTenant) {
                await api.patch(`/tenants/${editingTenant.id}`, payload);
            } else {
                await api.post('/tenants', payload);
            }

            setNombreTenant('');
            setPasswordTenant('');
            setIsTenantModalOpen(false);
            setEditingTenant(null);

            // Refrescar silenciosamente (sin pantalla de carga)
            await fetchTenants(false);
        } catch (err: any) {
            setErrorMsg(err.response?.data?.message || 'Error al procesar la solicitud');
        } finally {
            setCreateLoading(false);
        }
    };

    const handleDeleteTenant = async (id: string, name: string) => {
        if (!confirm(`¿Estás seguro de que deseas eliminar el tenant "${name}"? Se borrarán sus alarmas asociadas.`)) {
            return;
        }
        try {
            await api.delete(`/tenants/${id}`);
            await fetchTenants(false);
        } catch (err) {
            alert('Error al eliminar el tenant');
        }
    };

    // Alarm Handlers
    const resetRecurrenceForm = () => {
        setRecurrenceTipo('una_vez');
        setRecurHora('');
        setRecurDiasSemana([]);
        setRecurDiasMes([]);
        setRecurAnioMes(1);
        setRecurAnioDia(1);
        setRecurHoraInicio('');
        setRecurHoraFin('');
        setRecurIntervaloMinutos(10);
        setRecurFechaFin('');
    };

    const populateRecurrenceForm = (recurrence: Recurrence) => {
        setRecurrenceTipo(recurrence.tipo);
        setRecurFechaFin(recurrence.fechaFin || '');
        if (recurrence.tipo === 'diaria') {
            setRecurHora(recurrence.hora);
        } else if (recurrence.tipo === 'semanal') {
            setRecurHora(recurrence.hora);
            setRecurDiasSemana(recurrence.diasSemana);
        } else if (recurrence.tipo === 'mensual') {
            setRecurHora(recurrence.hora);
            setRecurDiasMes(recurrence.diasMes);
        } else if (recurrence.tipo === 'anual') {
            setRecurHora(recurrence.hora);
            if (recurrence.fechas.length > 0) {
                setRecurAnioMes(Number(recurrence.fechas[0].slice(0, 2)));
                setRecurAnioDia(Number(recurrence.fechas[0].slice(3, 5)));
            }
        } else if (recurrence.tipo === 'intervalo') {
            setRecurDiasSemana(recurrence.diasSemana);
            setRecurHoraInicio(recurrence.horaInicio);
            setRecurHoraFin(recurrence.horaFin);
            setRecurIntervaloMinutos(recurrence.intervaloMinutos);
        }
    };

    const handleOpenCreateAlarmModal = (tenant: Tenant) => {
        setSelectedTenantForAlarm(tenant);
        setEditingAlarm(null);
        setTituloAlarm('');
        setHoraAlarm('');
        setUrlAudioAlarm('');
        resetRecurrenceForm();
        setErrorMsg('');
        setIsAlarmModalOpen(true);
    };

    const handleOpenEditAlarmModal = (tenant: Tenant, alarm: Alarm) => {
        setSelectedTenantForAlarm(tenant);
        setEditingAlarm(alarm);
        setTituloAlarm(alarm.titulo);

        resetRecurrenceForm();

        if (alarm.recurrencia) {
            populateRecurrenceForm(alarm.recurrencia);
            setHoraAlarm('');
        } else if (alarm.horaProgramada) {
            // Formatear ISO string a YYYY-MM-DDTHH:mm para el input datetime-local
            const d = new Date(alarm.horaProgramada);
            const formattedDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
                .toISOString()
                .slice(0, 16);
            setHoraAlarm(formattedDate);
        } else {
            setHoraAlarm('');
        }

        setUrlAudioAlarm(alarm.urlAudio || '');
        setErrorMsg('');
        setIsAlarmModalOpen(true);
    };

    const buildRecurrence = (): Recurrence | null => {
        const fechaFin = recurFechaFin || undefined;
        switch (recurrenceTipo) {
            case 'diaria':
                return { tipo: 'diaria', hora: recurHora, ...(fechaFin ? { fechaFin } : {}) };
            case 'semanal':
                return { tipo: 'semanal', diasSemana: recurDiasSemana, hora: recurHora, ...(fechaFin ? { fechaFin } : {}) };
            case 'mensual':
                return { tipo: 'mensual', diasMes: recurDiasMes, hora: recurHora, ...(fechaFin ? { fechaFin } : {}) };
            case 'anual':
                return {
                    tipo: 'anual',
                    fechas: [`${pad2(recurAnioMes)}-${pad2(recurAnioDia)}`],
                    hora: recurHora,
                    ...(fechaFin ? { fechaFin } : {}),
                };
            case 'intervalo':
                return {
                    tipo: 'intervalo',
                    diasSemana: recurDiasSemana,
                    horaInicio: recurHoraInicio,
                    horaFin: recurHoraFin,
                    intervaloMinutos: recurIntervaloMinutos,
                    ...(fechaFin ? { fechaFin } : {}),
                };
            default:
                return null;
        }
    };

    const validateRecurrenceForm = (): boolean => {
        if (recurrenceTipo === 'una_vez') return true;

        if (recurrenceTipo === 'diaria' || recurrenceTipo === 'semanal' ||
            recurrenceTipo === 'mensual' || recurrenceTipo === 'anual') {
            if (!recurHora) { setErrorMsg('Selecciona la hora de la alarma'); return false; }
        }
        if (recurrenceTipo === 'semanal' || recurrenceTipo === 'intervalo') {
            if (recurDiasSemana.length === 0) { setErrorMsg('Selecciona al menos un día de la semana'); return false; }
        }
        if (recurrenceTipo === 'mensual' && recurDiasMes.length === 0) {
            setErrorMsg('Selecciona al menos un día del mes'); return false;
        }
        if (recurrenceTipo === 'intervalo') {
            if (!recurHoraInicio || !recurHoraFin) { setErrorMsg('Indica la hora de inicio y fin del rango'); return false; }
            if (recurHoraFin <= recurHoraInicio) { setErrorMsg('La hora de fin debe ser mayor que la de inicio'); return false; }
            if (!recurIntervaloMinutos || recurIntervaloMinutos < 1) { setErrorMsg('El intervalo en minutos debe ser mayor a 0'); return false; }
        }
        return true;
    };

    const handleSaveAlarm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTenantForAlarm || !tituloAlarm) return;

        if (!validateRecurrenceForm()) return;

        try {
            setCreateLoading(true);
            setErrorMsg('');

            const tenantId = selectedTenantForAlarm.id;
            const payload: any = {
                titulo: tituloAlarm.trim(),
                urlAudio: urlAudioAlarm,
            };

            if (recurrenceTipo === 'una_vez') {
                if (!horaAlarm) { setErrorMsg('Selecciona una fecha y hora'); setCreateLoading(false); return; }
                const parsedDate = new Date(horaAlarm);
                if (isNaN(parsedDate.getTime())) {
                    setErrorMsg('Selecciona una fecha y hora válidas');
                    setCreateLoading(false);
                    return;
                }
                payload.horaProgramada = parsedDate.toISOString();
                payload.recurrencia = null;
            } else {
                payload.recurrencia = buildRecurrence();
            }

            if (editingAlarm) {
                // Actualizar Alarma existente (PATCH)
                const res = await api.patch(`/alarms/${editingAlarm.id}`, payload);

                // Actualizar en el estado local directamente
                setTenantAlarms((prev) => ({
                    ...prev,
                    [tenantId]: (prev[tenantId] || []).map((a) =>
                        a.id === editingAlarm.id ? { ...a, ...res.data } : a
                    ),
                }));
            } else {
                // Crear nueva Alarma (POST)
                const res = await api.post('/alarms', {
                    ...payload,
                    tenantId,
                    activa: true,
                });

                // Agregar al estado local directamente
                setTenantAlarms((prev) => ({
                    ...prev,
                    [tenantId]: [...(prev[tenantId] || []), res.data],
                }));
            }

            setTituloAlarm('');
            setHoraAlarm('');
            setUrlAudioAlarm('');
            resetRecurrenceForm();
            setEditingAlarm(null);
            setIsAlarmModalOpen(false);
            setExpandedTenants((prev) => ({ ...prev, [tenantId]: true }));
        } catch (err: any) {
            setErrorMsg(err.response?.data?.message || 'Error al guardar la alarma');
        } finally {
            setCreateLoading(false);
        }
    };

    // Cambiar estado de la alarma sin parpadeos ni desplazamiento
    const handleToggleAlarm = async (alarm: Alarm) => {
        const nextState = !alarm.activa;

        // Actualización optimista en la UI
        setTenantAlarms((prev) => ({
            ...prev,
            [alarm.tenantId]: (prev[alarm.tenantId] || []).map((a) =>
                a.id === alarm.id ? { ...a, activa: nextState } : a
            ),
        }));

        try {
            await api.patch(`/alarms/${alarm.id}`, { activa: nextState });
        } catch (err) {
            alert('Error al actualizar el estado de la alarma');
            // Revertir cambio si hubo error
            setTenantAlarms((prev) => ({
                ...prev,
                [alarm.tenantId]: (prev[alarm.tenantId] || []).map((a) =>
                    a.id === alarm.id ? { ...a, activa: alarm.activa } : a
                ),
            }));
        }
    };

    const handleDeleteAlarm = async (alarm: Alarm) => {
        if (!confirm(`¿Estas seguro de eliminar la alarma "${alarm.titulo}"?`)) return;

        // Eliminar del estado local
        setTenantAlarms((prev) => ({
            ...prev,
            [alarm.tenantId]: (prev[alarm.tenantId] || []).filter((a) => a.id !== alarm.id),
        }));

        try {
            await api.delete(`/alarms/${alarm.id}`);
        } catch (err) {
            alert('Error al eliminar la alarma');
            fetchTenantAlarms(alarm.tenantId, false);
        }
    };

    const filteredTenants = tenants.filter((t) =>
        t.nombre.toLowerCase().includes(search.toLowerCase())
    );

    // Mapa urlAudio -> nombre visible, para mostrar el nombre de la canción en las alarmas.
    const audioNameByUrl = useMemo(() => {
        const map: Record<string, string> = {};
        audios.forEach((a) => {
            if (a.urlAudio) {
                map[a.urlAudio] = a.nombre || a.nombreArchivo || a.urlAudio;
            }
        });
        return map;
    }, [audios]);

    const audioLabel = (url?: string | null): string => {
        if (!url) return 'Sin audio';
        const resolved = audioNameByUrl[url];
        if (resolved) return resolved;
        return url.split('/').pop() || url;
    };

    const nextLabel = (alarm: Alarm): string => {
        try {
            const ms = nextExecutionMs(alarm, Date.now(), zonaHoraria);
            if (!ms) return '—';
            return new Date(ms).toLocaleString(undefined, {
                timeZone: zonaHoraria,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            });
        } catch {
            return '—';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        Gestión de Tenants y Alarmas
                    </h1>
                    <p className="text-slate-400 text-sm">
                        Administra los tenants y despliega sus alarmas programadas.
                    </p>
                </div>

                <button
                    onClick={handleOpenCreateTenantModal}
                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2.5 rounded-lg transition-colors shadow-lg shadow-blue-600/20 w-full sm:w-auto"
                >
                    <Plus className="w-5 h-5" />
                    <span>Nuevo Tenant</span>
                </button>
            </div>

            {/* Búsqueda */}
            <div className="relative max-w-md">
                <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                    type="text"
                    placeholder="Buscar tenant por nombre..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                />
            </div>

            {/* Tabla Principal */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                {loading ? (
                    <div className="p-8 text-center text-slate-400">Cargando empresas...</div>
                ) : filteredTenants.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        {search ? 'No se encontraron tenants con ese criterio' : 'No hay tenants registrados aún.'}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs border-b border-slate-800">
                                <tr>
                                    <th className="w-10 px-4 py-4"></th>
                                    <th className="px-3 sm:px-6 py-4 font-semibold">Nombre</th>
                                    <th className="hidden md:table-cell px-6 py-4 font-semibold">ID del Tenant</th>
                                    <th className="px-4 py-4 font-semibold text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {filteredTenants.map((tenant) => {
                                    const isExpanded = !!expandedTenants[tenant.id];
                                    const alarms = tenantAlarms[tenant.id] || [];
                                    const isAlarmsLoading = !!loadingAlarms[tenant.id];

                                    return (
                                        <React.Fragment key={tenant.id}>
                                            <tr className="hover:bg-slate-800/40 transition-colors">
                                                <td className="px-4 py-4 text-center">
                                                    <button
                                                        onClick={() => toggleTenantExpand(tenant.id)}
                                                        className="p-1 hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-white"
                                                        title={isExpanded ? 'Ocultar Alarmas' : 'Ver Alarmas'}
                                                    >
                                                        {isExpanded ? (
                                                            <ChevronDown className="w-5 h-5 text-blue-400" />
                                                        ) : (
                                                            <ChevronRight className="w-5 h-5" />
                                                        )}
                                                    </button>
                                                </td>
                                                <td className="px-3 sm:px-6 py-4 font-medium text-white">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="w-9 h-9 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold shrink-0">
                                                            {tenant.nombre.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="truncate">{tenant.nombre}</span>
                                                    </div>
                                                </td>
                                                <td className="hidden md:table-cell px-6 py-4 font-mono text-xs text-slate-400">{tenant.id}</td>
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center justify-end gap-1.5 sm:gap-2 flex-wrap">
                                                        <button
                                                            onClick={() => handleOpenCreateAlarmModal(tenant)}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg transition-colors"
                                                            title="Nueva Alarma"
                                                        >
                                                            <Bell className="w-3.5 h-3.5" />
                                                            <span className="hidden sm:inline">Nueva Alarma</span>
                                                        </button>

                                                        <button
                                                            onClick={() => handleOpenEditTenantModal(tenant)}
                                                            className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                                            title="Editar Tenant"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>

                                                        <button
                                                            onClick={() => handleDeleteTenant(tenant.id, tenant.nombre)}
                                                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                            title="Eliminar Tenant"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {isExpanded && (
                                                <tr className="bg-slate-950/60 border-b border-slate-800">
                                                    <td colSpan={4} className="p-3 sm:p-4 sm:pl-14">
                                                        <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 space-y-3">
                                                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                                                <span className="text-xs font-bold uppercase text-slate-400 flex items-center gap-2">
                                                                    <Bell className="w-4 h-4 text-blue-400" /> Alarmas de {tenant.nombre}
                                                                </span>
                                                                <span className="text-xs text-slate-500">
                                                                    Zona: {zonaHoraria} · Total: {alarms.length}
                                                                </span>
                                                            </div>

                                                            {isAlarmsLoading ? (
                                                                <div className="text-xs text-slate-500 py-2">Cargando alarmas...</div>
                                                            ) : alarms.length === 0 ? (
                                                                <div className="text-xs text-slate-500 py-2 italic">
                                                                    No hay alarmas programadas para este tenant.
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-2">
                                                                    {alarms.map((alarm) => (
                                                                        <div
                                                                            key={alarm.id}
                                                                            className="flex flex-col gap-3 bg-slate-800/40 border border-slate-800 rounded-lg p-3 hover:border-slate-700 transition-colors sm:flex-row sm:items-center sm:justify-between"
                                                                        >
                                                                            <div className="space-y-1 min-w-0 flex-1">
                                                                                <p className="text-sm font-semibold text-white break-words">{alarm.titulo}</p>
                                                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                                                                                    <span className="flex items-center gap-1">
                                                                                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                                                                                        {alarm.recurrencia
                                                            ? formatRecurrence(alarm.recurrencia)
                                                            : alarm.horaProgramada
                                                                ? new Date(alarm.horaProgramada).toLocaleString()
                                                                : '—'}
                                                                                    </span>
                                                                                    <span className="truncate max-w-full sm:max-w-[200px] text-slate-500 flex items-center gap-1" title={audioLabel(alarm.urlAudio)}>
                                                                                        <Music className="w-3 h-3 text-slate-500" />
                                                                                        {audioLabel(alarm.urlAudio)}
                                                                                    </span>
                                                                                </div>
                                                                                <p className="text-xs text-blue-400 font-medium">
                                                                                    Próxima ejecución: {nextLabel(alarm)}
                                                                                </p>
                                                                            </div>

                                                                            <div className="flex items-center gap-2 shrink-0">
                                                                                <button
                                                                                    onClick={() => handleToggleAlarm(alarm)}
                                                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${alarm.activa
                                                                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                                                                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                                                                                        }`}
                                                                                >
                                                                                    <Power className="w-3.5 h-3.5" />
                                                                                    {alarm.activa ? 'Activa' : 'Inactiva'}
                                                                                </button>

                                                                                <button
                                                                                    onClick={() => handleOpenEditAlarmModal(tenant, alarm)}
                                                                                    className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                                                                    title="Editar Alarma"
                                                                                >
                                                                                    <Edit2 className="w-4 h-4" />
                                                                                </button>

                                                                                <button
                                                                                    onClick={() => handleDeleteAlarm(alarm)}
                                                                                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                                                    title="Eliminar Alarma"
                                                                                >
                                                                                    <Trash2 className="w-4 h-4" />
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* MODAL: Crear / Editar Tenant */}
            {isTenantModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-4 sm:p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                {editingTenant ? 'Editar Tenant' : 'Crear Tenant'}
                            </h3>
                            <button
                                onClick={() => setIsTenantModalOpen(false)}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {errorMsg && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg">
                                {errorMsg}
                            </div>
                        )}

                        <form onSubmit={handleSaveTenant} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                                    Nombre del Tenant
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: dia de trabajo"
                                    value={nombreTenant}
                                    onChange={(e) => setNombreTenant(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                                    {editingTenant ? 'Nueva Contraseña (Opcional)' : 'Contraseña (Opcional)'}
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder={editingTenant ? 'Dejar en blanco para mantener la actual' : 'Contraseña de acceso'}
                                        value={passwordTenant}
                                        onChange={(e) => setPasswordTenant(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 text-white pl-3 pr-10 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                {editingTenant && (
                                    <p className="text-[11px] text-slate-500 mt-1">
                                        Por seguridad no se muestra la contraseña actual. Escribe una nueva solo si deseas cambiarla.
                                    </p>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsTenantModalOpen(false)}
                                    className="px-4 py-2 text-sm text-slate-400 hover:text-white font-medium transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={createLoading}
                                    className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {createLoading ? 'Guardando...' : editingTenant ? 'Actualizar Tenant' : 'Crear Tenant'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: Crear / Editar Alarma */}
            {isAlarmModalOpen && selectedTenantForAlarm && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-4 sm:p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                            <div>
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Bell className="w-5 h-5 text-blue-500" />
                                    {editingAlarm ? 'Editar Alarma' : 'Crear Alarma'}
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">Para: {selectedTenantForAlarm.nombre}</p>
                            </div>
                            <button
                                onClick={() => setIsAlarmModalOpen(false)}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {errorMsg && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg">
                                {errorMsg}
                            </div>
                        )}

                        <form onSubmit={handleSaveAlarm} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                                    Título de la Alarma
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: Alarma de prueba"
                                    value={tituloAlarm}
                                    onChange={(e) => setTituloAlarm(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                                    Repetición
                                </label>
                                <select
                                    value={recurrenceTipo}
                                    onChange={(e) => setRecurrenceTipo(e.target.value as RecurrenceTipo | 'una_vez')}
                                    className="w-full bg-slate-950 border border-slate-800 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                >
                                    <option value="una_vez">Una sola vez</option>
                                    <option value="diaria">Diaria (todos los días)</option>
                                    <option value="semanal">Semanal (días concretos)</option>
                                    <option value="mensual">Mensual (día del mes)</option>
                                    <option value="anual">Anual (fecha del año)</option>
                                    <option value="intervalo">Intervalo (cada N minutos)</option>
                                </select>
                            </div>

                            {recurrenceTipo === 'una_vez' && (
                                <div>
                                    <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                                        Fecha y Hora Programada
                                    </label>
                                    <input
                                        type="datetime-local"
                                        required
                                        value={horaAlarm}
                                        onChange={(e) => setHoraAlarm(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                            )}

                            {(recurrenceTipo === 'diaria' || recurrenceTipo === 'semanal' ||
                                recurrenceTipo === 'mensual' || recurrenceTipo === 'anual') && (
                                <div>
                                    <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                                        Hora
                                    </label>
                                    <input
                                        type="time"
                                        required
                                        value={recurHora}
                                        onChange={(e) => setRecurHora(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                            )}

                            {(recurrenceTipo === 'semanal' || recurrenceTipo === 'intervalo') && (
                                <div>
                                    <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                                        Días de la semana
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {DIAS_SEMANA.map((dia) => {
                                            const active = recurDiasSemana.includes(dia.value);
                                            return (
                                                <button
                                                    key={dia.value}
                                                    type="button"
                                                    onClick={() => setRecurDiasSemana((prev) => active ? prev.filter((d) => d !== dia.value) : [...prev, dia.value])}
                                                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${active ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}
                                                >
                                                    {dia.short}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {recurrenceTipo === 'mensual' && (
                                <div>
                                    <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                                        Días del mes
                                    </label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {Array.from({ length: 31 }, (_, i) => i + 1).map((dia) => {
                                            const active = recurDiasMes.includes(dia);
                                            return (
                                                <button
                                                    key={dia}
                                                    type="button"
                                                    onClick={() => setRecurDiasMes((prev) => active ? prev.filter((d) => d !== dia) : [...prev, dia])}
                                                    className={`w-8 h-8 rounded-md text-xs font-medium border transition-colors ${active ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}
                                                >
                                                    {dia}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {recurrenceTipo === 'anual' && (
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Mes</label>
                                        <select
                                            value={recurAnioMes}
                                            onChange={(e) => setRecurAnioMes(Number(e.target.value))}
                                            className="w-full bg-slate-950 border border-slate-800 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                        >
                                            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                                <option key={m} value={m}>{MESES[m - 1]}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Día</label>
                                        <select
                                            value={recurAnioDia}
                                            onChange={(e) => setRecurAnioDia(Number(e.target.value))}
                                            className="w-full bg-slate-950 border border-slate-800 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                        >
                                            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                                                <option key={d} value={d}>{d}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {recurrenceTipo === 'intervalo' && (
                                <>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Desde</label>
                                            <input
                                                type="time"
                                                required
                                                value={recurHoraInicio}
                                                onChange={(e) => setRecurHoraInicio(e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-800 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Hasta</label>
                                            <input
                                                type="time"
                                                required
                                                value={recurHoraFin}
                                                onChange={(e) => setRecurHoraFin(e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-800 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                                            Cada (minutos)
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={1440}
                                            required
                                            value={recurIntervaloMinutos}
                                            onChange={(e) => setRecurIntervaloMinutos(Number(e.target.value))}
                                            className="w-full bg-slate-950 border border-slate-800 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                        />
                                    </div>
                                </>
                            )}

                            {recurrenceTipo !== 'una_vez' && (
                                <div>
                                    <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                                        Fecha fin (opcional)
                                    </label>
                                    <input
                                        type="date"
                                        value={recurFechaFin}
                                        onChange={(e) => setRecurFechaFin(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                                    Seleccionar Audio
                                </label>
                                <select
                                    required
                                    value={urlAudioAlarm}
                                    onChange={(e) => setUrlAudioAlarm(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                >
                                    <option value="" disabled>
                                        {loadingAudios ? 'Cargando audios...' : 'Selecciona un audio...'}
                                    </option>
                                    {audios.map((audio, index) => {
                                        const valueOption = audio.urlAudio;
                                        const labelOption = audio.nombre || audio.nombreArchivo || `Audio ${index + 1}`;
                                        const keyOption = audio.urlAudio || `key-${index}`;

                                        return (
                                            <option key={keyOption} value={valueOption}>
                                                {labelOption}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAlarmModalOpen(false)}
                                    className="px-4 py-2 text-sm text-slate-400 hover:text-white font-medium transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={createLoading}
                                    className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {createLoading ? 'Guardando...' : editingAlarm ? 'Actualizar Alarma' : 'Crear Alarma'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}