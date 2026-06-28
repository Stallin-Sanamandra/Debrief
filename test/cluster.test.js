'use strict';

const assert = require('assert');
const { embed } = require('../src/shared/embed');
const { clusterEmbeddings } = require('../src/shared/cluster');

const SR = 16000;
function voice(f0, seconds, seed) {
  const n = Math.floor(seconds * SR);
  const a = new Float32Array(n);
  let s = seed || 1;
  const r = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff - 0.5; };
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    a[i] = 0.5 * Math.sin(2 * Math.PI * f0 * t) + 0.3 * Math.sin(2 * Math.PI * f0 * 2.4 * t) + 0.2 * Math.sin(2 * Math.PI * f0 * 3.7 * t) + 0.06 * r();
  }
  return a;
}

// Two distinct voices interleaved -> two clusters.
const male = (s) => embed(voice(114, 2, s), SR);
const female = (s) => embed(voice(214, 2, s), SR);
const embs = [male(1), female(2), male(3), female(4), male(5), female(6)];
const { assign, centroids } = clusterEmbeddings(embs, { threshold: 0.8 });
assert.strictEqual(centroids.length, 2, 'male + female -> exactly two clusters');
// the male indices share one cluster, female another, and they differ
const maleCluster = assign[0];
const femaleCluster = assign[1];
assert.notStrictEqual(maleCluster, femaleCluster, 'male and female in different clusters');
assert.ok([0, 2, 4].every((i) => assign[i] === maleCluster), 'all male utterances clustered together');
assert.ok([1, 3, 5].every((i) => assign[i] === femaleCluster), 'all female utterances clustered together');

// A single speaker -> one cluster.
const one = clusterEmbeddings([male(7), male(8), male(9)], { threshold: 0.8 });
assert.strictEqual(one.centroids.length, 1, 'one voice -> one cluster');

// Empty / null embeddings handled.
assert.deepStrictEqual(clusterEmbeddings([], {}).assign, [], 'empty -> empty');
assert.strictEqual(clusterEmbeddings([null], {}).assign[0], -1, 'null embedding -> unassigned');

console.log('cluster.test.js: all assertions passed');
