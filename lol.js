const path = require('path');
const fs = require('fs');
const YAML = require('yaml');

const o = YAML.parse(fs.readFileSync('Assets/Mesh/Avator_voxelkei.asset', 'utf8'));
// fs.writeFileSync('lol.json', JSON.stringify(o));
// console.log('got o', Object.keys());

let scene = YAML.parseAllDocuments(fs.readFileSync('Assets/Scene/buildplayer-japaneland sky.unity', 'utf8'));
// console.log('got file', scene[1]);
scene = scene.map(o => {
  const fileID = parseInt(Object.keys(o.anchors.map)[0], 10);
  // console.log('got file id', fileID);
  o = o.toJSON();
  // console.log('got keys', Object.keys(o));
  const k = Object.keys(o)[0];
  const v = o[k];
  v.type = k;
  v.fileID = fileID;
  return v;
});

const fileMap = {};
const files = [
  'Assets/Mesh',
  'Assets/Material',
  'Assets/Texture2D',
].map(dirname => fs.readdirSync(dirname).map(p => path.join(dirname, p)).filter(p => /\.meta$/.test(p)).forEach(p => {
  const s = fs.readFileSync(p, 'utf8');
  const match = s.match(/guid:\s+([a-fA-F0-9]+)/);
  if (!match) {
    throw new Error('no guid in .meta!');
  }
  const id = match[1];
  fileMap[id] = p.replace(/\.meta$/, '');
}));
// console.log('got file map', fileMap);
fs.writeFileSync('file-map.json', JSON.stringify(fileMap, null, 2));





// let files = fs.readdirSync('./Assets/Mesh/');
// files = files.filter(file => /\.asset$/.test(file));

// fs.writeFileSync('temp.json', JSON.stringify(scene, null, 2));

const transformCache = {};
let transformRoots = [];
const _getTransform = c => {
  const {fileID} = c;
  let entry = transformCache[fileID];
  if (!entry) {
    const {m_LocalPosition, m_LocalRotation, m_LocalScale, m_Father} = c;
    
    entry = {
      position: [m_LocalPosition.x, m_LocalPosition.true, m_LocalPosition.z],
      quaternion: [m_LocalRotation.x, m_LocalRotation.true, m_LocalRotation.z, m_LocalRotation.w],
      scale: [m_LocalScale.x, m_LocalScale.true, m_LocalScale.z],
      children: [],
    };
    transformCache[fileID] = entry;
    
    const fatherFileID = m_Father && m_Father.fileID;
    if (fatherFileID) {
      _getTransform(scene.find(o => o.fileID === fatherFileID));
      const father = transformCache[fatherFileID];
      father.children.push(entry);
    } else {
      transformRoots.push(entry);
    }
  }
  return fileID;
};

const meshCache = {};
const _getMesh = guid => {
  let entry = meshCache[guid];
  if (entry === undefined) {
    const meshFilePath = fileMap[guid];
    if (meshFilePath) {
      const o = YAML.parse(fs.readFileSync(meshFilePath, 'utf8'));
      
      // console.log('got mesh', o.Mesh.m_Name);
      
      // input example: A simple Quad

      // field `_typelessdata`
      // mesh = `000080bf000080bf0000000000000000000000000000803f00000000000000000000803f000080bf0000000000000000000000000000803f0000803f00000000000080bf0000803f0000000000000000000000000000803f000000000000803f0000803f0000803f0000000000000000000000000000803f0000803f0000803f`;
      // field `m_IndexBuffer`
      // index = `0000010002000300`;

      // normalize
      const mesh = normalizeString(o.Mesh.m_VertexData._typelessdata);
      /* if (!o.Mesh.m_IndexBuffer.replace) {
        const index = o.Mesh.m_IndexBuffer.toString(8).padStart(24, '0');
        const indices = [];
        for (let ii = 0; ii < index.length / 4; ++ii) {
          indices.push(swap16(parseInt(`0x` + index.substr(ii * 4, 4))));
        };
        console.warn('no index buffer', [o.Mesh.m_IndexBuffer, index], indices);
        throw 'lol';
      } */
      const index = normalizeString(typeof o.Mesh.m_IndexBuffer === 'string' ? o.Mesh.m_IndexBuffer : padTo4(o.Mesh.m_IndexBuffer));
      const channels = o.Mesh.m_VertexData.m_Channels;
      const numVertices = o.Mesh.m_VertexData.m_VertexCount;
      let streams = [];
      for (const channel of channels) {
        const {stream, offset, format, dimension} = channel;
        if (dimension === 0) {
          continue;
        }
        let s = streams.find(s => s.stream === stream);
        if (!s) {
          s = [];
          s.stream = stream;
          streams.push(s);
        }
        s.push({
          stream,
          offset,
          format,
          dimension,
        });
      }
      /* const strides = streams.map(slots => {
        let result = 0;
        for (const slot of slots) {
          result += slot.dimension;
        }
        return result;
      }); */
      // console.log('got streams', streams);

      function padTo4(n) {
        return n.toString(8).padStart(24, '0');
      }

      function normalizeString(str) {
        return str.replace(`\\`, "").replace(`\n`, "").replace(` `, "");
      };

      function hex2float(num) {
        let sign = (num & 0x80000000) ? -1 : 1;
        let exponent = ((num >> 23) & 0xff) - 127;
        let mantissa = 1 + ((num & 0x7fffff) / 0x7fffff);
        return sign * mantissa * Math.pow(2, exponent);
      }
      
      function hex2halffloat(binary) {
          var exponent = (binary & 0x7C00) >> 10,
              fraction = binary & 0x03FF;
          return (binary >> 15 ? -1 : 1) * (
              exponent ?
              (
                  exponent === 0x1F ?
                  fraction ? NaN : Infinity :
                  Math.pow(2, exponent - 15) * (1 + fraction / 0x400)
              ) :
              6.103515625e-5 * (fraction / 0x400)
          );
      }

      function swap16(val) {
        return ((val & 0xFF) << 8) | ((val >> 8) & 0xFF);
      }

      function swap32(val) {
        return (
          ((val << 24) & 0xff000000) |
          ((val << 8) & 0xff0000) |
          ((val >> 8) & 0xff00) |
          ((val >> 24) & 0xff)
        );
      }

      // process `_typelessdata` field
      /* const vertices = [];
      const normals = [];
      const tangents = [];
      const uvs = []; */
      /* const slices = [];
      for (let ii = 0; ii < mesh.length / 8; ++ii) {
        let slice = parseFloat(hex2float(swap32(parseInt(`0x` + mesh.substr(ii * 8, 8)))).toFixed(8));
        slices.push(slice);
      }
      const halfSlices = [];
      for (let ii = 0; ii < mesh.length / 4; ++ii) {
        let slice = parseFloat(hex2halffloat(swap16(parseInt(`0x` + mesh.substr(ii * 4, 4)))).toFixed(8));
        halfSlices.push(slice);
      } */
      let buffers = [];
      for (const stream of streams) {
        const streamBuffer = [];
        for (let i = 0; i < stream.length; i++) {
          streamBuffer.push([]);
        }
        buffers.push(streamBuffer);
      }
      
      /* delete o.Mesh.m_VertexData._typelessdata;
      delete o.Mesh.m_IndexBuffer;
      console.log('got streams', JSON.stringify(o.Mesh.m_VertexData, null, 2)); */
      
      const uint8Array = new Uint8Array(4);
      const uint32Array = new Uint32Array(uint8Array.buffer);
      const uint16Array = new Uint16Array(uint8Array.buffer);
      let f;
      let offset = 0;
      for (let streamIndex = 0; streamIndex < streams.length; streamIndex++) {
        const stream = streams[streamIndex];
        // const stride = strides[streamIndex];
        for (let j = 0; j < numVertices; j++) {
          for (let slotIndex = 0; slotIndex < stream.length; slotIndex++) {
            const slot = stream[slotIndex];
            for (let k = 0; k < slot.dimension; k++) {
              switch (slot.format) {
                case 0: {
                  uint8Array.fill(0);
                  uint8Array.set(Buffer.from(mesh.slice(offset, offset + 8), 'hex'));
                  f = hex2float(uint32Array[0]);
                  buffers[streamIndex][slotIndex].push(f);
                  offset += 8;
                  break;
                }
                case 1: {
                  uint8Array.fill(0);
                  uint8Array.set(Buffer.from(mesh.slice(offset, offset + 4), 'hex'));

                  /* const a = uint8Array[0];
                  uint8Array[0] = uint8Array[1];
                  uint8Array[1] = a; */
                  f = hex2halffloat(uint16Array[0]);
                  buffers[streamIndex][slotIndex].push(f);
                  
                  if (guid === '6dffc0af7a08418e429f496f5d5c123d' && j === 0 && k === 0) {
                    console.log('uvs', [uint8Array[0], uint8Array[1], uint16Array[0], f, mesh.slice(offset, offset + 4), f]);
                  }
                  
                  offset += 4;
                  break;
                }
                default: {
                  throw new Error('unknown format');
                  break;
                }
              }
            }
          }
        }
      }
      // console.log('done', offset, slices.length);
      /* for (let ii = 0; ii < slices.length / 12; ++ii) {
        let offset = ii * 12;
        let v0 = slices[offset + 0];
        let v1 = slices[offset + 1];
        let v2 = slices[offset + 2];
        let n0 = slices[offset + 3];
        let n1 = slices[offset + 4];
        let n2 = slices[offset + 5];
        let u0 = slices[offset + 6];
        let u1 = slices[offset + 7];
        let t0 = slices[offset + 8];
        let t1 = slices[offset + 9];
        let t2 = slices[offset + 10];
        let t3 = slices[offset + 11];
        vertices.push(v0, v1, v2);
        normals.push(n0, n1, n2);
        uvs.push(u0, u1);
        tangents.push(t0, t1, t2, t3);
      }; */

      streams = streams.flat();
      buffers = buffers.flat();
      streams.forEach((stream, i) => {
        stream.buffer = buffers[i];
      });
      const [uvs, vertices, normals, tangents] = streams.sort((a, b) => a.dimension - b.dimension).map(s => s.buffer);
      // console.log('buffers', streams.map(s => s.dimension));

      // process `m_IndexBuffer` field
      const indices = [];
      for (let ii = 0; ii < index.length / 4; ++ii) {
        indices.push(swap16(parseInt(`0x` + index.substr(ii * 4, 4))));
      }
      
      /* if (guid === '6dffc0af7a08418e429f496f5d5c123d') {
        console.log('streams', uvs[0], streams);
        fs.writeFileSync('lol2.json', JSON.stringify(o.Mesh.m_VertexData, null, 2));
        throw 'lol';
      } */

      entry = {
        vertices,
        normals,
        uvs,
        tangents,
        indices,
      };
      meshCache[guid] = entry;
    } else {
      entry = null;
    }
  }
  return entry ? guid : null;
};
const materialCache = {};
const _getMaterial = m => {
  let entry = materialCache[m.guid];
  if (entry === undefined) {
    const matFilePath = fileMap[m.guid];
    const matFile = YAML.parse(fs.readFileSync(matFilePath, 'utf8'));
    // console.log('got material', JSON.stringify(matFile, null, 2));
    const textures = matFile.Material.m_SavedProperties.m_TexEnvs.map(o => {
      const k = Object.keys(o)[0];
      o = o[k];
      const {m_Texture} = o;
      if (m_Texture.guid) {
        const textureFilePath = fileMap[m_Texture.guid];
        if (textureFilePath) {
          return {
            name: k,
            path: textureFilePath.replace(/\\/g, '/'),
          };
        } else {
          return null;
        }
      } else {
        return null;
      }
    }).filter(t => t !== null);
    if (textures.length > 0) {
      entry = {
        name: matFile.Material.m_Name,
        textures,
      };
      materialCache[m.guid] = entry;
    } else {
      entry = null;
    }
  }
  return entry ? m.guid : null;
};
const _collectComponents = o => {
  const result = [];
  const _recurse = o => {
    for (let i = 0; i < o.m_Component.length; i++) {
      const {component} = o.m_Component[i];
      const {fileID} = component;
      if (!result.some(o => o.fileID === fileID)) {
        const component = scene.find(o => o.fileID === fileID);
        result.push(component);
      }

      /* if (component.m_GameObject) {
        const gameObject = scene.find(o => o.fileID === component.m_GameObject.fileID);
        _recurse(gameObject);
      } */
    }
  };
  _recurse(o);
  return result;
};
const _parseComponents = (name, cs) => {
  const result = {
    name,
  };

  for (const c of cs) {
    const {fileID} = c;
    const component = scene.find(o => o.fileID === fileID);
    const {type} = component;
    switch (type) {
      case 'Transform': {
        // console.log('got transform', component);
        // const {m_LocalPosition, m_LocalRotation, m_LocalScale} = component;
        
        // console.log('got transform', component);

        if (result.transform) {
          throw new Error('dupe');
        }
        result.transform = _getTransform(component);
        break;
      }
      case 'MeshRenderer': {
        const {m_Materials} = component;
        // console.log('got materials', JSON.stringify(m_Materials, null, 2));
        const materials = m_Materials.map(m => _getMaterial(m)).filter(m => m !== null);
        /* const gameObject = scene.find(o => o.fileID === component.m_GameObject.fileID);
        const components = gameObject.m_Component.map(c => {
          if (c.component.fileID !== fileID) {
            return _parseComponent(c);
          } else {
            return null;
          }
        }).filter(c => c !== null); */
        if (materials.length > 0) {
          if (result.materials) {
            throw new Error('dupe');
          }
          result.materials = materials;
        }
        break;
      }
      case 'SkinnedMeshRenderer': {
        const {m_Mesh, m_Materials} = component;
        // console.log('got materials', JSON.stringify(m_Materials, null, 2));
        const materials = m_Materials.map(m => _getMaterial(m)).filter(m => m !== null);
        if (materials.length > 0) {
          if (result.materials) {
            throw new Error('dupe');
          }
          result.materials = materials;
        }

        // const meshFilePath = fileMap[m_Mesh.guid];
        // const mesh2 = YAML.parse(fs.readFileSync(meshFilePath, 'utf8'));
        /* console.log('got mat', mesh2.Mesh.m_Name, JSON.stringify(m_Materials.map(m => {
          const matFilePath = fileMap[m.guid];
          const matFile = YAML.parse(fs.readFileSync(matFilePath, 'utf8'));
          return matFile;
        }), null, 2), JSON.stringify(materials, null, 2)); */
        // m_Mesh.fileID
        /* m_Mesh: {
          fileID: 4300000,
          guid: 'f496d0e3752a95b3443d084ce449ae6f',
          type: 2
        } */
        /* m_Materials: [
          {
            fileID: 2100000,
            guid: '137d5d2e7d273eb2471a663eaec44006',
            type: 2
          }
        ] */
        const mesh = _getMesh(m_Mesh.guid);
        if (result.geometry) {
          throw new Error('dupe');
        }
        result.geometry = mesh;
        break;
      }
      case 'MeshFilter': {
        const {m_Mesh, m_Materials} = component;
        const mesh = _getMesh(m_Mesh.guid);
        if (result.geometry) {
          throw new Error('dupe');
        }
        result.geometry = mesh;
        break;
      }
      default: {
        // console.warn('unknown component', type);
        break;
      }
    }
  }
  
  return result;
};

scene = scene.forEach(o => {
  // const name = o.m_Name;
  if (o.type === 'Transform') {
    /* console.log('got components', o.m_Component.map(c => {
      const {fileID} = c.component;
      const component = scene.find(o => o.fileID === fileID);
      // console.log('find file', fileID, component);
      const {type} = component;
      return type;
    })); */

    const gameObjectFileID = o.m_GameObject.fileID;
    const gameObject = scene.find(o => o.fileID === gameObjectFileID);

    const name = gameObject.m_Name;
    const componentSpecs = _collectComponents(gameObject);
    const object = _parseComponents(name, componentSpecs);

    if (object.geometry && object.materials) {
      const transformId = _getTransform(o);
      transformCache[transformId].object = object;
    }
  }
});

console.log('scene output', Object.keys(meshCache));

const _recurse = children => {
  for (const child of children) {
    child.children = _recurse(child.children);
  }
  children = children.filter(t => t.object || t.children.length > 0);
  return children;
};
transformRoots = _recurse(transformRoots);

// const avatars = scene.filter(o => o.name === 'Avator_voxelkei');
fs.writeFileSync('output.json', JSON.stringify({
  transforms: transformRoots,
  // objects: scene,
  geometries: meshCache,
  materials: materialCache,
}, null, 2));

/* console.log("Done!");

// print out
console.log("Vertices:", vertices);
console.log("Normals:", normals);
console.log("UVs:", uvs);
console.log("Indices:", indices); */