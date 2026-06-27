import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import { DbTable } from "../types";
import { X, Upload, Loader2, Image as ImageIcon, Link as LinkIcon, Trash } from "lucide-react";

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: DbTable;
  initialData: any;
  onSubmit: (data: any) => Promise<void>;
  lookups: {
    proyectos: any[];
    llamados: any[];
    locaciones: any[];
    crew: any[];
    shotlist: any[];
    ciudades: any[];
  };
}

export default function FormModal({
  isOpen,
  onClose,
  table,
  initialData,
  onSubmit,
  lookups,
}: FormModalProps) {
  const [formValues, setFormValues] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  // Storage upload states
  const [uploadingFiles, setUploadingFiles] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // List of previously uploaded files in the root of 'referencias' bucket
  const [rootFiles, setRootFiles] = useState<{ name: string; url: string; id: string }[]>([]);
  const [loadingRootFiles, setLoadingRootFiles] = useState(false);

  const fetchRootFiles = async () => {
    setLoadingRootFiles(true);
    try {
      const { data, error } = await supabase.storage
        .from("referencias")
        .list("", { limit: 150 });
      if (error) {
        console.error("Error listing root files:", error.message);
      } else if (data) {
        // Filter out folders/subfolders and empty/system assets
        const filesOnly = data
          .filter((item) => item.id !== null && item.name !== ".emptyFolderPlaceholder" && item.name !== "img" && item.name !== "llamados")
          .map((item) => {
            const { data: urlData } = supabase.storage
              .from("referencias")
              .getPublicUrl(item.name);
            return {
              name: item.name,
              url: urlData?.publicUrl || "",
              id: item.id || item.name,
            };
          });
        setRootFiles(filesOnly);
      }
    } catch (err) {
      console.error("Error fetching root files:", err);
    } finally {
      setLoadingRootFiles(false);
    }
  };

  useEffect(() => {
    if (isOpen && table === "proyectos") {
      fetchRootFiles();
    }
  }, [isOpen, table]);

  // Sync Form State with initialData
  useEffect(() => {
    if (initialData) {
      setFormValues({ ...initialData });
    } else {
      // Set table-specific defaults
      const defaults: any = {};
      if (table === "escenas" || table === "shotlist" || table === "crew" || table === "talento" || table === "pdr") {
        defaults.orden = 1;
      }
      if (table === "cliente_agencia") {
        defaults.tipo = "Cliente";
      }
      if (table === "llamados") {
        defaults.fecha = new Date().toISOString().split("T")[0];
      }
      setFormValues(defaults);
    }
    setErrorMsg("");
  }, [initialData, table, isOpen]);

  if (!isOpen) return null;

  // Handle standard input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    // Convert to proper types if numeric
    let parsedValue: any = value;
    if (type === "number") {
      parsedValue = value === "" ? "" : Number(value);
    } else if (name === "proyecto_id" || name === "llamado_id" || name === "locacion_id" || name === "crew_id" || name === "shotlist_id" || name === "ciudad_id") {
      parsedValue = value === "" ? null : Number(value);
    }

    setFormValues((prev: any) => ({
      ...prev,
      [name]: parsedValue,
    }));
  };

  // Submit trigger
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg("");
    try {
      await onSubmit(formValues);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Error al guardar el registro en Supabase");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Supabase Multi-Image Upload logic to bucket 'referencias'
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFiles(true);
    setUploadProgress("Subiendo imágenes...");
    const uploadedUrls: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(`Subiendo (${i + 1}/${files.length}): ${file.name}`);

        // Format clean, unique file name to prevent collision or URL issues
        const cleanName = `img/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;

        const { data, error } = await supabase.storage
          .from("referencias")
          .upload(cleanName, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (error) {
          throw new Error(`Error al subir ${file.name}: ${error.message}`);
        }

        // Fetch official public URL
        const { data: urlData } = supabase.storage
          .from("referencias")
          .getPublicUrl(cleanName);

        if (urlData?.publicUrl) {
          uploadedUrls.push(urlData.publicUrl);
        }
      }

      // Merge newly uploaded URLs into any existing comma-separated reference string
      const currentVal = formValues.referencia_urls || "";
      const currentList = currentVal ? currentVal.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
      const newList = [...currentList, ...uploadedUrls];
      
      setFormValues((prev: any) => ({
        ...prev,
        referencia_urls: newList.join(", "),
      }));

      setUploadProgress("¡Subida exitosa!");
      setTimeout(() => setUploadProgress(""), 2000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Error al subir imágenes al bucket 'referencias'");
    } finally {
      setUploadingFiles(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Helper to extract storage filename from Supabase public URL
  const getFileStoragePathFromUrl = (url: string) => {
    if (!url) return null;
    try {
      const marker = "/storage/v1/object/public/referencias/";
      const index = url.indexOf(marker);
      if (index !== -1) {
        return decodeURIComponent(url.slice(index + marker.length));
      }
      const parts = url.split("/");
      return decodeURIComponent(parts[parts.length - 1]);
    } catch (err) {
      console.error("Error parsing URL path:", err);
      return null;
    }
  };

  // Helper to delete a file from the 'referencias' bucket
  const deleteFileFromBucket = async (url: string) => {
    if (!url) return;
    const filename = getFileStoragePathFromUrl(url);
    if (!filename) return;

    try {
      const { error } = await supabase.storage
        .from("referencias")
        .remove([filename]);
      if (error) {
        console.warn("Could not delete from storage bucket:", error.message);
      } else {
        console.log("Deleted successfully from storage bucket:", filename);
      }
    } catch (err) {
      console.warn("Error deleting file from bucket:", err);
    }
  };

  // Single logo upload to bucket 'referencias' (storing directly in the root directory)
  const handleSingleUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFiles(true);
    setUploadProgress(`Subiendo logo...`);

    try {
      // If there was an existing image in this field from our bucket, we can delete it first
      const existingUrl = formValues[fieldName];
      if (existingUrl) {
        await deleteFileFromBucket(existingUrl);
      }

      const cleanName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;

      const { error } = await supabase.storage
        .from("referencias")
        .upload(cleanName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        throw new Error(`Error al subir ${file.name}: ${error.message}`);
      }

      const { data: urlData } = supabase.storage
        .from("referencias")
        .getPublicUrl(cleanName);

      if (urlData?.publicUrl) {
        setFormValues((prev: any) => ({
          ...prev,
          [fieldName]: urlData.publicUrl,
        }));
        await fetchRootFiles();
      }

      setUploadProgress("¡Subida exitosa!");
      setTimeout(() => setUploadProgress(""), 2000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Error al subir imagen");
    } finally {
      setUploadingFiles(false);
      e.target.value = "";
    }
  };

  // Remove a reference URL from comma-separated input list and delete from bucket
  const removeUrl = async (urlToRemove: string) => {
    await deleteFileFromBucket(urlToRemove);

    const currentVal = formValues.referencia_urls || "";
    const currentList = currentVal.split(",").map((s: string) => s.trim()).filter(Boolean);
    const updatedList = currentList.filter((url) => url !== urlToRemove);
    setFormValues((prev: any) => ({
      ...prev,
      referencia_urls: updatedList.join(", "),
    }));
  };

  // Helper lists of URLs to render preview cards
  const currentUrlsList = formValues.referencia_urls
    ? formValues.referencia_urls.split(",").map((s: string) => s.trim()).filter(Boolean)
    : [];

  // Helper to resolve title from dynamic data
  const getModalTitle = () => {
    const action = initialData ? "Editar" : "Crear";
    const labels: Record<DbTable, string> = {
      proyectos: "Proyecto",
      llamados: "Llamado",
      locaciones: "Locación",
      escenas: "Escena",
      crew: "Miembro del Crew",
      crew_llamado: "Conexión de Crew a Llamado",
      cliente_agencia: "Cliente / Agencia",
      talento: "Talento",
      pdr: "Entrada PDR (Plan de Rodaje)",
      shotlist: "Plano Shotlist",
    };
    return `${action} ${labels[table] || table}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-neutral-100">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50">
          <div>
            <h3 className="font-condensed font-bold text-2xl text-neutral-800 tracking-tight">
              {getModalTitle()}
            </h3>
            <p className="text-neutral-400 text-xs uppercase tracking-wider font-mono">Tabla: {table}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Scrollable Form */}
        <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg flex flex-col gap-1">
              <span className="font-semibold">Error de Supabase:</span>
              <p className="text-xs break-all">{errorMsg}</p>
              <p className="text-xs text-neutral-400 mt-1">Verifica que las claves foráneas existan y que los permisos no bloqueen la escritura.</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* ───── TABLA: PROYECTOS ───── */}
            {table === "proyectos" && (
              <>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Campaña / Nombre del Proyecto *</label>
                  <input
                    required
                    type="text"
                    name="campana"
                    value={formValues.campana || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder=""
                  />
                </div>
                <div className="col-span-1 flex flex-col gap-1">
                  <label className="block text-xs font-semibold text-neutral-500 uppercase">Logo Cliente (URL o Subida) *</label>
                  <div className="flex gap-2">
                    <input
                      required
                      type="text"
                      name="cliente"
                      value={formValues.cliente || ""}
                      onChange={handleChange}
                      className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                      placeholder="Ej: https://example.com/logo.png"
                    />
                    <label className="flex items-center justify-center p-2.5 bg-neutral-100 hover:bg-neutral-200 cursor-pointer rounded-lg border border-neutral-300 text-neutral-600 transition-colors shrink-0" title="Subir Logo Cliente">
                      <Upload className="w-5 h-5" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleSingleUpload(e, "cliente")}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {/* Select con archivos de raíz del bucket */}
                  <div className="mt-1">
                    <select
                      className="w-full border border-neutral-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-neutral-800 focus:outline-hidden bg-white text-neutral-600 cursor-pointer"
                      value={rootFiles.some(rf => rf.url === formValues.cliente) ? formValues.cliente : ""}
                      onChange={(e) => {
                        setFormValues((prev: any) => ({ ...prev, cliente: e.target.value }));
                      }}
                    >
                      <option value="">{loadingRootFiles ? "Cargando biblioteca..." : "-- Usar archivo de biblioteca (Raíz) --"}</option>
                      {rootFiles.map((file) => (
                        <option key={file.id} value={file.url}>
                          {file.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {formValues.cliente && formValues.cliente.startsWith("http") && (
                    <div className="flex items-center gap-2 p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs justify-between mt-1">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <img src={formValues.cliente} alt="Logo Cliente" className="w-10 h-10 object-contain rounded bg-white p-0.5 border" referrerPolicy="no-referrer" />
                        <span className="truncate font-mono text-neutral-500 max-w-[120px]">{formValues.cliente}</span>
                      </div>
                      <div className="flex gap-1 justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setFormValues((prev: any) => ({ ...prev, cliente: "" }));
                          }}
                          className="text-neutral-500 hover:text-neutral-700 p-1.5 hover:bg-neutral-100 rounded transition-colors"
                          title="Quitar logo de este proyecto (conservar archivo en biblioteca)"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const urlToDelete = formValues.cliente;
                            if (confirm("¿Estás seguro de que deseas eliminar este archivo de forma permanente de la biblioteca en Supabase? Esta acción no se puede deshacer.")) {
                              await deleteFileFromBucket(urlToDelete);
                              setFormValues((prev: any) => ({ ...prev, cliente: "" }));
                              await fetchRootFiles();
                            }
                          }}
                          className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded transition-colors"
                          title="Eliminar archivo permanentemente de la biblioteca en Supabase"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Productora</label>
                  <input
                    required
                    type="text"
                    name="productora"
                    value={formValues.productora || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: Gecko Films"
                  />
                </div>
                <div className="col-span-2 flex flex-col gap-1">
                  <label className="block text-xs font-semibold text-neutral-500 uppercase">Logo Productora (URL o Subida)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="logo_productora"
                      value={formValues.logo_productora || ""}
                      onChange={handleChange}
                      className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                      placeholder="Ej: https://example.com/logo.png"
                    />
                    <label className="flex items-center justify-center p-2.5 bg-neutral-100 hover:bg-neutral-200 cursor-pointer rounded-lg border border-neutral-300 text-neutral-600 transition-colors shrink-0" title="Subir Logo Productora">
                      <Upload className="w-5 h-5" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleSingleUpload(e, "logo_productora")}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {/* Select con archivos de raíz del bucket */}
                  <div className="mt-1">
                    <select
                      className="w-full border border-neutral-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-neutral-800 focus:outline-hidden bg-white text-neutral-600 cursor-pointer"
                      value={rootFiles.some(rf => rf.url === formValues.logo_productora) ? formValues.logo_productora : ""}
                      onChange={(e) => {
                        setFormValues((prev: any) => ({ ...prev, logo_productora: e.target.value }));
                      }}
                    >
                      <option value="">{loadingRootFiles ? "Cargando biblioteca..." : "-- Usar archivo de biblioteca (Raíz) --"}</option>
                      {rootFiles.map((file) => (
                        <option key={file.id} value={file.url}>
                          {file.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {formValues.logo_productora && formValues.logo_productora.startsWith("http") && (
                    <div className="flex items-center gap-2 p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs justify-between mt-1">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <img src={formValues.logo_productora} alt="Logo Productora" className="w-10 h-10 object-contain rounded bg-white p-0.5 border" referrerPolicy="no-referrer" />
                        <span className="truncate font-mono text-neutral-500 max-w-[200px]">{formValues.logo_productora}</span>
                      </div>
                      <div className="flex gap-1 justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setFormValues((prev: any) => ({ ...prev, logo_productora: "" }));
                          }}
                          className="text-neutral-500 hover:text-neutral-700 p-1.5 hover:bg-neutral-100 rounded transition-colors"
                          title="Quitar logo de este proyecto (conservar archivo en biblioteca)"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const urlToDelete = formValues.logo_productora;
                            if (confirm("¿Estás seguro de que deseas eliminar este archivo de forma permanente de la biblioteca en Supabase? Esta acción no se puede deshacer.")) {
                              await deleteFileFromBucket(urlToDelete);
                              setFormValues((prev: any) => ({ ...prev, logo_productora: "" }));
                              await fetchRootFiles();
                            }
                          }}
                          className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded transition-colors"
                          title="Eliminar archivo permanentemente de la biblioteca en Supabase"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Dirección Productora</label>
                  <input
                    type="text"
                    name="direccion_productora"
                    value={formValues.direccion_productora || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: Av. Principal 123, Oficina 4B"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Url Mapa Dirección (Google Maps)</label>
                  <input
                    type="text"
                    name="map_productora"
                    value={formValues.map_productora || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Url del mapa de la productora"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Color Cliente</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      name="color_cliente"
                      value={formValues.color_cliente || "#171717"}
                      onChange={handleChange}
                      className="w-10 h-10 border border-neutral-300 rounded-lg p-0.5 cursor-pointer"
                    />
                    <input
                      type="text"
                      name="color_cliente"
                      value={formValues.color_cliente || ""}
                      onChange={handleChange}
                      className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                      placeholder="#HEX"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Color Campaña</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      name="color_campana"
                      value={formValues.color_campana || "#ea580c"}
                      onChange={handleChange}
                      className="w-10 h-10 border border-neutral-300 rounded-lg p-0.5 cursor-pointer"
                    />
                    <input
                      type="text"
                      name="color_campana"
                      value={formValues.color_campana || ""}
                      onChange={handleChange}
                      className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                      placeholder="#HEX"
                    />
                  </div>
                </div>
              </>
            )}

            {/* ───── TABLA: LLAMADOS ───── */}
            {table === "llamados" && (
              <>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Proyecto Relacionado *</label>
                  <select
                    required
                    name="proyecto_id"
                    value={formValues.proyecto_id || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                  >
                    <option value="">-- Seleccionar Proyecto --</option>
                    {lookups.proyectos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.campana}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Día de Días</label>
                  <input
                    type="text"
                    name="d_o_d"
                    value={formValues.d_o_d || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: Día 1 de 2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Fecha del Llamado *</label>
                  <input
                    required
                    type="date"
                    name="fecha"
                    value={formValues.fecha || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Hora General de Llamado</label>
                  <input
                    type="text"
                    name="llamado_hora"
                    value={formValues.llamado_hora || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: 07:00 AM"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Lugar del Llamado</label>
                  <input
                    type="text"
                    name="lugar_llamado"
                    value={formValues.lugar_llamado || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: EN LOCACIÓN, EN ESTUDIO"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Complemento Lluvia</label>
                  <input
                    type="text"
                    name="lluvia_c"
                    value={formValues.lluvia_c || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: Lluvias aisladas"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Ciudad</label>
                  <select
                    name="ciudad_id"
                    value={formValues.ciudad_id ?? ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden bg-white font-medium"
                  >
                    <option value="">-- Seleccione Ciudad --</option>
                    {(lookups.ciudades || []).map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.Nombre || c.nombre || `Ciudad #${c.id}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Horario Desayuno</label>
                  <input
                    type="text"
                    name="desayuno"
                    value={formValues.desayuno || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: 07:15"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Horario Almuerzo</label>
                  <input
                    type="text"
                    name="almuerzo"
                    value={formValues.almuerzo || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: 14:00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Horario Cena (Si aplica)</label>
                  <input
                    type="text"
                    name="cena"
                    value={formValues.cena || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: 21:00"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Notas Generales del Llamado</label>
                  <textarea
                    rows={3}
                    name="notas"
                    value={formValues.notas || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: Clima frío, traer ropa de abrigo relevante"
                  ></textarea>
                </div>
              </>
            )}

            {/* ───── TABLA: LOCACIONES ───── */}
            {table === "locaciones" && (
              <>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Nombre Locación *</label>
                  <input
                    required
                    type="text"
                    name="locacion"
                    value={formValues.locacion || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: Estudio San Bernardo"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Dirección Locación</label>
                  <input
                    type="text"
                    name="direccion_loc"
                    value={formValues.direccion_loc || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: Calle Gran Avenida #400"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Dirección URL Locación (Google Maps)</label>
                  <input
                    type="text"
                    name="url_loc"
                    value={formValues.url_loc || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: https://maps.app.goo.gl/..."
                  />
                </div>
                <hr className="col-span-2 border-neutral-100 my-2" />
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Centro Médico Cercano</label>
                  <input
                    type="text"
                    name="centro_medico"
                    value={formValues.centro_medico || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: Hospital Clínico Universidad"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Dirección Centro Médico</label>
                  <input
                    type="text"
                    name="direccion_med"
                    value={formValues.direccion_med || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: Av. Alameda 456"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Url Mapa Centro Médico (Google Maps)</label>
                  <input
                    type="text"
                    name="url_med"
                    value={formValues.url_med || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: https://maps.google.com/..."
                  />
                </div>
              </>
            )}

            {/* ───── TABLA: ESCENAS ───── */}
            {table === "escenas" && (
              <>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Llamado Relacionado *</label>
                  <select
                    required
                    name="llamado_id"
                    value={formValues.llamado_id || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                  >
                    <option value="">-- Seleccionar Llamado --</option>
                    {lookups.llamados.map((ll) => (
                      <option key={ll.id} value={ll.id}>
                        {ll.proyecto_id_campana || `Proyecto #${ll.proyecto_id}`} ({ll.d_o_d || "Día único"})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Escena</label>
                  <input
                    type="text"
                    name="escena"
                    value={formValues.escena || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Nombre de la escena"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Orden de Rodaje *</label>
                  <input
                    required
                    type="number"
                    name="orden"
                    value={formValues.orden === undefined ? "" : formValues.orden}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: 1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Horario Escena RTS</label>
                  <input
                    type="text"
                    name="hora"
                    value={formValues.hora || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: 08:30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Locación Asociada</label>
                  <select
                    name="locacion_id"
                    value={formValues.locacion_id || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                  >
                    <option value="">-- Sin Locación / Ver Locaciones --</option>
                    {lookups.locaciones.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.locacion}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Interior / Exterior</label>
                  <select
                    name="int_ext"
                    value={formValues.int_ext || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                  >
                    <option value="">-- Sin Definir --</option>
                    <option value="INT">INT (Interior)</option>
                    <option value="EXT">EXT (Exterior)</option>
                    <option value="INT/EXT">INT/EXT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Día / Noche</label>
                  <select
                    name="d_n"
                    value={formValues.d_n || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                  >
                    <option value="">-- Sin Definir --</option>
                    <option value="D">D (Día)</option>
                    <option value="N">N (Noche)</option>
                    <option value="ATARDECER">Atardecer</option>
                    <option value="AMANECER">Amanecer</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Nombres de Cast</label>
                  <input
                    type="text"
                    name="cast_nombres"
                    value={formValues.cast_nombres || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: María, Pedro, Extras"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Descripción de la Escena</label>
                  <textarea
                    rows={2}
                    name="descripcion"
                    value={formValues.descripcion || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: El protagonista entra corriendo con prisa y halla las llaves."
                  ></textarea>
                </div>
              </>
            )}

            {/* ───── TABLA: CREW (PERSONAL GENERAL) ───── */}
            {table === "crew" && (
              <>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Nombre Completo *</label>
                  <input
                    required
                    type="text"
                    name="nombre"
                    value={formValues.nombre || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: Daniel Gómez"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Departamento</label>
                  <input
                    type="text"
                    name="departamento"
                    value={formValues.departamento || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: Producción, Cámara, Vestuario"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Cargo</label>
                  <input
                    type="text"
                    name="cargo"
                    value={formValues.cargo || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: Foquista, Gaffer, Asistente"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Celular de Contacto</label>
                  <input
                    type="text"
                    name="celular"
                    value={formValues.celular || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: +569 1234 5678"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Hora de llamado</label>
                  <input
                    type="text"
                    name="llamado_hora"
                    value={formValues.llamado_hora || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: 07:00 AM"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Orden (vacío)</label>
                  <input
                    type="number"
                    name="orden"
                    value={formValues.orden === undefined ? "" : formValues.orden}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: 1"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Notas Personales</label>
                  <input
                    type="text"
                    name="notas"
                    value={formValues.notas || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: Opción vegetariana"
                  />
                </div>
              </>
            )}

            {/* ───── TABLA: CREW_LLAMADO (VÍNCULO CREW EN LLAMADOS) ───── */}
            {table === "crew_llamado" && (
              <>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Llamado Relacionado *</label>
                  <select
                    required
                    name="llamado_id"
                    value={formValues.llamado_id || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                  >
                    <option value="">-- Seleccionar Llamado --</option>
                    {lookups.llamados.map((ll) => (
                      <option key={ll.id} value={ll.id}>
                        {ll.proyecto_id_campana || `Proyecto #${ll.proyecto_id}`} ({ll.d_o_d || "Día único"})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Miembro del Crew *</label>
                  <select
                    required
                    name="crew_id"
                    value={formValues.crew_id || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                  >
                    <option value="">-- Seleccionar Personal --</option>
                    {[...lookups.crew].sort((a, b) => (a.id || 0) - (b.id || 0)).map((cr) => (
                      <option key={cr.id} value={cr.id}>
                        (#{cr.id}) {cr.nombre} [{cr.cargo || cr.departamento || "Sin Cargo"}]
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Orden (vacío)</label>
                  <input
                    type="number"
                    name="orden"
                    value={formValues.orden === undefined ? "" : formValues.orden}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: 1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Prioridad en Cabecera</label>
                  <input
                    type="number"
                    name="prioridad"
                    value={formValues.prioridad === undefined || formValues.prioridad === null ? "" : formValues.prioridad}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: 1 (Ejecutivo), 2 (Dir)"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Notas (específicas del llamado)</label>
                  <input
                    type="text"
                    name="notas"
                    value={formValues.notas || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: Opción vegetariana solo este día"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Hora Llamado (específica del llamado)</label>
                  <input
                    type="text"
                    name="hora_llamado"
                    value={formValues.hora_llamado || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: 07:00"
                  />
                </div>
              </>
            )}

            {/* ───── TABLA: CLIENTE_AGENCIA ───── */}
            {table === "cliente_agencia" && (
              <>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Llamado Asociado *</label>
                  <select
                    required
                    name="llamado_id"
                    value={formValues.llamado_id || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                  >
                    <option value="">-- Seleccionar Llamado --</option>
                    {lookups.llamados.map((ll) => (
                      <option key={ll.id} value={ll.id}>
                        {ll.proyecto_id_campana || `Proyecto #${ll.proyecto_id}`} ({ll.d_o_d || "Día único"})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Tipo de Contacto *</label>
                  <select
                    required
                    name="tipo"
                    value={formValues.tipo || "Cliente"}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                  >
                    <option value="Cliente">Cliente</option>
                    <option value="Agencia">Agencia</option>
                    <option value="Productora Ejecutiva">Productora Ejecutiva</option>
                    <option value="Invitado">Invitado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Nombre Completo *</label>
                  <input
                    required
                    type="text"
                    name="nombre"
                    value={formValues.nombre || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: Felipe Martínez"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Empresa / Marca</label>
                  <input
                    type="text"
                    name="empresa"
                    value={formValues.empresa || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder=""
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Horario en Locación / Set</label>
                  <input
                    type="text"
                    name="horario_loc"
                    value={formValues.horario_loc || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: 10:00 AM"
                  />
                </div>
              </>
            )}

            {/* ───── TABLA: TALENTO (REPARTO) ───── */}
            {table === "talento" && (
              <>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Llamado Asociado *</label>
                  <select
                    required
                    name="llamado_id"
                    value={formValues.llamado_id || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                  >
                    <option value="">-- Seleccionar Llamado --</option>
                    {lookups.llamados.map((ll) => (
                      <option key={ll.id} value={ll.id}>
                        {ll.proyecto_id_campana || `Proyecto #${ll.proyecto_id}`} ({ll.d_o_d || "Día único"})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Nombre Completo *</label>
                  <input
                    required
                    type="text"
                    name="nombre"
                    value={formValues.nombre || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: Sofía Vergara"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Rol / Personaje</label>
                  <input
                    type="text"
                    name="rol"
                    value={formValues.rol || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: Protagonista / Madre"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Hora de llamado</label>
                  <input
                    type="text"
                    name="llamado_hora"
                    value={formValues.llamado_hora || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: 08:30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Locación de llamado</label>
                  <select
                    name="locacion_id"
                    value={formValues.locacion_id || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                  >
                    <option value="">-- Sin Locación --</option>
                    {lookups.locaciones.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.locacion}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Hora en set</label>
                  <input
                    type="text"
                    name="en_set"
                    value={formValues.en_set || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: 09:30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Status de trabajo</label>
                  <input
                    type="text"
                    name="w_status"
                    value={formValues.w_status || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: SW, W, WF, SWF"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Orden (vacío)</label>
                  <input
                    required
                    type="number"
                    name="orden"
                    value={formValues.orden === undefined ? "" : formValues.orden}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: 1"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Notas de Talento</label>
                  <input
                    type="text"
                    name="notas"
                    value={formValues.notas || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: Alérgias, condiciones especiales"
                  />
                </div>
              </>
            )}

            {/* ───── TABLA: PDR (PAUTA DE RODAJE) ───── */}
            {table === "pdr" && (
              <>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Llamado Asociado *</label>
                  <select
                    required
                    name="llamado_id"
                    value={formValues.llamado_id || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                  >
                    <option value="">-- Seleccionar Llamado --</option>
                    {lookups.llamados.map((ll) => (
                      <option key={ll.id} value={ll.id}>
                        {ll.proyecto_id_campana || `Proyecto #${ll.proyecto_id}`} ({ll.d_o_d || "Día único"})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Plano Shotlist Asociado *</label>
                  <select
                    required
                    name="shotlist_id"
                    value={formValues.shotlist_id || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                  >
                    <option value="">
                      {!formValues.llamado_id 
                        ? "-- Selecciona primero el llamado asociado --" 
                        : "-- Seleccionar Shotlist --"}
                    </option>
                    {(() => {
                      const selectedLlamado = lookups.llamados.find(ll => Number(ll.id) === Number(formValues.llamado_id));
                      const selectedProyectoId = selectedLlamado ? Number(selectedLlamado.proyecto_id) : null;
                      const filteredList = selectedProyectoId
                        ? lookups.shotlist.filter(sh => Number(sh.proyecto_id) === Number(selectedProyectoId))
                        : [];

                      return [...filteredList]
                        .sort((a, b) => {
                          const escComp = (a.esc || "").localeCompare(b.esc || "", undefined, { numeric: true, sensitivity: "base" });
                          if (escComp !== 0) return escComp;
                          return (a.plano || "").localeCompare(b.plano || "", undefined, { numeric: true, sensitivity: "base" });
                        })
                        .map((sh) => (
                          <option key={sh.id} value={sh.id}>
                            Esc: {sh.esc || "S/E"} | Plano: {sh.plano || "S/P"} - {sh.descripcion?.substring(0, 40) || "Sin descripción"}
                          </option>
                        ));
                    })()}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Orden Correlativo PDR *</label>
                  <input
                    required
                    type="number"
                    name="orden"
                    value={formValues.orden === undefined ? "" : formValues.orden}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: 1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Duración Estimada (Minutos)</label>
                  <input
                    type="number"
                    name="duracion_min"
                    value={formValues.duracion_min === undefined ? "" : formValues.duracion_min}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: 30"
                  />
                </div>
              </>
            )}

            {/* ───── TABLA: SHOTLIST ───── */}
            {table === "shotlist" && (
              <>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Proyecto *</label>
                  <select
                    required
                    name="proyecto_id"
                    value={formValues.proyecto_id || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                  >
                    <option value="">-- Seleccionar Proyecto --</option>
                    {lookups.proyectos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.campana}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Escena (Nº)</label>
                  <input
                    type="text"
                    name="esc"
                    value={formValues.esc || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: 1A"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Plano (Nº)</label>
                  <input
                    type="text"
                    name="plano"
                    value={formValues.plano || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: Número de plano"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Orden del Plano *</label>
                  <input
                    required
                    type="number"
                    name="orden"
                    value={formValues.orden === undefined ? "" : formValues.orden}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: 1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Locación</label>
                  <select
                    name="locacion_id"
                    value={formValues.locacion_id || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                  >
                    <option value="">-- Seleccionar Locación --</option>
                    {lookups.locaciones.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.locacion}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Prep Nº (Shotlister)</label>
                  <input
                    type="text"
                    name="prep"
                    value={formValues.prep || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: Número correspondiente en Shotlister"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Descripción de la Toma</label>
                  <textarea
                    rows={2}
                    name="descripcion"
                    value={formValues.descripcion || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: Traveling lateral de izquierda a derecha siguiendo el producto..."
                  ></textarea>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Cast IDs</label>
                  <input
                    type="text"
                    name="cast_ids"
                    value={formValues.cast_ids || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: 1, 2, B"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Cast Nombres</label>
                  <input
                    type="text"
                    name="cast_nombres"
                    value={formValues.cast_nombres || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: Juan, Doble de Acción, Extras"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Notas Adicionales del Plano</label>
                  <input
                    type="text"
                    name="notas"
                    value={formValues.notas || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
                    placeholder="Ej: Grabación en timelapse"
                  />
                </div>

                {/* SPECIAL FIELD: REFERENCIA_URLS CON SUBIDA A BUCKET "REFERENCIAS" */}
                <div className="col-span-2 border-t border-neutral-100 pt-4 mt-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wide">
                      Imágenes de Referencia (URLs separadas por comas)
                    </label>
                    <span className="text-neutral-400 text-xs font-mono">Bucket: "referencias"</span>
                  </div>

                  {/* Manual Textbox field */}
                  <textarea
                    rows={2}
                    name="referencia_urls"
                    value={formValues.referencia_urls || ""}
                    onChange={handleChange}
                    className="w-full border border-neutral-300 rounded-lg p-2.5 text-xs font-mono focus:ring-2 focus:ring-neutral-800 focus:outline-hidden mb-3 bg-neutral-50"
                    placeholder="Urls separadas por coma..."
                  ></textarea>

                  {/* SUPABASE STORAGE BUCKET UPLOADER */}
                  <div className="border-2 border-dashed border-neutral-300 rounded-xl p-5 hover:border-neutral-400 transition-colors bg-neutral-0 flex flex-col items-center justify-center text-center">
                    <input
                      type="file"
                      id="bucket-upload"
                      ref={fileInputRef}
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploadingFiles}
                      className="hidden"
                    />
                    
                    {uploadingFiles ? (
                      <div className="flex flex-col items-center gap-2 py-2">
                        <Loader2 className="w-8 h-8 text-neutral-700 animate-spin" />
                        <span className="text-sm font-semibold text-neutral-700">{uploadProgress}</span>
                        <span className="text-xs text-neutral-400">Por favor, no cierres el modal.</span>
                      </div>
                    ) : (
                      <label htmlFor="bucket-upload" className="cursor-pointer flex flex-col items-center gap-2 py-1 w-full h-full">
                        <Upload className="w-8 h-8 text-neutral-500" />
                        <span className="text-sm font-semibold text-neutral-700">Subir imágenes de referencia</span>
                        <p className="text-xs text-neutral-400 max-w-xs">
                          Haz clic o arrastra fotos aquí. Se subirán automáticamente al bucket <code className="font-mono bg-neutral-150 p-0.5 rounded text-neutral-800">referencias</code> y se guardarán sus URLs públicas.
                        </p>
                      </label>
                    )}
                  </div>

                  {/* Reference URLs Previews */}
                  {currentUrlsList.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-neutral-500 uppercase mb-2">Previsualización de referencias ({currentUrlsList.length}):</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {currentUrlsList.map((url, index) => {
                          return (
                            <div key={index} className="group relative border border-neutral-200 rounded-lg overflow-hidden bg-neutral-50 flex flex-col justify-between h-40 shadow-xs sm:h-32">
                              {/* Image box */}
                              <div className="flex-1 bg-neutral-100 flex items-center justify-center overflow-hidden">
                                <img
                                  src={url}
                                  alt={`Ref ${index + 1}`}
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    // If URL is not renderable or private
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                />
                              </div>
                              {/* Url link details */}
                              <div className="p-1 px-2 flex items-center justify-between bg-white border-t border-neutral-100">
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-neutral-500 hover:text-neutral-800 font-mono truncate max-w-[80%] flex items-center gap-1"
                                >
                                  <LinkIcon className="w-3 h-3 decrease-shrink-0" />
                                  Ver origen
                                </a>
                                <button
                                  type="button"
                                  onClick={() => removeUrl(url)}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded-sm transition-colors"
                                  title="Quitar referencia del listado"
                                >
                                  <Trash className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-neutral-100 flex items-center justify-end gap-3 bg-neutral-50">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting || uploadingFiles}
            className="px-4 py-2 border border-neutral-300 hover:bg-neutral-100 text-neutral-700 rounded-lg text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleFormSubmit}
            disabled={isSubmitting || uploadingFiles}
            className="flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 text-white font-semibold px-5 py-2 rounded-lg text-sm shadow-md hover:shadow-lg transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Guardando...
              </>
            ) : (
              "Guardar Registro"
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
