import * as PIXI from "pixi.js";
import type { ViewportRect, EllipseInstance } from "../../../types";
import type { Camera2D } from "../../camera/camera-2d";
import { ellipseVert, ellipseFrag } from "./shaders";

type Props = { app: PIXI.Application };

// Helper: typings de Pixi v7 + TS moderno pueden no aceptar Float32Array genérico.
// Runtime lo soporta perfecto; esto es solo para TypeScript.
function updatePixiBuffer(buf: PIXI.Buffer, data: Float32Array) {
  (
    buf as unknown as { update: (d: ArrayBufferView | ArrayBuffer) => void }
  ).update(data);
}

export class EllipsesLayer {
  private app: PIXI.Application;
  private vp: ViewportRect = { width: 1, height: 1 };

  private shader: PIXI.Shader;
  private mesh: PIXI.Mesh<PIXI.Shader>;

  // Buffers instanciados (los manejamos nosotros)
  private centerABBuffer: PIXI.Buffer;
  private rotBuffer: PIXI.Buffer;
  private fillBuffer: PIXI.Buffer;

  constructor({ app }: Props) {
    this.app = app;

    // Quad base
    const quadVerts = new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]);
    const quadIndices = [0, 1, 2, 0, 2, 3];

    const geometry = new PIXI.Geometry();
    geometry.addAttribute("aPosition", quadVerts, 2);
    geometry.addIndex(quadIndices);

    // Buffers PIXI explícitos (data inicial vacía)
    this.centerABBuffer = new PIXI.Buffer(new ArrayBuffer(0), true, false);
    this.rotBuffer = new PIXI.Buffer(new ArrayBuffer(0), true, false);
    this.fillBuffer = new PIXI.Buffer(new ArrayBuffer(0), true, false);

    /**
     * Instanced attributes (Pixi v7):
     * addAttribute(id, buffer, size, normalized?, type?, stride?, start?, instance?)
     */
    geometry.addAttribute(
      "iCenterAB",
      this.centerABBuffer,
      4,
      false,
      PIXI.TYPES.FLOAT,
      0,
      0,
      true,
    );

    geometry.addAttribute(
      "iRot",
      this.rotBuffer,
      1,
      false,
      PIXI.TYPES.FLOAT,
      0,
      0,
      true,
    );

    geometry.addAttribute(
      "iFill",
      this.fillBuffer,
      4,
      false,
      PIXI.TYPES.FLOAT,
      0,
      0,
      true,
    );

    this.shader = PIXI.Shader.from(ellipseVert, ellipseFrag, {
      uWorldToScreen: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
      uViewport: new Float32Array([1, 1]),
    });

    this.mesh = new PIXI.Mesh(geometry, this.shader);
    this.mesh.state = PIXI.State.for2d();
    this.mesh.blendMode = PIXI.BLEND_MODES.NORMAL;

    // ✅ Por defecto visible
    this.mesh.visible = true;

    this.app.stage.addChild(this.mesh);
  }

  // ✅ NUEVO: mostrar/ocultar (para ViewerEngine.setShowElipses)
  setVisible(v: boolean) {
    this.mesh.visible = v;
  }

  setViewport(vp: ViewportRect) {
    this.vp = vp;
    const u = this.shader.uniforms.uViewport as Float32Array;
    u[0] = vp.width;
    u[1] = vp.height;
  }

  setData(data: EllipseInstance[]) {
    const items = data.filter((e) => e.visible !== false);
    const n = items.length;

    const centerAB = new Float32Array(n * 4);
    const rot = new Float32Array(n);
    const fill = new Float32Array(n * 4);

    for (let i = 0; i < n; i++) {
      const e = items[i];

      centerAB[i * 4 + 0] = e.cx;
      centerAB[i * 4 + 1] = e.cy;
      centerAB[i * 4 + 2] = e.a;
      centerAB[i * 4 + 3] = e.b;

      rot[i] = e.rot;
      fill.set(e.fill, i * 4);
    }

    // Update buffers (con typing safe)
    updatePixiBuffer(this.centerABBuffer, centerAB);
    updatePixiBuffer(this.rotBuffer, rot);
    updatePixiBuffer(this.fillBuffer, fill);

    // Instancing count
    (this.mesh.geometry as unknown as { instanceCount: number }).instanceCount =
      n;
  }

  render(camera: Camera2D) {
    // Si está oculto, no hace falta actualizar uniforms (micro-optimización)
    if (!this.mesh.visible) return;

    const { center, scale } = camera.state;

    const tx = this.vp.width * 0.5 - center.x * scale;
    const ty = this.vp.height * 0.5 + center.y * scale;

    // mat3 world->screen
    const m = this.shader.uniforms.uWorldToScreen as Float32Array;
    m[0] = scale;
    m[1] = 0;
    m[2] = 0;
    m[3] = 0;
    m[4] = -scale;
    m[5] = 0;
    m[6] = tx;
    m[7] = ty;
    m[8] = 1;

    const v = this.shader.uniforms.uViewport as Float32Array;
    v[0] = this.vp.width;
    v[1] = this.vp.height;
  }

  destroy() {
    this.mesh.destroy(true);
    this.centerABBuffer.destroy();
    this.rotBuffer.destroy();
    this.fillBuffer.destroy();
  }
}
