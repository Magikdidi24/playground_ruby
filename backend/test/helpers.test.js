const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { parseVersions, hasImage, decodeOutput, isLocalHost } = require('../sandbox');
const { resolveInWorkspace } = require('../fileManager');

const ROOT = path.join(__dirname, '..', 'workspace');

test('resolveInWorkspace keeps paths directly under the workspace root', () => {
  assert.equal(resolveInWorkspace('default'), path.join(ROOT, 'default'));
  assert.equal(resolveInWorkspace('default', 'main.rb'), path.join(ROOT, 'default', 'main.rb'));
  assert.equal(resolveInWorkspace('default', 'quoi?.rb'), path.join(ROOT, 'default', 'quoi?.rb'));
  assert.equal(resolveInWorkspace('my-ws_1'), path.join(ROOT, 'my-ws_1'));
  assert.equal(resolveInWorkspace('x'.repeat(64)), path.join(ROOT, 'x'.repeat(64)));
});

test('resolveInWorkspace rejects traversal, nesting and odd workspace ids', () => {
  for (const id of ['', '.', '..', '../..', '../backend', 'a/b', '/etc', '/', 'a b', 'a.b', '.git', 'é', 'x'.repeat(65)]) {
    assert.throws(() => resolveInWorkspace(id), { status: 400 }, `id ${JSON.stringify(id)}`);
  }
  for (const filename of ['', '.', '..', '../x.rb', '../../server.js', 'a/b.rb', '/etc/passwd']) {
    assert.throws(() => resolveInWorkspace('default', filename), { status: 400 }, `filename ${JSON.stringify(filename)}`);
  }
});

test('parseVersions maps version keys to images and ignores blank lines', () => {
  const versions = parseVersions('ruby:3.4.7\r\nruby:3.3.9-alpine\n\n');
  assert.deepEqual({ ...versions }, { '3.4.7': 'ruby:3.4.7', '3.3.9-alpine': 'ruby:3.3.9-alpine' });
});

test('parseVersions does not treat Object.prototype names as versions', () => {
  const versions = parseVersions('ruby:3.4.7');
  for (const name of ['constructor', '__proto__', 'toString', 'undefined']) {
    assert.equal(versions[name], undefined, name);
  }
});

test('hasImage matches Docker and Podman tag formats', () => {
  assert.ok(hasImage([{ RepoTags: ['ruby:3.4.7'] }], 'ruby:3.4.7'));
  assert.ok(hasImage([{ RepoTags: ['docker.io/library/ruby:3.4.7'] }], 'ruby:3.4.7'));
  assert.ok(!hasImage([{ RepoTags: ['ruby:3.4.6'] }, { RepoTags: null }], 'ruby:3.4.7'));
});

test('isLocalHost accepts loopback names only', () => {
  for (const host of ['localhost', 'localhost:3000', '127.0.0.1:5000', '[::1]:5000']) {
    assert.ok(isLocalHost(host), host);
  }
  for (const host of [undefined, '', 'evil.com', 'evil.com:5000', 'localhost.evil.com', '127.0.0.1.nip.io:5000', 'localhost:5000@evil.com']) {
    assert.ok(!isLocalHost(host), String(host));
  }
});

// Docker's multiplexed stream: [stream id, 0, 0, 0, size (uint32 BE)] + payload.
function frame(stream, payload) {
  const body = Buffer.from(payload);
  const header = Buffer.alloc(8);
  header[0] = stream;
  header.writeUInt32BE(body.length, 4);
  return Buffer.concat([header, body]);
}

test('decodeOutput strips every frame header and keeps stderr in order', () => {
  const buffer = Buffer.concat([frame(1, '1\n'), frame(2, 'oops\n'), frame(1, '2\n')]);
  assert.equal(decodeOutput(buffer), '1\noops\n2\n');
});

test('decodeOutput keeps NUL bytes and large frames intact', () => {
  const big = 'x'.repeat(70000);
  assert.equal(decodeOutput(Buffer.concat([frame(1, 'a\0b'), frame(1, big)])), `a\0b${big}`);
});

test('decodeOutput joins a UTF-8 character split across frames', () => {
  const e = Buffer.from('é');
  const buffer = Buffer.concat([frame(1, e.subarray(0, 1)), frame(1, e.subarray(1))]);
  assert.equal(decodeOutput(buffer), 'é');
});

test('decodeOutput keeps what it has of a truncated last frame', () => {
  const buffer = Buffer.concat([frame(1, 'ok\n'), frame(1, 'cut here')]).subarray(0, -4);
  assert.equal(decodeOutput(buffer), 'ok\ncut ');
  assert.equal(decodeOutput(Buffer.alloc(0)), '');
  assert.equal(decodeOutput(Buffer.alloc(5)), '');
});
