import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server";
import { corsHeaders as supabaseCorsHeaders } from "npm:@supabase/supabase-js/cors";

const corsHeaders = {
  ...supabaseCorsHeaders,
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json; charset=utf-8",
};
const respond = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });
const text = (value: unknown, max = 160) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const authenticatedHandler = withSupabase(
  { auth: "user" },
  async (request, ctx) => {
    if (request.method === "OPTIONS")
      return new Response("ok", { headers: corsHeaders });
    if (request.method !== "POST")
      return respond(405, { error: "Método no permitido." });

    try {
      const userClient = ctx.supabase;
      const service = ctx.supabaseAdmin;
      const actorId = ctx.userClaims?.id;
      if (!actorId)
        return respond(401, {
          error: "La sesión venció. Inicia sesión nuevamente.",
        });

      const { data: actor, error: actorError } = await userClient
        .from("user_profiles")
        .select("id,organization_id,branch_id,role_id,is_active")
        .eq("id", actorId)
        .maybeSingle();
      if (
        actorError ||
        !actor?.is_active ||
        !actor.organization_id ||
        !actor.branch_id
      )
        return respond(403, {
          error: "No tienes un perfil administrativo activo.",
        });
      const { data: permitted, error: permissionError } = await userClient.rpc(
        "has_permission",
        { permission_code: "users.manage" },
      );
      if (permissionError || permitted !== true)
        return respond(403, {
          error: "No tienes permiso para administrar usuarios.",
        });

      const body = (await request.json().catch(() => null)) as {
        operation?: unknown;
        user?: Record<string, unknown>;
      } | null;
      const operation = text(body?.operation, 20);
      const payload = body?.user ?? {};
      if (operation === "list") {
        const { data: profiles, error } = await service
          .from("user_profiles")
          .select("id,organization_id,branch_id")
          .eq("organization_id", actor.organization_id)
          .eq("branch_id", actor.branch_id);
        if (error)
          return respond(500, {
            error: "No se pudieron consultar los usuarios.",
          });
        const ids = new Set((profiles ?? []).map((profile) => profile.id));
        const users: Array<{ id: string; email: string }> = [];
        for (let page = 1; page <= 20; page += 1) {
          const { data, error: listError } = await service.auth.admin.listUsers(
            { page, perPage: 100 },
          );
          if (listError)
            return respond(500, {
              error: "No se pudieron consultar las cuentas.",
            });
          for (const user of data.users)
            if (ids.has(user.id))
              users.push({ id: user.id, email: user.email ?? "" });
          if (data.users.length < 100) break;
        }
        return respond(200, { users });
      }

      if (operation === "self_update") {
        const fullName = text(payload.fullName, 120);
        const password =
          typeof payload.password === "string" ? payload.password : "";
        if (!fullName)
          return respond(400, {
            error:
              "El nombre es obligatorio y debe tener máximo 120 caracteres.",
          });
        if (password && password.length < 12)
          return respond(400, {
            error: "La contraseña debe tener al menos 12 caracteres.",
          });

        const { data: current, error: currentError } =
          await userClient.auth.getUser();
        if (currentError || current.user?.id !== actorId)
          return respond(401, {
            error: "La sesión venció. Inicia sesión nuevamente.",
          });
        const authChanges = {
          ...(password ? { password } : {}),
          data: { ...current.user.user_metadata, full_name: fullName },
        };
        const { error: authUpdateError } =
          await userClient.auth.updateUser(authChanges);
        if (authUpdateError)
          return respond(400, {
            error:
              "No se pudo actualizar la cuenta. Revisa la contraseña y vuelve a intentarlo.",
          });

        const { error: profileUpdateError } = await service
          .from("user_profiles")
          .update({ full_name: fullName })
          .eq("id", actorId)
          .eq("organization_id", actor.organization_id)
          .eq("branch_id", actor.branch_id);
        if (profileUpdateError)
          return respond(500, {
            error:
              "Se actualizó la cuenta de acceso, pero no el nombre del perfil. Vuelve a guardar el nombre desde Mi cuenta.",
          });

        const { error: auditError } = await service.from("audit_logs").insert({
          organization_id: actor.organization_id,
          branch_id: actor.branch_id,
          user_id: actor.id,
          role_id: actor.role_id,
          action: "user.self_updated",
          entity_type: "user_profile",
          entity_id: actor.id,
          new_value: {
            full_name: fullName,
            password_changed: Boolean(password),
          },
        });
        if (auditError)
          return respond(500, {
            error:
              "La cuenta se actualizó, pero no se pudo registrar la auditoría. Contacta al administrador.",
          });
        return respond(200, { ok: true });
      }

      const targetId = text(payload.id, 64);
      if (operation === "delete") {
        if (!uuidPattern.test(targetId))
          return respond(400, { error: "Identificador de usuario inválido." });
        if (targetId === actor.id)
          return respond(400, {
            error: "No puedes eliminar tu propia cuenta.",
          });
        const { data: target } = await service
          .from("user_profiles")
          .select("id,organization_id,branch_id,role_id")
          .eq("id", targetId)
          .eq("organization_id", actor.organization_id)
          .eq("branch_id", actor.branch_id)
          .maybeSingle();
        if (!target)
          return respond(404, {
            error: "No se encontró el usuario en esta sucursal.",
          });
        const { error: authUpdateError } =
          await service.auth.admin.updateUserById(targetId, {
            ban_duration: "876000h",
          });
        if (authUpdateError)
          return respond(400, { error: "No se pudo desactivar la cuenta." });
        const { error: profileUpdateError } = await service
          .from("user_profiles")
          .update({ is_active: false })
          .eq("id", targetId)
          .eq("organization_id", actor.organization_id)
          .eq("branch_id", actor.branch_id);
        if (profileUpdateError) {
          await service.auth.admin.updateUserById(targetId, {
            ban_duration: "none",
          });
          return respond(400, {
            error: "No se pudo desactivar el perfil; el acceso se restauró.",
          });
        }
        await service.from("audit_logs").insert({
          organization_id: actor.organization_id,
          branch_id: actor.branch_id,
          user_id: actor.id,
          role_id: actor.role_id,
          action: "user.disabled",
          entity_type: "user_profile",
          entity_id: targetId,
        });
        return respond(200, { ok: true, disabled: true });
      }

      if (operation !== "create" && operation !== "update")
        return respond(400, { error: "Operación inválida." });
      const isCreate = operation === "create";
      if (!isCreate && (!uuidPattern.test(targetId) || targetId === actor.id))
        return respond(400, {
          error: "No puedes editar tu propia cuenta desde este panel.",
        });
      const email = text(payload.email, 254).toLowerCase();
      const fullName = text(payload.fullName, 120);
      const employeeNumber = text(payload.employeeNumber, 40) || null;
      const branchId = text(payload.branchId, 64);
      const roleId = text(payload.roleId, 64);
      const password =
        typeof payload.password === "string" ? payload.password : "";
      const isActive = payload.isActive === true;
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        !fullName ||
        !uuidPattern.test(branchId) ||
        !uuidPattern.test(roleId)
      )
        return respond(400, {
          error: "Revisa nombre, correo, sucursal y rol.",
        });
      if (isCreate && password.length < 12)
        return respond(400, {
          error: "La contraseña inicial debe tener al menos 12 caracteres.",
        });
      if (!isCreate && password && password.length < 12)
        return respond(400, {
          error: "La contraseña debe tener al menos 12 caracteres.",
        });
      if (branchId !== actor.branch_id)
        return respond(403, {
          error: "Solo puedes asignar usuarios a tu sucursal.",
        });

      const [{ data: branch }, { data: role }, { data: canManageRoles }] =
        await Promise.all([
          service
            .from("branches")
            .select("id")
            .eq("id", branchId)
            .eq("organization_id", actor.organization_id)
            .eq("is_active", true)
            .maybeSingle(),
          service
            .from("roles")
            .select("id,code")
            .eq("id", roleId)
            .eq("organization_id", actor.organization_id)
            .maybeSingle(),
          userClient.rpc("has_permission", { permission_code: "roles.manage" }),
        ]);
      if (!branch || !role)
        return respond(400, {
          error: "La sucursal o el rol no pertenecen a esta organización.",
        });
      if (canManageRoles !== true) {
        if (["administrator", "manager"].includes(role.code))
          return respond(403, {
            error:
              "Solo un administrador de roles puede asignar el rol de administrador o gerente.",
          });
        const [actorGrants, roleGrants] = await Promise.all([
          service
            .from("role_permissions")
            .select("permission:permissions!inner(code)")
            .eq("role_id", actor.role_id),
          service
            .from("role_permissions")
            .select("permission:permissions!inner(code)")
            .eq("role_id", roleId),
        ]);
        if (actorGrants.error || roleGrants.error)
          return respond(500, {
            error: "No se pudieron validar los permisos del rol.",
          });
        const actorCodes = new Set(
          (actorGrants.data ?? []).map(
            (grant) => (grant.permission as { code: string }).code,
          ),
        );
        if (
          (roleGrants.data ?? []).some(
            (grant) =>
              !actorCodes.has((grant.permission as { code: string }).code),
          )
        )
          return respond(403, {
            error:
              "No puedes asignar un rol con permisos superiores a los tuyos.",
          });
      }

      const { data: existing } = isCreate
        ? { data: null }
        : await service
            .from("user_profiles")
            .select("id,organization_id,branch_id,role_id")
            .eq("id", targetId)
            .eq("organization_id", actor.organization_id)
            .eq("branch_id", actor.branch_id)
            .maybeSingle();
      if (!isCreate && !existing)
        return respond(404, {
          error: "No se encontró el usuario en esta sucursal.",
        });

      if (employeeNumber) {
        let duplicateEmployeeQuery = service
          .from("user_profiles")
          .select("id")
          .eq("organization_id", actor.organization_id)
          .eq("employee_number", employeeNumber);
        if (!isCreate)
          duplicateEmployeeQuery = duplicateEmployeeQuery.neq("id", targetId);
        const { data: duplicateEmployee, error: duplicateEmployeeError } =
          await duplicateEmployeeQuery.maybeSingle();
        if (duplicateEmployeeError)
          return respond(500, {
            error:
              "No se pudo validar el número de empleado. Inténtalo de nuevo.",
          });
        if (duplicateEmployee)
          return respond(409, {
            error: "Ese número de empleado ya está asignado a otro usuario.",
          });
      }

      const metadata = {
        organization_id: actor.organization_id,
        branch_id: branchId,
        role_id: roleId,
      };
      const userMetadata = {
        full_name: fullName,
        employee_number: employeeNumber,
      };
      let userId = targetId;
      let oldAuth: {
        email?: string;
        user_metadata?: Record<string, unknown>;
        app_metadata?: Record<string, unknown>;
        wasBanned?: boolean;
      } | null = null;

      if (isCreate) {
        const { data, error } = await service.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          app_metadata: metadata,
          user_metadata: userMetadata,
        });
        if (error || !data.user) {
          const authError = error as { code?: string; message?: string } | null;
          const duplicateEmail =
            /email_exists|user_already_exists|already registered|already been registered/i.test(
              `${authError?.code ?? ""} ${authError?.message ?? ""}`,
            );
          return respond(400, {
            error: duplicateEmail
              ? "Ese correo ya tiene una cuenta. Usa otro correo o edita la cuenta existente."
              : "No se pudo crear la cuenta de acceso. Verifica el correo e inténtalo de nuevo.",
          });
        }
        userId = data.user.id;
      } else {
        const { data } = await service.auth.admin.getUserById(targetId);
        oldAuth = data.user
          ? {
              email: data.user.email,
              app_metadata: data.user.app_metadata,
              user_metadata: data.user.user_metadata,
              wasBanned: Boolean(
                data.user.banned_until &&
                Date.parse(data.user.banned_until) > Date.now(),
              ),
            }
          : null;
        if (!oldAuth)
          return respond(404, {
            error: "No se encontró la cuenta de autenticación.",
          });
        const authUpdate: Record<string, unknown> = {
          email,
          email_confirm: true,
          app_metadata: metadata,
          user_metadata: userMetadata,
        };
        if (password) authUpdate.password = password;
        if (!isActive) authUpdate.ban_duration = "876000h";
        else authUpdate.ban_duration = "none";
        const { error } = await service.auth.admin.updateUserById(
          targetId,
          authUpdate,
        );
        if (error)
          return respond(400, {
            error: "No se pudieron actualizar las credenciales.",
          });
      }

      const { error: profileError } = await service
        .from("user_profiles")
        .upsert(
          {
            id: userId,
            organization_id: actor.organization_id,
            branch_id: branchId,
            role_id: roleId,
            employee_number: employeeNumber,
            full_name: fullName,
            is_active: isActive,
          },
          { onConflict: "id" },
        );
      if (profileError) {
        if (isCreate) await service.auth.admin.deleteUser(userId);
        else if (oldAuth) {
          const { wasBanned, ...attributes } = oldAuth;
          await service.auth.admin.updateUserById(targetId, {
            ...attributes,
            ban_duration: wasBanned ? "876000h" : "none",
          });
        }
        return respond(400, {
          error:
            profileError.code === "23505"
              ? "Ese número de empleado ya está asignado a otro usuario."
              : "No se pudo guardar el perfil del usuario. No se conservó la cuenta de acceso; revisa sucursal y rol.",
        });
      }
      await service.from("audit_logs").insert({
        organization_id: actor.organization_id,
        branch_id: actor.branch_id,
        user_id: actor.id,
        role_id: actor.role_id,
        action: isCreate ? "user.created" : "user.updated",
        entity_type: "user_profile",
        entity_id: userId,
        new_value: {
          email,
          full_name: fullName,
          employee_number: employeeNumber,
          role_id: roleId,
          is_active: isActive,
        },
      });
      return respond(200, { ok: true, id: userId });
    } catch {
      return respond(500, {
        error: "Ocurrió un error inesperado al administrar usuarios.",
      });
    }
  },
);

const functionDefinition = {
  fetch: async (request: Request) => {
    if (request.method === "OPTIONS")
      return new Response("ok", { headers: corsHeaders });
    const response = await authenticatedHandler(request);
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders))
      headers.set(key, value);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};

export default functionDefinition;
