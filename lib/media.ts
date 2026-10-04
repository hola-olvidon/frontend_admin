// lib/media.ts
import { api } from "@/lib/api";

export interface AudioItem {
  nombre: string; // Nombre visible/editable del audio (ej: "cancion.mp3")
  nombreArchivo: string; // Key (ej: "uuid-audio.mp3")
  urlAudio: string; // URL pública completa
}

export const mediaApi = {
  // GET /media/audios
  getAudios: async (): Promise<AudioItem[]> => {
    const res = await api.get<AudioItem[]>("/media/audios");
    return res.data;
  },

  // POST /media/upload-audio
  uploadAudio: async (
    file: File,
    nombre?: string,
  ): Promise<AudioItem> => {
    const formData = new FormData();
    formData.append("file", file);
    if (nombre?.trim()) {
      formData.append("nombre", nombre.trim());
    }

    const res = await api.post<AudioItem>("/media/upload-audio", formData, {
      headers: {
        "Content-Type": "multipart/form-data", // Axios manejará el boundary automáticamente
      },
    });
    return res.data;
  },

  // PATCH /media/audios/:fileKey
  renameAudio: async (
    fileKey: string,
    nombre: string,
  ): Promise<AudioItem> => {
    const res = await api.patch<AudioItem>(`/media/audios/${fileKey}`, { nombre });
    return res.data;
  },

  // DELETE /media/audios/:fileKey
  deleteAudio: async (
    fileKey: string,
  ): Promise<{ message: string; alarmasActualizadas: number }> => {
    const res = await api.delete(`/media/audios/${fileKey}`);
    return res.data;
  },
};
