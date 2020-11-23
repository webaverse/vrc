const fs = require('fs');
const YAML = require('yaml');

const b = fs.readFileSync('./Assets/Mesh/Avator_voxelkei.asset');
const o = YAML.parse(b.toString('utf8'));
// fs.writeFileSync('lol.json', JSON.stringify(o));
// console.log('got o', Object.keys());

let files = fs.readdirSync('./Assets/Mesh/');
files = files.filter(file => /\.asset$/.test(file));
console.log('got file', files);






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
console.log('got streams', streams);

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

fs.writeFileSync('output.json', JSON.stringify({
  vertices,
  normals,
  uvs,
  tangents,
  indices,
}, null, 2));

/* console.log("Done!");

// print out
console.log("Vertices:", vertices);
console.log("Normals:", normals);
console.log("UVs:", uvs);
console.log("Indices:", indices); */