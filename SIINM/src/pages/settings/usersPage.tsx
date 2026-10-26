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

export const UsersPage: React.FC = () => {
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
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<UserRole>("Personal");
  const [clinicaId, setClinicaId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados del modal de confirmación de eliminación
  const [isDialogDelete, setIsDialogDelete] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<PerfilUsuario | null>(null);
  const [confirmationName, setConfirmationName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Cargar usuarios y clínicas
  const loadData = async () => {
    try {
      setLoading(true);
      const [usersData, clinicasData] = await Promise.all([
        userRepository.getAll(),
        clinicaRepository.getAll(),
      ]);

      setUsers(usersData);
      setClinicas(clinicasData);
      console.log(clinicasData);
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

  // Limpiar campos del formulario
  const resetForm = () => {
    setIsEditing(false);
    setIdAtEdit(null);
    setNombre("");
    setEmail("");
    setPassword("");
    setRol("Personal");
    setClinicaId("");
  };

  // Abrir diálogo para editar
  const openDialogToEdit = (user: PerfilUsuario) => {
    setIsEditing(true);
    setIdAtEdit(user.id);
    setNombre(user.nombre);
    setEmail(user.email);
    setPassword("");
    setRol(user.rol);
    setClinicaId(user.clinica_id ? String(user.clinica_id) : "");
    setIsDialogOpen(true);
  };

  // Guardar (crear vía Edge Function o actualizar en Perfil_usuarios)
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!nombre.trim()) {
      toast.warn("El nombre es obligatorio");
      return;
    }
    if (!email.trim()) {
      toast.warn("El correo electrónico es obligatorio");
      return;
    }

    if (!isEditing && (!password || password.length < 6)) {
      toast.warn("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    try {
      setIsSubmitting(true);
      const targetClinicaId = clinicaId ? Number(clinicaId) : null;

      if (isEditing && idAtEdit) {
        await userRepository.update(idAtEdit, {
          nombre: nombre.trim(),
          email: email.trim(),
          rol,
          clinica_id: targetClinicaId,
        });
        toast.success("Usuario actualizado correctamente");
      } else {
        await userRepository.create({
          nombre: nombre.trim(),
          email: email.trim(),
          password,
          rol,
          clinica_id: targetClinicaId,
        });
        toast.success("Usuario creado exitosamente con sus credenciales");
      }

      setIsDialogOpen(false);
      resetForm();
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
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button className="shrink-0 self-start sm:self-auto gap-2">
                <Plus className="w-4 h-4" />
                <span>Añadir Usuario</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <form onSubmit={onSubmit} className="space-y-4">
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
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>Correo Electrónico *</span>
                    </label>
                    <Input
                      type="email"
                      placeholder="usuario@salud.gob.mx"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  {!isEditing && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Contraseña Inicial * (mínimo 6 caracteres)</span>
                      </label>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required={!isEditing}
                        minLength={6}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Rol en el Sistema *
                      </label>
                      <select
                        value={rol}
                        onChange={(e) => setRol(e.target.value as UserRole)}
                        className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      >
                        <option value="Personal">Personal</option>
                        <option value="encargado">Encargado</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Hospital className="w-3.5 h-3.5 text-slate-400" />
                        <span>Clínica Asignada</span>
                      </label>
                      <select
                        value={clinicaId}
                        onChange={(e) => setClinicaId(e.target.value)}
                        className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">Sin asignar / Global</option>
                        {clinicas.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre} {c.clues ? `(${c.clues})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
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
              <TableHead className="text-right">Operaciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={5}
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
                  colSpan={5}
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
              filteredUsers.map((item) => {
                return (
                  <TableRow
                    key={item.id}
                    className="border-0 hover:bg-slate-50/70 transition-colors"
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
                      {item.email || "---"}
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

                    <TableCell className="text-right">
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
                              className="cursor-pointer dark:text-gray-800 hover:bg-gray-100 p-2 text-xs flex items-center"
                            >
                              <PencilIcon className="w-4 h-4 mr-2" />
                              <span>Editar</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              className="cursor-pointer dark:text-gray-800 hover:bg-gray-100 p-2 text-xs flex items-center text-red-600 border-t border-slate-100"
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
      </Card>
    </div>
  );
};
