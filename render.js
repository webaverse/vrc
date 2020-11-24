import * as THREE from './three.module.js';
import {OrbitControls} from './OrbitControls.js';
// import {CSS3DRenderer} from './CSS3DRenderer.js';
import {DDSLoader} from './DDSLoader.js';

const canvas = document.getElementById('canvas');
const context = canvas.getContext('webgl2', {
  antialias: true,
  alpha: true,
  // preserveDrawingBuffer: false,
});
const renderer = new THREE.WebGLRenderer({
  canvas,
  context,
  antialias: true,
  // alpha: true,
  // preserveDrawingBuffer: false,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
// renderer.autoClear = false;
renderer.sortObjects = false;
// renderer.physicallyCorrectLights = true;
// renderer.xr.enabled = true;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 2);
camera.rotation.order = 'YXZ';
// camera.quaternion.set(0, 0, 0, 1);

const dolly = new THREE.Object3D();
dolly.add(camera);
scene.add(dolly);

const ambientLight = new THREE.AmbientLight(0xFFFFFF);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xFFFFFF);
directionalLight.position.set(1, 2, 3);
scene.add(directionalLight);
/* const directionalLight2 = new THREE.DirectionalLight(0xFFFFFF, 1);
scene.add(directionalLight2); */

const orbitControls = new OrbitControls(camera, canvas);
orbitControls.screenSpacePanning = true;
orbitControls.enableMiddleZoom = false;
orbitControls.target.copy(camera.position).add(new THREE.Vector3(0, camera.position.y, -3).applyQuaternion(camera.quaternion));
orbitControls.update();

const cubeMesh = new THREE.Mesh(new THREE.BoxBufferGeometry(1, 1, 1), new THREE.MeshBasicMaterial({
  color: 0xFF0000,
}));
cubeMesh.position.z = -3;
scene.add(cubeMesh);

(async () => {
  const res = await fetch('./output.json');
  const j = await res.json();

  // const meshComponent = j.find(c => c.type === 'mesh');
  // console.log('got j', {j, meshComponent});
  // const {} = j.geometry;

  const materials = Object.keys(j.materials).map(k => {
    const {textures} = j.materials[k];
    const texture = textures[0];

    const texturePath = texture.path;
    const dxt5Texture = new DDSLoader().load(texturePath.replace(/\.crn$/, '.dds'));
    const m = new THREE.MeshBasicMaterial({
      // color: 0x000080,
      map: dxt5Texture,
    });
    m.materialId = k;
    return m;
  });
  const geometries = Object.keys(j.geometries).map(k => {
    const {indices, normals, uvs, vertices, tangents} = j.geometries[k];

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(vertices), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(Float32Array.from(normals), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(Float32Array.from(uvs), 2));
    g.setIndex(new THREE.BufferAttribute(Uint32Array.from(indices), 1));
    g.geometryId = k;
    return g;
  });
  const _parseTransform = t => {
    const result = t.object ? new THREE.Mesh(
      geometries.find(geometry => geometry.geometryId === t.object.geometry),
      materials.find(material => material.materialId === t.object.materials[0]),
    ) : new THREE.Object3D();
    result.position.fromArray(t.position);
    result.quaternion.fromArray(t.quaternion);
    result.scale.fromArray(t.scale);
    for (const child of t.children) {
      const childResult = _parseTransform(child);
      result.add(childResult);
    }
    return result;
  };
  const meshes = j.transforms.map(t => _parseTransform(t));
  for (const mesh of meshes) {
    scene.add(mesh);
  }
})();

/* ImportedVertex iVertex;
if (iSubmesh.VertexList.Count < mesh.m_SubMeshes[i].vertexCount)
{
  iVertex = new ImportedVertex();
  iSubmesh.VertexList.Add(iVertex);
}
else
{
  iVertex = iSubmesh.VertexList[j];
}

for (int chn = 0; chn < mesh.m_VertexData.m_Channels.Count; chn++)
{
  ChannelInfo cInfo = mesh.m_VertexData.m_Channels[chn];
  if ((sInfo.channelMask & (1 << chn)) == 0)
  {
    continue;
  }

  vertReader.BaseStream.Position = sInfo.offset + (submesh.firstVertex + j) * sInfo.stride + cInfo.offset;
  switch (chn)
  {
  case 0:
    iVertex.Position = new SlimDX.Vector3(-vertReader.ReadSingle(), vertReader.ReadSingle(), vertReader.ReadSingle());
    break;
  case 1:
    iVertex.Normal = new SlimDX.Vector3(-vertReader.ReadSingle(), vertReader.ReadSingle(), vertReader.ReadSingle());
    break;
  case 3:
    iVertex.UV = new float[2] { vertReader.ReadSingle(), vertReader.ReadSingle() };
    break;
  case 5:
    iVertex.Tangent = new SlimDX.Vector4(-vertReader.ReadSingle(), vertReader.ReadSingle(), vertReader.ReadSingle(), -vertReader.ReadSingle());
    break;
  }
} */

renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
});

/* const renderer2 = new CSS3DRenderer();
renderer2.setSize(window.innerWidth, window.innerHeight);
renderer2.domElement.style.position = 'absolute';
renderer2.domElement.style.top = 0;
document.body.insertBefore(renderer2.domElement, canvas); */

// const scene2 = new THREE.Scene();
// const scene3 = new THREE.Scene();

