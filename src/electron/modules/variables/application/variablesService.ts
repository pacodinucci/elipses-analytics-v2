// src/electron/modules/variables/application/variablesService.ts

import type {
  GrupoVariable,
  Variable,
  Unidades,
} from "../../../backend/models.js";
import { databaseService } from "../../../shared/db/index.js";
import { migrations } from "../../../shared/db/migrations.js";

import type {
  CreateGrupoVariableInput,
  CreateVariableInput,
  UpsertUnidadInput,
  GrupoVariableScope,
} from "../domain/variables.js";

import {
  validateCreateGrupoVariableInput,
  validateCreateVariableInput,
  validateUpsertUnidadInput,
} from "../domain/variables.js";

import { VariablesRepository } from "../infrastructure/variablesRepository.js";

type GroupVariableTemplate = {
  codigo: string;
  nombre: string;
  tipoDato: string;
  configJson?: Record<string, unknown>;
  extrasJson?: Record<string, unknown>;
};

type GroupTemplate = {
  key: string;
  nombre: string;
  orden: number;
  scope: GrupoVariableScope;
  /**
   * Nota:
   * - Para MAPA: NO se usa. Las variables del grupo MAPA se generan desde la tabla VariableMapa.
   */
  variables?: GroupVariableTemplate[];
};

const GROUP_TEMPLATES: GroupTemplate[] = [
  {
    key: "proyecto",
    nombre: "Proyecto",
    orden: 0,
    scope: "PROYECTO",
    variables: [
      { codigo: "NOMBRE", nombre: "Nombre", tipoDato: "string" },
      { codigo: "ALIAS", nombre: "Alias", tipoDato: "string" },
    ],
  },
  {
    key: "pozo",
    nombre: "Pozo",
    orden: 1,
    scope: "POZO",
    variables: [
      { codigo: "NOMBRE", nombre: "Nombre", tipoDato: "string" },
      { codigo: "X", nombre: "X", tipoDato: "number" },
      { codigo: "Y", nombre: "Y", tipoDato: "number" },
    ],
  },
  {
    key: "capa",
    nombre: "Capa",
    orden: 2,
    scope: "CAPA",
    variables: [{ codigo: "NOMBRE", nombre: "Nombre", tipoDato: "string" }],
  },
  {
    key: "escenario",
    nombre: "Escenario",
    orden: 3,
    scope: "ESCENARIO",
    variables: [{ codigo: "NOMBRE", nombre: "Nombre", tipoDato: "string" }],
  },
  {
    key: "simulacion",
    nombre: "Simulacion",
    orden: 4,
    scope: "SIMULACION",
    variables: [{ codigo: "ID", nombre: "Id", tipoDato: "string" }],
  },
  {
    key: "elipse",
    nombre: "Elipse",
    orden: 5,
    scope: "ELIPSE",
    variables: [{ codigo: "GEOMETRIA", nombre: "Geometria", tipoDato: "json" }],
  },
  {
    key: "mapa",
    nombre: "Mapa",
    orden: 6,
    scope: "MAPA",
    // 👇 Importante:
    // NO definimos variables "GRID" acá.
    // Las variables del grupo MAPA se generan leyendo el catálogo VariableMapa.
    variables: [],
  },
  {
    key: "unidades",
    nombre: "Unidades",
    orden: 7,
    scope: "UNIDADES",
    variables: [
      { codigo: "UNIDAD", nombre: "Unidad", tipoDato: "string" },
      { codigo: "CONFIG_JSON", nombre: "Configuracion", tipoDato: "json" },
    ],
  },
];

type VariableMapaRow = {
  id: string;
  nombre: string;
};

export class VariablesService {
  private readonly repository = new VariablesRepository();
  private schemaReady = false;

  async createGrupoVariable(
    input: CreateGrupoVariableInput,
  ): Promise<GrupoVariable> {
    validateCreateGrupoVariableInput(input);
    await this.ensureSchema();
    return this.repository.createGrupoVariable(input);
  }

  async listGrupoVariable(proyectoId?: string): Promise<GrupoVariable[]> {
    await this.ensureSchema();
    return this.repository.listGrupoVariable(proyectoId);
  }

  async createVariable(input: CreateVariableInput): Promise<Variable> {
    validateCreateVariableInput(input);
    await this.ensureSchema();
    return this.repository.createVariable(input);
  }

  async listVariableByGrupoVariable(
    grupoVariableId: string,
  ): Promise<Variable[]> {
    if (!grupoVariableId) throw new Error("grupoVariableId is required");
    await this.ensureSchema();
    return this.repository.listVariableByGrupoVariable(grupoVariableId);
  }

  async listUnidadesByProyecto(proyectoId: string): Promise<Unidades[]> {
    if (!proyectoId) throw new Error("proyectoId is required");
    await this.ensureSchema();
    return this.repository.listUnidadesByProyecto(proyectoId);
  }

  async upsertUnidad(input: UpsertUnidadInput): Promise<{ id: string }> {
    validateUpsertUnidadInput(input);
    await this.ensureSchema();
    return this.repository.upsertUnidad(input);
  }

  async ensureDefaultsForProject(proyectoId: string): Promise<{
    ok: true;
    createdGroups: number;
    createdVariables: number;
    ensuredUnits: number;
  }> {
    if (!proyectoId) throw new Error("proyectoId is required");
    await this.ensureSchema();

    const { createdGroups, createdVariables } =
      await this.ensureProjectCatalog(proyectoId);

    // ✅ asegura al menos 1 fila en Unidades por proyecto
    await this.repository.upsertUnidad({
      proyectoId,
      unidad: "m3/d",
      configJson: {},
      extrasJson: {},
    });

    return { ok: true, createdGroups, createdVariables, ensuredUnits: 1 };
  }

  private async ensureProjectCatalog(proyectoId: string): Promise<{
    createdGroups: number;
    createdVariables: number;
  }> {
    // --- 1) asegurar grupos del proyecto
    const grupos = await this.repository.listGrupoVariable(proyectoId);
    const gruposSet = new Set(grupos.map((g) => g.id));
    const groupIdsByKey = new Map<string, string>();

    let createdGroups = 0;
    for (const g of GROUP_TEMPLATES) {
      const groupId = this.buildGroupId(proyectoId, g.key);
      groupIdsByKey.set(g.key, groupId);

      if (gruposSet.has(groupId)) continue;

      await this.repository.createGrupoVariable({
        id: groupId,
        proyectoId,
        nombre: g.nombre,
        orden: g.orden,
        scope: g.scope,
        extrasJson: {},
      });

      createdGroups += 1;
      gruposSet.add(groupId);
    }

    // --- 2) asegurar variables (templates) para todos los grupos NO-MAPA
    let createdVariables = 0;

    for (const g of GROUP_TEMPLATES) {
      if (g.scope === "MAPA") continue;

      const groupId =
        groupIdsByKey.get(g.key) ?? this.buildGroupId(proyectoId, g.key);

      for (const v of g.variables ?? []) {
        const variableId = this.buildVariableId(proyectoId, g.key, v.codigo);

        const exists = await databaseService.readAll(
          "SELECT id FROM Variable WHERE id = ? LIMIT 1",
          [variableId],
        );
        if (exists.length > 0) continue;

        await this.repository.createVariable({
          id: variableId,
          grupoVariableId: groupId,
          nombre: v.nombre,
          codigo: v.codigo,
          tipoDato: v.tipoDato,
          configJson: v.configJson ?? {},
          extrasJson: v.extrasJson ?? {},
        });

        createdVariables += 1;
      }
    }

    // --- 3) caso especial MAPA: variables = catálogo VariableMapa
    const mapaGroupId =
      groupIdsByKey.get("mapa") ?? this.buildGroupId(proyectoId, "mapa");

    const createdMapVars = await this.ensureMapaVariablesFromCatalog(
      proyectoId,
      mapaGroupId,
    );

    createdVariables += createdMapVars;

    return { createdGroups, createdVariables };
  }

  /**
   * ✅ MAPA:
   * - Lee VariableMapa (catálogo global)
   * - Crea una Variable por cada VariableMapa dentro del grupo MAPA del proyecto
   * - NO crea / NO modifica VariableMapa
   */
  private async ensureMapaVariablesFromCatalog(
    proyectoId: string,
    grupoVariableId: string,
  ): Promise<number> {
    // OJO: VariableMapa tiene extrasJson desde v8 pero acá solo necesitamos id + nombre.
    const rows = (await databaseService.readAll(
      "SELECT id, nombre FROM VariableMapa ORDER BY nombre ASC",
      [],
    )) as Array<Record<string, unknown>>;

    const catalog: VariableMapaRow[] = rows.map((r) => ({
      id: String(r.id),
      nombre: String(r.nombre),
    }));

    let created = 0;

    for (const vm of catalog) {
      // ID estable y separado del catálogo:
      // No uses vm.id como id de Variable porque son entidades distintas.
      const variableId = this.buildMapaVariableId(proyectoId, vm.id);

      const exists = await databaseService.readAll(
        "SELECT id FROM Variable WHERE id = ? LIMIT 1",
        [variableId],
      );
      if (exists.length > 0) continue;

      await this.repository.createVariable({
        id: variableId,
        grupoVariableId,
        nombre: vm.nombre,
        codigo: `VM:${vm.id}`,
        // tipoDato: mantenelo genérico. Si después tipás "grid"/"raster", lo cambiás acá.
        tipoDato: "json",
        configJson: { variableMapaId: vm.id },
        extrasJson: {},
      });

      created += 1;
    }

    return created;
  }

  private buildGroupId(proyectoId: string, key: string): string {
    return `grp-${proyectoId}-${key}`;
  }

  private buildVariableId(
    proyectoId: string,
    groupKey: string,
    codigo: string,
  ): string {
    return `var-${proyectoId}-${groupKey}-${codigo.toLowerCase()}`;
  }

  private buildMapaVariableId(
    proyectoId: string,
    variableMapaId: string,
  ): string {
    return `var-${proyectoId}-mapa-vm-${variableMapaId}`;
  }

  private async ensureSchema(): Promise<void> {
    if (this.schemaReady) return;
    await databaseService.applyMigrations(migrations);
    this.schemaReady = true;
  }
}

export const variablesService = new VariablesService();
