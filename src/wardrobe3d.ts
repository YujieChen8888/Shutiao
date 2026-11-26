import * as THREE from "three";
import { outfitFor } from "./wardrobe";

const Z = 0.82;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Independent, reusable garment meshes. Rest coordinates deform with the pet's
 * spine so clothes stay attached when it types, breathes and falls asleep. */
export class Wardrobe3D {
  readonly group = new THREE.Group();
  private key = "";
  private meshes: THREE.Mesh[] = [];
  constructor(parent: THREE.Group) {
    parent.add(this.group);
  }

  clear() {
    this.group.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.geometry.dispose();
      for (const mat of Array.isArray(obj.material)
        ? obj.material
        : [obj.material]) {
        (mat as THREE.MeshBasicMaterial).map?.dispose();
        mat.dispose();
      }
    });
    this.group.clear();
    this.meshes = [];
  }

  set(id: string, radius: (y: number) => number, contourKey: string) {
    const key = id + contourKey;
    if (key === this.key) return;
    this.key = key;
    this.clear();
    const o = outfitFor(id);
    if (o.id === "none") return;
    const mat = (color: string, knit = false) => {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const c = canvas.getContext("2d")!;
      c.fillStyle = color;
      c.fillRect(0, 0, 128, 128);
      if (knit) {
        c.strokeStyle = "rgba(255,255,255,.19)";
        c.lineWidth = 2;
        for (let x = 0; x < 128; x += 8)
          for (let y = 0; y < 128; y += 10) {
            c.beginPath();
            c.moveTo(x, y);
            c.lineTo(x + 4, y + 6);
            c.lineTo(x + 8, y);
            c.stroke();
          }
      } else {
        const g = c.createLinearGradient(0, 0, 128, 0);
        g.addColorStop(0, "rgba(0,0,0,.2)");
        g.addColorStop(0.45, "rgba(255,255,255,.08)");
        g.addColorStop(1, "rgba(0,0,0,.16)");
        c.fillStyle = g;
        c.fillRect(0, 0, 128, 128);
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
      });
    };
    const add = (geo: THREE.BufferGeometry, material: THREE.Material) => {
      geo.setAttribute("rest", geo.attributes.position.clone());
      const mesh = new THREE.Mesh(geo, material);
      mesh.frustumCulled = false;
      this.meshes.push(mesh);
      this.group.add(mesh);
      return mesh;
    };
    const shell = (
      bottom: number,
      top: number,
      color: string,
      knit = false,
      start = 0,
      length = Math.PI * 2,
      lift = 0.025,
    ) => {
      const profile = Array.from({ length: 25 }, (_, i) => {
        const y = bottom + ((top - bottom) * i) / 24;
        return new THREE.Vector2(radius(y) + lift, y);
      });
      const geo = new THREE.LatheGeometry(profile, 64, start, length);
      geo.scale(1, 1, Z);
      add(geo, mat(color, knit));
    };
    const patch = (points: number[][], color: string) => {
      const vertices: number[] = [];
      for (let i = 1; i < points.length - 1; i++)
        vertices.push(...points[0], ...points[i], ...points[i + 1]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(vertices, 3),
      );
      geo.computeVertexNormals();
      add(geo, mat(color));
    };
    const front = (x: number, y: number, extra = 0.05) =>
      Math.sqrt(Math.max(0.005, radius(y) ** 2 - x * x)) * Z + extra;
    const disk = (x: number, y: number, r: number, color: string) => {
      const g = new THREE.CircleGeometry(r, 24);
      g.translate(x, y, front(x, y, 0.065));
      add(g, mat(color));
    };
    const bow = (color: string) => {
      const y = 1.2,
        z = front(0, y, 0.07);
      for (const s of [-1, 1]) {
        patch(
          [
            [0, y, z],
            [s * 0.23, y + 0.09, z - 0.015],
            [s * 0.21, y - 0.1, z - 0.015],
          ],
          color,
        );
        patch(
          [
            [s * 0.025, y - 0.02, z],
            [s * 0.08, y - 0.38, front(s * 0.08, y - 0.38, 0.07)],
            [s * 0.14, y - 0.34, front(s * 0.14, y - 0.34, 0.07)],
          ],
          color,
        );
      }
      disk(0, y, 0.047, color);
    };
    if (o.id === "blue-collar") {
      shell(1.23, 1.34, o.color, true);
      const y = 1.285,
        z = front(0, y, 0.07);
      patch(
        [
          [-0.13, y - 0.052, z],
          [0.13, y - 0.052, z],
          [0.13, y + 0.052, z],
          [-0.13, y + 0.052, z],
        ],
        o.trim,
      );
      patch(
        [
          [-0.085, y - 0.027, z + 0.005],
          [0.085, y - 0.027, z + 0.005],
          [0.085, y + 0.027, z + 0.005],
          [-0.085, y + 0.027, z + 0.005],
        ],
        o.color,
      );
      disk(0, 1.135, 0.065, "#dfc998");
    } else if (o.id === "festive") {
      shell(1.19, 1.35, o.color, true);
      shell(1.18, 1.21, o.trim);
      patch(
        [
          [0.08, 1.25, front(0.08, 1.25)],
          [0.25, 1.24, front(0.25, 1.24)],
          [0.31, 0.62, front(0.31, 0.62)],
          [0.12, 0.6, front(0.12, 0.6)],
        ],
        o.color,
      );
      for (let i = 0; i < 6; i++) {
        const x = 0.12 + i * 0.032;
        patch(
          [
            [x, 0.65, front(x, 0.65, 0.06)],
            [x + 0.016, 0.65, front(x, 0.65, 0.06)],
            [x + 0.016, 0.52, front(x, 0.52, 0.06)],
            [x, 0.52, front(x, 0.52, 0.06)],
          ],
          o.trim,
        );
      }
    } else if (o.id === "vampire") {
      // Opening down the chest, black outer cape and tall scarlet collar behind ears.
      shell(0.18, 1.29, o.color, false, 0.43, Math.PI * 2 - 0.86, 0.055);
      shell(0.18, 0.21, o.trim, false, 0.43, Math.PI * 2 - 0.86, 0.059);
      for (const s of [-1, 1]) {
        patch(
          [
            [s * 0.35, 1.21, -0.04],
            [s * 1.0, 1.76, -0.08],
            [s * 0.8, 1.97, -0.19],
            [s * 0.35, 1.51, -0.26],
          ],
          o.trim,
        );
        patch(
          [
            [s * 0.27, 1.24, front(s * 0.27, 1.24, 0.08)],
            [s * 0.36, 0.24, front(s * 0.36, 0.24, 0.08)],
            [s * 0.42, 0.24, front(s * 0.42, 0.24, 0.09)],
          ],
          o.trim,
        );
      }
      bow(o.trim);
    } else {
      shell(0.22, 1.26, o.color, o.id === "oat-knit" || o.id === "mint-vest");
      shell(0.21, 0.27, o.trim, true, 0, Math.PI * 2, 0.033);
      shell(1.21, 1.31, o.trim, true, 0, Math.PI * 2, 0.034);
      // Soft armhole trim, leaving the original moving forelegs unobstructed.
      for (const s of [-1, 1]) {
        const curve = new THREE.CatmullRomCurve3(
          Array.from({ length: 17 }, (_, i) => {
            const a = (i / 16) * Math.PI * 2;
            const x = s * (radius(1.0) * 0.8) + Math.cos(a) * 0.1;
            const y = 1.01 + Math.sin(a) * 0.18;
            return new THREE.Vector3(x, y, front(x, y, 0.045));
          }),
        );
        add(new THREE.TubeGeometry(curve, 32, 0.018, 6, true), mat(o.trim));
      }
      if (o.id === "sailor") {
        for (const s of [-1, 1])
          patch(
            [
              [s * 0.48, 1.26, front(s * 0.48, 1.26, 0.06)],
              [0, 1.06, front(0, 1.06, 0.06)],
              [s * 0.32, 0.96, front(s * 0.32, 0.96, 0.06)],
            ],
            o.trim,
          );
        bow("#c95b66");
      } else if (o.id === "raincoat") {
        for (const y of [0.95, 0.73, 0.51]) disk(0, y, 0.035, o.trim);
      } else if (o.id === "mint-vest") {
        disk(0, 0.78, 0.115, "#ead089");
        disk(-0.035, 0.81, 0.027, "#6a4e36");
        disk(0.035, 0.81, 0.027, "#6a4e36");
        disk(0, 0.75, 0.041, "#6a4e36");
      }
    }
  }

  update(bend: { x: number; z: number; squash: number; bellySwell: number }) {
    for (const mesh of this.meshes) {
      const p = mesh.geometry.attributes.position,
        r = mesh.geometry.attributes.rest;
      for (let i = 0; i < p.count; i++) {
        const x = r.getX(i),
          y = r.getY(i),
          z = r.getZ(i);
        const w = smooth(0.14, 1.75, y) ** 1.45;
        const swell =
          1 + bend.bellySwell * smooth(1.3, 0.65, y) * smooth(0, 0.25, y);
        p.setXYZ(
          i,
          x * swell + bend.x * w,
          y * (1 - bend.squash * smooth(0.18, 1.98, y)),
          z * swell + bend.z * w,
        );
      }
      p.needsUpdate = true;
    }
  }
}
