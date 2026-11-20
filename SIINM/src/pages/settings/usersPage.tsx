import React, { useEffect, useState, useMemo } from "react";
import {
  Users,
  Plus,
  Search,
  MoreVertical,
  PencilIcon,
  Trash2Icon,
  Wifi,
  WifiOff,
  RefreshCw,
  Shield,
  Stethoscope,
  UserCheck,
  Hospital,
  Mail,
  Lock,
  EyeIcon,
  EyeOffIcon,
  Copy,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "react-toastify";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TablePagination,
  usePaginatedTable,
} from "@/components/ui/table";
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { userRepository } from "@/db/repositories/user.repository";
import { clinicaRepository } from "@/db/repositories/clinica.repository";
import { useNetwork } from "@/context/NetworkContext";
import type { PerfilUsuario, UserRole } from "@/types/auth.types";
import type { Clinica } from "@/types/inventory.types";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import copy from "copy-to-clipboard";
import { useForm } from "react-hook-form";

export const UsersPage: React.FC = () => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>();
  const { isOnline } = useNetwork();
  const [users, setUsers] = useState<PerfilUsuario[]>([]);
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"todos" | UserRole>("todos");

  // Estados del modal de creación / edición
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [idAtEdit, setIdAtEdit] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  interface FormValues {
    nombre: string;
    email: string;
    contrasena?: string;
    clinicaId?: string;
    rol?: UserRole;
  }

  // Estados del modal de confirmación de eliminación
  const [isDialogDelete, setIsDialogDelete] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<PerfilUsuario | null>(null);
  const [confirmationName, setConfirmationName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Estados del modal de cambio de contraseña / clave temporal
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [userForPassword, setUserForPassword] = useState<PerfilUsuario | null>(
    null,
  );
  const [tempPassword, setTempPassword] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Cargar usuarios y clínicas
  const loadData = async () => {
    try {
      setLoading(true);
      const [usersData, clinicasData] = await Promise.all([
        userRepository.getAll(),
        clinicaRepository.getAll({ onlyActive: true }),
      ]);

      setUsers(usersData);
      setClinicas(clinicasData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al cargar datos";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Suscripción a cambios en tiempo real en la tabla de usuarios
    const unsubscribeUsers = userRepository.subscribe(() => {
      loadData();
    });

    return () => {
      unsubscribeUsers();
    };
  }, []);

  // Abrir diálogo para editar
  const openDialogToEdit = (user: PerfilUsuario) => {
    setIsEditing(true);
    setIdAtEdit(user.id);
    reset({
      nombre: user.nombre,
      email: user.email,
      contrasena: "",
      rol: user.rol,
      clinicaId: user.clinica_id ? String(user.clinica_id) : "",
    });

    setIsDialogOpen(true);
  };

  // Guardar (crear vía Edge Function o actualizar en Perfil_usuarios)
  const onSubmit = async (data: FormValues) => {
    try {
      setIsSubmitting(true);
      const targetClinicaId = data.clinicaId ? Number(data.clinicaId) : null;

      if (isEditing && idAtEdit) {
        await userRepository.update(idAtEdit, {
          nombre: data.nombre.trim(),
          email: data.email.trim(),
          rol: data.rol,
          clinica_id: targetClinicaId,
        });
        toast.success("Usuario actualizado correctamente");
      } else {
        await userRepository.create({
          nombre: data.nombre.trim(),
          email: data.email.trim(),
          password: (data.contrasena || "").trim(),
          rol: data.rol || "Personal",
          clinica_id: targetClinicaId,
        });
        toast.success("Usuario creado exitosamente con sus credenciales");
      }

      setIsDialogOpen(false);
      setIsEditing(false);
      setIdAtEdit(null);
      reset({
        nombre: "",
        email: "",
        contrasena: "",
        rol: "Personal",
        clinicaId: "",
      });
      await loadData();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al procesar usuario";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirmar eliminación de usuario
  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      setIsDeleting(true);
      await userRepository.delete(itemToDelete.id);
      toast.success("Usuario eliminado de la plataforma");
      setIsDialogDelete(false);
      setItemToDelete(null);
      setConfirmationName("");
      await loadData();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al eliminar usuario";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Activar o desactivar usuario en Supabase
  const toggleUserStatus = async (targetUser: PerfilUsuario) => {
    const newStatus = targetUser.activo === false ? true : false;
    try {
      await userRepository.updateStatus(
        targetUser.id,
        newStatus,
        targetUser.email,
      );
      toast.success(
        newStatus
          ? `Usuario "${targetUser.nombre}" activado`
          : `Usuario "${targetUser.nombre}" desactivado`,
      );
      await loadData();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Error al cambiar estatus del usuario";
      toast.error(msg);
    }
  };

  // Abrir modal de contraseña con clave temporal generada
  const openPasswordDialog = (targetUser: PerfilUsuario) => {
    setUserForPassword(targetUser);
    setTempPassword(userRepository.generateTemporaryPassword());
    setIsPasswordDialogOpen(true);
  };

  const regenerateTempPassword = () => {
    setTempPassword(userRepository.generateTemporaryPassword());
  };

  // Procesar asignación de clave temporal en Supabase (compatible con App de Escritorio Tauri)
  const handlePasswordReset = async (sendEmail: boolean) => {
    if (!userForPassword) return;
    if (!userForPassword.email) {
      toast.error("El usuario no cuenta con un correo electrónico registrado");
      return;
    }
    if (tempPassword.trim().length < 8) {
      toast.error("La clave temporal debe tener al menos 8 caracteres");
      return;
    }

    try {
      setIsResettingPassword(true);
      const { emailSent, passwordUpdatedRemotely } =
        await userRepository.resetPasswordWithSupabase({
          userId: userForPassword.id,
          email: userForPassword.email,
          tempPassword: tempPassword.trim(),
          sendEmail,
        });

      copy(tempPassword.trim());

      if (passwordUpdatedRemotely) {
        toast.success(
          emailSent
            ? "Clave temporal aplicada en Supabase, copiada al portapapeles y notificación enviada por correo."
            : "Clave temporal aplicada en Supabase y copiada al portapapeles. Compártela con el usuario para que ingrese desde la app.",
        );
      } else if (emailSent) {
        toast.warn(
          "Correo enviado y clave copiada. Nota: Para que la clave temporal funcione directo en la app de escritorio sin enlace web, ejecuta la función SQL admin_reset_user_password en Supabase.",
        );
      } else {
        toast.error(
          "No se encontró la función SQL admin_reset_user_password en Supabase. Ejecútala en el SQL Editor de Supabase para aplicar claves temporales sin correo.",
        );
        return;
      }

      setIsPasswordDialogOpen(false);
      setUserForPassword(null);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Error al solicitar el cambio de contraseña en Supabase";
      toast.error(msg);
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Filtro y búsqueda
  const filteredUsers = useMemo(() => {
    const term = search.toLowerCase().trim();
    return users.filter((u) => {
      const name = (u.nombre || "").toLowerCase();
      const mail = (u.email || "").toLowerCase();
      const clinicName = (u.clinica?.nombre || "").toLowerCase();
      const roleStr = (u.rol || "").toLowerCase();

      const matchesSearch =
        term === "" ||
        name.includes(term) ||
        mail.includes(term) ||
        clinicName.includes(term) ||
        roleStr.includes(term);

      if (roleFilter !== "todos") {
        return matchesSearch && u.rol === roleFilter;
      }
      return matchesSearch;
    });
  }, [users, search, roleFilter]);

  // Paginación con @tanstack/react-table (useTable)
  const { table, paginatedData: paginatedUsers } = usePaginatedTable(
    filteredUsers,
    10,
  );

  // Renderizar badge según rol
  const renderRoleBadge = (userRole: UserRole) => {
    switch (userRole) {
      case "admin":
        return (
          <Badge
            variant="outline"
            className="border-purple-200 bg-purple-50 text-purple-700 gap-1 text-[11px]"
          >
            <Shield className="w-3 h-3 text-purple-600" />
            <span>Administrador</span>
          </Badge>
        );
      case "encargado":
        return (
          <Badge
            variant="outline"
            className="border-blue-200 bg-blue-50 text-blue-700 gap-1 text-[11px]"
          >
            <Stethoscope className="w-3 h-3 text-blue-600" />
            <span>Encargado</span>
          </Badge>
        );
      case "Personal":
      default:
        return (
          <Badge
            variant="outline"
            className="border-slate-200 bg-slate-50 text-slate-700 gap-1 text-[11px]"
          >
            <UserCheck className="w-3 h-3 text-slate-600" />
            <span>Personal</span>
          </Badge>
        );
    }
  };

  // Manejo de clipboard
  const oncopy = (text: string) => {
    copy(text);
    toast("Elemento copiado al portapapeles");
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-wide uppercase m-0 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            Administración de Usuarios
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestión de cuentas, roles y asignación de clínicas (Autenticación
            con Supabase)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Indicador de conectividad */}
          {isOnline ? (
            <Badge
              variant="outline"
              className="border-emerald-200 bg-emerald-50 text-emerald-700 gap-1.5 py-1 text-xs"
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>Conectado (Supabase)</span>
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-amber-200 bg-amber-50 text-amber-700 gap-1.5 py-1 text-xs"
            >
              <WifiOff className="w-3.5 h-3.5" />
              <span>Sin conexión</span>
            </Badge>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="gap-1.5 h-8 text-xs border-slate-200 hover:bg-slate-50 text-slate-700"
            title="Recargar desde Supabase"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
            <span>Actualizar</span>
          </Button>

          {/* Diálogo para agregar o editar usuario */}
          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setIsEditing(false);
                setIdAtEdit(null);
                reset({
                  nombre: "",
                  email: "",
                  contrasena: "",
                  rol: "Personal",
                  clinicaId: "",
                });
              }
            }}
          >
            <DialogTrigger asChild>
              <Button
                className="shrink-0 self-start sm:self-auto gap-2"
                onClick={() => {
                  setIsEditing(false);
                  setIdAtEdit(null);
                  reset({
                    nombre: "",
                    email: "",
                    contrasena: "",
                    rol: "Personal",
                    clinicaId: "",
                  });
                }}
              >
                <Plus className="w-4 h-4" />
                <span>Añadir Usuario</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <DialogHeader>
                  <DialogTitle>
                    {isEditing ? "Editar Usuario" : "Añadir Nuevo Usuario"}
                  </DialogTitle>
                  <DialogDescription>
                    {isEditing
                      ? "Modifica los datos del perfil y clínica asignada."
                      : "Crea una cuenta en Supabase Auth y asigna su perfil."}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Nombre Completo *
                    </label>
                    <Input
                      placeholder="Ej. Dr. Roberto Gómez"
                      {...register("nombre", {
                        required: "El nombre es obligatorio",
                      })}
                      className={errors.nombre ? "border-red-700" : ""}
                    />
                    <p className="text-red-500 font-semibold text-xs m-1">
                      {errors.nombre?.message?.toString()}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>Correo Electrónico *</span>
                    </label>
                    <Input
                      type="email"
                      placeholder="usuario@salud.gob.mx"
                      {...register("email", {
                        required: "El email es requerido",
                        pattern: {
                          value: /^\S+@\S+\.\S+$/,
                          message: "email Invalido",
                        },
                      })}
                      className={errors.email ? "border-red-700" : ""}
                    />
                    <p className="text-red-500 font-semibold text-xs m-1">
                      {errors.email?.message?.toString()}
                    </p>
                  </div>

                  {!isEditing && (
                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Contraseña Inicial * (mínimo 6 caracteres)</span>
                      </label>
                      <InputGroup
                        className={errors.contrasena ? "border-red-700" : ""}
                      >
                        <InputGroupInput
                          type={isVisible ? "Text" : "password"}
                          placeholder="••••••••"
                          minLength={6}
                          {...register("contrasena", {
                            required: isEditing
                              ? false
                              : "La contraseña es obligatoria",
                            minLength: {
                              value: 8,
                              message: "Longitud minima de 8",
                            },
                          })}
                        />
                        <InputGroupAddon align="inline-end">
                          <Button
                            type="button"
                            variant="ghost"
                            className="hover:bg-transparent"
                            onClick={() => setIsVisible(!isVisible)}
                          >
                            {!isVisible ? <EyeIcon /> : <EyeOffIcon />}
                          </Button>
                        </InputGroupAddon>
                      </InputGroup>
                      <p className="text-red-500 text-xs font-semibold m-1">
                        {errors.contrasena?.message?.toString()}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Rol en el Sistema *
                      </label>
                      <select
                        className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        {...register("rol", {
                          required: "El rol es obligatorio",
                        })}
                      >
                        <option value="Personal">Personal</option>
                        <option value="encargado">Encargado</option>
                        <option value="admin">Administrador</option>
                      </select>
                      <p className="text-red-500 text-xs font-semibold">
                        {errors.rol?.message?.toString()}
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Hospital className="w-3.5 h-3.5 text-slate-400" />
                        <span>Clínica Asignada</span>
                      </label>
                      <select
                        className={`w-full h-9 rounded-md border ${errors.clinicaId ? "border-red-700" : "border-slate-200"} bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500`}
                        {...register("clinicaId", {
                          required: "La clinica es obligatoria",
                        })}
                      >
                        <option value="">Sin asignar / Global</option>
                        {clinicas.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre} {c.clues ? `(${c.clues})` : ""}
                          </option>
                        ))}
                      </select>
                      <p className="text-red-500 text-xs font-semibold m-1">
                        {errors.clinicaId?.message?.toString()}
                      </p>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      reset();
                    }}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting
                      ? "Guardando..."
                      : isEditing
                        ? "Actualizar Usuario"
                        : "Crear Usuario"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Diálogo de confirmación para eliminar */}
          <AlertDialog open={isDialogDelete} onOpenChange={setIsDialogDelete}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-red-600 font-bold">
                  ¿Eliminar usuario?
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <span className="block text-sm text-slate-600">
                    Esta acción eliminará el perfil de{" "}
                    <strong>"{itemToDelete?.nombre}"</strong> (
                    {itemToDelete?.email}).
                  </span>
                  <span className="block text-xs text-slate-500">
                    Escribe exactamente <strong>{itemToDelete?.nombre}</strong>{" "}
                    para confirmar:
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>

              <Input
                type="text"
                placeholder={itemToDelete?.nombre || ""}
                value={confirmationName}
                onChange={(e) => setConfirmationName(e.target.value)}
                className="text-xs"
              />

              <AlertDialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogDelete(false);
                    setItemToDelete(null);
                    setConfirmationName("");
                  }}
                  disabled={isDeleting}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={confirmDelete}
                  disabled={
                    isDeleting ||
                    confirmationName.trim() !==
                      (itemToDelete?.nombre || "").trim()
                  }
                  className="bg-red-600 hover:bg-red-700 text-white font-bold"
                >
                  {isDeleting ? "Eliminando..." : "Confirmar Eliminación"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Diálogo de cambio de contraseña / clave temporal con Supabase */}
          <Dialog
            open={isPasswordDialogOpen}
            onOpenChange={(open) => {
              setIsPasswordDialogOpen(open);
              if (!open) setUserForPassword(null);
            }}
          >
            <DialogContent className="w-[calc(100vw-2rem)] max-w-md overflow-hidden p-5 sm:p-6">
              <DialogHeader className="min-w-0 pr-6">
                <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <KeyRound className="w-5 h-5 text-blue-600 shrink-0" />
                  <span className="truncate">
                    Cambiar / Restablecer Contraseña
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs leading-relaxed wrap-break">
                  Genera una clave temporal de seguridad y envía el enlace de
                  restablecimiento a{" "}
                  <strong className="text-slate-700">
                    {userForPassword?.nombre}
                  </strong>{" "}
                  (<span className="break-all">{userForPassword?.email}</span>).
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2 min-w-0">
                <div className="min-w-0">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Clave Temporal de Seguridad (mín. 8 caracteres)
                  </label>
                  <div className="flex items-center gap-2 min-w-0">
                    <Input
                      type="text"
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      className="font-mono text-sm font-bold tracking-wider min-w-0 flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={regenerateTempPassword}
                      className="shrink-0"
                      title="Generar otra clave temporal"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => oncopy(tempPassword)}
                      className="shrink-0"
                      title="Copiar clave temporal"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 leading-relaxed wrap-break">
                    Al aplicar esta <strong>clave temporal</strong>, se copia a
                    tu portapapeles para que se la entregues al usuario. Cuando
                    el usuario inicie sesión en la aplicación de escritorio con
                    ella (o entre a <em>Cambiar contraseña</em>), el sistema lo
                    obligará automáticamente a definir su nueva contraseña
                    personal sin depender de enlaces web.
                  </p>
                </div>
              </div>

              <DialogFooter className="flex flex-col-reverse sm:flex-col gap-2 sm:space-x-0 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsPasswordDialogOpen(false);
                      setUserForPassword(null);
                    }}
                    disabled={isResettingPassword}
                    className="w-full text-xs"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handlePasswordReset(true)}
                    disabled={isResettingPassword}
                    className="w-full gap-1.5 text-xs"
                  >
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Aplicar y enviar correo</span>
                  </Button>
                </div>
                <Button
                  type="button"
                  onClick={() => handlePasswordReset(false)}
                  disabled={isResettingPassword}
                  className="w-full gap-1.5 text-xs h-10"
                >
                  <KeyRound className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {isResettingPassword
                      ? "Aplicando en Supabase..."
                      : "Aplicar clave temporal (Sin enlace web)"}
                  </span>
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <Card className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-2">
            Filtrar por Rol:
          </span>
          <Button
            size="sm"
            variant={roleFilter === "todos" ? "default" : "secondary"}
            onClick={() => setRoleFilter("todos")}
          >
            Todos ({users.length})
          </Button>
          <Button
            size="sm"
            variant={roleFilter === "admin" ? "default" : "secondary"}
            onClick={() => setRoleFilter("admin")}
          >
            Administradores ({users.filter((u) => u.rol === "admin").length})
          </Button>
          <Button
            size="sm"
            variant={roleFilter === "encargado" ? "default" : "secondary"}
            onClick={() => setRoleFilter("encargado")}
          >
            Encargados ({users.filter((u) => u.rol === "encargado").length})
          </Button>
          <Button
            size="sm"
            variant={roleFilter === "Personal" ? "default" : "secondary"}
            onClick={() => setRoleFilter("Personal")}
          >
            Personal ({users.filter((u) => u.rol === "Personal").length})
          </Button>
        </div>

        <div className="relative w-full md:w-80">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, correo, clínica o rol..."
            className="pr-9 h-9 text-xs"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </Card>

      {/* Tabla de Usuarios */}
      <Card className="overflow-hidden p-0 border border-slate-200/80">
        <Table>
          <TableHeader>
            <TableRow className="border-0 bg-gray-50">
              <TableHead className="text-gray-800">Usuario</TableHead>
              <TableHead className="text-gray-800">
                Correo Electrónico
              </TableHead>
              <TableHead className="text-gray-800">Rol</TableHead>
              <TableHead className="text-gray-800">Clínica Asignada</TableHead>
              <TableHead className="text-gray-800">Estatus</TableHead>
              <TableHead className="text-right">Operaciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-36 text-center text-slate-500 py-8"
                >
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
                  <p className="text-xs text-slate-500">
                    Cargando usuarios desde Supabase...
                  </p>
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-36 text-center text-slate-500 py-8"
                >
                  <p className="font-semibold text-sm text-slate-700 mb-1">
                    No se encontraron usuarios
                  </p>
                  <p className="text-xs text-slate-400">
                    Puedes dar de alta una nueva cuenta usando el botón "+
                    Añadir Usuario".
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              paginatedUsers.map((item) => {
                const isUserActive = item.activo !== false;
                return (
                  <TableRow
                    key={item.id}
                    className={`border-0 hover:bg-slate-50/70 transition-colors ${
                      !isUserActive ? "opacity-65 bg-slate-50/40" : ""
                    }`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                          {item.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm m-0">
                            {item.nombre}
                          </p>
                          <span className="text-[10px] text-slate-400 font-mono">
                            ID: {item.id.slice(0, 8)}...
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-xs font-mono text-slate-600">
                      <div className="flex flex-row items-center">
                        <p> {item.email || "---"} </p>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            oncopy(item.email);
                          }}
                        >
                          <Copy />
                        </Button>
                      </div>
                    </TableCell>

                    <TableCell>{renderRoleBadge(item.rol)}</TableCell>

                    <TableCell className="text-xs text-slate-600">
                      {item.clinica ? (
                        <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                          <Hospital className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span>{item.clinica.nombre}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">
                          Sin clínica asignada
                        </span>
                      )}
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          isUserActive
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-red-200 bg-red-50 text-red-700"
                        }
                      >
                        {isUserActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="dark:bg-white dark:border-gray-200">
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              onClick={() => openDialogToEdit(item)}
                              className="cursor-pointer dark:text-gray-800 hover:bg-gray-200 p-2 text-xs flex items-center"
                            >
                              <PencilIcon className="w-4 h-4 mr-2" />
                              <span>Editar</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => openPasswordDialog(item)}
                              className="cursor-pointer dark:text-gray-800 hover:bg-gray-200 p-2 text-xs flex items-center border-t border-slate-100"
                            >
                              <KeyRound className="w-4 h-4 mr-2 text-blue-600" />
                              <span>Cambiar contraseña</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => toggleUserStatus(item)}
                              className="cursor-pointer dark:text-gray-800 hover:bg-gray-200 p-2 text-xs flex items-center border-t border-slate-100"
                            >
                              {isUserActive ? (
                                <div className="flex items-center text-amber-600">
                                  <EyeOffIcon className="w-4 h-4 mr-2" />
                                  <span>Desactivar</span>
                                </div>
                              ) : (
                                <div className="flex items-center text-emerald-600">
                                  <EyeIcon className="w-4 h-4 mr-2" />
                                  <span>Activar</span>
                                </div>
                              )}
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              className="cursor-pointer dark:text-red-600 hover:bg-gray-200 p-2 text-xs flex items-center text-red-600 border-t border-slate-100"
                              onClick={() => {
                                setItemToDelete(item);
                                setConfirmationName("");
                                setIsDialogDelete(true);
                              }}
                            >
                              <Trash2Icon className="w-4 h-4 mr-2" />
                              <span>Eliminar</span>
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        {!loading && filteredUsers.length > 0 && (
          <TablePagination table={table} />
        )}
      </Card>
    </div>
  );
};
