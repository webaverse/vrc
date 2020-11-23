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


const _parseMesh = o => {
  // input example: A simple Quad

  // field `_typelessdata`
  // mesh = `000080bf000080bf0000000000000000000000000000803f00000000000000000000803f000080bf0000000000000000000000000000803f0000803f00000000000080bf0000803f0000000000000000000000000000803f000000000000803f0000803f0000803f0000000000000000000000000000803f0000803f0000803f`;
  // field `m_IndexBuffer`
  // index = `0000010002000300`;

  // normalize
  const mesh = normalizeString(o.Mesh.m_VertexData._typelessdata);
  const index = normalizeString(o.Mesh.m_IndexBuffer);
  const channels = o.Mesh.m_VertexData.m_Channels;
  const numVertices = o.Mesh.m_VertexData.m_VertexCount;
  const streams = [];
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

  function normalizeString(str) {
    return str.replace(`\\`, "").replace(`\n`, "").replace(` `, "");
  };

  function hex2float(num) {
    let sign = (num & 0x80000000) ? -1 : 1;
    let exponent = ((num >> 23) & 0xff) - 127;
    let mantissa = 1 + ((num & 0x7fffff) / 0x7fffff);
    return sign * mantissa * Math.pow(2, exponent);
  }

  function swap16(val) {
    return ((val & 0xFF) << 8) | ((val >> 8) & 0xFF);
  };

  function swap32(val) {
    return (
      ((val << 24) & 0xff000000) |
      ((val << 8) & 0xff0000) |
      ((val >> 8) & 0xff00) |
      ((val >> 24) & 0xff)
    );
  };

  // process `_typelessdata` field
  /* const vertices = [];
  const normals = [];
  const tangents = [];
  const uvs = []; */
  const slices = [];
  for (let ii = 0; ii < mesh.length / 8; ++ii) {
    let slice = parseFloat(hex2float(swap32(parseInt(`0x` + mesh.substr(ii * 8, 8)))).toFixed(4));
    slices.push(slice);
  };
  const buffers = [
    [
      [],
      [],
      [],
    ],
    [
      [],
    ],
  ];
  let offset = 0;
  for (let streamIndex = 0; streamIndex < streams.length; streamIndex++) {
    const stream = streams[streamIndex];
    // const stride = strides[streamIndex];
    for (let j = 0; j < numVertices; j++) {
      for (let slotIndex = 0; slotIndex < stream.length; slotIndex++) {
        const slot = stream[slotIndex];
        for (let k = 0; k < slot.dimension; k++) {
          buffers[streamIndex][slotIndex].push(slices[offset++]);
        }
      }
    }
  }
  console.log('done', offset, slices.length);
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

  const [[vertices, normals, tangents], [uvs]] = buffers;

  // process `m_IndexBuffer` field
  const indices = [];
  for (let ii = 0; ii < index.length / 4; ++ii) {
    indices.push(swap16(parseInt(`0x` + index.substr(ii * 4, 4))));
  };

  return {
    vertices,
    normals,
    uvs,
    tangents,
    indices,
  };
};
const _parseComponent = c => {
  const {fileID} = c.component;
  const component = scene.find(o => o.fileID === fileID);
  // console.log('find file', fileID, component);
  const {type} = component;
  switch (type) {
    case 'Transform': {
      // console.log('got transform', component);
      const {m_LocalPosition, m_LocalRotation, m_LocalScale} = component;

      const position = [m_LocalPosition.x, m_LocalPosition.true, m_LocalPosition.z];
      const quaternion = [m_LocalRotation.x, m_LocalRotation.true, m_LocalRotation.z, m_LocalRotation.w];
      const scale = [m_LocalScale.x, m_LocalScale.true, m_LocalScale.z];
      return {
        type: 'transform',
        position,
        quaternion,
        scale,
      };
    }
    case 'MeshRenderer': {
      const gameObject = scene.find(o => o.fileID === component.m_GameObject.fileID);
      const components = gameObject.m_Component.map(c => {
        if (c.component.fileID !== fileID) {
          return _parseComponent(c);
        } else {
          return null;
        }
      }).filter(c => c !== null);
      console.log('got', component, components);
      // throw 'lol';
      return null;
    }
    case 'SkinnedMeshRenderer': {
      const {m_Mesh, m_Materials} = component;
      const meshFilePath = fileMap[m_Mesh.guid];
      const meshFile = YAML.parse(fs.readFileSync(meshFilePath, 'utf8'));
      const mesh = _parseMesh(meshFile);
      const materials = m_Materials.map(mat => {
        const matFilePath = fileMap[mat.guid];
        const matFile = YAML.parse(fs.readFileSync(matFilePath, 'utf8'));
        // console.log('got mat', matFile);
        const textures = matFile.Material.m_SavedProperties.m_TexEnvs.map(o => {
          const k = Object.keys(o);
          o = o[k];
          const {m_Texture} = o;
          if (m_Texture.guid) {
            const textureFilePath = fileMap[m_Texture.guid];
            return textureFilePath;
          } else {
            return null;
          }
        }).filter(mat => mat !== null);
        return textures;
      });
      // console.log('got mat', JSON.stringify(materials, null, 2));
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
      return {
        type: 'mesh',
        geometry: mesh,
        material: materials,
      };
    }
    case 'MeshFilter': {
      const {m_Mesh} = component;
      const meshFilePath = fileMap[m_Mesh.guid];
      const meshFile = YAML.parse(fs.readFileSync(meshFilePath, 'utf8'));
      const mesh = _parseMesh(meshFile);
      console.log('got mesh', mesh);
      return null;
    }
    default: {
      console.warn('unknown component', type);
      if (type === 'MeshFilter') {
        console.warn('got component', component);
      }
      return null;
    }
  }
};

scene = scene.map(o => {
  const name = o.m_Name;
  if (o.type === 'GameObject') {
    /* console.log('got components', o.m_Component.map(c => {
      const {fileID} = c.component;
      const component = scene.find(o => o.fileID === fileID);
      // console.log('find file', fileID, component);
      const {type} = component;
      return type;
    })); */
    
    const components = o.m_Component.map(c => _parseComponent(c)).filter(c => c !== null);

    return {
      name,
      components,
    };
  } else {
    return null;
  }
}).filter(o => o !== null);

const avatar = scene.find(o => o.name === 'Avator_voxelkei');
fs.writeFileSync('output.json', JSON.stringify(avatar, null, 2));

/* console.log("Done!");

// print out
console.log("Vertices:", vertices);
console.log("Normals:", normals);
console.log("UVs:", uvs);
console.log("Indices:", indices); */