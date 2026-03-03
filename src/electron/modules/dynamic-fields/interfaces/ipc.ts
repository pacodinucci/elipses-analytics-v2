// src/electron/modules/dynamic-fields/interfaces/ipc.ts
import { ipcMainHandleWithPayload } from "../../../util.js";
import {
  listDefs,
  createDef,
  updateEntityExtras,
  type DynamicEntity,
  type DynamicFieldDataType,
} from "../application/service.js";

/**
 * Nota:
 * - Los tipos "Payload/Response" viven en types.d.ts (globales).
 * - Acá devolvemos responses 100% compatibles con esas unions:
 *   { ok: true, ... } | { ok: false, error }
 */

export function registerDynamicFieldsIpcHandlers() {
  ipcMainHandleWithPayload("dynamicFieldsListDefs", async (payload) => {
    try {
      const entity = payload.entity as DynamicEntity;
      const defs = await listDefs(entity);

      const res: DynamicFieldsListDefsResponse = {
        ok: true,
        defs: defs as unknown as DynamicFieldDef[],
      };
      return res;
    } catch (err) {
      const res: DynamicFieldsListDefsResponse = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
      return res;
    }
  });

  ipcMainHandleWithPayload("dynamicFieldsCreateDef", async (payload) => {
    try {
      const created = await createDef({
        entity: payload.entity as DynamicEntity,
        key: payload.key as string,
        dataType: payload.dataType as DynamicFieldDataType,
        label: payload.label ?? null,
        unit: payload.unit ?? null,
        configJson: payload.configJson ?? {},
      });

      const res: DynamicFieldsCreateDefResponse = {
        ok: true,
        def: created as unknown as DynamicFieldDef,
      };
      return res;
    } catch (err) {
      const res: DynamicFieldsCreateDefResponse = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
      return res;
    }
  });

  ipcMainHandleWithPayload(
    "dynamicFieldsUpdateEntityExtras",
    async (payload) => {
      try {
        const out = await updateEntityExtras({
          entity: payload.entity as DynamicEntity,
          entityId: payload.entityId as string,
          patch: payload.patch ?? {},
          unsetKeys: payload.unsetKeys ?? [],
        });

        const res: DynamicFieldsUpdateEntityExtrasResponse = {
          ok: true,
          entity: payload.entity as DynamicEntity,
          entityId: payload.entityId as string,
          extrasJson: out.extrasJson as Record<string, unknown>,
        };
        return res;
      } catch (err) {
        const res: DynamicFieldsUpdateEntityExtrasResponse = {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
        return res;
      }
    },
  );
}
