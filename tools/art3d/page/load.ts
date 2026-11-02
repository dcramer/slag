import type * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/** A model as the renderer uses it: its scene, its meshes, its animations and its colour texture. */
export interface Model {
  root: THREE.Object3D;
  meshes: THREE.Mesh[];
  clips: THREE.AnimationClip[];
  texture: THREE.Texture | null;
}

/** Loads a GLB as Tripo gives it (meshopt-compressed when downloaded from Studio, plain when exported). */
export async function loadModel(url: string): Promise<Model> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(url);
  const meshes: THREE.Mesh[] = [];
  let texture: THREE.Texture | null = null;
  gltf.scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      const m = o as THREE.Mesh;
      meshes.push(m);
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat.map && !texture) texture = mat.map;
    }
  });
  return { root: gltf.scene, meshes, clips: gltf.animations, texture };
}

/** The texture's pixels, read back through a canvas. */
export function texturePixels(tex: THREE.Texture): ImageData {
  const img = tex.image as HTMLImageElement | ImageBitmap;
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  // glTF textures are stored top row first and three loads them unflipped: draw as is, so (u, 1 - v) is (x, y).
  g.drawImage(img, 0, 0);
  return g.getImageData(0, 0, c.width, c.height);
}
